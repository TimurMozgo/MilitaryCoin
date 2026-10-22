import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../integrations/google-sheets/Code.gs',import.meta.url),'utf8');
function harness(fail=false){
 const key='x'.repeat(64),values=new Map([['SYNC_KEY',key],['SPREADSHEET_ID','book'],['CURSOR','0']]);
 const props={getProperty:k=>values.get(k)||null,setProperty:(k,v)=>values.set(k,v),deleteProperty:k=>values.delete(k)};
 const rows=new Map();
 function sheet(name){if(!rows.has(name))rows.set(name,[]);const r=rows.get(name);return {getLastRow:()=>r.length+1,getMaxRows:()=>1000,getRange:(n)=>({getDisplayValues:()=>r.map(x=>[String(x[0]).replace(/^'/,'')]),setValues:matrix=>{if(fail&&name==='Состав заказов')throw Error('write failed');r[n-2]=matrix[0];}})};}
 const ss={getId:()=> 'book',getSheetByName:sheet};
 const data={schemaVersion:1,nextCursor:4,hasMore:false,orders:[{id:'order',created_at:1,user_id:'123',telegram_name:'Telegram Name',telegram_username:'user',customer:'=IMPORTXML("https://evil")',phone:'+380123456789',city:'City',branch:'1',total:13000,deposit:1300,receipt:'receipt',status:'pending',reason:''}],items:[{id:'item',order_id:'order',product_id:'coin',name:'Coin',price:13000,quantity:1}],products:[],movements:[]};
 const context=vm.createContext({PropertiesService:{getScriptProperties:()=>props},SpreadsheetApp:{openById:()=>ss,flush:()=>{}},LockService:{getScriptLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock:()=>{}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},Date,Map,Number,JSON});
 vm.runInContext(source,context);return {run:(input={key,data})=>{context.event={postData:{contents:JSON.stringify(input)}};return vm.runInContext('doPost(event)',context)},values,rows,data};
}
test('webhook retries update same IDs and retain Telegram identity and phone',()=>{const h=harness();assert.equal(h.run().ok,true);h.run();assert.equal(h.rows.get('Заказы').length,1);const row=h.rows.get('Заказы')[0];assert.equal(row[2],"'123");assert.equal(row[4],"'+380123456789");assert.equal(row[14],"'Telegram Name");assert.equal(row[15],"'user");assert.ok(row[3].startsWith("'=IMPORTXML"));assert.equal(h.values.get('CURSOR'),'4');});
test('partial write never acknowledges or advances cursor',()=>{const h=harness(true);assert.equal(h.run().ok,false);assert.equal(h.values.get('CURSOR'),'0');assert.ok(h.values.get('LAST_ERROR'));});
test('unauthorized webhook cannot write rows',()=>{const h=harness();assert.equal(h.run({key:'wrong',data:h.data}).error,'unauthorized');assert.equal(h.rows.size,0);});
