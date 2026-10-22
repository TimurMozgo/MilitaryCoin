/** @OnlyCurrentDoc */
// Source of truth: shop database. Edits to mirrored rows are overwritten by later sync.
const SHEET_NAMES = ['Заказы','Состав заказов','Товары','Движение остатков'];
const DEFAULT_SHOP_URL = 'https://coin-collection-tma.nikitalesnikovtest1.chatgpt.site';

function installSync() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SYNC_KEY')) throw new Error('Добавьте SYNC_KEY в свойства скрипта.');
  p.setProperty('SPREADSHEET_ID', SpreadsheetApp.getActiveSpreadsheet().getId());
  if (!p.getProperty('SHOP_URL')) p.setProperty('SHOP_URL', DEFAULT_SHOP_URL);
  if (!p.getProperty('CURSOR')) p.setProperty('CURSOR', '0');
  configureSheets_();
  syncShop();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'syncShop')) {
    ScriptApp.newTrigger('syncShop').timeBased().everyMinutes(1).create();
  }
}

function syncShop() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const p = PropertiesService.getScriptProperties();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss || ss.getId() !== p.getProperty('SPREADSHEET_ID')) throw new Error('Неверная таблица.');
    const secret = p.getProperty('SYNC_KEY');
    if (!secret) throw new Error('SYNC_KEY не настроен.');
    const base = p.getProperty('SHOP_URL') || DEFAULT_SHOP_URL;
    if (!/^https:\/\/[^/]+$/.test(base)) throw new Error('SHOP_URL должен быть HTTPS origin.');
    const headers = {'x-sheets-sync-key':secret};
    const siteToken = p.getProperty('SITES_TOKEN');
    if (siteToken) headers['OAI-Sites-Authorization'] = 'Bearer ' + siteToken;
    for (let i = 0; i < 5; i++) {
      const cursor = Number(p.getProperty('CURSOR') || '0');
      const response = UrlFetchApp.fetch(base + '/api/shop/integrations/sheets?after=' + cursor,
        {headers, muteHttpExceptions:true, followRedirects:false});
      if (response.getResponseCode() !== 200) throw new Error('Сервер синхронизации: HTTP ' + response.getResponseCode());
      const data = JSON.parse(response.getContentText());
      if (data.schemaVersion !== 1 || !Number.isSafeInteger(data.nextCursor) || data.nextCursor < cursor) throw new Error('Некорректный ответ сервера.');
      const status = {pending:'В обработке',accepted:'Принято',rejected:'Отклонено'};
      upsert_(ss.getSheetByName('Заказы'), data.orders.map(o => [o.id,date_(o.created_at),o.user_id,o.customer,o.phone,o.city,o.branch,o.total/100,o.deposit/100,o.receipt,status[o.status]||o.status,o.reason,date_(o.reviewed_at),o.reviewer||'']));
      upsert_(ss.getSheetByName('Состав заказов'), data.items.map(i => [i.id,i.order_id,i.product_id,i.name,i.price/100,i.quantity,i.price*i.quantity/100]));
      upsert_(ss.getSheetByName('Товары'), data.products.map(v => [v.id,v.name,v.description,v.price/100,v.stock,JSON.parse(v.images).map(url => base+url).join('\n'),v.year,v.denomination,v.active?'Да':'Нет',date_(v.updated_at)]));
      upsert_(ss.getSheetByName('Движение остатков'), data.movements.map(m => [m.id,date_(m.created_at),m.product_id,m.delta,m.stock_after,m.operation,m.order_id]));
      SpreadsheetApp.flush();
      // Advance only after all four sheets have been written successfully.
      p.setProperty('CURSOR',String(data.nextCursor));
      p.setProperty('LAST_SUCCESS',new Date().toISOString());
      p.deleteProperty('LAST_ERROR');
      if (!data.hasMore) break;
    }
  } catch (error) {
    p.setProperty('LAST_ERROR',String(error.message).slice(0,300));
    throw error;
  } finally { lock.releaseLock(); }
}

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
