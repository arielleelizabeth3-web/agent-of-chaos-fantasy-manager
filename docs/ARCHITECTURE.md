# Architecture

## Shared intelligence, isolated teams

The application uses one shared decision engine with two independent team profiles. Every run is scoped to one profile before league data reaches the strategist.

```text
Scheduler or draft companion
          |
          v
Select exactly one team profile
          |
          v
Load that league's rules and state
          |
          v
Generate a structured recommendation
          |
          v
Policy check → audit log → human review
```

## Team profile boundary

Each profile owns:

- Yahoo league and team keys
- Scoring and roster rules
- Current roster and player availability
- Waiver priority and FAAB budget
- Recommendation and approval history
- Model conversation state

The profile identifier must be included in every persisted record. Cross-profile reads are rejected unless the operation is an explicitly authorized aggregate health check that contains no private league data.

## Operating modes

- `dry_run`: generate and log recommendations without Yahoo writes.
- `supervised`: require approval before every supported Yahoo write.
- `autonomous`: permit only routine, explicitly bounded actions after testing and authorization.

The project remains in `dry_run` while Yahoo write access is unavailable.

## Draft workflow

The first draft implementation is a deterministic, auditable companion rather than unattended browser automation:

```text
League-specific projections + ADP + player traits
                         |
                         v
Validated draft state and isolated team profile
                         |
                         v
Replacement value + need + scarcity + survival + risk scoring
                         |
                         v
Primary pick + alternatives + exclusions + confidence
```

The engine in `fantasy_agent/draft.py` does not require an LLM or a Yahoo write connection. This makes mock-draft testing repeatable and lets the football logic mature while access remains read-only. The live integration will refresh the available-player list after every selection and pass the selected team profile's state to the engine.

Player projections supplied to the engine must already reflect the league's scoring rules. The engine then adjusts their relative value using the league's roster slots and team count. The input schema requires a data-version label so live recommendations can be traced to a particular projection and news snapshot.

The strategy principles and phase behavior are defined in `docs/STRATEGY_CONSTITUTION.md`.
