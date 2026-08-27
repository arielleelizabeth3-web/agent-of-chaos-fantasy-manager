from fantasy_agent.models import ActionKind, ManagerAction
from fantasy_agent.policy import ExecutionPolicy


def action(kind: ActionKind, faab_bid: int | None = None) -> ManagerAction:
    return ManagerAction(kind=kind, rationale="test", confidence=0.8, faab_bid=faab_bid)


def test_dry_run_blocks_all_writes():
    assert not ExecutionPolicy("dry_run").evaluate(action(ActionKind.SET_LINEUP)).allowed


def test_autonomous_lineup_is_allowed():
    assert ExecutionPolicy("autonomous").evaluate(action(ActionKind.SET_LINEUP)).allowed


def test_trade_always_requires_approval():
    assert not ExecutionPolicy("autonomous").evaluate(action(ActionKind.TRADE)).allowed


def test_large_faab_bid_requires_approval():
    assert not ExecutionPolicy("autonomous", max_faab_without_approval=5).evaluate(
        action(ActionKind.WAIVER_CLAIM, faab_bid=6)
    ).allowed


