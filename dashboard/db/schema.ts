import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const teamStates = sqliteTable('team_states', {
  userId: text('user_id').notNull(),
  team: text('team').notNull(),
  draftJson: text('draft_json').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.team] })]);

export const teamSettings = sqliteTable('team_settings', {
  userId: text('user_id').notNull(),
  team: text('team').notNull(),
  leagueId: text('league_id').notNull().default(''),
  yahooTeamKey: text('yahoo_team_key').notNull().default(''),
  lineupReview: integer('lineup_review', { mode: 'boolean' }).notNull().default(true),
  waiverWatch: integer('waiver_watch', { mode: 'boolean' }).notNull().default(true),
  weeklyReport: integer('weekly_report', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.team] })]);

export const leagueProfiles = sqliteTable('league_profiles', {
  userId: text('user_id').notNull(),
  team: text('team').notNull(),
  profileJson: text('profile_json').notNull(),
  source: text('source').notNull().default('manual'),
  updatedAt: text('updated_at').notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.team] })]);

export const bridgeStates = sqliteTable('bridge_states', {
  userId: text('user_id').notNull(),
  team: text('team').notNull(),
  rosterJson: text('roster_json').notNull().default('[]'),
  waiverJson: text('waiver_json').notNull().default('[]'),
  updatedAt: text('updated_at').notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.team] })]);

export const yahooTokens = sqliteTable('yahoo_tokens', {
  userId: text('user_id').primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const oauthStates = sqliteTable('oauth_states', {
  state: text('state').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [index('idx_oauth_states_expires').on(table.expiresAt)]);

export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  team: text('team').notNull(),
  action: text('action').notNull(),
  detailsJson: text('details_json').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_audit_events_user_created').on(table.userId, table.createdAt)]);
