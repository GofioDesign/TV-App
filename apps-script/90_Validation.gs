/** TV App · VALIDACIÓN */

function validateTvProject() {
  const errors = [];
  const warnings = [];
  const stats = {};

  const definitions = [
    [TV.SHEETS.FORM_RESPONSES, TV.REQUEST_FORM_HEADERS],
    [TV.SHEETS.REQUESTS, TV.REQUEST_HEADERS],
    [TV.SHEETS.CHANNELS, TV.CHANNEL_HEADERS],
    [TV.SHEETS.PROGRAMS, TV.PROGRAM_HEADERS],
    [TV.SHEETS.MEDIA, TV.MEDIA_HEADERS],
    [TV.SHEETS.ENTITIES, TV.ENTITY_HEADERS],
    [TV.SHEETS.ENTITY_MEDIA, TV.ENTITY_MEDIA_HEADERS],
    [TV.SHEETS.SCHEDULE, TV.SCHEDULE_HEADERS]
  ];

  definitions.forEach(function(def) {
    const name = def[0];
    const required = def[1];
    try {
      const sheet = getTvSheet_(name);
      const headers = getTvHeaders_(sheet);
      const missing = required.filter(function(h) { return headers.indexOf(h) === -1; });
      if (missing.length) errors.push(name + ': faltan columnas: ' + missing.join(', '));
      const duplicates = duplicateValues_(headers.filter(Boolean));
      if (duplicates.length) errors.push(name + ': cabeceras duplicadas: ' + duplicates.join(', '));
      stats[name] = Math.max(0, sheet.getLastRow() - 1);
    } catch (error) {
      errors.push(error.message);
    }
  });

  if (errors.some(function(msg) { return /^No existe la hoja/.test(msg); })) {
    return { ok: false, generated_at: new Date().toISOString(), errors: errors, warnings: warnings, stats: stats };
  }

  try {
    validateTvCatalogReferences_(errors, warnings);
  } catch (error) {
    errors.push('Validación de referencias: ' + error.message);
  }

  try {
    const pendingReviewCount = tvReadObjects_(getTvSheet_(TV.SHEETS.MEDIA)).filter(function(record) {
      return tvIsPendingReview_(record.status);
    }).length;
    stats.pending_review_media = pendingReviewCount;
  } catch (_) {}

  if (!getTvEntitiesSourceUrl_()) {
    warnings.push('TV_ENTITIES_SOURCE_URL no está configurada. _tv_entities puede gestionarse manualmente, pero no se sincronizará automáticamente con una fuente pública.');
  }

  const result = {
    ok: errors.length === 0,
    generated_at: new Date().toISOString(),
    errors: errors,
    warnings: warnings,
    stats: stats
  };
  return result;
}

