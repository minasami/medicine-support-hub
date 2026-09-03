"""Print precert or adjudication results."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .adjudicate import adjudicate
from .decide import decide


def _precert(path: str) -> int:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    members = {m["id"]: m for m in payload["members"]}
    policies = {p["id"]: p for p in payload["policies"]}
    print(f"{'id':<8} {'code':<9} gate           reason")
    print("-" * 88)
    for ticket in payload["tickets"]:
        member = members[ticket["member_id"]]
        policy = policies[member["policy_id"]]
        d = decide(ticket, member, policy)
        gate = d.failed_gate or "-"
        print(f"{ticket['id']:<8} {d.code:<9} {gate:<14} {d.reason}")
    return 0


def _claims(path: str) -> int:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    members = {m["id"]: m for m in payload["members"]}
    policies = {p["id"]: p for p in payload["policies"]}
    prior = payload.get("prior_paid") or []
    print(f"{'id':<8} {'code':<8} plan   member reason")
    print("-" * 88)
    for claim in payload["claims"]:
        member = members[claim["member_id"]]
        policy = policies[member["policy_id"]]
        d = adjudicate(claim, member, policy, prior)
        print(f"{claim['id']:<8} {d.code:<8} {d.plan_pay:<6} {d.member_pay:<6} {d.reason}")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[1] in {"claims", "adjudicate"}:
        src = argv[2] if len(argv) > 2 else str(Path(__file__).resolve().parents[1] / "data" / "claims.json")
        return _claims(src)
    src = argv[1] if len(argv) > 1 else str(Path(__file__).resolve().parents[1] / "data" / "tickets.json")
    return _precert(src)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
