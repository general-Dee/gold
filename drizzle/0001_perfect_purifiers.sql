CREATE TABLE `checklist_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`completion_date` text NOT NULL,
	`completed_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `checklist_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checklist_completions_item_date_idx` ON `checklist_completions` (`item_id`,`completion_date`);--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
