from __future__ import annotations

import io
import re
from typing import Any

# ------------------------------------------------------------
# Amount parsing
# ------------------------------------------------------------

_AMOUNT_STRIP_RE = re.compile(r"[^0-9,.\-]")
_EUROPEAN_NUM_RE = re.compile(r"^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$")


def _parse_amount(text: str) -> float | None:
    cleaned = _AMOUNT_STRIP_RE.sub("", text).strip()
    if not cleaned:
        return None

    if _EUROPEAN_NUM_RE.match(cleaned):
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif cleaned.count(",") == 1 and cleaned.count(".") == 0:
        cleaned = cleaned.replace(",", ".")
    else:
        cleaned = cleaned.replace(",", "")

    try:
        value = float(cleaned)
    except ValueError:
        return None
    return value if value >= 0 else None


# ------------------------------------------------------------
# Date parsing
# ------------------------------------------------------------

_MONTH_MAP = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

_RE_DATE_SLASH = re.compile(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})\b")
_RE_DATE_ISO = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
_RE_DATE_NAMED = re.compile(
    r"\b(\d{1,2})\s+"
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|"
    r"Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|"
    r"Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b",
    re.IGNORECASE,
)


def _parse_date_iso(text: str) -> str | None:
    match = _RE_DATE_ISO.search(text)
    if match:
        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if 2000 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    match = _RE_DATE_NAMED.search(text)
    if match:
        day = int(match.group(1))
        month = _MONTH_MAP.get(match.group(2).lower()[:3], 0)
        year = int(match.group(3))
        if month and 1 <= day <= 31 and 2000 <= year <= 2100:
            return f"{year:04d}-{month:02d}-{day:02d}"

    match = _RE_DATE_SLASH.search(text)
    if match:
        a, b, c = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if c < 100:
            c += 2000
        if 2000 <= c <= 2100:
            if 1 <= a <= 31 and 1 <= b <= 12:
                return f"{c:04d}-{b:02d}-{a:02d}"
            if 1 <= b <= 31 and 1 <= a <= 12:
                return f"{c:04d}-{a:02d}-{b:02d}"

    return None


# ------------------------------------------------------------
# Header extraction
# ------------------------------------------------------------

_RE_INV_LABELED = re.compile(
    r"invoice\s*(?:no|number|num|#|ref)[\.:\s]+([A-Z0-9][A-Z0-9\-\/\s]{1,30})",
    re.IGNORECASE,
)
_RE_INV_PATTERN = re.compile(
    r"\b(INV[-\/\s]?\d{3,}[A-Z0-9\-]*)\b",
    re.IGNORECASE,
)


def _extract_invoice_number(text: str) -> str | None:
    match = _RE_INV_LABELED.search(text)
    if match:
        return match.group(1).strip().split("\n")[0].strip()
    match = _RE_INV_PATTERN.search(text)
    if match:
        return match.group(1).strip()
    return None


_SUPPLIER_STOP_WORDS = re.compile(
    r"\b("
    r"invoice|receipt|statement|purchase\s*order|delivery|page\s*\d+|"
    r"subtotal|total|vat|tax|amount|due|balance|reference|ref|"
    r"bill\s*to|ship\s*to|sold\s*to|invoice\s*number|invoice\s*date|due\s*date"
    r")\b",
    re.IGNORECASE,
)
_SUPPLIER_SUFFIX_RE = re.compile(
    r"\b(ltd|limited|llc|inc|plc|gmbh|sarl|bv|sa|wholesale|foods?|supplies?|"
    r"distributors?|distribution|bakery|meats?|dairy)\b",
    re.IGNORECASE,
)


