import json
from pathlib import Path

import typer

from fantasy_agent.models import LeagueState, ManagerAction
from fantasy_agent.policy import ExecutionPolicy
from fantasy_agent.strategist import FantasyStrategist


app = typer.Typer(help="Run the Gridiron fantasy football manager.")


@app.command()
def decide(state_file: Path, objective: str = "Set the strongest legal lineup") -> None:
    """Ask the manager for a structured decision without changing Yahoo."""
    state = LeagueState.model_validate_json(state_file.read_text(encoding="utf-8"))
    action = FantasyStrategist().decide(objective, state)
    typer.echo(action.model_dump_json(indent=2))


@app.command()
def check_policy(action_file: Path, mode: str = "dry_run") -> None:
    """Show whether a proposed action is currently permitted to execute."""
    action = ManagerAction.model_validate_json(action_file.read_text(encoding="utf-8"))
    result = ExecutionPolicy(mode=mode).evaluate(action)
    typer.echo(json.dumps({"allowed": result.allowed, "reason": result.reason}, indent=2))


if __name__ == "__main__":
    app()


