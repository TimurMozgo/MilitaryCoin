import {money} from './types';
const STORE='https://timurmozgo.github.io/MilitaryCoin/';
type Job={id:string;order_id:string;chat_id:string;event:string;attempts:number};
export async function notificationMessage(db:D1Database,job:Job){
 const order=await db.prepare('SELECT * FROM orders WHERE id=?').bind(job.order_id).first<any>();
 if(!order||(['created','admin_new'].includes(job.event)&&order.status!=='pending'))return null;
 const code=order.order_code||order.id.slice(0,8).toUpperCase();
 let text='';
 if(job.event==='admin_new'){
  const items=await db.prepare('SELECT name,quantity FROM order_items WHERE order_id=?').bind(order.id).all<any>();
  const summary=items.results.slice(0,8).map(i=>`• ${i.name} × ${i.quantity}`).join('\n');
  text=`🪙 Нова заявка №${code}\n\nОтримувач: ${order.customer}\nТелефон: ${order.phone}\nTelegram ID: ${order.user_id}${order.telegram_username?'\n@'+order.telegram_username:''}\n\n${summary}${items.results.length>8?'\n…та інші монети':''}\n\nСума: ${money(order.total)}\nПередоплата: ${money(order.deposit)}\nЧек прикріплено — перевірте оплату в адмін-панелі.`;
 }else if(job.event==='created')text=`🟠 Заявку №${code} отримано!\n\nМонети зарезервовано. Чек передано на перевірку.\nСума: ${money(order.total)}\nПередоплата: ${money(order.deposit)}\n\nСтатус: В обробці.\nМи повідомимо результат тут. Дякуємо, що обрали MilitaryCoin!`;
 else if(job.event==='accepted')text=`🟢 Заявку №${code} прийнято!\n\nПередоплату перевірено. Ваше замовлення підтверджено.\nСума: ${money(order.total)}\nЗалишок до сплати: ${money(order.total-order.deposit)}\n\nДеталі замовлення — у вашому профілі MilitaryCoin.`;
 else text=`🔴 Заявку №${code} відхилено.\n\nПричина: ${order.reason}\n\nПереглянути заявку можна у вашому профілі MilitaryCoin.`;
 return {chat_id:job.chat_id,text,reply_markup:{inline_keyboard:[[{text:job.event==='admin_new'?'Перевірити заявку':'Моє замовлення',web_app:{url:STORE+'?view='+(job.event==='admin_new'?'admin':'orders')+'&order='+encodeURIComponent(order.id)}}]]}};
}
// A durable outbox is populated in the same transaction as the order/status.
// Claims prevent concurrent requests from sending the same event. Telegram has no idempotency key;
// an interrupted send is marked uncertain instead of automatically risking duplicate messages.
export async function drainNotifications(db:D1Database,token?:string,send:typeof fetch=fetch){
 if(!token)return {configured:false,sent:0};
 const now=Date.now();let sent=0;
 await db.prepare("UPDATE telegram_outbox SET state='uncertain',last_error='delivery_unknown',lease=NULL WHERE state='sending' AND next_attempt<=?").bind(now).run();
 const jobs=await db.prepare("SELECT * FROM telegram_outbox WHERE state IN ('pending','retry') AND next_attempt<=? ORDER BY created_at,id LIMIT 6").bind(now).all<Job>();
 for(const job of jobs.results){
  const lease=crypto.randomUUID();
  const claim=await db.prepare("UPDATE telegram_outbox SET state='sending',lease=?,attempts=attempts+1,next_attempt=? WHERE id=? AND state IN ('pending','retry') AND next_attempt<=?").bind(lease,Date.now()+60000,job.id,Date.now()).run();
  if(!claim.meta.changes)continue;
  const finish=async(state:string,error:string,next=0,messageId:number|null=null)=>db.prepare('UPDATE telegram_outbox SET state=?,last_error=?,next_attempt=?,message_id=?,sent_at=?,lease=NULL WHERE id=? AND lease=?').bind(state,error,next,messageId,state==='sent'?Date.now():null,job.id,lease).run();
  try{
   const body=await notificationMessage(db,job);if(!body){await finish('skipped','order_missing_or_already_reviewed');continue}
   const response=await send(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(4000)});
   const result:any=await response.json();
   if(response.ok&&result.ok){await finish('sent','',0,result.result.message_id);sent++;continue}
   const code=Number(result.error_code||response.status);
   if(code===429||code>=500){const delay=Math.max(30,Number(result.parameters?.retry_after)||Math.min(3600,30*2**Math.min(job.attempts,7)));await finish('retry','telegram_'+code,Date.now()+delay*1000)}
   else await finish(code===403||code===400?'blocked':'failed','telegram_'+code);
  }catch{await finish('uncertain','delivery_unknown')}
 }
 return {configured:true,sent};
}
