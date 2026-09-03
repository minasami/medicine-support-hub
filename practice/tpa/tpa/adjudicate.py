"""Post-service adjudication on synthetic claims. Auth is not a cheque."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from .decide import decide

AdjCode = Literal["pay", "partial", "deny", "pend"]


@dataclass(frozen=True)
class Adjudication:
    code: AdjCode
    reason: str
    allowed: int
    plan_pay: int
    member_pay: int
    failed_gate: str | None = None
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "reason": self.reason,
            "allowed": self.allowed,
            "plan_pay": self.plan_pay,
            "member_pay": self.member_pay,
            "failed_gate": self.failed_gate,
            "notes": list(self.notes),
        }


def _money(allowed: int, copay: int) -> tuple[int, int]:
    copay = max(0, min(copay, allowed))
    return allowed - copay, copay


def adjudicate(claim: dict, member: dict, policy: dict, prior_paid: list[dict] | None = None) -> Adjudication:
    prior_paid = prior_paid or []
    billed = int(claim.get("billed") or 0)
    tariff = int(claim.get("tariff") or billed)
    copay = int(policy.get("copay") or 0)
    docs = set(claim.get("documents") or [])

    if claim.get("channel") == "reimbursement" and "original_receipt" not in docs:
        return Adjudication("pend", "Reimbursement pack missing original receipt.", 0, 0, 0, "completeness")

    for prev in prior_paid:
        same = (
            prev.get("member_id") == claim.get("member_id")
            and prev.get("service_date") == claim.get("service_date")
            and prev.get("service_code") == claim.get("service_code")
        )
        if same:
            return Adjudication("deny", "Duplicate of a claim already paid for this date and service.", 0, 0, 0, "integrity")

    ticket = {
        "id": claim.get("id"),
        "member_id": claim.get("member_id"),
        "product_code": claim.get("product_code") or member.get("product_code"),
        "service_date": claim.get("service_date"),
        "kind": claim.get("kind") or "outpatient_consult",
        "service_code": claim.get("service_code"),
        "units": claim.get("units") or 1,
        "documents": claim.get("clinical_documents") or ["prescription_or_referral", "doctor_order", "clinical_note", "proposed_date"],
        "indication": claim.get("indication") or "posted-service",
        "high_cost": claim.get("high_cost"),
        "first_pass_note": claim.get("first_pass_note"),
    }
    pre = decide(ticket, member, policy)
    if pre.code == "decline":
        return Adjudication("deny", pre.reason, 0, 0, 0, pre.failed_gate, list(pre.notes))
    if pre.code == "query" and claim.get("high_cost") and not claim.get("first_pass_note"):
        return Adjudication("pend", pre.reason, 0, 0, 0, pre.failed_gate, list(pre.notes))

    required_auth = bool(claim.get("requires_auth"))
    auth = claim.get("auth") or {}
    if required_auth and not auth.get("id"):
        return Adjudication("deny", "Service required precertification and no authorization is on file.", 0, 0, 0, "authorization")

    billed_code = claim.get("service_code")
    auth_code = auth.get("service_code")
    billed_units = int(claim.get("units") or 1)
    auth_units = int(auth.get("units") or billed_units)
    if required_auth and auth_code and billed_code != auth_code:
        return Adjudication("deny", "Invoice code does not match the authorization code.", 0, 0, 0, "authorization")

    allowed = min(billed, tariff)
    if required_auth and billed_units > auth_units:
        unit_price = allowed // max(billed_units, 1)
        allowed = unit_price * auth_units
        plan_pay, member_pay = _money(allowed, copay)
        extra = (billed_units - auth_units) * unit_price
        return Adjudication(
            "partial",
            f"Auth covered {auth_units} unit(s); extra billed unit(s) are member liability ({extra}).",
            allowed,
            plan_pay,
            member_pay + extra,
            "authorization",
        )

    if pre.code == "partial":
        limit = int((policy.get("limits") or {}).get(billed_code) or 1)
        unit_price = allowed // max(billed_units, 1)
        allowed = unit_price * limit
        plan_pay, member_pay = _money(allowed, copay)
        return Adjudication("partial", pre.reason, allowed, plan_pay, member_pay, "coverage", list(pre.notes))

    plan_pay, member_pay = _money(allowed, copay)
    return Adjudication(
        "pay",
        f"Pay network/tariff allowed {allowed}; copay {member_pay}.",
        allowed,
        plan_pay,
        member_pay,
        None,
        list(pre.notes),
    )
