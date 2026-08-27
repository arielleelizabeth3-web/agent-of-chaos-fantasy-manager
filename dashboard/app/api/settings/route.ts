import { ensureSchema, getD1 } from '@/db';
import { unauthorized, userFromRequest } from '@/app/lib/server-auth';

export const dynamic = 'force-dynamic';
const teams = ['family', 'friends'] as const;

type TeamSettings = {
  leagueId: string;
  yahooTeamKey: string;
  lineupReview: boolean;
  waiverWatch: boolean;
  weeklyReport: boolean;
};

const defaults: Record<(typeof teams)[number], TeamSettings> = {
  family: { leagueId: '', yahooTeamKey: '', lineupReview: true, waiverWatch: true, weeklyReport: true },
  friends: { leagueId: '', yahooTeamKey: '', lineupReview: true, waiverWatch: true, weeklyReport: true },
};

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  await ensureSchema();
  const result = await getD1().prepare(`SELECT team, league_id, yahoo_team_key,
    lineup_review, waiver_watch, weekly_report FROM team_settings WHERE user_id = ?`).bind(user.userId)
    .all<{ team: string; league_id: string; yahoo_team_key: string; lineup_review: number; waiver_watch: number; weekly_report: number }>();
  const settings = structuredClone(defaults);
  for (const row of result.results) {
    if (!teams.includes(row.team as (typeof teams)[number])) continue;
    settings[row.team as (typeof teams)[number]] = {
      leagueId: row.league_id,
      yahooTeamKey: row.yahoo_team_key,
      lineupReview: Boolean(row.lineup_review),
      waiverWatch: Boolean(row.waiver_watch),
      weeklyReport: Boolean(row.weekly_report),
    };
  }
  return Response.json({ settings });
}

export async function PUT(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  const payload = await request.json().catch(() => null) as { team?: string; settings?: Partial<TeamSettings> } | null;
  if (!payload || !teams.includes(payload.team as (typeof teams)[number]) || !validSettings(payload.settings)) {
    return Response.json({ error: 'Invalid league settings.' }, { status: 400 });
  }
  await ensureSchema();
  const now = new Date().toISOString();
  const value = { ...defaults[payload.team as (typeof teams)[number]], ...payload.settings };
  await getD1().prepare(`INSERT INTO team_settings
    (user_id, team, league_id, yahoo_team_key, lineup_review, waiver_watch, weekly_report, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, team) DO UPDATE SET league_id = excluded.league_id,
      yahoo_team_key = excluded.yahoo_team_key, lineup_review = excluded.lineup_review,
      waiver_watch = excluded.waiver_watch, weekly_report = excluded.weekly_report, updated_at = excluded.updated_at`)
    .bind(user.userId, payload.team, value.leagueId.trim(), value.yahooTeamKey.trim(), Number(value.lineupReview), Number(value.waiverWatch), Number(value.weeklyReport), now).run();
  return Response.json({ ok: true, settings: value, updatedAt: now });
}

function validSettings(value: Partial<TeamSettings> | undefined): value is Partial<TeamSettings> {
  if (!value || typeof value !== 'object') return false;
  if (value.leagueId !== undefined && (typeof value.leagueId !== 'string' || value.leagueId.length > 120)) return false;
  if (value.yahooTeamKey !== undefined && (typeof value.yahooTeamKey !== 'string' || value.yahooTeamKey.length > 160)) return false;
  return ['lineupReview', 'waiverWatch', 'weeklyReport'].every((key) => {
    const setting = value[key as keyof TeamSettings];
    return setting === undefined || typeof setting === 'boolean';
  });
}
