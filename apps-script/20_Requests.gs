/**
 * TV App · SOLICITUDES
 *
 * Google Forms escribe únicamente en Form_Responses.
 * Esta capa crea/actualiza la vista operativa _tv_requests.
 */

function onTvFormSubmit(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!e || !e.range) throw new Error('onTvFormSubmit requiere un evento de envío de formulario de Sheets.');
    const sheet = e.range.getSheet();
    if (sheet.getName() !== TV.SHEETS.FORM_RESPONSES) return;
    return syncOneTvRequestRow_(sheet, e.range.getRow());
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function syncTvRequests() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const source = getTvSheet_(TV.SHEETS.FORM_RESPONSES);
    const target = getTvSheet_(TV.SHEETS.REQUESTS);
    tvAssertHeaders_(source, TV.REQUEST_FORM_HEADERS);
    tvAssertHeaders_(target, TV.REQUEST_HEADERS);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let row = 2; row <= source.getLastRow(); row++) {
      const result = syncOneTvRequestRow_(source, row);
      if (!result) skipped++;
      else if (result.action === 'created') created++;
      else updated++;
    }

    const summary = { ok: true, created: created, updated: updated, skipped: skipped };
    console.log(JSON.stringify(summary));

    if (SpreadsheetApp.getActiveSpreadsheet()) {
      SpreadsheetApp.getUi().alert(
        'Solicitudes sincronizadas.\n\nNuevas: ' + created +
        '\nActualizadas: ' + updated +
        '\nOmitidas: ' + skipped
      );
    }
    return summary;
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function syncOneTvRequestRow_(sourceSheet, rowNumber) {
  if (rowNumber < 2 || rowNumber > sourceSheet.getLastRow()) return null;

  tvAssertHeaders_(sourceSheet, TV.REQUEST_FORM_HEADERS);
  const target = getTvSheet_(TV.SHEETS.REQUESTS);
  tvAssertHeaders_(target, TV.REQUEST_HEADERS);

  const sourceHeaders = getTvHeaders_(sourceSheet);
  const raw = sourceSheet.getRange(rowNumber, 1, 1, sourceHeaders.length).getValues()[0];
  const sourceRecord = tvRowToObject_(sourceHeaders, raw);

  const nonEmpty = TV.REQUEST_FORM_HEADERS.some(function(header) {
    return sourceRecord[header] !== '' && sourceRecord[header] !== null && sourceRecord[header] !== undefined;
  });
  if (!nonEmpty) return null;

  const requestId = buildTvRequestId_(sourceSheet, rowNumber, sourceRecord.Timestamp);
  const existingRow = tvFindRowByField_(target, 'request_id', requestId);
  const targetHeaders = getTvHeaders_(target);

  const formPatch = {};
  TV.REQUEST_FORM_HEADERS.forEach(function(header) {
    formPatch[header] = tvSafeSheetValue_(sourceRecord[header]);
  });
  formPatch.request_id = requestId;

  if (!existingRow) {
    formPatch.request_status = TV.REQUEST_PENDING_STATUS;
    return {
      action: 'created',
      request_id: requestId,
      rowNumber: tvAppendObject_(target, formPatch)
    };
  }

  const existing = tvRowToObject_(
    targetHeaders,
    target.getRange(existingRow, 1, 1, targetHeaders.length).getValues()[0]
  );

  const newRow = targetHeaders.map(function(header) {
    if (TV.REQUEST_FORM_HEADERS.indexOf(header) !== -1) return formPatch[header];
    if (header === 'request_id') return requestId;
    return existing[header] === undefined ? '' : existing[header];
  });

  target.getRange(existingRow, 1, 1, targetHeaders.length).setValues([newRow]);
  return { action: 'updated', request_id: requestId, rowNumber: existingRow };
}

function buildTvRequestId_(sourceSheet, rowNumber, timestamp) {
  const signature = [
    getTvSpreadsheet_().getId(),
    sourceSheet.getSheetId(),
    rowNumber,
    tvDateIso_(timestamp) || String(timestamp || '')
  ].join('|');
  return 'TVREQ-' + tvSha256Hex_(signature).slice(0, 16).toUpperCase();
}
