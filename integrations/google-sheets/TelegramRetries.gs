function retryMilitaryCoinNotifications() {
 const response=UrlFetchApp.fetch('https://coin-collection-tma.nikitalesnikovtest1.chatgpt.site/api/shop/integrations/telegram/retry',{method:'post',muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('MilitaryCoin notification queue temporarily unavailable');
}
function installMilitaryCoinNotificationRetry() {
 const exists=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='retryMilitaryCoinNotifications');
 if(!exists)ScriptApp.newTrigger('retryMilitaryCoinNotifications').timeBased().everyMinutes(1).create();
}
