CREATE TABLE `item_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`side` text NOT NULL,
	`image_key` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "item_images_side" CHECK("item_images"."side" IN ('problem', 'answer'))
);
--> statement-breakpoint
CREATE INDEX `item_images_item` ON `item_images` (`item_id`);--> statement-breakpoint
CREATE INDEX `item_images_key` ON `item_images` (`image_key`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`section_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`problem_url` text,
	`problem_text` text,
	`answer_url` text,
	`answer_text` text,
	`side_note` text,
	`stop` integer DEFAULT 1 NOT NULL,
	`due_on` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "items_stop" CHECK("items"."stop" >= 1)
);
--> statement-breakpoint
CREATE INDEX `items_user_due` ON `items` (`user_id`,`due_on`);--> statement-breakpoint
CREATE INDEX `items_section` ON `items` (`section_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`reviewed_on` text NOT NULL,
	`confidence` text NOT NULL,
	`stop_before` integer NOT NULL,
	`stop_after` integer NOT NULL,
	`was_due_on` text NOT NULL,
	`next_due_on` text NOT NULL,
	`manual` integer DEFAULT false NOT NULL,
	`reviewed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reviews_confidence" CHECK("reviews"."confidence" IN ('confident', 'neutral', 'not_at_all'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_item_day` ON `reviews` (`item_id`,`reviewed_on`);--> statement-breakpoint
CREATE INDEX `reviews_user_day` ON `reviews` (`user_id`,`reviewed_on`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`line` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sections_line" CHECK("sections"."line" IN ('m2', 'm3', 'm4'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_user_code` ON `sections` (`user_id`,`code`);--> statement-breakpoint
CREATE INDEX `sections_user_position` ON `sections` (`user_id`,`position`);--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`ladder_days` text DEFAULT '[1,2,3,5,7,14,28]' NOT NULL,
	`next_line` text DEFAULT 'm2' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "settings_next_line" CHECK("settings"."next_line" IN ('m2', 'm3', 'm4'))
);
