CREATE TABLE `bridge_states` (
	`user_id` text NOT NULL,
	`team` text NOT NULL,
	`roster_json` text DEFAULT '[]' NOT NULL,
	`waiver_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `team`)
);
--> statement-breakpoint
CREATE TABLE `league_profiles` (
	`user_id` text NOT NULL,
	`team` text NOT NULL,
	`profile_json` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `team`)
);