def _score_supplier_candidate(line: str) -> int:
    candidate = line.strip()
    if not candidate or len(candidate) < 3 or len(candidate) > 80:
        return -1
    if _SUPPLIER_STOP_WORDS.search(candidate):
        return -1
    if re.fullmatch(r"[\d\s\-/.,:]+", candidate):
        return -1
    letters = sum(1 for ch in candidate if ch.isalpha())
    if letters < 2:
        return -1

    score = 0
    if 3 <= len(candidate) <= 60:
        score += 1
    if _SUPPLIER_SUFFIX_RE.search(candidate):
        score += 4
    if re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", candidate):
        score += 1
    if any(token in candidate.lower() for token in ("wholesale", "foods", "supplies", "distribution", "bakery", "dairy")):
        score += 2
    if re.search(r"\d{2,}", candidate):
        score -= 1
    return score


def _extract_supplier_name(text_lines: list[str]) -> str | None:
    # Prefer the strongest business-looking line before any invoice heading.
    heading_idx = None
    for idx, line in enumerate(text_lines[:20]):
        if "invoice" in line.lower() and (
            "supplier" in line.lower()
            or "tax" in line.lower()
            or "number" in line.lower()
            or "date" in line.lower()
        ):
            heading_idx = idx
            break

    candidates = text_lines[: heading_idx if heading_idx is not None else 20]
    best_line = None
    best_score = -1
    for line in candidates:
        score = _score_supplier_candidate(line)
        if score > best_score:
            best_line = line.strip()
            best_score = score

    if best_line and best_score > 0:
        return best_line[:255]

    # Label-based fallback.
    full_text = "\n".join(text_lines[:30])
    labeled = re.search(
        r"(?:^|\n)\s*(?:from|supplier|vendor|sold\s*by|bill\s*(?:from|to))[:\s]+(.+)",
        full_text,
        re.IGNORECASE,
    )
    if labeled:
        candidate = labeled.group(1).strip().split("\n")[0].strip()
        if candidate and _score_supplier_candidate(candidate) > 0:
            return candidate[:255]

    return None


# ------------------------------------------------------------
# Totals and currency
# ------------------------------------------------------------

def _extract_currency(text: str) -> str | None:
    if "€" in text or re.search(r"\bEUR\b", text, re.IGNORECASE):
        return "EUR"
    if "£" in text or re.search(r"\bGBP\b", text, re.IGNORECASE):
        return "GBP"
    if "$" in text or re.search(r"\bUSD\b", text, re.IGNORECASE):
        return "USD"
    return None


def _extract_vat_rate(text: str) -> float | None:
    match = re.search(r"\bVAT\b[^\d]{0,20}(\d{1,2}(?:\.\d+)?)\s*%", text, re.IGNORECASE)
    if match:
        return _parse_amount(match.group(1))
    match = re.search(r"\b(\d{1,2}(?:\.\d+)?)\s*%\s*VAT\b", text, re.IGNORECASE)
    if match:
        return _parse_amount(match.group(1))
    return None


def _extract_totals(text: str, warnings: list[str]) -> tuple[float | None, float | None, float | None]:
    subtotal = None
    vat_total = None
    total_inc_vat = None

    lines = [" ".join(raw_line.split()) for raw_line in text.splitlines()]

    def next_amount_after(start: int) -> float | None:
        for idx in range(start + 1, min(start + 6, len(lines))):
            candidate = lines[idx].strip()
            if not candidate:
                continue
            amount_match = re.search(r"([\u20ac\u00a3$]?\s*[\d][\d,\.]*)\s*$", candidate)
            if not amount_match:
                continue
            amount = _parse_amount(amount_match.group(1))
            if amount is not None:
                return amount
        return None

    for idx, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        lowered = line.lower()
        amount_match = re.search(r"([\u20ac\u00a3$]?\s*[\d][\d,\.]*)\s*$", line)
        amount = _parse_amount(amount_match.group(1)) if amount_match else None

        if subtotal is None and "subtotal" in lowered:
            subtotal = amount if amount is not None else next_amount_after(idx)
            continue

        if vat_total is None and lowered.startswith("vat") and not lowered.startswith(
            ("vat no", "vat number", "vat no.", "vat no:")
        ):
            vat_total = amount if amount is not None else next_amount_after(idx)
            continue

        if total_inc_vat is None and (
            lowered.startswith("total")
            or "grand total" in lowered
            or "amount due" in lowered
            or "amount payable" in lowered
            or "balance due" in lowered
        ):
            total_inc_vat = amount if amount is not None else next_amount_after(idx)
            continue

    if subtotal is None and total_inc_vat is None:
        warnings.append("Could not detect invoice totals")

    return subtotal, vat_total, total_inc_vat


