CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`team` text NOT NULL,
	`action` text NOT NULL,
	`details_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_settings` (
	`user_id` text NOT NULL,
	`team` text NOT NULL,
	`league_id` text DEFAULT '' NOT NULL,
	`yahoo_team_key` text DEFAULT '' NOT NULL,
	`lineup_review` integer DEFAULT true NOT NULL,
	`waiver_watch` integer DEFAULT true NOT NULL,
	`weekly_report` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `team`)
);
--> statement-breakpoint
CREATE TABLE `team_states` (
	`user_id` text NOT NULL,
	`team` text NOT NULL,
	`draft_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `team`)
);
--> statement-breakpoint
CREATE TABLE `yahoo_tokens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` text NOT NULL
);
