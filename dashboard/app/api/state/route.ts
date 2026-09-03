import { ensureSchema, getD1 } from '@/db';
import { DraftState, newDraftState } from '@/app/lib/draft';
import { unauthorized, userFromRequest } from '@/app/lib/server-auth';

export const dynamic = 'force-dynamic';
const teams = ['family', 'friends'] as const;

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  await ensureSchema();

  const result = await getD1().prepare(
    'SELECT team, draft_json, updated_at FROM team_states WHERE user_id = ? ORDER BY team',
  ).bind(user.userId).all<{ team: string; draft_json: string; updated_at: string }>();

  const drafts: Record<string, DraftState> = { family: newDraftState(), friends: newDraftState() };
  let updatedAt: string | null = null;
  for (const row of result.results) {
    if (!teams.includes(row.team as (typeof teams)[number])) continue;
    try {
      const parsed = JSON.parse(row.draft_json);
      if (isDraftState(parsed)) drafts[row.team] = parsed;
      if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
    } catch { /* Ignore corrupted rows and retain a safe empty board. */ }
  }

  return Response.json({ drafts, updatedAt, user: { email: user.email, displayName: user.displayName } });
}

export async function PUT(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  const payload = await request.json().catch(() => null) as { team?: string; draft?: unknown } | null;
  if (!payload || !teams.includes(payload.team as (typeof teams)[number]) || !isDraftState(payload.draft)) {
    return Response.json({ error: 'Invalid team state.' }, { status: 400 });
  }
  const draftJson = JSON.stringify(payload.draft);
  if (draftJson.length > 150_000) return Response.json({ error: 'Team state is too large.' }, { status: 413 });

  await ensureSchema();
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch([
    db.prepare(`INSERT INTO team_states (user_id, team, draft_json, version, updated_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(user_id, team) DO UPDATE SET
        draft_json = excluded.draft_json,
        version = team_states.version + 1,
        updated_at = excluded.updated_at`).bind(user.userId, payload.team, draftJson, now),
    db.prepare(`INSERT INTO audit_events (user_id, team, action, details_json, created_at)
      VALUES (?, ?, 'draft_state_saved', ?, ?)`).bind(
        user.userId,
        payload.team,
        JSON.stringify({ currentPick: payload.draft.currentPick, rosterSize: payload.draft.roster.length }),
        now,
      ),
  ]);
  return Response.json({ ok: true, updatedAt: now });
}

function isDraftState(value: unknown): value is DraftState {
  if (!value || typeof value !== 'object') return false;
  const state = value as DraftState;
  return Number.isInteger(state.currentPick) && state.currentPick > 0 && state.currentPick <= 500
    && (state.draftSlot === undefined || Number.isInteger(state.draftSlot) && state.draftSlot >= 1 && state.draftSlot <= 32)
    && (state.teamCount === undefined || Number.isInteger(state.teamCount) && state.teamCount >= 2 && state.teamCount <= 32)
    && (state.totalRounds === undefined || Number.isInteger(state.totalRounds) && state.totalRounds >= 1 && state.totalRounds <= 40)
    && Array.isArray(state.roster) && state.roster.every((item) => typeof item === 'string')
    && Array.isArray(state.history) && state.history.every((item) => item && typeof item.playerKey === 'string'
      && Number.isInteger(item.pick) && (item.manager === 'agent' || item.manager === 'league'));
}

