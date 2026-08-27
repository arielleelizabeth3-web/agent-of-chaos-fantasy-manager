CREATE INDEX `idx_audit_events_user_created` ON `audit_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_states_expires` ON `oauth_states` (`expires_at`);