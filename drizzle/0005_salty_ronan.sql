CREATE TABLE `telegram_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`event` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`lease` text,
	`last_error` text DEFAULT '' NOT NULL,
	`message_id` integer,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX telegram_due ON telegram_outbox(state,next_attempt);
--> statement-breakpoint
CREATE TRIGGER telegram_order_created AFTER INSERT ON orders BEGIN
 INSERT INTO telegram_outbox(id,order_id,chat_id,event,created_at) VALUES(NEW.id||':created:customer',NEW.id,NEW.user_id,'created',NEW.created_at);
 INSERT INTO telegram_outbox(id,order_id,chat_id,event,created_at) VALUES(NEW.id||':created:6088315974',NEW.id,'6088315974','admin_new',NEW.created_at);
 INSERT INTO telegram_outbox(id,order_id,chat_id,event,created_at) VALUES(NEW.id||':created:1246079025',NEW.id,'1246079025','admin_new',NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER telegram_order_reviewed AFTER UPDATE OF status ON orders WHEN OLD.status='pending' AND NEW.status IN ('accepted','rejected') BEGIN
 INSERT OR IGNORE INTO telegram_outbox(id,order_id,chat_id,event,created_at) VALUES(NEW.id||':'||NEW.status,NEW.id,NEW.user_id,NEW.status,NEW.reviewed_at);
END;
