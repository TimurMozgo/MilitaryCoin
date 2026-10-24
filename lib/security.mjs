export class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const ADMIN_IDS=new Set(['6088315974','1246079025']);
export async function verifyTelegram(raw,credentials,now=Math.floor(Date.now()/1000)){
 const {token,botId}=typeof credentials==='string'?{token:credentials}:credentials||{};
 if(!token&&!/^[1-9][0-9]{0,15}$/.test(botId||''))throw new AppError('Telegram ще не підключено. Оформлення стане доступним після підключення бота.',503);
 if(!raw||raw.length>12000)throw new AppError('Відкрийте застосунок через Telegram.',401);
 const p=new URLSearchParams(raw); if(new Set(p.keys()).size!==[...p.keys()].length)throw new AppError('Некоректна авторизація.',401);
 const enc=new TextEncoder();
 const sorted=values=>[...values.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
 let valid=false;
 if(token){
  const hash=p.get('hash');if(!hash||!/^[a-f0-9]{64}$/i.test(hash))throw new AppError('Некоректна авторизація.',401);
  p.delete('hash');
  async function sign(key,data){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(data)));}
  const secret=await sign(enc.encode('WebAppData'),token);const expected=await sign(secret,sorted(p));const bytes=Uint8Array.from(hash.match(/../g),x=>parseInt(x,16));let diff=0;for(let i=0;i<32;i++)diff|=expected[i]^bytes[i];valid=diff===0;
 }else{
  // Telegram production key: https://core.telegram.org/bots/webapps#validating-data-for-third-party-use
  const signature=p.get('signature');
  if(!signature||! /^[A-Za-z0-9_-]{86}(==)?$/.test(signature))throw new AppError('Telegram не передав підпис входу. Оновіть Telegram і відкрийте застосунок знову.',401);
  p.delete('hash');p.delete('signature');
  const publicKey=Uint8Array.from('e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d'.match(/../g),x=>parseInt(x,16));
  const key=await crypto.subtle.importKey('raw',publicKey,{name:'Ed25519'},false,['verify']);
  const bytes=Uint8Array.from(atob(signature.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  valid=await crypto.subtle.verify('Ed25519',key,bytes,enc.encode(`${botId}:WebAppData\n${sorted(p)}`));
 }
 const date=Number(p.get('auth_date'));if(!valid||!Number.isInteger(date)||date>now+30||now-date>86400)throw new AppError('Сесія завершилася. Закрийте застосунок і відкрийте його знову.',401);
 let u;try{u=JSON.parse(p.get('user')||'null')}catch{throw new AppError('Некоректний профіль.',401)}
 if(!u||!Number.isSafeInteger(u.id)||u.id<=0)throw new AppError('Некоректний профіль.',401);
 return {id:String(u.id),name:[u.first_name,u.last_name].filter(Boolean).map(String).join(' ')||'Покупець',username:String(u.username||''),admin:ADMIN_IDS.has(String(u.id))};
}
export function depositFor(total){return Math.ceil(total/10)}
export function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw new AppError(`Перевірте поле «${label}».`);return value}
export function text(value,min,max,label){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw new AppError(`Перевірте поле «${label}».`);return value.trim()}
export function cartInput(items){if(!Array.isArray(items)||!items.length||items.length>30)throw new AppError('Кошик має містити від 1 до 30 товарів.');const ids=new Set();return items.map(i=>{const id=text(i.id,1,80,'товар');if(ids.has(id))throw new AppError('Товар повторюється.');ids.add(id);return {id,quantity:integer(i.quantity,1,9999,'кількість'),price:integer(i.price,1,100000000,'ціна')}})}

export function ukrainianPhone(value){if(typeof value!=='string'||!/^\+380[0-9]{9}$/.test(value))throw new AppError('Номер має містити +380 і рівно 9 цифр після коду країни.');return value}
export function newOrderCode(){return String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000)}
