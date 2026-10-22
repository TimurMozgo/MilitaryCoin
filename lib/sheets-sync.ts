import {AppError} from './security.mjs';

export async function authorizeSheets(req:Request,secret?:string){
 if(!secret||secret.length<32)throw new AppError('Синхронизация не подключена.',503);
 const supplied=req.headers.get('x-sheets-sync-key')||'';
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([secret,supplied].map(v=>crypto.subtle.digest('SHA-256',enc.encode(v))));
 let diff=0;const aa=new Uint8Array(a),bb=new Uint8Array(b);
 for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
 if(diff)throw new AppError('Нет доступа.',403);
}

export async function sheetsChanges(db:D1Database,req:Request){
 const cursor=Number(new URL(req.url).searchParams.get('after')||'0');
 if(!Number.isSafeInteger(cursor)||cursor<0)throw new AppError('Некорректный курсор.');
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
