import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyTelegram} from '../lib/security.mjs';
const botId='8928031957',now=1800000000;
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
function signed(id=777,date=now,bot=botId){
 const p=new URLSearchParams({auth_date:String(date),user:JSON.stringify({id,first_name:'Ім’я',last_name:'Покупця',username:'buyer'}),query_id:'query',chat_instance:'123'});
 const check=[...p.entries()].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n');
 p.set('signature',sign(null,Buffer.from(`${bot}:WebAppData\n${check}`),privateKey).toString('base64url'));
 p.set('hash','a'.repeat(64));return p.toString();
}
test('Ed25519 verifies canonical Telegram data and rejects identity, bot and date tampering',async t=>{
 // Substitute only the key in this isolated test process; exercise real Ed25519 verification.
 const importKey=crypto.subtle.importKey.bind(crypto.subtle);
 t.mock.method(crypto.subtle,'importKey',async(format,key,algorithm,...rest)=>{
  if(algorithm.name==='Ed25519'){
   assert.equal(Buffer.from(key).toString('hex'),'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d');
   key=publicKey.export({format:'der',type:'spki'}).subarray(-32);
  }
  return importKey(format,key,algorithm,...rest);
 });
 const config={botId};
 const buyer=await verifyTelegram(signed(),config,now);
 assert.equal(buyer.id,'777');assert.equal(buyer.name,'Ім’я Покупця');assert.equal(buyer.admin,false);
 for(const id of [6088315974,1246079025])assert.equal((await verifyTelegram(signed(id),config,now)).admin,true);
 for(const raw of [signed().replace('777','6088315974'),signed(777,now,'123'),signed(777,now-86401),signed(777,now+31),signed()+'&user=x',signed().replace(/signature=[^&]+/,'signature=invalid')]){
  await assert.rejects(()=>verifyTelegram(raw,config,now),e=>e.status===401);
 }
 const p=new URLSearchParams(signed());p.delete('signature');
 await assert.rejects(()=>verifyTelegram(p.toString(),config,now),e=>e.status===401);
});
test('production key rejects a signature from an arbitrary key',async()=>{
 await assert.rejects(()=>verifyTelegram(signed(),{botId},now),e=>e.status===401);
});
