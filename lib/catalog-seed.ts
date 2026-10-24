import additions from '../data/catalog-additions.json';
const marker='catalog_expansion_2026_10_24';
// One transaction: never overwrite edited products or recreate categories after this import.
export async function seedCatalog(db:D1Database){
 if(await db.prepare('SELECT key FROM settings WHERE key=?').bind(marker).first())return false;
 const stmts:D1PreparedStatement[]=[];
 const absent="NOT EXISTS (SELECT 1 FROM settings WHERE key='"+marker+"')";
 for(const [id,name] of [['forces','Войска и службы'],['memory','Герои и память'],['equipment','Военная техника']])stmts.push(db.prepare(`INSERT OR IGNORE INTO categories(id,name,updated_at) SELECT ?,?,? WHERE ${absent}`).bind(id,name,Date.now()));
 for(let i=0;i<additions.length;i++){
  const p=additions[i];
  stmts.push(db.prepare(`INSERT OR IGNORE INTO products (id,name,description,price,stock,images,year,denomination,active,updated_at,category_id,image_source) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${absent}`).bind(p.id,p.name,p.description,p.price,0,JSON.stringify(p.images),p.year,p.denomination,1,Date.now()-i,p.category_id,p.image_source));
 }
 stmts.push(db.prepare(`UPDATE products SET category_id='forces',updated_at=MAX(updated_at+1,?) WHERE id='dshv-2021' AND category_id IS NULL AND ${absent}`).bind(Date.now()));
 stmts.push(db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').bind(marker,'complete'));
 await db.batch(stmts);return true;
}
