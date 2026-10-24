CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name` ON `categories` (`name`);--> statement-breakpoint
ALTER TABLE `products` ADD `category_id` text REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `products` ADD `image_source` text DEFAULT '' NOT NULL;