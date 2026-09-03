"""Four-gate precert practice engine. Synthetic data only."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

DecisionCode = Literal["approve", "partial", "query", "decline"]
FailedGate = Literal["eligibility", "completeness", "coverage", "necessity", None]


@dataclass(frozen=True)
class Decision:
    code: DecisionCode
    reason: str
    failed_gate: FailedGate
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "reason": self.reason,
            "failed_gate": self.failed_gate,
            "notes": list(self.notes),
        }


REQUIRED_DOCS = {
    "outpatient_consult": ["prescription_or_referral"],
    "lab": ["doctor_order"],
    "imaging": ["doctor_order", "clinical_note"],
    "chronic_refill": ["active_chronic_approval"],
    "day_case": ["doctor_order", "clinical_note", "proposed_date"],
}


def _docs(ticket: dict) -> set[str]:
    return set(ticket.get("documents") or [])


def decide(ticket: dict, member: dict, policy: dict) -> Decision:
    notes: list[str] = []

    if not member.get("active"):
        return Decision("decline", "Member is not active on the requested date — no medical review.", "eligibility")
    if ticket.get("service_date") and member.get("cover_end"):
        if ticket["service_date"] > member["cover_end"]:
            return Decision("decline", "Service date is after cover end — request is out of period.", "eligibility")
    if ticket.get("product_code") and ticket["product_code"] != member.get("product_code"):
        return Decision("decline", "Product on the request does not match the member product.", "eligibility")
    notes.append("eligibility_ok")

    kind = ticket.get("kind") or "outpatient_consult"
    missing = [d for d in REQUIRED_DOCS.get(kind, []) if d not in _docs(ticket)]
    if missing:
        ask = ", ".join(missing)
        return Decision("query", f"File is incomplete. Send: {ask}.", "completeness", notes + [f"missing:{ask}"])
    notes.append("completeness_ok")

    excluded = set(policy.get("exclusions") or [])
    service = ticket.get("service_code") or ""
    if service in excluded:
        return Decision("decline", f"Service {service} is listed as an exclusion on this schedule.", "coverage", notes)
    covered = set(policy.get("covered_services") or [])
    if covered and service and service not in covered:
        return Decision("decline", f"Service {service} is not on this product schedule.", "coverage", notes)
    limit = (policy.get("limits") or {}).get(service)
    units = int(ticket.get("units") or 1)
    if limit is not None and units > int(limit):
        return Decision("partial", f"Covered up to {limit} unit(s) for {service}; requested {units}.", "coverage", notes + ["partial_limit"])
    notes.append("coverage_ok")

    if kind == "imaging" and not ticket.get("indication"):
        return Decision("query", "Imaging request has no clinical indication. Send the indication in one line.", "necessity", notes)
    if kind == "imaging" and ticket.get("repeat_within_days") and int(ticket["repeat_within_days"]) <= 14:
        if not ticket.get("justification_for_repeat"):
            return Decision("query", "Repeat imaging inside 14 days needs a one-line justification.", "necessity", notes + ["repeat_14d"])
    if ticket.get("high_cost") and not ticket.get("first_pass_note"):
        return Decision("query", "High-cost flag set. Write a first-pass note and escalate; do not self-approve the limit.", "necessity", notes + ["high_cost_escalate"])
    notes.append("necessity_ok")

    return Decision("approve", f"Approve {service or kind} for {units} unit(s) under {member.get('product_code', 'product')}.", None, notes)
