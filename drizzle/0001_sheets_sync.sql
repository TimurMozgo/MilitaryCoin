CREATE TABLE sync_changes (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, entity_id TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE stock_movements (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL, product_id TEXT NOT NULL, delta INTEGER NOT NULL, stock_after INTEGER NOT NULL, operation TEXT NOT NULL, order_id TEXT NOT NULL DEFAULT '');
--> statement-breakpoint
CREATE TRIGGER sync_product_insert AFTER INSERT ON products BEGIN
 INSERT INTO sync_changes(kind,entity_id) VALUES ('product',NEW.id);
 INSERT INTO stock_movements VALUES (lower(hex(randomblob(16))),NEW.updated_at,NEW.id,NEW.stock,NEW.stock,'Начальный остаток','');
END;
--> statement-breakpoint
CREATE TRIGGER sync_product_update AFTER UPDATE ON products BEGIN
 INSERT INTO sync_changes(kind,entity_id) VALUES ('product',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER sync_order_insert AFTER INSERT ON orders BEGIN INSERT INTO sync_changes(kind,entity_id) VALUES ('order',NEW.id); END;
--> statement-breakpoint
CREATE TRIGGER sync_order_update AFTER UPDATE ON orders BEGIN INSERT INTO sync_changes(kind,entity_id) VALUES ('order',NEW.id); END;
--> statement-breakpoint
CREATE TRIGGER sync_item_insert AFTER INSERT ON order_items BEGIN INSERT INTO sync_changes(kind,entity_id) VALUES ('order',NEW.order_id); END;
--> statement-breakpoint
CREATE TRIGGER sync_movement_insert AFTER INSERT ON stock_movements BEGIN INSERT INTO sync_changes(kind,entity_id) VALUES ('movement',NEW.id); END;
--> statement-breakpoint
DROP TRIGGER reserve_stock;
--> statement-breakpoint
CREATE TRIGGER reserve_stock BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NEW.quantity <= 0 OR NOT EXISTS (SELECT 1 FROM products WHERE id=NEW.product_id AND active=1 AND stock>=NEW.quantity AND price=NEW.price) THEN RAISE(ABORT,'stock_or_price') END;
 UPDATE products SET stock=stock-NEW.quantity, updated_at=MAX(updated_at+1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE id=NEW.product_id;
 INSERT INTO stock_movements SELECT lower(hex(randomblob(16))),updated_at,id,-NEW.quantity,stock,'Резерв',NEW.order_id FROM products WHERE id=NEW.product_id;
END;
--> statement-breakpoint
DROP TRIGGER release_stock;
--> statement-breakpoint
CREATE TRIGGER release_stock AFTER UPDATE OF status ON orders WHEN OLD.status='pending' AND NEW.status='rejected' BEGIN
 UPDATE products SET stock=stock+COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND product_id=products.id),0), updated_at=MAX(updated_at+1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE id IN (SELECT product_id FROM order_items WHERE order_id=NEW.id);
 INSERT INTO stock_movements SELECT lower(hex(randomblob(16))),p.updated_at,p.id,i.quantity,p.stock,'Возврат резерва',NEW.id FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=NEW.id;
END;
--> statement-breakpoint
INSERT INTO sync_changes(kind,entity_id) SELECT 'product',id FROM products;
--> statement-breakpoint
INSERT INTO sync_changes(kind,entity_id) SELECT 'order',id FROM orders;
--> statement-breakpoint
INSERT INTO stock_movements SELECT lower(hex(randomblob(16))),CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),id,stock,stock,'Остаток на момент подключения','' FROM products;
