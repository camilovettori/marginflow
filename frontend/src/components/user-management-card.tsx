"use client"

import { useEffect, useMemo, useState } from "react"
import {
  createTenantMember,
  getMe,
  getTenantMembers,
  removeTenantMember,
  updateTenantMemberRole,
  type MeResponse,
  type TenantMember,
} from "@/services/api"
import { KeyRound, Lock, Plus, Trash2, Users } from "lucide-react"

type UserManagementCardProps = {
  tenantId: string
}

const CREATION_ROLES = ["viewer", "staff", "admin"] as const
const EDITABLE_ROLES = ["viewer", "staff", "admin", "owner"] as const

const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  staff: 2,
  viewer: 3,
}

function roleBadgeClass(role: string) {
  switch (role) {
    case "owner":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "admin":
      return "border-sky-200 bg-sky-50 text-sky-700"
    case "staff":
      return "border-violet-200 bg-violet-50 text-violet-700"
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600"
  }
}

export default function UserManagementCard({
  tenantId,
}: UserManagementCardProps) {
  const [members, setMembers] = useState<TenantMember[]>([])
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<(typeof CREATION_ROLES)[number]>("viewer")
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  async function loadMembers() {
    try {
      setLoading(true)
      setError(null)

      const [membersData, meData] = await Promise.all([
        getTenantMembers(tenantId),
        getMe(),
      ])

      setMembers(membersData)
      setMe(meData)
    } catch (err) {
      console.error("Load tenant members error:", err)
      setError(err instanceof Error ? err.message : "Failed to load members.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!tenantId) return
    loadMembers()
  }, [tenantId])

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const byRole = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
      if (byRole !== 0) return byRole

      const nameA = (a.full_name || a.email || "").toLowerCase()
      const nameB = (b.full_name || b.email || "").toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [members])

  async function handleAddMember() {
    try {
      setError(null)
      setTemporaryPassword(null)

      if (!email.trim()) {
        throw new Error("Email is required.")
      }

      setSubmitting(true)

      const created = await createTenantMember(tenantId, {
        email: email.trim(),
        full_name: fullName.trim() || null,
        role,
      })

      setEmail("")
      setFullName("")
      setRole("viewer")
      setTemporaryPassword(created.temporary_password)

      await loadMembers()
    } catch (err) {
      console.error("Create tenant member error:", err)
      setError(err instanceof Error ? err.message : "Failed to add member.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(userId: string, nextRole: string) {
    try {
      setError(null)
      setBusyUserId(userId)

      await updateTenantMemberRole(tenantId, userId, { role: nextRole })
      await loadMembers()
    } catch (err) {
      console.error("Update member role error:", err)
      setError(err instanceof Error ? err.message : "Failed to update member role.")
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleRemoveMember(userId: string, memberLabel: string) {
    const confirmed = window.confirm(
      `Remove ${memberLabel} from this workspace? This action can be reversed only by adding them again.`
    )

    if (!confirmed) return

    try {
      setError(null)
      setBusyUserId(userId)

      await removeTenantMember(tenantId, userId)
      await loadMembers()
    } catch (err) {
      console.error("Remove member error:", err)
      setError(err instanceof Error ? err.message : "Failed to remove member.")
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="mt-8 rounded-[28px] border border-zinc-200 bg-white/95 shadow-sm">
      <div className="border-b border-zinc-100 px-7 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
              User Management
            </h3>
            <p className="mt-1.5 text-sm text-zinc-500">
              Invite team members, assign roles, and control workspace access.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {temporaryPassword && (
          <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-emerald-700">
                <KeyRound size={18} />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-zinc-950">
                  Temporary password generated
                </h4>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Save this password now. For security reasons, it is only shown once.
                </p>
                <div className="mt-4 inline-flex rounded-2xl border border-emerald-200 bg-white px-4 py-3 font-mono text-sm text-zinc-950 shadow-sm">
                  {temporaryPassword}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-5">
          <h4 className="text-lg font-semibold text-zinc-950">Add Member</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Create a new login for this company and assign an access role.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@company.com"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Team member name"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">Role</label>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as (typeof CREATION_ROLES)[number])
                }
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              >
                <option value="viewer">Viewer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleAddMember}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={16} />
              {submitting ? "Adding Member..." : "Add Member"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h4 className="text-lg font-semibold text-zinc-950">Current Members</h4>
          </div>

          {loading ? (
            <div className="px-5 py-6 text-sm text-zinc-500">Loading members...</div>
          ) : sortedMembers.length === 0 ? (
            <div className="px-5 py-6 text-sm text-zinc-500">No members found yet.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {sortedMembers.map((member) => {
                const displayName = member.full_name || "Unnamed user"
                const isBusy = busyUserId === member.user_id
                const isCurrentUser = me?.user_id === member.user_id
                const isOwner = member.role === "owner"
                const disableRoleEdit = isBusy || isOwner || isCurrentUser
                const hideRemove = isOwner || isCurrentUser

                return (
                  <div
                    key={member.user_id}
                    className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-950">{displayName}</p>
                        {isCurrentUser && (
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                            You
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">{member.email}</p>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${roleBadgeClass(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          member.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {member.is_active ? "Active" : "Inactive"}
                      </span>

                      {isOwner ? (
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-500">
                          <Lock size={14} />
                          Owner locked
                        </div>
                      ) : (
                        <select
                          value={member.role}
                          disabled={disableRoleEdit}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                          className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {EDITABLE_ROLES.filter((roleOption) => roleOption !== "owner").map(
                            (roleOption) => (
                              <option key={roleOption} value={roleOption}>
                                {roleOption}
                              </option>
                            )
                          )}
                        </select>
                      )}

                      {!hideRemove ? (
                        <button
                          onClick={() =>
                            handleRemoveMember(member.user_id, member.full_name || member.email)
                          }
                          disabled={isBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={15} />
                          Remove
                        </button>
                      ) : (
                        <div className="inline-flex items-center rounded-2xl border border-transparent px-4 py-2.5 text-sm text-zinc-400">
                          Protected
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}