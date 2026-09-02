import { ensureSchema, getD1 } from '@/db';
import { DEFAULT_PROFILES, LeagueProfile, Team } from '@/app/lib/league';
import { unauthorized, userFromRequest } from '@/app/lib/server-auth';

export const dynamic = 'force-dynamic';
const teams: Team[] = ['family', 'friends'];

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  await ensureSchema();
  const db = getD1();
  const now = new Date().toISOString();
  await db.batch(teams.map((team) => db.prepare(`INSERT INTO league_profiles
    (user_id, team, profile_json, source, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, team) DO UPDATE SET profile_json = excluded.profile_json,
      source = excluded.source, updated_at = excluded.updated_at
    WHERE league_profiles.source = 'default'`)
    .bind(user.userId, team, JSON.stringify(DEFAULT_PROFILES[team]),
      DEFAULT_PROFILES[team].imported ? 'Yahoo settings photos' : 'default', now)));
  const result = await db.prepare('SELECT team, profile_json, source, updated_at FROM league_profiles WHERE user_id = ?')
    .bind(user.userId).all<{ team: string; profile_json: string; source: string; updated_at: string }>();
  const profiles = structuredClone(DEFAULT_PROFILES);
  for (const row of result.results) {
    if (!teams.includes(row.team as Team)) continue;
    try { profiles[row.team as Team] = JSON.parse(row.profile_json) as LeagueProfile; } catch { /* Use the safe built-in profile. */ }
  }
  return Response.json({ profiles });
}

export async function PUT(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  const payload = await request.json().catch(() => null) as { team?: Team; profile?: LeagueProfile; source?: string } | null;
  if (!payload?.team || !teams.includes(payload.team) || !validProfile(payload.profile)) {
    return Response.json({ error: 'Invalid league profile.' }, { status: 400 });
  }
  await ensureSchema();
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO league_profiles (user_id, team, profile_json, source, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, team) DO UPDATE SET profile_json = excluded.profile_json,
    source = excluded.source, updated_at = excluded.updated_at`)
    .bind(user.userId, payload.team, JSON.stringify(payload.profile), (payload.source ?? 'manual').slice(0, 80), now).run();
  return Response.json({ ok: true, profile: payload.profile, updatedAt: now });
}

function validProfile(profile: LeagueProfile | undefined): profile is LeagueProfile {
  return Boolean(profile && typeof profile.leagueName === 'string' && profile.leagueName.length <= 160 &&
    typeof profile.leagueId === 'string' && profile.leagueId.length <= 120 && Array.isArray(profile.roster?.slots) &&
    Array.isArray(profile.scoring?.offense) && Array.isArray(profile.scoring?.kicking) && Array.isArray(profile.scoring?.defense));
}
