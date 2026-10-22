import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../integrations/google-sheets/Code.gs',import.meta.url),'utf8');
function harness(fail=false){
 const values=new Map([['SYNC_KEY','secret'],['SPREADSHEET_ID','book'],['CURSOR','0']]);
 const props={getProperty:k=>values.get(k)||null,setProperty:(k,v)=>values.set(k,v),deleteProperty:k=>values.delete(k)};
 const rows=new Map();
 function sheet(name){if(!rows.has(name))rows.set(name,[]);const r=rows.get(name);return {getLastRow:()=>r.length+1,getMaxRows:()=>1000,getRange:(n,c,count,width)=>({getDisplayValues:()=>r.map(x=>[String(x[0]).replace(/^'/,'')]),setValues:matrix=>{if(fail&&name==='Состав заказов')throw Error('write failed');r[n-2]=matrix[0];}})};}
 const ss={getId:()=> 'book',getSheetByName:sheet};
 const data={schemaVersion:1,nextCursor:4,hasMore:false,orders:[{id:'order',created_at:1,user_id:'123',customer:'=IMPORTXML("https://evil")',phone:'+380123456789',city:'City',branch:'1',total:13000,deposit:1300,receipt:'receipt',status:'pending',reason:''}],items:[{id:'item',order_id:'order',product_id:'coin',name:'Coin',price:13000,quantity:1}],products:[],movements:[]};
 const context=vm.createContext({PropertiesService:{getScriptProperties:()=>props},SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush:()=>{}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(data)})},Date,Map,Number,JSON});
 vm.runInContext(source,context);return {run:()=>vm.runInContext('syncShop()',context),values,rows};
}
test('Apps Script retries update the same IDs and escape formula-like fields',()=>{const h=harness();h.run();h.values.set('CURSOR','0');h.run();assert.equal(h.rows.get('Заказы').length,1);assert.equal(h.rows.get('Состав заказов').length,1);assert.equal(h.rows.get('Заказы')[0][7],130);assert.ok(h.rows.get('Заказы')[0][3].startsWith("'=IMPORTXML"));assert.equal(h.values.get('CURSOR'),'4');});
test('partial Sheet failure keeps cursor for retry and records error',()=>{const h=harness(true);assert.throws(h.run,/write failed/);assert.equal(h.values.get('CURSOR'),'0');assert.equal(h.values.get('LAST_ERROR'),'write failed');});
