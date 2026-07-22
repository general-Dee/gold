CREATE TABLE `badge_unlocks` (
	`id` text PRIMARY KEY NOT NULL,
	`badge_key` text NOT NULL,
	`trade_id` text,
	`unlocked_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mood_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'both' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setup_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_images` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text NOT NULL,
	`file_path` text NOT NULL,
	`caption` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trade_rule_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`rule_text_snapshot` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`instrument` text DEFAULT 'XAUUSD' NOT NULL,
	`status` text DEFAULT 'closed' NOT NULL,
	`entry_price` real NOT NULL,
	`exit_price` real,
	`stop_loss` real NOT NULL,
	`take_profit` real,
	`position_size` real NOT NULL,
	`risk_reward_planned` real,
	`risk_reward_realized` real,
	`outcome` text,
	`pnl` real,
	`setup_tag_id` text,
	`session` text NOT NULL,
	`dxy_bias` text,
	`news_nearby` integer DEFAULT false NOT NULL,
	`news_note` text,
	`mood_before_id` text,
	`mood_after_id` text,
	`reasoning` text,
	`notes_after` text,
	`entry_at` text NOT NULL,
	`exit_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`setup_tag_id`) REFERENCES `setup_tags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mood_before_id`) REFERENCES `mood_tags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mood_after_id`) REFERENCES `mood_tags`(`id`) ON UPDATE no action ON DELETE no action
);
