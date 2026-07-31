CREATE TABLE `account_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`starting_balance` real DEFAULT 0 NOT NULL,
	`monthly_profit_target_pct` real,
	`max_drawdown_limit_pct` real,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`occurred_at` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
