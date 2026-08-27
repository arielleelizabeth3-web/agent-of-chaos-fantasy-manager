from __future__ import annotations

from collections import Counter
from math import ceil
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


CORE_POSITIONS = ("QB", "RB", "WR", "TE", "K", "DEF")
FLEX_SHARES = {"RB": 0.45, "WR": 0.45, "TE": 0.10}
SUPERFLEX_SHARES = {"QB": 0.70, "RB": 0.12, "WR": 0.12, "TE": 0.06}


def normalize_position(position: str) -> str:
    normalized = position.upper().replace("D/ST", "DEF").replace("DST", "DEF")
    return normalized


class DraftPlayer(BaseModel):
    player_key: str
    name: str
    positions: list[str]
    nfl_team: str | None = None
    bye_week: int | None = Field(default=None, ge=1, le=18)
    projected_points: float = Field(ge=0)
    adp: float | None = Field(default=None, gt=0)
    tier: int = Field(default=1, ge=1)
    floor_score: float = Field(default=0.5, ge=0, le=1)
    ceiling_score: float = Field(default=0.5, ge=0, le=1)
    risk_score: float = Field(default=0.5, ge=0, le=1)

    @field_validator("positions")
    @classmethod
    def normalize_positions(cls, positions: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(normalize_position(position) for position in positions))
        if not cleaned:
            raise ValueError("A draft player must have at least one eligible position.")
        return cleaned


class DraftLeagueSettings(BaseModel):
    league_id: str
    team_count: int = Field(default=12, ge=2, le=32)
    roster_slots: dict[str, int]
    scoring_format: Literal["standard", "half_ppr", "ppr", "custom"] = "half_ppr"
    max_players_by_position: dict[str, int] = Field(default_factory=dict)

    @field_validator("roster_slots", "max_players_by_position")
    @classmethod
    def normalize_position_map(cls, values: dict[str, int]) -> dict[str, int]:
        normalized = {normalize_position(key): value for key, value in values.items()}
        if any(value < 0 for value in normalized.values()):
            raise ValueError("Roster counts cannot be negative.")
        return normalized

    @model_validator(mode="after")
    def require_draftable_roster(self) -> "DraftLeagueSettings":
        if sum(self.roster_slots.values()) == 0:
            raise ValueError("At least one roster slot is required.")
        return self

    @property
    def total_rounds(self) -> int:
        return sum(self.roster_slots.values())


class DraftState(BaseModel):
    team_profile: Literal["family", "friends"]
    current_pick: int = Field(ge=1)
    round_number: int = Field(ge=1)
    my_next_pick: int | None = Field(default=None, ge=2)
    my_roster: list[DraftPlayer] = Field(default_factory=list)
    available_players: list[DraftPlayer]
    position_drafted_counts: dict[str, int] = Field(default_factory=dict)
    data_version: str | None = None

    @field_validator("position_drafted_counts")
    @classmethod
    def normalize_drafted_counts(cls, values: dict[str, int]) -> dict[str, int]:
        return {normalize_position(key): max(0, value) for key, value in values.items()}

    @model_validator(mode="after")
    def validate_board(self) -> "DraftState":
        roster_keys = {player.player_key for player in self.my_roster}
        available_keys = [player.player_key for player in self.available_players]
        if len(available_keys) != len(set(available_keys)):
            raise ValueError("Available player keys must be unique.")
        if roster_keys.intersection(available_keys):
            raise ValueError("A rostered player cannot also be available.")
        return self


class ScoreComponents(BaseModel):
    value_over_replacement: float
    roster_need: float
    scarcity: float
    adp_value: float
    unlikely_to_survive: float
    upside: float
    safety: float
    bye_fit: float
    format_adjustment: float = 0


class DraftCandidate(BaseModel):
    rank: int
    player_key: str
    name: str
    position: str
    score: float = Field(ge=0, le=100)
    components: ScoreComponents
    rationale: str


class ExcludedPlayer(BaseModel):
    player_key: str
    name: str
    reason: str


class DraftRecommendation(BaseModel):
    team_profile: Literal["family", "friends"]
    league_id: str
    current_pick: int
    round_number: int
    recommended_pick: DraftCandidate
    alternatives: list[DraftCandidate] = Field(default_factory=list)
    excluded: list[ExcludedPlayer] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    data_version: str | None = None


class DraftRequest(BaseModel):
    settings: DraftLeagueSettings
    state: DraftState


