/** TV App · ACTIVADORES */

function installTvTriggers() {
  uninstallTvTriggers_();
  const ss = getTvSpreadsheet_();
  ScriptApp.newTrigger('onTvFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('scheduledTvMaintenance').timeBased().atHour(4).everyDays(1).inTimezone(TV.TIMEZONE).create();
  SpreadsheetApp.getUi().alert('Activadores instalados:\n\n• onTvFormSubmit · al recibir una respuesta\n• scheduledTvMaintenance · diariamente alrededor de las 04:00');
  return { ok: true };
}

function uninstallTvTriggers_() {
  const handlers = new Set(['onTvFormSubmit', 'scheduledTvMaintenance']);
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.has(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  });
}

function scheduledTvMaintenance() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const result = { ok: true, started_at: new Date().toISOString(), requests: null, entities: null, metadata: null, validation: null, errors: [] };
    try { result.requests = syncTvRequestsSilent_(); } catch (error) { result.errors.push('requests: ' + error.message); }
    try { const url = getTvEntitiesSourceUrl_(); if (url) result.entities = syncTvEntitiesInternal_({ silent: true }); } catch (error) { result.errors.push('entities: ' + error.message); }
    try { result.metadata = refreshTvMediaMetadataInternal_({ silent: true }); } catch (error) { result.errors.push('metadata: ' + error.message); }
    try { result.validation = validateTvProject(); } catch (error) { result.errors.push('validation: ' + error.message); }
    result.ok = result.errors.length === 0;
    result.finished_at = new Date().toISOString();
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function syncTvRequestsSilent_() {
  const source = getTvSheet_(TV.SHEETS.FORM_RESPONSES);
  const target = getTvSheet_(TV.SHEETS.REQUESTS);
  tvAssertHeaders_(source, TV.REQUEST_FORM_HEADERS);
  tvAssertHeaders_(target, TV.REQUEST_HEADERS);
  let created = 0, updated = 0, skipped = 0;
  for (let row = 2; row <= source.getLastRow(); row++) {
    const result = syncOneTvRequestRow_(source, row);
    if (!result) skipped++; else if (result.action === 'created') created++; else updated++;
  }
  return { created: created, updated: updated, skipped: skipped };
}
