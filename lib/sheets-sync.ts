import {AppError} from './security.mjs';
export async function sheetsChanges(db:D1Database,req:Request){
 const cursor=Number(new URL(req.url).searchParams.get('after')||'0');
 if(!Number.isSafeInteger(cursor)||cursor<0)throw new AppError('Некоректний курсор.');
 const events=(await db.prepare('SELECT seq,kind,entity_id FROM sync_changes WHERE seq>? ORDER BY seq LIMIT 101').bind(cursor).all<any>()).results;
 const page=events.slice(0,100),products:any[]=[],orders:any[]=[],items:any[]=[],movements:any[]=[];
 const seen=new Set<string>();
 for(const event of page){
  const key=event.kind+':'+event.entity_id;if(seen.has(key))continue;seen.add(key);
  if(event.kind==='product'){
   const p=await db.prepare('SELECT * FROM products WHERE id=?').bind(event.entity_id).first<any>();
   if(p)products.push(p);
  }else if(event.kind==='order'){
   const o=await db.prepare('SELECT * FROM orders WHERE id=?').bind(event.entity_id).first<any>();
   if(o){orders.push(o);items.push(...(await db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').bind(o.id).all()).results);}
  }else if(event.kind==='movement'){
   const m=await db.prepare('SELECT * FROM stock_movements WHERE id=?').bind(event.entity_id).first();if(m)movements.push(m);
  }
 }
 return {schemaVersion:1,nextCursor:page.at(-1)?.seq||cursor,hasMore:events.length>100,products,orders,items,movements};
}

export async function pushSheets(db:D1Database,url?:string,key?:string){
 if(!url||!key)return {connected:false};
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)||key.length<32)throw new Error('Invalid Sheets configuration');
 const now=Date.now(),lease=JSON.stringify({id:crypto.randomUUID(),until:now+120000});
 await db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('sheets_lease','')").run();
 const previous=await db.prepare("SELECT value FROM settings WHERE key='sheets_lease'").first<any>();
 if(previous.value&&JSON.parse(previous.value).until>now)return {busy:true};
 const claimed=await db.prepare("UPDATE settings SET value=? WHERE key='sheets_lease' AND value=?").bind(lease,previous.value).run();
 if(!claimed.meta.changes)return {busy:true};
 try{
  const state=await db.prepare("SELECT value FROM settings WHERE key='sheets_cursor'").first<any>();
  const cursor=Number(state?.value||'0');
  const data=await sheetsChanges(db,new Request('https://internal/sync?after='+cursor));
  if(data.nextCursor===cursor)return {ok:true,cursor};
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,data}),redirect:'follow',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Sheets HTTP '+response.status);
  const ack=await response.json() as {ok?:boolean;cursor?:number};
  if(!ack.ok||ack.cursor!==data.nextCursor)throw new Error('Sheets acknowledgement failed');
  await db.batch([
   db.prepare("INSERT INTO settings(key,value) VALUES ('sheets_cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(data.nextCursor)),
   db.prepare("INSERT INTO settings(key,value) VALUES ('sheets_last_success',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(Date.now())),
   db.prepare("DELETE FROM settings WHERE key='sheets_last_error'")
  ]);
  return {ok:true,cursor:data.nextCursor,hasMore:data.hasMore};
 }catch(e){
  await db.prepare("INSERT INTO settings(key,value) VALUES ('sheets_last_error',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind('Помилка надсилання. Запис збережено в черзі.').run();
  throw e;
 }finally{await db.prepare("UPDATE settings SET value='' WHERE key='sheets_lease' AND value=?").bind(lease).run();}
}