# ------------------------------------------------------------
# Unit and row parsing
# ------------------------------------------------------------

_UNIT_MAP: dict[str, str] = {
    "kilogram": "kg",
    "kilograms": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "gram": "g",
    "grams": "g",
    "litre": "l",
    "litres": "l",
    "liter": "l",
    "liters": "l",
    "millilitre": "ml",
    "millilitres": "ml",
    "milliliter": "ml",
    "milliliters": "ml",
    "piece": "unit",
    "pieces": "unit",
    "each": "unit",
    "ea": "unit",
    "unit": "unit",
    "units": "unit",
    "pack": "pack",
    "packs": "pack",
    "pkt": "pack",
    "bag": "pack",
    "bags": "pack",
    "block": "pack",
    "blocks": "pack",
    "carton": "box",
    "cartons": "box",
    "box": "box",
    "boxes": "box",
    "tray": "pack",
    "trays": "pack",
    "tub": "pack",
    "tubs": "pack",
    "bottle": "unit",
    "bottles": "unit",
    "can": "unit",
    "cans": "unit",
    "jar": "unit",
    "jars": "unit",
    "roll": "unit",
    "rolls": "unit",
    "sheet": "unit",
    "sheets": "unit",
}


def _normalize_unit(raw: str) -> str:
    key = raw.lower().strip("s.,; ")
    return _UNIT_MAP.get(key, key)


_SKIP_WORDS = frozenset(
    "description product item qty quantity unit price amount total subtotal "
    "sub-total vat tax gst delivery shipping discount freight ref sku barcode "
    "code no number line totals line item".split()
)

_TOTAL_KEYWORDS = re.compile(
    r"sub\s*total|sub-total|vat\s*total|total\s*vat|grand\s*total|total\s*amount"
    r"|amount\s*due|balance\s*due|total\s*payable|total\s*inc|total\s*ex",
    re.IGNORECASE,
)

_TABLE_HEADER_RE = re.compile(
    r"item\s*description.*sku.*qty.*unit.*unit\s*price.*line\s*total",
    re.IGNORECASE,
)

_ROW_WITH_SKU_RE = re.compile(
    r"^(?P<description>.+?)\s+(?P<sku>[A-Z0-9][A-Z0-9\-\/]{1,})\s+"
    r"(?P<qty>\d+(?:\.\d+)?)\s+(?P<unit>[A-Za-z]+)\s+"
    r"(?P<unit_price>[€£$]?\s*[\d,\.]+)\s+"
    r"(?P<line_total>[€£$]?\s*[\d,\.]+)\s*$",
    re.IGNORECASE,
)

_ROW_WITHOUT_SKU_RE = re.compile(
    r"^(?P<description>.+?)\s+(?P<qty>\d+(?:\.\d+)?)\s+(?P<unit>[A-Za-z]+)\s+"
    r"(?P<unit_price>[€£$]?\s*[\d,\.]+)\s+"
    r"(?P<line_total>[€£$]?\s*[\d,\.]+)\s*$",
    re.IGNORECASE,
)

_DESC_PACK_RE_LIST: list[re.Pattern[str]] = [
    re.compile(r"^(?P<name>.+?)\s+\((?P<value>\d+(?:\.\d+)?)\)\s*$"),
    re.compile(r"^(?P<name>.+?)\s+(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>kg|g|l|ml)\s*$", re.IGNORECASE),
    re.compile(r"^(?P<name>.+?)\s+(?P<value>\d+(?:\.\d+)?)(?P<unit>kg|g|l|ml)\s*$", re.IGNORECASE),
]


