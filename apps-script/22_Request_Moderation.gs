/** ARCHIPIÉLAGO VIVO TV · MODERACIÓN DE SOLICITUDES */

function getSelectedTvRequest_() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!sheet || sheet.getName() !== TV.SHEETS.REQUESTS) throw new Error('Selecciona una fila de ' + TV.SHEETS.REQUESTS + '.');
  const rowNumber = sheet.getActiveRange().getRow();
  if (rowNumber < 2) throw new Error('Selecciona una fila de datos, no la cabecera.');
  const headers = getTvHeaders_(sheet);
  const record = tvRowToObject_(headers, sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]);
  Object.defineProperty(record, '_rowNumber', { value: rowNumber, enumerable: false });
  return record;
}

function markSelectedTvRequestInReview() {
  return updateSelectedTvRequestModeration_({ request_status: 'En revisión', reviewed_at: new Date(), reviewed_by: tvOperator_() });
}

function markSelectedTvRequestResolved() {
  return updateSelectedTvRequestModeration_({ request_status: 'Resuelta', reviewed_at: new Date(), reviewed_by: tvOperator_(), resolved_at: new Date() });
}

function updateSelectedTvRequestModeration_(patch) {
  const request = getSelectedTvRequest_();
  const sheet = getTvSheet_(TV.SHEETS.REQUESTS);
  tvPatchRow_(sheet, request._rowNumber, patch);
  return { ok: true, request_id: request.request_id || '', patch: patch };
}

function createMediaFromSelectedTvProposal() {
  const request = getSelectedTvRequest_();
  const requestType = tvNormalizeKey_(request.request_type);
  if (requestType.indexOf('propon') === -1) throw new Error('La solicitud seleccionada no parece una propuesta de vídeo.');
  const identity = parseTvMediaIdentity_(request.url, request.provider);
  if (!identity) throw new Error('No se reconoce el proveedor o la URL de la propuesta.');
  const ui = SpreadsheetApp.getUi();
  const decision = ui.alert('Crear registro de media','Se creará o vinculará ' + buildTvMediaId_(identity) + ' como INACTIVO y con rights_status=review.\n\nNo se emitirá hasta que completes la revisión editorial y lo actives.\n\n¿Continuar?',ui.ButtonSet.YES_NO);
  if (decision !== ui.Button.YES) return { ok: false, cancelled: true };
  const result = upsertTvMediaIdentity_(identity, { title: String(request.title || '').trim(), type: '', program_id: String(request.proposed_program || '').trim(), channels: String(request.proposed_channels || '').trim(), tags: String(request.territory || '').trim(), rights_status: 'review', source: 'request:' + String(request.request_id || '').trim(), status: 'Inactivo' });
  const requestSheet = getTvSheet_(TV.SHEETS.REQUESTS);
  tvPatchRow_(requestSheet, request._rowNumber, { request_status: 'En revisión', reviewed_at: new Date(), reviewed_by: tvOperator_(), result_media_id: result.media_id });
  ui.alert('Media preparado: ' + result.media_id + '\n\nEstado: Inactivo\nrights_status: review\n\nCompleta type/program_id/channels/rights_status y activa la fila cuando proceda.');
  return result;
}
