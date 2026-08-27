from __future__ import annotations

from xml.etree import ElementTree as ET

import httpx

from fantasy_agent.models import LineupMove


BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2"
YAHOO_NS = "http://fantasysports.yahooapis.com/fantasy/v2/base.rng"


class YahooFantasyClient:
    def __init__(self, access_token: str, transport: httpx.BaseTransport | None = None):
        self._client = httpx.Client(
            base_url=BASE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20,
            transport=transport,
        )

    def get_team(self, team_key: str) -> str:
        response = self._client.get(f"/team/{team_key}")
        response.raise_for_status()
        return response.text

    def get_roster(self, team_key: str, week: int | None = None) -> str:
        suffix = f";week={week}" if week is not None else ""
        response = self._client.get(f"/team/{team_key}/roster{suffix}")
        response.raise_for_status()
        return response.text

    def set_lineup(self, team_key: str, moves: list[LineupMove], week: int | None = None) -> str:
        payload = build_lineup_xml(moves, week)
        response = self._client.put(
            f"/team/{team_key}/roster",
            content=payload,
            headers={"Content-Type": "application/xml"},
        )
        response.raise_for_status()
        return response.text


def build_lineup_xml(moves: list[LineupMove], week: int | None = None) -> bytes:
    root = ET.Element("fantasy_content", {"xmlns": YAHOO_NS})
    roster = ET.SubElement(root, "roster")
    if week is not None:
        ET.SubElement(roster, "coverage_type").text = "week"
        ET.SubElement(roster, "week").text = str(week)
    players = ET.SubElement(roster, "players")
    for move in moves:
        player = ET.SubElement(players, "player")
        ET.SubElement(player, "player_key").text = move.player_key
        ET.SubElement(player, "selected_position").text = move.selected_position
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