def _strip_pack_size(description: str) -> tuple[str, float | None, str | None]:
    text = " ".join(description.split()).strip()
    for pattern in _DESC_PACK_RE_LIST:
        match = pattern.match(text)
        if not match:
            continue
        name = match.group("name").strip()
        value = _parse_amount(match.group("value"))
        unit = match.groupdict().get("unit")
        if unit:
            unit = _normalize_unit(unit)
        elif "(" in text and text.endswith(")"):
            unit = "unit"
        return name, value, unit
    return text, None, None


def _infer_costing_details(
    quantity_purchased: float,
    purchase_unit: str,
    pack_size_value: float | None,
    pack_size_unit: str | None,
) -> tuple[float, str]:
    qty = float(quantity_purchased or 0)
    p_unit = purchase_unit.lower().strip()

    if pack_size_value is not None:
        size_unit = (pack_size_unit or "").lower().strip()
        if size_unit == "kg":
            return qty * pack_size_value * 1000, "g"
        if size_unit == "g":
            return qty * pack_size_value, "g"
        if size_unit == "l":
            return qty * pack_size_value * 1000, "ml"
        if size_unit == "ml":
            return qty * pack_size_value, "ml"
        if size_unit == "unit":
            return qty * pack_size_value, "unit"

        if p_unit in {"kg", "g"}:
            return qty * pack_size_value * (1000 if p_unit == "kg" else 1), "g"
        if p_unit in {"l", "ml"}:
            return qty * pack_size_value * (1000 if p_unit == "l" else 1), "ml"
        return qty * pack_size_value, "unit"

    if p_unit == "kg":
        return qty * 1000, "g"
    if p_unit == "g":
        return qty, "g"
    if p_unit == "l":
        return qty * 1000, "ml"
    if p_unit == "ml":
        return qty, "ml"
    return qty, "unit"


def _make_item(
    *,
    raw_description: str,
    ingredient_name: str,
    sku: str | None,
    qty: float,
    unit: str,
    unit_price_ex_vat: float | None,
    total_ex_vat: float,
    vat_rate: float | None,
    total_inc_vat: float | None,
    pack_size_value: float | None,
    pack_size_unit: str | None,
) -> dict[str, Any]:
    net_quantity_for_costing, costing_unit = _infer_costing_details(
        qty,
        unit,
        pack_size_value,
        pack_size_unit,
    )

    return {
        "ingredient_name": ingredient_name,
        "supplier_product_name": raw_description,
        "ingredient_sku": sku,
        "quantity_purchased": qty,
        "purchase_unit": unit,
        "pack_size_value": pack_size_value,
        "pack_size_unit": pack_size_unit,
        "net_quantity_for_costing": round(net_quantity_for_costing, 3),
        "costing_unit": costing_unit,
        "unit_price_ex_vat": unit_price_ex_vat,
        "line_total_ex_vat": total_ex_vat,
        "vat_rate": vat_rate,
        "line_total_inc_vat": total_inc_vat,
        "brand": None,
        "category": None,
    }


def _is_row_header(line: str) -> bool:
    normalized = " ".join(line.lower().split())
    return bool(_TABLE_HEADER_RE.search(normalized)) or (
        "item" in normalized and "sku" in normalized and "qty" in normalized and "unit" in normalized
    )


def _find_table_bounds(lines: list[str]) -> tuple[int | None, int | None]:
    start_idx = None
    end_idx = None

    for idx, line in enumerate(lines):
        if "item description" in line.lower():
            start_idx = idx + 1
            break

    if start_idx is None:
        return None, None

    for idx in range(start_idx, len(lines)):
        line = lines[idx].strip()
        if not line:
            continue
        if _TOTAL_KEYWORDS.search(line) and (
            "subtotal" in line.lower()
            or "sub total" in line.lower()
            or "total" in line.lower()
        ):
            end_idx = idx
            break

    return start_idx, end_idx


def _is_sku_line(line: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9][A-Z0-9\-\/]{2,}", line.strip()))


def _is_qty_line(line: str) -> bool:
    return bool(re.fullmatch(r"\d+(?:\.\d+)?", line.strip()))


