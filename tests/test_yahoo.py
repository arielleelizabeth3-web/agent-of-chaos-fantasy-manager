from fantasy_agent.models import LineupMove
from fantasy_agent.yahoo import build_lineup_xml


def test_lineup_xml_contains_week_and_players():
    xml = build_lineup_xml(
        [LineupMove(player_key="461.p.1234", selected_position="QB")], week=1
    ).decode()
    assert "<week>1</week>" in xml
    assert "461.p.1234" in xml
    assert "<selected_position>QB</selected_position>" in xml