function validateTvCatalogReferences_(errors, warnings) {
  const channels = readTvChannels_();
  const programs = readTvPrograms_();
  const schedule = readTvSchedule_();
  const mediaSheet = getTvSheet_(TV.SHEETS.MEDIA);
  const entitySheet = getTvSheet_(TV.SHEETS.ENTITIES);
  const relationSheet = getTvSheet_(TV.SHEETS.ENTITY_MEDIA);

  const channelIds = new Set(channels.map(function(c) { return c.channel_id; }).filter(Boolean));
  const programIds = new Set(programs.map(function(p) { return p.program_id; }).filter(Boolean));
  const mediaRecords = tvReadObjects_(mediaSheet);
  const mediaIds = new Set(mediaRecords.map(function(m) { return String(m.media_id || '').trim(); }).filter(Boolean));
  const entityRecords = tvReadObjects_(entitySheet);
  const entityIds = new Set(entityRecords.map(function(e) { return String(e.entity_id || '').trim().toUpperCase(); }).filter(Boolean));
  const relations = tvReadObjects_(relationSheet);
  const activeRelationsByMedia = {};
  relations.forEach(function(record) {
    if (!tvIsActive_(record.status)) return;
    const mediaId = String(record.media_id || '').trim();
    if (!mediaId) return;
    if (!activeRelationsByMedia[mediaId]) activeRelationsByMedia[mediaId] = [];
    activeRelationsByMedia[mediaId].push(record);
  });

  duplicateValues_(Array.from(channelIds)).forEach(function(id) { errors.push('channel_id duplicado: ' + id); });
  findDuplicatesByField_(channels, 'channel_id').forEach(function(id) { errors.push('channel_id duplicado: ' + id); });
  findDuplicatesByField_(programs, 'program_id').forEach(function(id) { errors.push('program_id duplicado: ' + id); });
  findDuplicatesByField_(mediaRecords, 'media_id').forEach(function(id) { errors.push('media_id duplicado: ' + id); });
  findDuplicatesByField_(entityRecords, 'entity_id', function(v) { return String(v || '').trim().toUpperCase(); })
    .forEach(function(id) { errors.push('entity_id duplicado: ' + id); });
  findDuplicatesByField_(schedule, 'schedule_id').forEach(function(id) { errors.push('schedule_id duplicado: ' + id); });

  const providerKeys = {};
  mediaRecords.forEach(function(record) {
    const mediaId = String(record.media_id || '').trim();
    if (!mediaId) {
      errors.push('_tv_media fila ' + record._rowNumber + ': media_id vacío.');
      return;
    }
    const statusKey = tvNormalizeKey_(record.status);
    const allowedStatusKeys = [
      tvNormalizeKey_(TV.MEDIA_STATUS_ACTIVE),
      tvNormalizeKey_(TV.MEDIA_STATUS_INACTIVE),
      tvNormalizeKey_(TV.MEDIA_STATUS_RETIRED),
      tvNormalizeKey_(TV.MEDIA_STATUS_PENDING_REVIEW)
    ];
    if (allowedStatusKeys.indexOf(statusKey) === -1) {
      warnings.push(mediaId + ': status no reconocido: ' + String(record.status || '').trim());
    }

    if (tvIsPendingReview_(record.status)) {
      if (!String(record.review_reason || '').trim()) {
        errors.push(mediaId + ': Pending review sin review_reason.');
      }
      if (!record.review_requested_at) {
        errors.push(mediaId + ': Pending review sin review_requested_at.');
      }
      if (tvNormalizeKey_(record.review_reason) === tvNormalizeKey_(TV.REVIEW_REASON_ORPHANED_MAP_RELATION) &&
          (activeRelationsByMedia[mediaId] || []).length) {
        warnings.push(mediaId + ': sigue en Pending review por relación huérfana, pero actualmente tiene una relación activa.');
      }
    }

    const provider = tvNormalizeProvider_(record.provider);
    const identity = parseTvMediaIdentity_(record);
    if (!provider) errors.push(mediaId + ': provider no reconocido: ' + record.provider);
    if (!identity) {
      warnings.push(mediaId + ': no se pudo resolver provider_id/provider_url/embed_url.');
    } else {
      const key = identity.provider + ':' + identity.provider_id;
      if (providerKeys[key] && providerKeys[key] !== mediaId) {
        errors.push('Proveedor duplicado ' + key + ' en ' + providerKeys[key] + ' y ' + mediaId + '.');
      }
      providerKeys[key] = mediaId;
      if (!String(record.provider_url || '').trim()) warnings.push(mediaId + ': provider_url vacío.');
      if (!String(record.embed_url || '').trim()) warnings.push(mediaId + ': embed_url vacío.');
    }

    const programId = String(record.program_id || '').trim();
    if (programId && !programIds.has(programId)) errors.push(mediaId + ': program_id inexistente: ' + programId);

    tvList_(record.channels).forEach(function(channelId) {
      if (!channelIds.has(channelId)) errors.push(mediaId + ': canal inexistente: ' + channelId);
    });

    if (tvIsActive_(record.status) && !programId) {
      warnings.push(mediaId + ': Activo pero sin program_id; no entrará en program_rotation salvo que esté vinculado a una entidad.');
    }

    if (tvIsActive_(record.status) && !tvBoolean_(record.embeddable, false)) {
      warnings.push(mediaId + ': Activo pero embeddable no es TRUE.');
    }

    if (provider && TV.FRONTEND_SUPPORTED_PROVIDERS.indexOf(provider) === -1 && tvIsActive_(record.status)) {
      warnings.push(mediaId + ': provider=' + provider + ' está catalogado, pero el frontend actual no lo reproduce todavía.');
    }
  });

  const relationKeys = {};
  const primaryByEntity = {};
  relations.forEach(function(record) {
    const entityId = String(record.entity_id || '').trim().toUpperCase();
    const mediaId = String(record.media_id || '').trim();
    const key = entityId + '|' + mediaId;
    if (relationKeys[key]) errors.push('_tv_entity_media: relación duplicada ' + key + '.');
    relationKeys[key] = true;
    if (!entityIds.has(entityId)) errors.push('_tv_entity_media: entity_id inexistente ' + entityId + '.');
    if (!mediaIds.has(mediaId)) errors.push('_tv_entity_media: media_id inexistente ' + mediaId + '.');
    if (tvIsActive_(record.status) && tvBoolean_(record.is_primary, false)) {
      primaryByEntity[entityId] = (primaryByEntity[entityId] || 0) + 1;
    }
  });
  Object.keys(primaryByEntity).forEach(function(entityId) {
    if (primaryByEntity[entityId] > 1) warnings.push(entityId + ': tiene más de una relación primaria activa.');
  });

  schedule.forEach(function(rule) {
    if (!rule.schedule_id) return;
    if (rule.channel_id !== '*' && !channelIds.has(rule.channel_id)) {
      errors.push(rule.schedule_id + ': channel_id inexistente: ' + rule.channel_id);
    }
    if (rule.program_id && !programIds.has(rule.program_id)) {
      errors.push(rule.schedule_id + ': program_id inexistente: ' + rule.program_id);
    }
    if (rule.media_id && !mediaIds.has(rule.media_id)) {
      errors.push(rule.schedule_id + ': media_id inexistente: ' + rule.media_id);
    }
    if (TV.VALID_SELECTION_RULES.indexOf(rule.selection_rule) === -1) {
      errors.push(rule.schedule_id + ': selection_rule no válida: ' + rule.selection_rule);
    }
    if (!/^\d{2}:\d{2}$/.test(rule.start) || !/^\d{2}:\d{2}$/.test(rule.end)) {
      errors.push(rule.schedule_id + ': horario inválido (' + rule.start + '–' + rule.end + ').');
    }
  });
}

function duplicateValues_(values) {
  const seen = new Set();
  const dupes = new Set();
  values.forEach(function(value) {
    const key = String(value || '').trim();
    if (!key) return;
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  });
  return Array.from(dupes);
}

function findDuplicatesByField_(records, field, normalizer) {
  const normalize = normalizer || function(v) { return String(v || '').trim(); };
  const seen = new Set();
  const dupes = new Set();
  records.forEach(function(record) {
    const key = normalize(record[field]);
    if (!key) return;
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  });
  return Array.from(dupes);
}

function showTvValidation() {
  const result = validateTvProject();
  const lines = [
    result.ok ? 'VALIDACIÓN OK' : 'VALIDACIÓN CON ERRORES',
    '',
    'Errores: ' + result.errors.length,
    'Avisos: ' + result.warnings.length
  ];
  if (result.errors.length) lines.push('', 'ERRORES', result.errors.slice(0, 30).join('\n'));
  if (result.warnings.length) lines.push('', 'AVISOS', result.warnings.slice(0, 30).join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
  console.log(JSON.stringify(result, null, 2));
  return result;
}