def _is_unit_line(line: str) -> bool:
    return line.strip().lower() in {
        "kg",
        "g",
        "l",
        "ml",
        "unit",
        "units",
        "pack",
        "packs",
        "bag",
        "bags",
        "block",
        "blocks",
        "carton",
        "cartons",
        "box",
        "boxes",
        "tray",
        "trays",
        "tub",
        "tubs",
        "bottle",
        "bottles",
        "can",
        "cans",
        "jar",
        "jars",
    }


def _is_amount_line(line: str) -> bool:
    stripped = line.strip()
    return bool(re.fullmatch(r"[€£$]?\s*[\d][\d,\.]*", stripped))


def _parse_inline_row(line: str, vat_rate: float | None) -> dict[str, Any] | None:
    if not line:
        return None
    if _is_row_header(line):
        return None
    if _TOTAL_KEYWORDS.search(line):
        return None
    if re.fullmatch(r"[\d\s\-/.,:€£$]+", line):
        return None

    sku = None
    qty = None
    unit = None
    unit_price = None
    line_total = None
    description = None

    if "|" in line:
        parts = [part.strip() for part in line.split("|")]
        parts = [part for part in parts if part]
        if len(parts) >= 5:
            description = parts[0]
            sku = parts[1] if len(parts) > 1 else None
            qty = _parse_amount(parts[2]) if len(parts) > 2 else None
            unit = parts[3] if len(parts) > 3 else None
            unit_price = _parse_amount(parts[4]) if len(parts) > 4 else None
            line_total = _parse_amount(parts[5]) if len(parts) > 5 else None
            if description and qty is not None and unit and line_total is not None:
                pass
            else:
                description = None

    if description is None:
        match = _ROW_WITH_SKU_RE.match(line)
        if match:
            description = match.group("description").strip()
            sku = match.group("sku").strip()
            qty = _parse_amount(match.group("qty"))
            unit = match.group("unit").strip()
            unit_price = _parse_amount(match.group("unit_price"))
            line_total = _parse_amount(match.group("line_total"))
        else:
            match = _ROW_WITHOUT_SKU_RE.match(line)
            if match:
                description = match.group("description").strip()
                qty = _parse_amount(match.group("qty"))
                unit = match.group("unit").strip()
                unit_price = _parse_amount(match.group("unit_price"))
                line_total = _parse_amount(match.group("line_total"))

    if not description or qty is None or line_total is None:
        return None

    clean_name, pack_value, pack_unit = _strip_pack_size(description)
    purchase_unit = _normalize_unit(unit or "unit")
    resolved_vat_rate = vat_rate if vat_rate is not None else 0.0
    total_inc = _parse_amount(f"{line_total * (1 + resolved_vat_rate / 100):.2f}") if resolved_vat_rate else line_total

    return _make_item(
        raw_description=description,
        ingredient_name=clean_name,
        sku=sku,
        qty=float(qty),
        unit=purchase_unit,
        unit_price_ex_vat=unit_price,
        total_ex_vat=float(line_total),
        vat_rate=resolved_vat_rate,
        total_inc_vat=float(total_inc) if total_inc is not None else None,
        pack_size_value=pack_value,
        pack_size_unit=pack_unit,
    )


