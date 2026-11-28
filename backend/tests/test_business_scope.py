"""Self / Team / Combined business rules. Pure logic, no database."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.business_scope import credited_to, metrics, pick, split, walk_team

ADMIN, MGR_A, TL_A1, EMP1, EMP2, EMP3, MGR_B, P1, P2, P1_SUB, OUTSIDER = (uuid4() for _ in range(11))
TREE = {
    ADMIN: [MGR_A, MGR_B],
    MGR_A: [TL_A1, EMP3],
    TL_A1: [EMP1, EMP2],
    MGR_B: [P1, P2],
    P1: [P1_SUB],
}


def children(parents):
    return [kid for parent in parents for kid in TREE.get(parent, [])]


def case(owner, stage="submitted", partner=None, amount=100000, collected=0, counted=False, flag="", loan="PL"):
    return SimpleNamespace(
        id=uuid4(), owner_user_id=owner, partner_user_id=partner, stage=stage, flag=flag,
        counted=counted, collected_amount=collected, loan_amount=amount, loan_type=loan,
    )


def money(row):
    return {"base_amount": row.loan_amount, "net_revenue": row.loan_amount * 0.01, "payable_amount": row.loan_amount * 0.009}


def test_manager_sees_direct_and_indirect_only():
    team = walk_team(MGR_A, children)
    assert team == {TL_A1, EMP1, EMP2, EMP3}
    assert MGR_B not in team and P1 not in team


def test_team_leader_sees_own_team():
    assert walk_team(TL_A1, children) == {EMP1, EMP2}


def test_employee_without_reports_has_no_team():
    assert walk_team(EMP1, children) == set()


def test_partner_team_only_through_real_links():
    assert walk_team(P1, children) == {P1_SUB}
    assert walk_team(P2, children) == set()


def test_cycle_does_not_loop():
    loop = {EMP1: [EMP2], EMP2: [EMP1]}
    assert walk_team(EMP1, lambda ps: [k for p in ps for k in loop.get(p, [])]) == {EMP2}


def test_partner_field_wins_attribution():
    row = case(EMP1, partner=P1)
    assert credited_to(row) == P1


ROWS = [
    case(MGR_A, "disbursed", amount=500000),
    case(EMP1, "sanctioned"),
    case(EMP3, "collected", amount=200000, collected=2000, counted=True),
    case(OUTSIDER, "disbursed"),
    case(MGR_B, "submitted", partner=P1),
]


def test_self_team_combined_no_duplicates():
    team = walk_team(MGR_A, children)
    mine = pick(ROWS, MGR_A, team, False, "self")
    theirs = pick(ROWS, MGR_A, team, False, "team")
    both = pick(ROWS, MGR_A, team, False, "combined")
    assert len(mine) == 1 and len(theirs) == 2
    assert {r.id for r in both} == {r.id for r in mine} | {r.id for r in theirs}
    assert not {r.id for r in mine} & {r.id for r in theirs}


def test_outsider_and_other_team_never_leak():
    team = walk_team(MGR_A, children)
    ids = {r.id for r in pick(ROWS, MGR_A, team, False, "combined")}
    assert ROWS[3].id not in ids and ROWS[4].id not in ids


def test_admin_sees_organisation():
    team = walk_team(ADMIN, children)
    assert len(pick(ROWS, ADMIN, team, True, "team")) == len(ROWS)


def test_member_filter_inside_team():
    team = walk_team(MGR_A, children)
    assert [r.owner_user_id for r in pick(ROWS, MGR_A, team, False, "team", EMP3)] == [EMP3]


def test_member_filter_outside_team_is_refused():
    team = walk_team(MGR_A, children)
    with pytest.raises(PermissionError):
        pick(ROWS, MGR_A, team, False, "team", P1)


def test_partner_cannot_pick_other_partner():
    with pytest.raises(PermissionError):
        pick(ROWS, P2, walk_team(P2, children), False, "self", P1)


def test_empty_team_combined_equals_self():
    mine = pick(ROWS, EMP1, set(), False, "self")
    assert pick(ROWS, EMP1, set(), False, "combined") == mine
    assert pick(ROWS, EMP1, set(), False, "team") == []


def test_unknown_scope_rejected():
    with pytest.raises(ValueError):
        pick(ROWS, EMP1, set(), False, "everything")


def test_metrics_add_up():
    team = walk_team(MGR_A, children)
    mine, theirs = split(ROWS, MGR_A, team, False)
    s, t, c = metrics(mine, money), metrics(theirs, money), metrics(mine + theirs, money)
    for key in ("cases", "submitted", "disbursed", "disbursed_amount", "collected_amount", "revenue", "pending"):
        assert c[key] == pytest.approx(s[key] + t[key])
    assert s["disbursed_amount"] == 500000
    assert t["revenue"] == pytest.approx(2000)
    assert t["pending"] == 1


def test_cancelled_not_counted():
    out = metrics([case(EMP1, "disbursed", flag="cancelled")], money)
    assert out["disbursed"] == 0 and out["cases"] == 1


def test_partner_revenue_uses_payable():
    out = metrics([case(P1, "collected", counted=True)], money, partner=True)
    assert out["revenue"] == pytest.approx(900)
