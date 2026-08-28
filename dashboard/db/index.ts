import { env } from 'cloudflare:workers';

let initialized: Promise<void> | null = null;

export function getD1(): D1Database {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  return env.DB;
}

export function ensureSchema(): Promise<void> {
  if (!initialized) initialized = initializeSchema();
  return initialized;
}

async function initializeSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS team_states (
      user_id TEXT NOT NULL,
      team TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, team)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS team_settings (
      user_id TEXT NOT NULL,
      team TEXT NOT NULL,
      league_id TEXT NOT NULL DEFAULT '',
      yahoo_team_key TEXT NOT NULL DEFAULT '',
      lineup_review INTEGER NOT NULL DEFAULT 1,
      waiver_watch INTEGER NOT NULL DEFAULT 1,
      weekly_report INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, team)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS league_profiles (
      user_id TEXT NOT NULL,
      team TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, team)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bridge_states (
      user_id TEXT NOT NULL,
      team TEXT NOT NULL,
      roster_json TEXT NOT NULL DEFAULT '[]',
      waiver_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, team)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS yahoo_tokens (
      user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      team TEXT NOT NULL,
      action TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_events_user_created ON audit_events (user_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states (expires_at)'),
  ]);
  await db.prepare('PRAGMA optimize').run();
}