def _parse_block_row(lines: list[str], index: int, vat_rate: float | None) -> tuple[dict[str, Any] | None, int]:
    if index >= len(lines):
        return None, index + 1

    line = " ".join(lines[index].split())
    if not line or _is_row_header(line) or _TOTAL_KEYWORDS.search(line):
        return None, index + 1

    # Skip repeated header labels if the PDF rendered them vertically.
    if line.lower() in {
        "sku",
        "qty",
        "quantity",
        "unit",
        "unit price (ex vat)",
        "line total (ex vat)",
        "item description",
    }:
        return None, index + 1

    # Preferred layout for this invoice family:
    # description
    # sku
    # qty
    # unit
    # unit price
    # line total
    if index + 5 < len(lines):
        desc = " ".join(lines[index].split())
        sku = " ".join(lines[index + 1].split())
        qty_line = " ".join(lines[index + 2].split())
        unit_line = " ".join(lines[index + 3].split())
        unit_price_line = " ".join(lines[index + 4].split())
        line_total_line = " ".join(lines[index + 5].split())

        if (
            desc
            and _is_sku_line(sku)
            and _is_qty_line(qty_line)
            and _is_unit_line(unit_line)
            and _is_amount_line(unit_price_line)
            and _is_amount_line(line_total_line)
        ):
            qty = _parse_amount(qty_line)
            unit_price = _parse_amount(unit_price_line)
            line_total = _parse_amount(line_total_line)
            if qty is not None and line_total is not None:
                clean_name, pack_value, pack_unit = _strip_pack_size(desc)
                purchase_unit = _normalize_unit(unit_line)
                resolved_vat_rate = vat_rate if vat_rate is not None else 0.0
                total_inc = (
                    _parse_amount(f"{line_total * (1 + resolved_vat_rate / 100):.2f}")
                    if resolved_vat_rate
                    else line_total
                )
                return (
                    _make_item(
                        raw_description=desc,
                        ingredient_name=clean_name,
                        sku=sku,
                        qty=float(qty),
                        unit=purchase_unit,
                        unit_price_ex_vat=unit_price,
                        total_ex_vat=float(line_total),
                        vat_rate=resolved_vat_rate,
                        total_inc_vat=float(total_inc) if total_inc is not None else None,
                        pack_size_value=pack_value,
                        pack_size_unit=pack_unit,
                    ),
                    index + 6,
                )

    parsed = _parse_inline_row(line, vat_rate)
    if parsed:
        return parsed, index + 1
    return None, index + 1


def _extract_line_items(text: str, warnings: list[str]) -> list[dict[str, Any]]:
    lines = [line.strip() for line in text.splitlines()]
    start_idx, end_idx = _find_table_bounds(lines)
    candidate_lines = lines[start_idx:end_idx] if start_idx is not None else lines

    vat_rate = _extract_vat_rate(text)
    items: list[dict[str, Any]] = []

    idx = 0
    while idx < len(candidate_lines):
        parsed, next_idx = _parse_block_row(candidate_lines, idx, vat_rate)
        idx = max(next_idx, idx + 1)
        if parsed:
            items.append(parsed)

    if not items and candidate_lines is not lines:
        # One more pass over the entire document in case the table header was
        # not rendered cleanly but the rows were still flattened into text.
        idx = 0
        while idx < len(lines):
            parsed, next_idx = _parse_block_row(lines, idx, vat_rate)
            idx = max(next_idx, idx + 1)
            if parsed:
                items.append(parsed)

    if not items:
        warnings.append("Could not detect line items from PDF layout — please enter manually")
        return items

    # Fill or normalize missing values with the parsed VAT rate.
    for item in items:
        if item.get("vat_rate") in (None, 0):
            item["vat_rate"] = vat_rate if vat_rate is not None else 0.0
        if item.get("line_total_inc_vat") in (None, 0) and item.get("vat_rate"):
            ex_total = float(item["line_total_ex_vat"] or 0)
            item["line_total_inc_vat"] = round(ex_total * (1 + float(item["vat_rate"]) / 100), 2)
        if item.get("net_quantity_for_costing") in (None, 0):
            item["net_quantity_for_costing"], item["costing_unit"] = _infer_costing_details(
                float(item.get("quantity_purchased") or 0),
                str(item.get("purchase_unit") or "unit"),
                item.get("pack_size_value"),
                item.get("pack_size_unit"),
            )

    # Only emit warnings if the parsed rows still contain ambiguity.
    unit_review = sum(
        1
        for row in items
        if row["purchase_unit"] not in ("kg", "g", "l", "ml", "unit", "pack", "box")
    )
    if unit_review:
        warnings.append(f"{unit_review} line{'s' if unit_review > 1 else ''} need unit review")

    net_missing = sum(1 for row in items if row["net_quantity_for_costing"] in (None, 0))
    if net_missing:
        warnings.append(
            f"Net quantity for costing could not be inferred for {net_missing} line"
            f"{'s' if net_missing > 1 else ''}"
        )

    return items


