/** ARCHIPIÉLAGO VIVO TV · CANALES, PROGRAMAS Y PARRILLA */

function readTvChannels_() {
  const sheet = getTvSheet_(TV.SHEETS.CHANNELS);
  tvAssertHeaders_(sheet, TV.CHANNEL_HEADERS);
  return tvReadObjects_(sheet).map(function(record) {
    return { channel_id: String(record.channel_id || '').trim(), channel_number: tvNullableNumber_(record.channel_number), slug: String(record.slug || '').trim(), name: String(record.name || '').trim(), overlay_label: String(record.overlay_label || '').trim(), description: String(record.description || '').trim(), status: String(record.status || '').trim(), active: tvIsActive_(record.status) };
  });
}

function readTvPrograms_() {
  const sheet = getTvSheet_(TV.SHEETS.PROGRAMS);
  tvAssertHeaders_(sheet, TV.PROGRAM_HEADERS);
  return tvReadObjects_(sheet).map(function(record) {
    return { program_id: String(record.program_id || '').trim(), name: String(record.name || '').trim(), description: String(record.description || '').trim(), status: String(record.status || '').trim(), active: tvIsActive_(record.status) };
  });
}

function readTvSchedule_() {
  const sheet = getTvSheet_(TV.SHEETS.SCHEDULE);
  tvAssertHeaders_(sheet, TV.SCHEDULE_HEADERS);
  return tvReadObjects_(sheet).map(function(record) {
    const channelId = String(record.channel_id || '').trim();
    const rule = String(record.selection_rule || '').trim();
    const active = tvIsActive_(record.status);
    return { schedule_id: String(record.schedule_id || '').trim(), channel_id: channelId, days: tvList_(record.days).map(function(day) { return tvNormalizeKey_(day).slice(0, 3); }), start: tvTimeHHmm_(record.start), end: tvTimeHHmm_(record.end), program_id: String(record.program_id || '').trim(), media_id: String(record.media_id || '').trim(), selection_rule: rule, max_duration_minutes: tvNullableNumber_(record.max_duration_minutes), priority: tvNullableNumber_(record.priority), valid_from: tvDateIso_(record.valid_from), valid_to: tvDateIso_(record.valid_to), status: String(record.status || '').trim(), active: active, is_global: channelId === '*', is_global_entity_block: channelId === '*' && ['entity_rotation', 'entity_new', 'entity_deadline'].indexOf(rule) !== -1, valid: active && Boolean(String(record.schedule_id || '').trim()) && Boolean(rule) };
  });
}
