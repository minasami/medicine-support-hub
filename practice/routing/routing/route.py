"""Assign a synthetic programme pharmacy. Practice only."""

from typing import Any


def route_order(order: dict[str, Any], partners: list[dict[str, Any]]) -> dict[str, Any]:
    reason_parts: list[str] = []
    governorate = (order.get("governorate") or "").strip()
    sku = (order.get("sku") or "").strip()
    form = (order.get("form") or "oral").strip()
    pin = (order.get("pin_partner_id") or "").strip()
    address_ok = bool(order.get("address_ok"))

    if not governorate or not sku or not address_ok:
        return {
            "order_id": order.get("id"),
            "decision": "query",
            "partner_id": None,
            "reason": "Incomplete ship-to or product. Do not send.",
        }

    eligible = []
    for p in partners:
        if sku not in p.get("skus", []):
            continue
        if governorate not in p.get("governorates", []):
            continue
        if form not in p.get("forms", []):
            continue
        if not p.get("active", True):
            continue
        eligible.append(p)

    if pin:
        pinned = next((p for p in eligible if p["id"] == pin), None)
        if pinned:
            return {
                "order_id": order.get("id"),
                "decision": "assign",
                "partner_id": pinned["id"],
                "reason": f"Programme pin {pin} can ship {sku} to {governorate}.",
            }
        reason_parts.append(f"Pin {pin} cannot fill this order.")

    if not eligible:
        return {
            "order_id": order.get("id"),
            "decision": "decline",
            "partner_id": None,
            "reason": " ".join(reason_parts + [f"No licensed partner stocks {sku} ({form}) for {governorate}."]),
        }

    chosen = sorted(eligible, key=lambda p: p.get("tat_days", 99))[0]
    return {
        "order_id": order.get("id"),
        "decision": "assign",
        "partner_id": chosen["id"],
        "reason": f"Assign {chosen['id']}: stock, governorate, and form match. TAT {chosen.get('tat_days')}d.",
    }
