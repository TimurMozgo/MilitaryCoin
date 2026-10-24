import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {build} from 'esbuild';
globalThis.fetch=async()=>Response.json({ok:true,result:{message_id:123}});
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
globalThis.__catalogTestEnv={DB,TELEGRAM_BOT_TOKEN:'local-test-only'};
const bundle=await build({entryPoints:['lib/shop-server.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'local-test-bindings',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'bindings',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__catalogTestEnv;'}))}}]});
const {shop}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function headers(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Test'})});const check=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n');const secret=createHmac('sha256','WebAppData').update('local-test-only').digest();p.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return {'content-type':'application/json','x-telegram-init-data':p.toString()}}
async function request(path,method='GET',body,id=6088315974){const r=await shop(new Request('https://local.test/api/shop/'+path,{method,headers:headers(id),...(body?{body:JSON.stringify(body)}:{})}),path.split('/'));return {status:r.status,data:await r.json()}}
test('catalog import is complete and idempotent; preserves edited inventory',async()=>{
 const first=await request('catalog');assert.equal(first.status,200);assert.equal(first.data.products.length,10);assert.equal(first.data.categories.length,3);assert.equal(first.data.products.filter(p=>p.id!=='dshv-2021'&&p.stock===0).length,9);
 sqlite.prepare('UPDATE products SET price=22200,stock=7 WHERE id=?').run('sso-2022');const seq=sqlite.prepare('SELECT MAX(seq) n FROM sync_changes').get().n;
 const second=await request('catalog');const p=second.data.products.find(p=>p.id==='sso-2022');assert.equal(p.price,22200);assert.equal(p.stock,7);assert.equal(sqlite.prepare('SELECT MAX(seq) n FROM sync_changes').get().n,seq);
});
test('category administration requires an admin and rejects duplicates and occupied deletion',async()=>{
 assert.equal((await request('admin/category','PUT',{name:'New category'},777)).status,403);
 const c=await request('admin/category','PUT',{name:'Новая категория'});assert.equal(c.status,200);
 assert.equal((await request('admin/category','PUT',{name:'Новая категория'})).status,409);
 const category=(await request('catalog')).data.categories.find(x=>x.id===c.data.id);
 assert.equal((await request('admin/category','PUT',{id:category.id,name:'Переименована',version:category.updated_at})).status,200);
 assert.equal((await request('admin/category','PUT',{id:category.id,name:'Старая запись',version:category.updated_at})).status,409);
 const forces=(await request('catalog')).data.categories.find(x=>x.id==='forces');assert.equal((await request('admin/category/delete','POST',{id:forces.id,version:forces.updated_at})).status,409);
 const current=(await request('catalog')).data.categories.find(x=>x.id===category.id);assert.equal((await request('admin/category/delete','POST',{id:current.id,version:current.updated_at})).status,200);
});
test('product category and imported WebP photos remain editable, reject missing category',async()=>{
 const p=(await request('catalog')).data.products.find(x=>x.id==='sso-2022');
 assert.equal((await request('admin/product','PUT',{...p,version:p.updated_at,category_id:'missing'})).status,409);
 const saved=await request('admin/product','PUT',{...p,version:p.updated_at,category_id:'memory'});assert.equal(saved.status,200);
 const next=(await request('catalog')).data.products.find(x=>x.id===p.id);assert.equal(next.category_id,'memory');assert.deepEqual(next.images,p.images);
 const created=await request('admin/product','PUT',{...p,id:undefined,name:'New coin',category_id:'equipment'});assert.equal(created.status,200);
});

test('checkout validates Ukrainian phone and persists six-digit code on idempotent retry',async()=>{
 await request('catalog');
 sqlite.prepare("INSERT INTO media(id,owner,kind,mime,created_at) VALUES ('checkout-receipt',6088315974,'receipt','image/png',?)").run(Date.now());
 sqlite.exec("INSERT OR REPLACE INTO settings(key,value) VALUES ('payment','Local test payment'); UPDATE products SET stock=5 WHERE id='dshv-2021'");
 const p=(await request('catalog')).data.products.find(p=>p.id==='dshv-2021');
 const body={requestKey:'checkout-idempotency-key',customer:'Олена Коваль',phone:'+380671234567',city:'Київ',branch:'12',receipt:'checkout-receipt',items:[{id:p.id,quantity:1,price:p.price}]};
 for(const phone of ['23423424242342','+38012345678','+3801234567890','0671234567','+380abcdefghi'])assert.equal((await request('orders','POST',{...body,phone})).status,400);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
 const first=await request('orders','POST',body);assert.equal(first.status,201,JSON.stringify(first.data));assert.match(first.data.order_code,/^[0-9]{6}$/);
 const again=await request('orders','POST',body);assert.equal(again.data.order_code,first.data.order_code);assert.equal(again.data.id,first.data.id);
 const saved=sqlite.prepare('SELECT * FROM orders WHERE id=?').get(first.data.id);assert.equal(saved.customer,body.customer);assert.equal(saved.phone,body.phone);assert.equal(saved.telegram_name,'Test');assert.equal(saved.user_id,'6088315974');
 assert.equal(sqlite.prepare('SELECT stock FROM products WHERE id=?').get(p.id).stock,p.stock-1);
 assert.equal('image_source' in p,false);
});


test('notification deep links enforce order ownership and reviews notify once',async()=>{const order=sqlite.prepare('SELECT * FROM orders LIMIT 1').get();assert.equal((await request('orders/'+order.id,'GET',undefined,777)).status,404);assert.equal((await request('orders/'+order.id)).status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_outbox WHERE order_id=?').get(order.id).n,3);assert.equal((await request('admin/review','PUT',{id:order.id,status:'rejected',reason:'Не видно суму платежу'})).status,200);assert.equal((await request('admin/review','PUT',{id:order.id,status:'rejected',reason:'Не видно суму платежу'})).status,409);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_outbox WHERE order_id=?').get(order.id).n,4);assert.equal(sqlite.prepare("SELECT state FROM telegram_outbox WHERE event='rejected'").get().state,'sent')});
