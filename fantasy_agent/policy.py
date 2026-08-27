from dataclasses import dataclass

from fantasy_agent.models import ActionKind, ManagerAction


@dataclass(frozen=True)
class ApprovalDecision:
    allowed: bool
    reason: str


class ExecutionPolicy:
    """Hard boundary between football judgment and external side effects."""

    def __init__(self, mode: str = "dry_run", max_faab_without_approval: int = 5):
        if mode not in {"dry_run", "supervised", "autonomous"}:
            raise ValueError("mode must be dry_run, supervised, or autonomous")
        self.mode = mode
        self.max_faab_without_approval = max_faab_without_approval

    def evaluate(self, action: ManagerAction) -> ApprovalDecision:
        if self.mode == "dry_run":
            return ApprovalDecision(False, "Dry-run mode never writes to Yahoo.")
        if action.kind == ActionKind.TRADE:
            return ApprovalDecision(False, "Trades always require a human approval step.")
        if self.mode == "supervised":
            return ApprovalDecision(False, "Supervised mode requires approval for every write.")
        if action.kind == ActionKind.WAIVER_CLAIM and (action.faab_bid or 0) > self.max_faab_without_approval:
            return ApprovalDecision(False, "FAAB bid exceeds the autonomous spending limit.")
        return ApprovalDecision(True, "Action is within the configured autonomous policy.")


