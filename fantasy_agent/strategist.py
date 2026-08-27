from __future__ import annotations

import json

from openai import OpenAI

from fantasy_agent.models import LeagueState, ManagerAction


SYSTEM_PROMPT = """You are the independent manager of one fantasy football team.
Optimize expected season-long championship probability, not any human manager's preferences.
Respect league rules and return only actions supported by the supplied state.
Never invent player keys, roster slots, injuries, projections, or transactions.
Prefer no action when evidence is weak. Explain the main tradeoff in concise plain language.
"""


class FantasyStrategist:
    def __init__(self, model: str = "gpt-5.6-terra", client: OpenAI | None = None):
        self.client = client or OpenAI()
        self.model = model

    def decide(self, objective: str, state: LeagueState) -> ManagerAction:
        response = self.client.responses.parse(
            model=self.model,
            instructions=SYSTEM_PROMPT,
            input=json.dumps({"objective": objective, "league_state": state.model_dump(mode="json")}),
            text_format=ManagerAction,
            reasoning={"effort": "medium"},
        )
        if response.output_parsed is None:
            raise RuntimeError("The strategist did not return a valid manager action.")
        return response.output_parsed


