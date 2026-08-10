CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`period_start` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reflections_period_start_idx` ON `reflections` (`period`,`period_start`);