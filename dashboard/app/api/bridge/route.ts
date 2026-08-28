import { ensureSchema, getD1 } from '@/db';
import { BridgePlayer, BridgeTeamState, Team } from '@/app/lib/league';
import { unauthorized, userFromRequest } from '@/app/lib/server-auth';

export const dynamic = 'force-dynamic';
const teams: Team[] = ['family', 'friends'];

const empty = (): BridgeTeamState => ({ roster: [], waivers: [] });

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  await ensureSchema();
  const result = await getD1().prepare('SELECT team, roster_json, waiver_json FROM bridge_states WHERE user_id = ?')
    .bind(user.userId).all<{ team: string; roster_json: string; waiver_json: string }>();
  const bridge: Record<Team, BridgeTeamState> = { family: empty(), friends: empty() };
  for (const row of result.results) {
    if (!teams.includes(row.team as Team)) continue;
    try { bridge[row.team as Team] = { roster: JSON.parse(row.roster_json), waivers: JSON.parse(row.waiver_json) }; } catch { /* Keep the safe empty state. */ }
  }
  return Response.json({ bridge });
}

export async function PUT(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  const payload = await request.json().catch(() => null) as { team?: Team; state?: BridgeTeamState } | null;
  if (!payload?.team || !teams.includes(payload.team) || !validPlayers(payload.state?.roster) || !validPlayers(payload.state?.waivers)) {
    return Response.json({ error: 'Invalid bridge workspace.' }, { status: 400 });
  }
  await ensureSchema();
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO bridge_states (user_id, team, roster_json, waiver_json, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, team) DO UPDATE SET roster_json = excluded.roster_json,
    waiver_json = excluded.waiver_json, updated_at = excluded.updated_at`)
    .bind(user.userId, payload.team, JSON.stringify(payload.state.roster), JSON.stringify(payload.state.waivers), now).run();
  return Response.json({ ok: true, updatedAt: now });
}

function validPlayers(players: BridgePlayer[] | undefined): players is BridgePlayer[] {
  return Array.isArray(players) && players.length <= 100 && players.every((player) =>
    typeof player.id === 'string' && player.id.length <= 80 && typeof player.name === 'string' && player.name.length <= 120 &&
    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(player.position) && Number.isFinite(player.projection) && player.projection >= 0 && player.projection <= 100 &&
    ['Active', 'Questionable', 'Out', 'IR'].includes(player.status));
}
