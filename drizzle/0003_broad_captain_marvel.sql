CREATE TABLE `trade_setup_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text NOT NULL,
	`setup_tag_id` text NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`setup_tag_id`) REFERENCES `setup_tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_setup_tags_trade_tag_idx` ON `trade_setup_tags` (`trade_id`,`setup_tag_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trades` (
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
	FOREIGN KEY (`mood_before_id`) REFERENCES `mood_tags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mood_after_id`) REFERENCES `mood_tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_trades`("id", "direction", "instrument", "status", "entry_price", "exit_price", "stop_loss", "take_profit", "position_size", "risk_reward_planned", "risk_reward_realized", "outcome", "pnl", "session", "dxy_bias", "news_nearby", "news_note", "mood_before_id", "mood_after_id", "reasoning", "notes_after", "entry_at", "exit_at", "created_at", "updated_at") SELECT "id", "direction", "instrument", "status", "entry_price", "exit_price", "stop_loss", "take_profit", "position_size", "risk_reward_planned", "risk_reward_realized", "outcome", "pnl", "session", "dxy_bias", "news_nearby", "news_note", "mood_before_id", "mood_after_id", "reasoning", "notes_after", "entry_at", "exit_at", "created_at", "updated_at" FROM `trades`;--> statement-breakpoint
DROP TABLE `trades`;--> statement-breakpoint
ALTER TABLE `__new_trades` RENAME TO `trades`;--> statement-breakpoint
PRAGMA foreign_keys=ON;