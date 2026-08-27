from copy import deepcopy

from fantasy_agent.draft import (
    DraftEngine,
    DraftLeagueSettings,
    DraftPlayer,
    DraftRequest,
    DraftState,
)


def player(
    key: str,
    name: str,
    position: str,
    points: float,
    adp: float,
    tier: int,
    *,
    ceiling: float = 0.7,
    floor: float = 0.7,
    risk: float = 0.3,
    bye: int = 8,
) -> DraftPlayer:
    return DraftPlayer(
        player_key=key,
        name=name,
        positions=[position],
        nfl_team="TST",
        bye_week=bye,
        projected_points=points,
        adp=adp,
        tier=tier,
        ceiling_score=ceiling,
        floor_score=floor,
        risk_score=risk,
    )


def settings(*, superflex: bool = False) -> DraftLeagueSettings:
    roster_slots = {
        "QB": 1,
        "RB": 2,
        "WR": 2,
        "TE": 1,
        "FLEX": 1,
        "K": 1,
        "DEF": 1,
        "BN": 6,
    }
    if superflex:
        roster_slots["SUPERFLEX"] = 1
    return DraftLeagueSettings(
        league_id="test-league",
        team_count=12,
        roster_slots=roster_slots,
        scoring_format="half_ppr",
    )


def state(players: list[DraftPlayer], *, round_number: int = 2) -> DraftState:
    return DraftState(
        team_profile="family",
        current_pick=15,
        round_number=round_number,
        my_next_pick=34,
        available_players=players,
        position_drafted_counts={"QB": 1, "RB": 7, "WR": 5, "TE": 1},
        data_version="test-board",
    )


def test_standard_draft_favors_foundational_skill_position_value():
    players = [
        player("rb1", "Elite Runner", "RB", 255, 10, 1, ceiling=0.9, floor=0.85, risk=0.15),
        player("rb2", "Replacement Runner", "RB", 195, 35, 3),
        player("wr1", "Strong Receiver", "WR", 230, 18, 2),
        player("wr2", "Replacement Receiver", "WR", 190, 40, 3),
        player("qb1", "Good Quarterback", "QB", 330, 40, 2),
        player("qb2", "Replacement Quarterback", "QB", 300, 70, 4),
    ]

    recommendation = DraftEngine().recommend(DraftRequest(settings=settings(), state=state(players)))

    assert recommendation.recommended_pick.player_key == "rb1"
    assert recommendation.recommended_pick.components.value_over_replacement == 75


def test_superflex_materially_increases_quarterback_priority():
    players = [
        player("qb1", "Difference Maker QB", "QB", 380, 12, 1, ceiling=0.9, floor=0.85, risk=0.1),
        player("qb2", "Replacement QB", "QB", 275, 45, 4),
        player("rb1", "Strong Runner", "RB", 250, 13, 1, ceiling=0.82, floor=0.8, risk=0.18),
        player("rb2", "Replacement Runner", "RB", 205, 40, 3),
    ]

    recommendation = DraftEngine().recommend(
        DraftRequest(settings=settings(superflex=True), state=state(players))
    )

    assert recommendation.recommended_pick.player_key == "qb1"
    assert recommendation.recommended_pick.components.format_adjustment == 18


def test_kicker_and_defense_are_excluded_before_final_two_rounds():
    players = [
        player("k1", "Top Kicker", "K", 180, 10, 1),
        player("def1", "Top Defense", "DEF", 190, 10, 1),
        player("wr1", "Available Receiver", "WR", 175, 60, 5),
    ]

    recommendation = DraftEngine().recommend(DraftRequest(settings=settings(), state=state(players)))

    assert recommendation.recommended_pick.player_key == "wr1"
    assert {candidate.player_key for candidate in recommendation.excluded} == {"k1", "def1"}


def test_late_rounds_prefer_meaningful_upside():
    upside_receiver = player(
        "wr-upside", "Upside Receiver", "WR", 150, 150, 8, ceiling=0.98, floor=0.25, risk=0.65
    )
    safe_receiver = player(
        "wr-safe", "Safe Receiver", "WR", 158, 148, 8, ceiling=0.35, floor=0.8, risk=0.15
    )
    draft_state = state([upside_receiver, safe_receiver], round_number=14)
    draft_state.current_pick = 160
    draft_state.my_next_pick = 177
    draft_state.my_roster = [
        player("owned-wr1", "Owned Receiver One", "WR", 220, 20, 2),
        player("owned-wr2", "Owned Receiver Two", "WR", 205, 35, 3),
    ]

    recommendation = DraftEngine().recommend(
        DraftRequest(settings=settings(), state=draft_state)
    )

    assert recommendation.recommended_pick.player_key == "wr-upside"


def test_team_profile_is_preserved_without_mutating_shared_input():
    players = [player("rb1", "Runner", "RB", 200, 25, 2)]
    family_state = state(players)
    friends_state = family_state.model_copy(update={"team_profile": "friends"}, deep=True)
    family_before = deepcopy(family_state.model_dump())

    family_result = DraftEngine().recommend(
        DraftRequest(settings=settings(), state=family_state), limit=1
    )
    friends_result = DraftEngine().recommend(
        DraftRequest(settings=settings(), state=friends_state), limit=1
    )

    assert family_result.team_profile == "family"
    assert friends_result.team_profile == "friends"
    assert family_state.model_dump() == family_before
