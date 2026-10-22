export class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const ADMIN_IDS=new Set(['6088315974','1246079025']);
export async function verifyTelegram(raw,token,now=Math.floor(Date.now()/1000)){
 if(!token)throw new AppError('Telegram ещё не подключён. Оформление станет доступно после подключения бота.',503);
 if(!raw||raw.length>12000)throw new AppError('Откройте приложение через Telegram.',401);
 const p=new URLSearchParams(raw); if(new Set(p.keys()).size!==[...p.keys()].length)throw new AppError('Некорректная авторизация.',401);
 const hash=p.get('hash');if(!hash||!/^[a-f0-9]{64}$/i.test(hash))throw new AppError('Некорректная авторизация.',401);
 p.delete('hash');const check=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
 const enc=new TextEncoder();async function sign(key,data){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(data)));}
 const secret=await sign(enc.encode('WebAppData'),token);const expected=await sign(secret,check);const bytes=Uint8Array.from(hash.match(/../g),x=>parseInt(x,16));let diff=0;for(let i=0;i<32;i++)diff|=expected[i]^bytes[i];
 const date=Number(p.get('auth_date'));if(diff||!Number.isInteger(date)||date>now+30||now-date>86400)throw new AppError('Сессия истекла. Закройте приложение и откройте его заново.',401);
 let u;try{u=JSON.parse(p.get('user')||'null')}catch{throw new AppError('Некорректный профиль.',401)}
 if(!u||!Number.isSafeInteger(u.id)||u.id<=0)throw new AppError('Некорректный профиль.',401);
 return {id:String(u.id),name:String(u.first_name||'Покупатель'),username:String(u.username||''),admin:ADMIN_IDS.has(String(u.id))};
}
export function depositFor(total){return Math.ceil(total/10)}
export function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw new AppError(`Проверьте поле «${label}».`);return value}
export function text(value,min,max,label){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw new AppError(`Проверьте поле «${label}».`);return value.trim()}
export function cartInput(items){if(!Array.isArray(items)||!items.length||items.length>30)throw new AppError('Корзина должна содержать от 1 до 30 товаров.');const ids=new Set();return items.map(i=>{const id=text(i.id,1,80,'товар');if(ids.has(id))throw new AppError('Товар повторяется.');ids.add(id);return {id,quantity:integer(i.quantity,1,9999,'количество'),price:integer(i.price,1,100000000,'цена')}})}
