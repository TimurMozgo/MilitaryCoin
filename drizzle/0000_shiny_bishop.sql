CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`image` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`customer` text NOT NULL,
	`phone` text NOT NULL,
	`city` text NOT NULL,
	`branch` text NOT NULL,
	`total` integer NOT NULL,
	`deposit` integer NOT NULL,
	`receipt` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewer` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_user_request` ON `orders` (`user_id`,`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_receipt` ON `orders` (`receipt`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`images` text NOT NULL,
	`year` text NOT NULL,
	`denomination` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER reserve_stock BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NEW.quantity <= 0 OR NOT EXISTS (SELECT 1 FROM products WHERE id=NEW.product_id AND active=1 AND stock>=NEW.quantity AND price=NEW.price) THEN RAISE(ABORT,'stock_or_price') END;
 UPDATE products SET stock=stock-NEW.quantity, updated_at=MAX(updated_at+1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE id=NEW.product_id;
END;
--> statement-breakpoint
CREATE TRIGGER release_stock AFTER UPDATE OF status ON orders WHEN OLD.status='pending' AND NEW.status='rejected' BEGIN
 UPDATE products SET stock=stock+COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND product_id=products.id),0), updated_at=MAX(updated_at+1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE id IN (SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE INDEX orders_user_created ON orders(user_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE INDEX media_owner_created ON media(owner,created_at);
