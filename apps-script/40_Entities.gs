/*
 * ARCHIPIÉLAGO VIVO TV · ENTIDADES
 *
 * _tv_entities y _tv_entity_media son locales a TV.
 * La sincronización consume una fuente JSON PÚBLICA del Mapa.
 * Nunca se abre la hoja de cálculo del Mapa.
 *
 * Las relaciones creadas por este sincronizador usan relation_type=map_profile.
 * Esa marca permite retirar/desactivar solo relaciones automáticas sin tocar
 * relaciones editoriales creadas manualmente en TV.
 */

function promptTvEntitiesSourceUrl() {
  const ui = SpreadsheetApp.getUi();
  const current = getTvEntitiesSourceUrl_();
  const response = ui.prompt(
    'Fuente pública de entidades',
    'Introduce la URL JSON completa que TV debe usar como snapshot público de entidades.\n\nActual:\n' + (current || '(sin configurar)'),
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  setTvEntitiesSourceUrl(response.getResponseText());
}

function setTvEntitiesSourceUrl(url) {
  const value = String(url || '').trim();
  if (value && !/^https:\/\//i.test(value)) {
    throw new Error('La fuente de entidades debe usar HTTPS.');
  }
  const props = PropertiesService.getScriptProperties();
  if (value) props.setProperty(TV.PROPERTIES.ENTITIES_SOURCE_URL, value);
  else props.deleteProperty(TV.PROPERTIES.ENTITIES_SOURCE_URL);

  if (SpreadsheetApp.getActiveSpreadsheet()) {
    SpreadsheetApp.getUi().alert(value ? 'Fuente guardada:\n\n' + value : 'Fuente de entidades eliminada.');
  }
  return value;
}

function getTvEntitiesSourceUrl_() {
  return String(
    PropertiesService.getScriptProperties().getProperty(TV.PROPERTIES.ENTITIES_SOURCE_URL) || ''
  ).trim();
}

function syncTvEntities() {
  const result = syncTvEntitiesInternal_({ silent: false });
  SpreadsheetApp.getUi().alert(
    'Entidades sincronizadas.\n\n' +
    'Entidades recibidas: ' + result.received +
    '\nNuevas: ' + result.entities_created +
    '\nActualizadas: ' + result.entities_updated +
    '\nMarcadas inactivas: ' + result.entities_inactivated +
    '\nRelaciones activas creadas/actualizadas: ' + result.relations_upserted +
    '\nRelaciones automáticas desactivadas: ' + result.relations_inactivated +
    '\nMedia creados: ' + result.media_created +
    '\nMedia ya existentes: ' + result.media_reused +
    '\nMedia enviados a Pending review: ' + result.media_pending_review +
    '\nMedia reactivados al volver la relación: ' + result.media_reactivated +
    '\nVídeos no reconocidos: ' + result.unrecognized_media
  );
  return result;
}

function syncTvEntitiesInternal_(options) {
  const opts = options || {};
  const sourceUrl = getTvEntitiesSourceUrl_();
  if (!sourceUrl) throw new Error('No está configurada TV_ENTITIES_SOURCE_URL.');

  const response = UrlFetchApp.fetch(sourceUrl, {
    method: 'get',
    followRedirects: true,
    muteHttpExceptions: true,
    headers: { Accept: 'application/json' }
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('La fuente pública de entidades respondió HTTP ' + code + '.');
  }

  const payload = JSON.parse(response.getContentText() || 'null');
  const sourceEntities = normalizeTvEntitySourcePayload_(payload);
  const entitySheet = getTvSheet_(TV.SHEETS.ENTITIES);
  const relationSheet = getTvSheet_(TV.SHEETS.ENTITY_MEDIA);
  tvAssertHeaders_(entitySheet, TV.ENTITY_HEADERS);
  tvAssertHeaders_(relationSheet, TV.ENTITY_MEDIA_HEADERS);

  const now = new Date();
  const sourceIds = new Set();
  const orphanCandidates = new Set();
  const reactivationCandidates = new Set();
  const removedEntitiesByMedia = {};

  let entitiesCreated = 0;
  let entitiesUpdated = 0;
  let entitiesInactivated = 0;
  let relationsUpserted = 0;
  let relationsInactivated = 0;
  let mediaCreated = 0;
  let mediaReused = 0;
  let unrecognizedMedia = 0;

  sourceEntities.forEach(function(rawEntity) {
    const entity = normalizeTvEntitySourceRecord_(rawEntity, now);
    if (!entity.entity_id) return;
    sourceIds.add(entity.entity_id);

    const existingRow = tvFindRowByField_(entitySheet, 'entity_id', entity.entity_id, function(v) {
      return String(v || '').trim().toUpperCase();
    });

    if (existingRow) {
      const headers = getTvHeaders_(entitySheet);
      const existing = tvRowToObject_(headers, entitySheet.getRange(existingRow, 1, 1, headers.length).getValues()[0]);
      entity.synced_at = existing.synced_at || now;
      const row = headers.map(function(header) {
        return entity[header] === undefined ? existing[header] : tvSafeSheetValue_(entity[header]);
      });
      entitySheet.getRange(existingRow, 1, 1, headers.length).setValues([row]);
      entitiesUpdated++;
    } else {
      entity.synced_at = now;
      tvAppendObject_(entitySheet, entity);
      entitiesCreated++;
    }

    if (!tvIsActive_(entity.status)) {
      const inactivated = inactivateAllEntityMapRelations_(entity.entity_id);
      relationsInactivated += inactivated.media_ids.length;
      registerOrphanCandidates_(orphanCandidates, removedEntitiesByMedia, inactivated.media_ids, entity.entity_id);
      return;
    }

    const mediaItems = extractEntityMediaItems_(rawEntity);
    const activeMediaIds = [];

    mediaItems.forEach(function(item, mediaIndex) {
      const identity = parseTvMediaIdentity_(item.url, item.provider || '');
      if (!identity) {
        unrecognizedMedia++;
        return;
      }

      const mediaResult = upsertTvMediaIdentity_(identity, {
        type: 'profile',
        program_id: TV.ENTITY_PROGRAM_ID,
        channels: TV.DEFAULT_CHANNEL_ID,
        rights_status: 'embed_only',
        source: TV.MAP_MEDIA_SOURCE,
        status: TV.MEDIA_STATUS_ACTIVE,
        title: mediaIndex === 0 ? entity.name : ''
      });

      if (mediaResult.action === 'created') mediaCreated++;
      else mediaReused++;

      activeMediaIds.push(mediaResult.media_id);

      const relationResult = upsertTvEntityMediaRelation_(entity.entity_id, mediaResult.media_id, {
        relation_type: TV.MAP_RELATION_TYPE,
        is_primary: item.is_primary,
        status: TV.MEDIA_STATUS_ACTIVE
      });

      if (relationResult.action !== 'preserved_manual') relationsUpserted++;
      reactivationCandidates.add(mediaResult.media_id);
    });

    const inactivated = inactivateMissingEntityMapRelations_(entity.entity_id, activeMediaIds);
    relationsInactivated += inactivated.media_ids.length;
    registerOrphanCandidates_(orphanCandidates, removedEntitiesByMedia, inactivated.media_ids, entity.entity_id);
  });

  tvReadObjects_(entitySheet).forEach(function(record) {
    const id = String(record.entity_id || '').trim().toUpperCase();
    if (!id || sourceIds.has(id) || !tvIsActive_(record.status)) return;

    tvPatchRow_(entitySheet, record._rowNumber, { status: TV.MEDIA_STATUS_INACTIVE });
    const inactivated = inactivateAllEntityMapRelations_(id);
    relationsInactivated += inactivated.media_ids.length;
    registerOrphanCandidates_(orphanCandidates, removedEntitiesByMedia, inactivated.media_ids, id);
    entitiesInactivated++;
  });

  SpreadsheetApp.flush();

  const reviewResult = reconcileTvMapMediaReviewState_({
    orphan_candidates: Array.from(orphanCandidates),
    reactivation_candidates: Array.from(reactivationCandidates),
    removed_entities_by_media: removedEntitiesByMedia,
    now: now
  });

  const result = {
    ok: true,
    source_url: sourceUrl,
    received: sourceEntities.length,
    entities_created: entitiesCreated,
    entities_updated: entitiesUpdated,
    entities_inactivated: entitiesInactivated,
    relations_upserted: relationsUpserted,
    relations_inactivated: relationsInactivated,
    media_created: mediaCreated,
    media_reused: mediaReused,
    media_pending_review: reviewResult.pending_review,
    media_reactivated: reviewResult.reactivated,
    unrecognized_media: unrecognizedMedia,
    synced_at: now.toISOString(),
    silent: Boolean(opts.silent)
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function normalizeTvEntitySourcePayload_(payload) {
  if (Array.isArray(payload)) return payload;

  if (payload && payload.type === 'FeatureCollection' && Array.isArray(payload.features)) {
    return payload.features.map(function(feature) {
      const props = Object.assign({}, feature.properties || {});
      if (!props.entity_id && feature.entity_id) props.entity_id = feature.entity_id;
      if (!props.entity_id && feature.id) props.entity_id = feature.id;
      return props;
    });
  }

  if (payload && Array.isArray(payload.entities)) return payload.entities;

  if (payload && payload.entities && typeof payload.entities === 'object') {
    return Object.keys(payload.entities).map(function(id) {
      return Object.assign({ entity_id: id }, payload.entities[id] || {});
    });
  }

  if (payload && payload.data && Array.isArray(payload.data)) return payload.data;

  throw new Error('Formato de fuente de entidades no reconocido. Se esperaba array, FeatureCollection o {entities: ...}.');
}

function normalizeTvEntitySourceRecord_(raw, now) {
  const props = raw && raw.properties ? raw.properties : (raw || {});
  const id = String(props.entity_id || raw.entity_id || raw.id || '').trim().toUpperCase();
  const sourceUpdated = props.source_updated_at || props.updated_at || props.date_revised || props.date_created || '';

  let sourceUpdatedValue = '';
  if (sourceUpdated) {
    const parsed = new Date(sourceUpdated);
    sourceUpdatedValue = isNaN(parsed.getTime()) ? tvSafeSheetValue_(String(sourceUpdated)) : parsed;
  }

  return {
    entity_id: id,
    name: tvSafeSheetValue_(props.name || props.title || ''),
    map_url: tvSafeSheetValue_(props.map_url || props.url_map || props.public_url || ''),
    island: tvSafeSheetValue_(props.island || ''),
    municipality: tvSafeSheetValue_(props.municipality || ''),
    img: tvSafeSheetValue_(props.img || props.image || ''),
    status: !String(props.status || '').trim() || tvIsActive_(props.status)
      ? TV.MEDIA_STATUS_ACTIVE
      : TV.MEDIA_STATUS_INACTIVE,
    source_updated_at: sourceUpdatedValue,
    synced_at: now
  };
}

function extractEntityMediaItems_(raw) {
  const props = raw && raw.properties ? raw.properties : (raw || {});
  const candidates = [];

  ['media', 'video', 'videos', 'video_url', 'video_urls'].forEach(function(field) {
    const value = props[field];
    if (Array.isArray(value)) {
      value.forEach(function(item) { candidates.push(item); });
    } else if (value !== undefined && value !== null && value !== '') {
      candidates.push(value);
    }
  });

  const items = [];

  candidates.forEach(function(value) {
    if (typeof value === 'object' && value !== null) {
      const url = String(value.url || value.provider_url || value.embed_url || '').trim();
      if (!/^https?:\/\//i.test(url)) return;
      items.push({
        url: url,
        provider: String(value.provider || '').trim(),
        is_primary: value.is_primary === undefined || value.is_primary === null
          ? null
          : tvBoolean_(value.is_primary, false)
      });
      return;
    }

    String(value || '')
      .split(/[\n\r,;]+/)
      .map(function(v) { return v.trim(); })
      .filter(function(v) { return /^https?:\/\//i.test(v); })
      .forEach(function(url) {
        items.push({ url: url, provider: '', is_primary: null });
      });
  });

  const deduped = [];
  const seen = new Set();
  items.forEach(function(item) {
    const identity = parseTvMediaIdentity_(item.url, item.provider || '');
    const key = identity ? identity.provider + ':' + identity.provider_id : item.url;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  const explicitPrimaryIndex = deduped.findIndex(function(item) {
    return item.is_primary === true;
  });
  deduped.forEach(function(item, index) {
    item.is_primary = explicitPrimaryIndex >= 0 ? index === explicitPrimaryIndex : index === 0;
  });

  return deduped;
}

function upsertTvEntityMediaRelation_(entityId, mediaId, values) {
  const sheet = getTvSheet_(TV.SHEETS.ENTITY_MEDIA);
  tvAssertHeaders_(sheet, TV.ENTITY_MEDIA_HEADERS);
  const records = tvReadObjects_(sheet);
  const e = String(entityId || '').trim().toUpperCase();
  const m = String(mediaId || '').trim();
  const existing = records.find(function(record) {
    return String(record.entity_id || '').trim().toUpperCase() === e &&
      String(record.media_id || '').trim() === m;
  });

  const record = {
    entity_id: e,
    media_id: m,
    relation_type: values.relation_type || TV.MAP_RELATION_TYPE,
    is_primary: values.is_primary === true,
    status: values.status || TV.MEDIA_STATUS_ACTIVE
  };

  if (!existing) {
    tvAppendObject_(sheet, record);
    return { action: 'created' };
  }

  const existingType = tvNormalizeKey_(existing.relation_type);
  const mapType = tvNormalizeKey_(TV.MAP_RELATION_TYPE);

  let canManage = existingType === mapType;
  if (!canManage && existingType === 'profile') {
    const mediaSheet = getTvSheet_(TV.SHEETS.MEDIA);
    const mediaRow = tvFindRowByField_(mediaSheet, 'media_id', m);
    if (mediaRow) {
      const headers = getTvHeaders_(mediaSheet);
      const mediaRecord = tvRowToObject_(headers, mediaSheet.getRange(mediaRow, 1, 1, headers.length).getValues()[0]);
      canManage = tvIsMapDerivedMedia_(mediaRecord);
    }
  }

  if (!canManage) {
    return { action: 'preserved_manual', rowNumber: existing._rowNumber };
  }

  tvPatchRow_(sheet, existing._rowNumber, record);
  return { action: 'updated', rowNumber: existing._rowNumber };
}

function inactivateMissingEntityMapRelations_(entityId, activeMediaIds) {
  const activeSet = new Set(activeMediaIds || []);
  const sheet = getTvSheet_(TV.SHEETS.ENTITY_MEDIA);
  const affected = [];

  tvReadObjects_(sheet).forEach(function(record) {
    if (String(record.entity_id || '').trim().toUpperCase() !== String(entityId || '').trim().toUpperCase()) return;
    if (tvNormalizeKey_(record.relation_type) !== tvNormalizeKey_(TV.MAP_RELATION_TYPE)) return;

    const mediaId = String(record.media_id || '').trim();
    if (activeSet.has(mediaId)) return;
    if (!tvIsActive_(record.status)) return;

    tvPatchRow_(sheet, record._rowNumber, {
      status: TV.MEDIA_STATUS_INACTIVE,
      is_primary: false
    });
    affected.push(mediaId);
  });

  return { media_ids: tvUnique_(affected) };
}

function inactivateAllEntityMapRelations_(entityId) {
  const sheet = getTvSheet_(TV.SHEETS.ENTITY_MEDIA);
  const affected = [];

  tvReadObjects_(sheet).forEach(function(record) {
    if (String(record.entity_id || '').trim().toUpperCase() !== String(entityId || '').trim().toUpperCase()) return;
    if (tvNormalizeKey_(record.relation_type) !== tvNormalizeKey_(TV.MAP_RELATION_TYPE)) return;
    if (!tvIsActive_(record.status)) return;

    tvPatchRow_(sheet, record._rowNumber, {
      status: TV.MEDIA_STATUS_INACTIVE,
      is_primary: false
    });
    affected.push(String(record.media_id || '').trim());
  });

  return { media_ids: tvUnique_(affected) };
}

function registerOrphanCandidates_(candidateSet, removedEntitiesByMedia, mediaIds, entityId) {
  (mediaIds || []).forEach(function(mediaId) {
    const id = String(mediaId || '').trim();
    if (!id) return;
    candidateSet.add(id);
    if (!removedEntitiesByMedia[id]) removedEntitiesByMedia[id] = [];
    removedEntitiesByMedia[id].push(String(entityId || '').trim().toUpperCase());
  });
}

function readTvEntitiesForExport_() {
  const sheet = getTvSheet_(TV.SHEETS.ENTITIES);
  const entities = {};
  tvReadObjects_(sheet).forEach(function(record) {
    const id = String(record.entity_id || '').trim().toUpperCase();
    if (!id || !tvIsActive_(record.status)) return;
    entities[id] = {
      entity_id: id,
      name: String(record.name || '').trim(),
      map_url: String(record.map_url || '').trim(),
      island: String(record.island || '').trim(),
      municipality: String(record.municipality || '').trim(),
      img: String(record.img || '').trim(),
      status: String(record.status || '').trim(),
      source_updated_at: tvDateIso_(record.source_updated_at),
      synced_at: tvDateIso_(record.synced_at)
    };
  });
  return entities;
}

function readTvEntityRelationsForExport_() {
  const sheet = getTvSheet_(TV.SHEETS.ENTITY_MEDIA);
  return tvReadObjects_(sheet)
    .filter(function(record) { return tvIsActive_(record.status); })
    .map(function(record) {
      return {
        entity_id: String(record.entity_id || '').trim().toUpperCase(),
        media_id: String(record.media_id || '').trim(),
        relation_type: String(record.relation_type || '').trim(),
        is_primary: tvBoolean_(record.is_primary, false),
        status: String(record.status || '').trim()
      };
    });
}
