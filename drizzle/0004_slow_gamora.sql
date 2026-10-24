ALTER TABLE `orders` ADD `order_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_code` ON `orders` (`order_code`);