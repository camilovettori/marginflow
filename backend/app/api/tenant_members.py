from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps_auth import get_current_tenant_id, get_current_user
from app.models.tenant_user import TenantUser
from app.models.user import User
from app.schemas.tenant_member import (
    TenantMemberCreate,
    TenantMemberCreateResponse,
    TenantMemberOut,
)
from app.security import hash_password, generate_temporary_password

router = APIRouter(prefix="/api/tenants", tags=["tenant-members"])


class TenantMemberRoleUpdate(BaseModel):
    role: str


def _get_current_membership(db: Session, tenant_id: UUID, user_id: UUID) -> TenantUser:
    membership = (
        db.query(TenantUser)
        .filter(
            TenantUser.tenant_id == tenant_id,
            TenantUser.user_id == user_id,
            TenantUser.is_active.is_(True),
        )
        .first()
    )

    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this tenant.")

    return membership


def _get_target_membership(db: Session, tenant_id: UUID, user_id: UUID) -> TenantUser:
    membership = (
        db.query(TenantUser)
        .filter(
            TenantUser.tenant_id == tenant_id,
            TenantUser.user_id == user_id,
            TenantUser.is_active.is_(True),
        )
        .first()
    )

    if not membership:
        raise HTTPException(status_code=404, detail="Member not found.")

    return membership


@router.get("/{tenant_id}/members", response_model=list[TenantMemberOut])
def list_tenant_members(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_tenant_id: UUID = Depends(get_current_tenant_id),
):
    if tenant_id != current_tenant_id:
        raise HTTPException(status_code=403, detail="You do not have access to this tenant.")

    _get_current_membership(db, tenant_id, current_user.id)

    memberships = (
        db.query(TenantUser)
        .join(User, User.id == TenantUser.user_id)
        .filter(
            TenantUser.tenant_id == tenant_id,
            TenantUser.is_active.is_(True),
        )
        .order_by(User.full_name.asc(), User.email.asc())
        .all()
    )

    return [
        TenantMemberOut(
            user_id=m.user.id,
            email=m.user.email,
            full_name=m.user.full_name,
            role=m.role,
            is_active=m.is_active,
        )
        for m in memberships
    ]


@router.post("/{tenant_id}/members", response_model=TenantMemberCreateResponse)
def create_tenant_member(
    tenant_id: UUID,
    payload: TenantMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_tenant_id: UUID = Depends(get_current_tenant_id),
):
    if tenant_id != current_tenant_id:
        raise HTTPException(status_code=403, detail="You do not have access to this tenant.")

    current_membership = _get_current_membership(db, tenant_id, current_user.id)

    if current_membership.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can add members.")

    allowed_new_roles = ["admin", "staff", "viewer"]
    if payload.role not in allowed_new_roles:
        raise HTTPException(
            status_code=400,
            detail="New members can only be created as admin, staff, or viewer.",
        )

    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()

    temp_password = None

    if not existing_user:
        temp_password = generate_temporary_password()

        new_user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            password_hash=hash_password(temp_password),
            is_active=True,
        )
        db.add(new_user)
        db.flush()
        user = new_user
    else:
        user = existing_user

    existing_membership = (
        db.query(TenantUser)
        .filter(
            TenantUser.tenant_id == tenant_id,
            TenantUser.user_id == user.id,
        )
        .first()
    )

    if existing_membership:
        raise HTTPException(status_code=400, detail="User already belongs to this tenant.")

    membership = TenantUser(
        tenant_id=tenant_id,
        user_id=user.id,
        role=payload.role,
        is_active=True,
    )

    db.add(membership)
    db.commit()

    return TenantMemberCreateResponse(
        user_id=user.id,
        email=user.email,
        temporary_password=temp_password,
    )


@router.patch("/{tenant_id}/members/{user_id}/role", response_model=TenantMemberOut)
def update_tenant_member_role(
    tenant_id: UUID,
    user_id: UUID,
    payload: TenantMemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_tenant_id: UUID = Depends(get_current_tenant_id),
):
    if tenant_id != current_tenant_id:
        raise HTTPException(status_code=403, detail="You do not have access to this tenant.")

    current_membership = _get_current_membership(db, tenant_id, current_user.id)
    target_membership = _get_target_membership(db, tenant_id, user_id)

    allowed_roles = ["owner", "admin", "staff", "viewer"]
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role.")

    if current_membership.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can update roles.")

    if target_membership.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role.")

    if current_membership.role == "admin":
        if target_membership.role == "owner":
            raise HTTPException(status_code=403, detail="Admin cannot change owner role.")
        if payload.role == "owner":
            raise HTTPException(status_code=403, detail="Admin cannot promote a member to owner.")

    if current_membership.role == "owner" and target_membership.role == "owner":
        raise HTTPException(status_code=400, detail="Use a dedicated owner transfer flow later.")

    target_membership.role = payload.role
    db.commit()
    db.refresh(target_membership)

    return TenantMemberOut(
        user_id=target_membership.user.id,
        email=target_membership.user.email,
        full_name=target_membership.user.full_name,
        role=target_membership.role,
        is_active=target_membership.is_active,
    )


@router.delete("/{tenant_id}/members/{user_id}")
def remove_tenant_member(
    tenant_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_tenant_id: UUID = Depends(get_current_tenant_id),
):
    if tenant_id != current_tenant_id:
        raise HTTPException(status_code=403, detail="You do not have access to this tenant.")

    current_membership = _get_current_membership(db, tenant_id, current_user.id)
    target_membership = _get_target_membership(db, tenant_id, user_id)

    if current_membership.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owner or admin can remove members.")

    if target_membership.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself.")

    if current_membership.role == "admin" and target_membership.role == "owner":
        raise HTTPException(status_code=403, detail="Admin cannot remove owner.")

    db.delete(target_membership)
    db.commit()

    return {"success": True}