class DraftEngine:
    """Deterministic, auditable draft scoring that can be tested without an LLM."""

    PHASE_WEIGHTS = {
        "foundation": {
            "value_over_replacement": 0.35,
            "roster_need": 0.15,
            "scarcity": 0.13,
            "adp_value": 0.08,
            "unlikely_to_survive": 0.12,
            "upside": 0.09,
            "safety": 0.06,
            "bye_fit": 0.02,
        },
        "construction": {
            "value_over_replacement": 0.27,
            "roster_need": 0.20,
            "scarcity": 0.12,
            "adp_value": 0.10,
            "unlikely_to_survive": 0.12,
            "upside": 0.10,
            "safety": 0.06,
            "bye_fit": 0.03,
        },
        "asymmetry": {
            "value_over_replacement": 0.16,
            "roster_need": 0.18,
            "scarcity": 0.08,
            "adp_value": 0.08,
            "unlikely_to_survive": 0.08,
            "upside": 0.30,
            "safety": 0.06,
            "bye_fit": 0.06,
        },
    }

    def recommend(self, request: DraftRequest, limit: int = 5) -> DraftRecommendation:
        if limit < 1:
            raise ValueError("The recommendation limit must be at least one.")

        settings = request.settings
        state = request.state
        phase = self._phase(settings, state.round_number)
        roster_counts = self._position_counts(state.my_roster)
        eligible, excluded = self._eligible_players(settings, state, roster_counts)
        if not eligible:
            raise ValueError("No eligible players remain on the supplied draft board.")

        raw_vor = {
            player.player_key: self._value_over_replacement(player, eligible, settings, state)
            for player in eligible
        }
        normalized_vor = self._normalize_vor(raw_vor)

        scored: list[DraftCandidate] = []
        for player in eligible:
            position = self._best_position(player, raw_vor[player.player_key], settings, state)
            components = ScoreComponents(
                value_over_replacement=normalized_vor[player.player_key],
                roster_need=self._roster_need(position, settings, roster_counts),
                scarcity=self._scarcity(player, position, eligible),
                adp_value=self._adp_value(player, state.current_pick),
                unlikely_to_survive=self._survival_pressure(player, state),
                upside=player.ceiling_score * 100,
                safety=((1 - player.risk_score) * 0.65 + player.floor_score * 0.35) * 100,
                bye_fit=self._bye_fit(player, position, state.my_roster),
                format_adjustment=self._format_adjustment(
                    player, position, settings, state, roster_counts
                ),
            )
            weighted_score = sum(
                getattr(components, factor) * weight
                for factor, weight in self.PHASE_WEIGHTS[phase].items()
            )
            score = min(100.0, max(0.0, weighted_score + components.format_adjustment))
            scored.append(
                DraftCandidate(
                    rank=0,
                    player_key=player.player_key,
                    name=player.name,
                    position=position,
                    score=round(score, 2),
                    components=components,
                    rationale=self._rationale(player, position, components, phase, state),
                )
            )

        scored.sort(key=lambda candidate: (-candidate.score, candidate.name))
        for rank, candidate in enumerate(scored, start=1):
            candidate.rank = rank

        visible = scored[:limit]
        margin = visible[0].score - (visible[1].score if len(visible) > 1 else 50)
        completeness = self._data_completeness(eligible)
        confidence = min(0.95, max(0.50, 0.58 + margin / 100 + completeness * 0.18))
        return DraftRecommendation(
            team_profile=state.team_profile,
            league_id=settings.league_id,
            current_pick=state.current_pick,
            round_number=state.round_number,
            recommended_pick=visible[0],
            alternatives=visible[1:],
            excluded=excluded,
            confidence=round(confidence, 2),
            data_version=state.data_version,
        )

    def _eligible_players(
        self,
        settings: DraftLeagueSettings,
        state: DraftState,
        roster_counts: Counter[str],
    ) -> tuple[list[DraftPlayer], list[ExcludedPlayer]]:
        eligible: list[DraftPlayer] = []
        excluded: list[ExcludedPlayer] = []
        late_specialists = state.round_number >= max(1, settings.total_rounds - 1)

        for player in state.available_players:
            valid_positions = [position for position in player.positions if position in CORE_POSITIONS]
            if not valid_positions:
                excluded.append(
                    ExcludedPlayer(
                        player_key=player.player_key,
                        name=player.name,
                        reason="No supported fantasy position was supplied.",
                    )
                )
                continue
            if all(settings.roster_slots.get(position, 0) == 0 for position in valid_positions) and not any(
                position in {"RB", "WR", "TE"} and settings.roster_slots.get("FLEX", 0) > 0
                or position in {"QB", "RB", "WR", "TE"}
                and settings.roster_slots.get("SUPERFLEX", 0) > 0
                for position in valid_positions
            ):
                excluded.append(
                    ExcludedPlayer(
                        player_key=player.player_key,
                        name=player.name,
                        reason="The player is not eligible for any configured roster slot.",
                    )
                )
                continue
            if any(position in {"K", "DEF"} for position in valid_positions) and not late_specialists:
                excluded.append(
                    ExcludedPlayer(
                        player_key=player.player_key,
                        name=player.name,
                        reason="Kickers and defenses are reserved for the final two rounds.",
                    )
                )
                continue
            if all(
                roster_counts[position] >= self._position_max(position, settings)
                for position in valid_positions
            ):
                excluded.append(
                    ExcludedPlayer(
                        player_key=player.player_key,
                        name=player.name,
                        reason="The configured roster limit for this position is already filled.",
                    )
                )
                continue
            eligible.append(player)
        return eligible, excluded

    @staticmethod
    def _phase(settings: DraftLeagueSettings, round_number: int) -> str:
        progress = round_number / max(1, settings.total_rounds)
        if progress <= 1 / 3:
            return "foundation"
        if progress <= 2 / 3:
            return "construction"
        return "asymmetry"

    @staticmethod
    def _position_counts(players: list[DraftPlayer]) -> Counter[str]:
        counts: Counter[str] = Counter()
        for player in players:
            primary = next((position for position in player.positions if position in CORE_POSITIONS), None)
            if primary:
                counts[primary] += 1
        return counts

    @staticmethod
    def _starter_share(position: str, settings: DraftLeagueSettings) -> float:
        exact = settings.roster_slots.get(position, 0)
        flex = settings.roster_slots.get("FLEX", 0) * FLEX_SHARES.get(position, 0)
        superflex = settings.roster_slots.get("SUPERFLEX", 0) * SUPERFLEX_SHARES.get(position, 0)
        return exact + flex + superflex

    def _replacement_points(
        self,
        position: str,
        players: list[DraftPlayer],
        settings: DraftLeagueSettings,
        state: DraftState,
    ) -> float:
        position_pool = sorted(
            (player.projected_points for player in players if position in player.positions), reverse=True
        )
        if not position_pool:
            return 0
        total_demand = ceil(self._starter_share(position, settings) * settings.team_count)
        already_drafted = state.position_drafted_counts.get(position, 0)
        outstanding_demand = max(1, total_demand - already_drafted)
        replacement_index = min(len(position_pool) - 1, outstanding_demand - 1)
        return position_pool[replacement_index]

    def _value_over_replacement(
        self,
        player: DraftPlayer,
        players: list[DraftPlayer],
        settings: DraftLeagueSettings,
        state: DraftState,
    ) -> float:
        values = [
            player.projected_points
            - self._replacement_points(position, players, settings, state)
            for position in player.positions
            if position in CORE_POSITIONS
        ]
        return max(values, default=0)

    @staticmethod
    def _normalize_vor(values: dict[str, float]) -> dict[str, float]:
        # An 80-point seasonal advantage is treated as an elite 100 score. Using
        # an absolute scale prevents a tiny gap on a small late-round board from
        # being exaggerated into a 0-versus-100 difference.
        return {
            key: min(100.0, max(0.0, value / 80 * 100))
            for key, value in values.items()
        }

    def _best_position(
        self,
        player: DraftPlayer,
        raw_vor: float,
        settings: DraftLeagueSettings,
        state: DraftState,
    ) -> str:
        positions = [position for position in player.positions if position in CORE_POSITIONS]
        if len(positions) == 1:
            return positions[0]
        replacement_gaps = {
            position: player.projected_points
            - self._replacement_points(position, state.available_players, settings, state)
            for position in positions
        }
        return max(replacement_gaps, key=replacement_gaps.get) if replacement_gaps else positions[0]

    def _position_max(self, position: str, settings: DraftLeagueSettings) -> int:
        if position in settings.max_players_by_position:
            return settings.max_players_by_position[position]
        exact = settings.roster_slots.get(position, 0)
        flex = settings.roster_slots.get("FLEX", 0)
        superflex = settings.roster_slots.get("SUPERFLEX", 0)
        bench = settings.roster_slots.get("BN", 0) + settings.roster_slots.get("BENCH", 0)
        if position == "QB":
            return max(1, exact + superflex + (2 if superflex else 1))
        if position in {"RB", "WR"}:
            return max(1, exact + flex + max(2, ceil(bench * 0.5)))
        if position == "TE":
            return max(1, exact + flex + 1)
        return max(0, exact)

    def _roster_need(
        self, position: str, settings: DraftLeagueSettings, roster_counts: Counter[str]
    ) -> float:
        exact = settings.roster_slots.get(position, 0)
        count = roster_counts[position]
        if count < exact:
            return 95.0
        if position == "QB" and settings.roster_slots.get("SUPERFLEX", 0) and count < exact + 1:
            return 95.0
        if position in {"RB", "WR", "TE"} and settings.roster_slots.get("FLEX", 0):
            flex_candidates = sum(roster_counts[pos] for pos in ("RB", "WR", "TE"))
            flex_starters = sum(settings.roster_slots.get(pos, 0) for pos in ("RB", "WR", "TE"))
            if flex_candidates < flex_starters + settings.roster_slots.get("FLEX", 0):
                return 82.0
        maximum = self._position_max(position, settings)
        if count >= maximum:
            return 0.0
        if count == exact:
            return 55.0
        return 38.0

    @staticmethod
    def _scarcity(player: DraftPlayer, position: str, players: list[DraftPlayer]) -> float:
        same_position = [candidate for candidate in players if position in candidate.positions]
        same_tier = [candidate for candidate in same_position if candidate.tier == player.tier]
        higher_tier_remaining = sum(candidate.tier < player.tier for candidate in same_position)
        if len(same_tier) == 1:
            return 92.0 if higher_tier_remaining <= 2 else 80.0
        if len(same_tier) == 2:
            return 72.0
        if len(same_tier) <= 4:
            return 55.0
        return 38.0

    @staticmethod
    def _adp_value(player: DraftPlayer, current_pick: int) -> float:
        if player.adp is None:
            return 50.0
        return min(100.0, max(0.0, 50 + (current_pick - player.adp) * 3.5))

    @staticmethod
    def _survival_pressure(player: DraftPlayer, state: DraftState) -> float:
        if player.adp is None or state.my_next_pick is None:
            return 50.0
        return min(100.0, max(0.0, 50 + (state.my_next_pick - player.adp) * 3.5))

    @staticmethod
    def _bye_fit(player: DraftPlayer, position: str, roster: list[DraftPlayer]) -> float:
        if player.bye_week is None:
            return 65.0
        conflicts = sum(
            existing.bye_week == player.bye_week and position in existing.positions
            for existing in roster
        )
        return max(25.0, 100.0 - conflicts * 20)

    @staticmethod
    def _format_adjustment(
        player: DraftPlayer,
        position: str,
        settings: DraftLeagueSettings,
        state: DraftState,
        roster_counts: Counter[str],
    ) -> float:
        is_superflex = settings.roster_slots.get("SUPERFLEX", 0) > 0
        progress = state.round_number / max(1, settings.total_rounds)
        adjustment = 0.0
        if position == "QB" and is_superflex and roster_counts["QB"] < 2:
            adjustment += 14.0
        if position == "QB" and not is_superflex and roster_counts["QB"] >= 1 and progress < 0.6:
            adjustment -= 18.0
        if position == "TE" and roster_counts["TE"] >= 1 and progress < 0.6:
            adjustment -= 12.0
        if player.tier == 1 and position in {"QB", "TE"}:
            adjustment += 4.0
        return adjustment

    @staticmethod
    def _rationale(
        player: DraftPlayer,
        position: str,
        components: ScoreComponents,
        phase: str,
        state: DraftState,
    ) -> str:
        labeled = {
            "replacement-level advantage": components.value_over_replacement,
            "roster fit": components.roster_need,
            "positional scarcity": components.scarcity,
            "ADP value": components.adp_value,
            "risk of being gone by the next pick": components.unlikely_to_survive,
            "upside": components.upside,
            "safety": components.safety,
        }
        strongest = sorted(labeled.items(), key=lambda item: item[1], reverse=True)[:3]
        factors = ", ".join(label for label, _ in strongest)
        next_pick = f" before pick {state.my_next_pick}" if state.my_next_pick else ""
        return (
            f"{player.name} is the best {phase}-phase value at {position}, led by {factors}. "
            f"The score accounts for whether a comparable option is likely to remain{next_pick}."
        )

    @staticmethod
    def _data_completeness(players: list[DraftPlayer]) -> float:
        if not players:
            return 0
        complete = sum(
            player.adp is not None and player.bye_week is not None and player.nfl_team is not None
            for player in players
        )
        return complete / len(players)
