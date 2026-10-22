import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pushSheets} from '../lib/sheets-sync.ts';
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['0000_shiny_bishop','0001_sheets_sync','0002_telegram_identity'])sql.exec(readFileSync(new URL('../drizzle/'+file+'.sql',import.meta.url),'utf8'));
 sql.prepare('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?)').run('coin','Coin','Description',13000,3,'[]','2021','10',1,1000);
 const prepare=query=>{let values=[];const stmt={bind(...v){values=v;return stmt},async first(){return sql.prepare(query).get(...values)||null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){return {meta:sql.prepare(query).run(...values)}}};return stmt;};
 const db={prepare,async batch(statements){sql.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {db,sql};
}
const url='https://script.google.com/macros/s/receiver/exec',key='a'.repeat(64);
test('failed delivery retains cursor and successful retry sends actual product',async()=>{const {db,sql}=setup();const old=globalThis.fetch;try{
 globalThis.fetch=async()=>Response.json({ok:false});
 await assert.rejects(()=>pushSheets(db,url,key));
 assert.equal(sql.prepare("SELECT value FROM settings WHERE key='sheets_cursor'").get(),undefined);
 assert.equal(sql.prepare("SELECT value FROM settings WHERE key='sheets_lease'").get().value,'');
 let sent;globalThis.fetch=async(u,options)=>{sent=JSON.parse(options.body);return Response.json({ok:true,cursor:sent.data.nextCursor})};
 const result=await pushSheets(db,url,key);assert.equal(result.ok,true);assert.equal(sent.data.products[0].id,'coin');assert.equal(sent.data.movements[0].stock_after,3);
 assert.equal(Number(sql.prepare("SELECT value FROM settings WHERE key='sheets_cursor'").get().value),result.cursor);
 assert.equal((await pushSheets(db,url,key)).cursor,result.cursor);
 }finally{globalThis.fetch=old;sql.close();}});
test('lease prevents concurrent delivery and arbitrary destinations are rejected',async()=>{const {db,sql}=setup();try{sql.prepare("INSERT INTO settings VALUES ('sheets_lease',?)").run(JSON.stringify({id:'owner',until:Date.now()+100000}));assert.equal((await pushSheets(db,url,key)).busy,true);await assert.rejects(()=>pushSheets(db,'https://example.com',key));}finally{sql.close();}});
