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

The first draft implementation is a companion rather than unattended browser automation. It tracks available players, roster construction, positional scarcity, and the draft timer; the agent selects the preferred player, and a human enters the pick in Yahoo.


