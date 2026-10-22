// Запись только в таблицу SPREADSHEET_ID из свойств скрипта.
const SHEET_NAMES = ['Заказы','Состав заказов','Товары','Движение остатков'];
const DEFAULT_SHOP_URL = 'https://coin-collection-tma.nikitalesnikovtest1.chatgpt.site';

function setupReceiver() {
 const p=PropertiesService.getScriptProperties();
 if(!p.getProperty('SYNC_KEY'))throw new Error('SYNC_KEY не настроен.');
 p.setProperty('SPREADSHEET_ID',SpreadsheetApp.getActiveSpreadsheet().getId());
 configureSheets_();
}

function doPost(e) {
 const lock=LockService.getScriptLock();
 const p=PropertiesService.getScriptProperties();
 try {
  if(!e || !e.postData || e.postData.contents.length>2000000)throw new Error('Неверный запрос.');
  const input=JSON.parse(e.postData.contents);
  const expected=p.getProperty('SYNC_KEY');
  if(!expected || expected.length<32 || typeof input.key!=='string' || input.key!==expected)return reply_({ok:false,error:'unauthorized'});
  if(!lock.tryLock(10000))return reply_({ok:false,error:'busy'});
  const data=input.data;
  if(!data || data.schemaVersion!==1 || !Number.isSafeInteger(data.nextCursor))throw new Error('Некорректный формат.');
  for(const name of ['orders','items','products','movements'])if(!Array.isArray(data[name])||data[name].length>3000)throw new Error('Слишком много данных.');
  const ss=SpreadsheetApp.openById(p.getProperty('SPREADSHEET_ID'));
  if(!ss || ss.getId()!==p.getProperty('SPREADSHEET_ID'))throw new Error('Приёмник не настроен.');
  const current=Number(p.getProperty('CURSOR')||'0');
  if(data.nextCursor<current)return reply_({ok:true,cursor:data.nextCursor});
  const base=DEFAULT_SHOP_URL;
  const status = {pending:'В обработке',accepted:'Принято',rejected:'Отклонено'};
  upsert_(ss.getSheetByName('Заказы'), data.orders.map(o => [o.id,date_(o.created_at),o.user_id,o.customer,o.phone,o.city,o.branch,o.total/100,o.deposit/100,o.receipt,status[o.status]||o.status,o.reason,date_(o.reviewed_at),o.reviewer||'',o.telegram_name||'',o.telegram_username||'']));
  upsert_(ss.getSheetByName('Состав заказов'), data.items.map(i => [i.id,i.order_id,i.product_id,i.name,i.price/100,i.quantity,i.price*i.quantity/100]));
  upsert_(ss.getSheetByName('Товары'), data.products.map(v => [v.id,v.name,v.description,v.price/100,v.stock,JSON.parse(v.images).map(url => base+url).join('\n'),v.year,v.denomination,v.active?'Да':'Нет',date_(v.updated_at)]));
  upsert_(ss.getSheetByName('Движение остатков'), data.movements.map(m => [m.id,date_(m.created_at),m.product_id,m.delta,m.stock_after,m.operation,m.order_id]));

  SpreadsheetApp.flush();
  p.setProperty('CURSOR',String(data.nextCursor));
  p.setProperty('LAST_SUCCESS',new Date().toISOString());
  p.deleteProperty('LAST_ERROR');
  return reply_({ok:true,cursor:data.nextCursor});
 }catch(error){p.setProperty('LAST_ERROR','Ошибка записи в таблицу');return reply_({ok:false,error:'write_failed'});}
 finally{if(lock.hasLock())lock.releaseLock();}
}
function reply_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

function upsert_(sheet, rows) {
  if (!sheet) throw new Error('Отсутствует лист.');
  if (!rows.length) return;
  const last = sheet.getLastRow();
  const ids = last > 1 ? sheet.getRange(2,1,last-1,1).getDisplayValues().flat() : [];
  const index = new Map(ids.map((id,i) => [id,i+2]));
  let next = Math.max(2,last+1);
  for (const row of rows) {
    const id = String(row[0]);
    const n = index.get(id) || next++;
    if (n > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(100,n-sheet.getMaxRows()));
    // Preserve IDs/phones, and never evaluate user-controlled strings as formulas.
    sheet.getRange(n,1,1,row.length).setValues([row.map(v => typeof v === 'string' ? "'"+v : v)]);
    index.set(id,n);
  }
}

function date_(ms) { return ms ? new Date(ms) : ''; }

function configureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Europe/Kiev');
  for (const name of SHEET_NAMES) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error('Нет листа ' + name);
    sheet.setFrozenRows(1);sheet.setFrozenColumns(1);
    if (!sheet.getFilter()) sheet.getRange(1,1,sheet.getMaxRows(),sheet.getLastColumn()).createFilter();
  }
  const orders=ss.getSheetByName('Заказы');
  orders.getRange('O1:P1').setValues([['Имя в Telegram','Username Telegram']]);
  orders.getRange('A1').copyTo(orders.getRange('O1:P1'),{formatOnly:true});
  orders.setColumnWidths(15,2,200);
  orders.getRange('B2:B1000').setNumberFormat('dd.MM.yyyy HH:mm');
  orders.getRange('M2:M1000').setNumberFormat('dd.MM.yyyy HH:mm');
  orders.getRange('H2:I1000').setNumberFormat('#,##0.00');
  const rules=[['В обработке','#fff2cc'],['Принято','#d9ead3'],['Отклонено','#f4cccc']].map(([text,color])=>SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setBackground(color).setRanges([orders.getRange('K2:K1000')]).build());
  orders.setConditionalFormatRules(rules);
  ss.getSheetByName('Состав заказов').getRange('E2:E1000').setNumberFormat('#,##0.00');
  ss.getSheetByName('Состав заказов').getRange('G2:G1000').setNumberFormat('#,##0.00');
  ss.getSheetByName('Товары').getRange('D2:D1000').setNumberFormat('#,##0.00');
  ss.getSheetByName('Товары').getRange('J2:J1000').setNumberFormat('dd.MM.yyyy HH:mm');
  ss.getSheetByName('Движение остатков').getRange('B2:B1000').setNumberFormat('dd.MM.yyyy HH:mm');
}