# ------------------------------------------------------------
# Main entry points
# ------------------------------------------------------------

def _build_extraction_response(raw_text: str) -> dict[str, Any]:
    warnings: list[str] = []
    text_lines = [ln.strip() for ln in raw_text.splitlines()]

    invoice_number = _extract_invoice_number(raw_text)
    if not invoice_number:
        warnings.append("Could not detect invoice number")

    supplier_name = _extract_supplier_name(text_lines)
    if not supplier_name:
        warnings.append("Could not detect supplier name")

    invoice_date: str | None = None
    date_patterns = [
        r"(?:invoice\s*date|date\s*of\s*invoice|date\s*issued)[:\s]+(.{5,40})",
        r"(?:date)[:\s]+(.{5,40})",
    ]
    for pattern in date_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            invoice_date = _parse_date_iso(match.group(1))
            if invoice_date:
                break
    if not invoice_date:
        for line in text_lines[:25]:
            parsed = _parse_date_iso(line)
            if parsed:
                invoice_date = parsed
                break
    if not invoice_date:
        warnings.append("Could not detect invoice date")

    due_date: str | None = None
    match = re.search(
        r"(?:due\s*(?:date)?|payment\s*due|pay\s*by|payment\s*terms?)[:\s]+(.{5,40})",
        raw_text,
        re.IGNORECASE,
    )
    if match:
        due_date = _parse_date_iso(match.group(1))
    if not due_date:
        warnings.append("Could not detect due date")

    currency = _extract_currency(raw_text)
    subtotal_ex_vat, vat_total, total_inc_vat = _extract_totals(raw_text, warnings)
    lines = _extract_line_items(raw_text, warnings)

    if lines:
        parsed_subtotal = round(sum(float(row.get("line_total_ex_vat") or 0) for row in lines), 2)
        if subtotal_ex_vat is None:
            subtotal_ex_vat = parsed_subtotal
        if vat_total is None:
            vat_total = round(max((total_inc_vat or parsed_subtotal) - parsed_subtotal, 0), 2) if total_inc_vat is not None else None
        if total_inc_vat is None and vat_total is not None:
            total_inc_vat = round(parsed_subtotal + float(vat_total), 2)

    if lines and warnings == []:
        # Keep the response clean when the parser succeeds fully.
        warnings = []

    debug_text = raw_text[:4000] if raw_text else None
    return {
        "supplier_name": supplier_name,
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "due_date": due_date,
        "currency": currency,
        "subtotal_ex_vat": subtotal_ex_vat,
        "vat_total": vat_total,
        "total_inc_vat": total_inc_vat,
        "notes": None,
        "vat_included": False,
        "lines": lines,
        "warnings": warnings,
        "extraction_debug": debug_text,
    }


def extract_invoice_from_text(text: str) -> dict[str, Any]:
    """Parse a plain-text invoice representation into structured fields."""
    return _build_extraction_response(text or "")


def extract_invoice_from_pdf(pdf_bytes: bytes) -> dict[str, Any]:
    """
    Extract invoice data from PDF bytes.
    Returns a dict matching PdfExtractResponse shape.
    Does not save anything — caller is responsible for saving.
    """
    try:
        import pypdf  # soft import so startup is not blocked if pypdf is absent
    except ImportError:
        return {
            "warnings": [
                "pypdf is not installed on the server. Please run: pip install pypdf"
            ],
            "lines": [],
            "extraction_debug": None,
        }

    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        raw_text = "\n".join(pages_text)
    except Exception as exc:
        return {
            "warnings": [
                f"Could not read PDF: {exc}. The file may be corrupted or password-protected."
            ],
            "lines": [],
            "extraction_debug": None,
        }

    if not raw_text.strip():
        return {
            "warnings": [
                "PDF appears to be image-based (scanned). Text extraction is not supported in V1 — please enter the invoice manually."
            ],
            "lines": [],
            "extraction_debug": None,
        }

    return extract_invoice_from_text(raw_text)
