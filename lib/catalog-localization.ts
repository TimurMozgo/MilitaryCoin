import edits from '../data/catalog-ukrainian.json';
// Translate supplied catalogue copy once, retaining any independently edited fields.
export async function localizeCatalog(db:D1Database){
 const marker='catalog_ukrainian_2026_10_24';
 if(await db.prepare('SELECT key FROM settings WHERE key=?').bind(marker).first())return false;
 const absent="NOT EXISTS (SELECT 1 FROM settings WHERE key='"+marker+"')";
 const stmts:D1PreparedStatement[]=[];
 for(const p of edits){
  stmts.push(db.prepare(`UPDATE products SET name=CASE WHEN name=? THEN ? ELSE name END,description=CASE WHEN description=? THEN ? ELSE description END,denomination=CASE WHEN denomination=? THEN ? ELSE denomination END,updated_at=MAX(updated_at+1,?) WHERE id=? AND (name=? OR description=? OR denomination=?) AND ${absent}`).bind(p.before.name,p.after.name,p.before.description,p.after.description,p.before.denomination,p.after.denomination,Date.now(),p.id,p.before.name,p.before.description,p.before.denomination));
 }
 for(const [id,before,after] of [['forces','Войска и службы','Війська та служби'],['memory','Герои и память','Герої та пам’ять'],['equipment','Военная техника','Військова техніка']])stmts.push(db.prepare(`UPDATE categories SET name=?,updated_at=MAX(updated_at+1,?) WHERE id=? AND name=? AND ${absent}`).bind(after,Date.now(),id,before));
 stmts.push(db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').bind(marker,'complete'));
 await db.batch(stmts);return true;
}
