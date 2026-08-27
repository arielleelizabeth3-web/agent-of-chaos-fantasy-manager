from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class ActionKind(StrEnum):
    SET_LINEUP = "set_lineup"
    ADD_DROP = "add_drop"
    WAIVER_CLAIM = "waiver_claim"
    DRAFT_PICK = "draft_pick"
    TRADE = "trade"


class Player(BaseModel):
    player_key: str
    name: str
    positions: list[str] = Field(default_factory=list)
    team: str | None = None
    projected_points: float | None = None
    injury_status: str | None = None


class RosterSlot(BaseModel):
    position: str
    player: Player


class LeagueState(BaseModel):
    team_key: str
    week: int | None = None
    roster: list[RosterSlot] = Field(default_factory=list)
    free_agents: list[Player] = Field(default_factory=list)
    budget_remaining: int | None = None


class LineupMove(BaseModel):
    player_key: str
    selected_position: str


class ManagerAction(BaseModel):
    kind: ActionKind
    rationale: str
    confidence: float = Field(ge=0, le=1)
    lineup: list[LineupMove] = Field(default_factory=list)
    add_player_key: str | None = None
    drop_player_key: str | None = None
    faab_bid: int | None = Field(default=None, ge=0)
    draft_player_key: str | None = None
    status: Literal["proposed", "approved", "executed", "rejected"] = "proposed"


