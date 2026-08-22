/** ARCHIPIÉLAGO VIVO TV · CATÁLOGO MULTIPROVEEDOR */

function normalizeTvMediaProviders() {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  tvAssertHeaders_(sheet, TV.MEDIA_HEADERS);
  const headers = getTvHeaders_(sheet);
  const index = tvHeaderIndex_(headers);
  const values = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];

  let updated = 0;
  let unresolved = 0;

  values.forEach(function(row, i) {
    const rowNumber = i + 2;
    const record = tvRowToObject_(headers, row);
    const parsed = parseTvMediaIdentity_(record);
    if (!parsed) {
      unresolved++;
      return;
    }

    const patch = {};
    ['provider', 'provider_id', 'provider_url', 'embed_url'].forEach(function(field) {
      if (String(record[field] || '').trim() !== String(parsed[field] || '').trim()) {
        patch[field] = parsed[field];
      }
    });

    if (Object.keys(patch).length) {
      tvPatchRow_(sheet, rowNumber, patch, TV.MEDIA_TECHNICAL_PATCH_FIELDS);
      updated++;
    }
  });

  SpreadsheetApp.flush();
  const result = { ok: true, updated: updated, unresolved: unresolved };
  SpreadsheetApp.getUi().alert(
    'Identidades de proveedor normalizadas.\n\nActualizadas: ' + updated +
    '\nSin resolver: ' + unresolved
  );
  return result;
}

function refreshTvMediaMetadata() {
  const result = refreshTvMediaMetadataInternal_({ silent: false });
  SpreadsheetApp.getUi().alert(
    'Metadatos marcados actualizados.\n\n' +
    'YouTube: ' + JSON.stringify(result.youtube) + '\n' +
    'Vimeo: ' + JSON.stringify(result.vimeo) + '\n' +
    'PeerTube: ' + JSON.stringify(result.peertube) + '\n' +
    'Direct: ' + JSON.stringify(result.direct)
  );
  return result;
}

function refreshTvMediaMetadataInternal_(options) {
  const opts = options || {};
  return {
    youtube: refreshTvMediaYouTubeMetadataInternal_({ silent: true }),
    vimeo: refreshTvMediaVimeoMetadataInternal_({ silent: true }),
    peertube: refreshTvMediaPeerTubeMetadataInternal_({ silent: true }),
    direct: refreshTvMediaDirectMetadataInternal_({ silent: true }),
    silent: Boolean(opts.silent)
  };
}

function parseTvMediaIdentity_(recordOrUrl, providerHint) {
  const record = typeof recordOrUrl === 'object' && recordOrUrl !== null
    ? recordOrUrl
    : { provider_url: recordOrUrl, provider: providerHint || '' };

  const provider = tvNormalizeProvider_(record.provider || providerHint || '');
  const providerId = String(record.provider_id || '').trim();
  const candidates = [record.provider_url, record.embed_url, record.url]
    .map(function(v) { return String(v || '').trim(); })
    .filter(Boolean);

  const byProvider = function(name) {
    if (name === 'youtube') return parseYouTubeIdentity_(providerId, candidates);
    if (name === 'vimeo') return parseVimeoIdentity_(providerId, candidates);
    if (name === 'peertube') return parsePeerTubeIdentity_(providerId, candidates);
    if (name === 'direct') return parseDirectIdentity_(providerId, candidates);
    return null;
  };

  if (provider) {
    const parsed = byProvider(provider);
    if (parsed) return parsed;
  }

  for (const name of ['youtube', 'vimeo', 'peertube', 'direct']) {
    const parsed = byProvider(name);
    if (parsed) return parsed;
  }

  const mediaId = String(record.media_id || '').trim();
  if (/^YT-/i.test(mediaId)) return parseYouTubeIdentity_(mediaId.replace(/^YT-/i, ''), candidates);
  if (/^VM-/i.test(mediaId)) return parseVimeoIdentity_(mediaId.replace(/^VM-/i, ''), candidates);
  if (/^PT-/i.test(mediaId)) return parsePeerTubeIdentity_(mediaId.replace(/^PT-/i, ''), candidates);

  return null;
}

function tvNormalizeProvider_(value) {
  const key = tvNormalizeKey_(value).replace(/_/g, '');
  if (['youtube', 'yt'].indexOf(key) !== -1) return 'youtube';
  if (['vimeo', 'vm'].indexOf(key) !== -1) return 'vimeo';
  if (['peertube', 'pt'].indexOf(key) !== -1) return 'peertube';
  if (['direct', 'html5', 'file', 'video'].indexOf(key) !== -1) return 'direct';
  return '';
}

function buildTvMediaId_(identity) {
  if (!identity) return '';
  if (identity.provider === 'youtube') return 'YT-' + identity.provider_id;
  if (identity.provider === 'vimeo') return 'VM-' + identity.provider_id;
  if (identity.provider === 'peertube') return 'PT-' + identity.provider_id;
  if (identity.provider === 'direct') return 'AV-' + tvSha256Hex_(identity.provider_url).slice(0, 16).toUpperCase();
  return '';
}

function upsertTvMediaIdentity_(identity, defaults) {
  if (!identity || !identity.provider || !identity.provider_id) {
    throw new Error('Identidad de media incompleta.');
  }

  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  tvAssertHeaders_(sheet, TV.MEDIA_HEADERS);
  const mediaId = buildTvMediaId_(identity);
  const existingRow = tvFindRowByField_(sheet, 'media_id', mediaId);

  if (existingRow) {
    tvPatchRow_(sheet, existingRow, {
      provider: identity.provider,
      provider_id: identity.provider_id,
      provider_url: identity.provider_url,
      embed_url: identity.embed_url
    }, TV.MEDIA_TECHNICAL_PATCH_FIELDS);
    return { action: 'updated', media_id: mediaId, rowNumber: existingRow };
  }

  const d = defaults || {};
  const record = {
    media_id: mediaId,
    provider: identity.provider,
    provider_id: identity.provider_id,
    provider_url: identity.provider_url,
    embed_url: identity.embed_url,
    title: d.title || '',
    type: d.type || 'profile',
    program_id: d.program_id || TV.ENTITY_PROGRAM_ID,
    tv_description: d.tv_description || '',
    tags: d.tags || '',
    channels: d.channels || TV.DEFAULT_CHANNEL_ID,
    rights_status: d.rights_status || 'embed_only',
    source: d.source || 'manual',
    status: d.status || TV.DEFAULT_STATUS,
    embeddable: d.embeddable === undefined ? '' : d.embeddable,
    privacy_status: d.privacy_status || '',
    description: d.description || '',
    channel_title: '',
    thumbnail: d.thumbnail || '',
    published_at: '',
    youtube_tags: '',
    duration_seconds: '',
    youtube_license: '',
    metadata_updated_at: '',
    review_note: '',
    review_reason: '',
    review_requested_at: '',
    reviewed_at: '',
    reviewed_by: '',
    refresh_metadata: true,
    metadata_refresh_error: ''
  };
  return { action: 'created', media_id: mediaId, rowNumber: tvAppendObject_(sheet, record) };
}

function tvPatchMediaTechnical_(rowNumber, patch) {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  const safe = {};
  Object.keys(patch || {}).forEach(function(field) {
    if (TV.MEDIA_TECHNICAL_PATCH_FIELDS.indexOf(field) !== -1) safe[field] = patch[field];
  });
  tvPatchRow_(sheet, rowNumber, safe, TV.MEDIA_TECHNICAL_PATCH_FIELDS);
}

function parseDirectIdentity_(providerId, candidates) {
  const url = candidates.find(function(v) {
    return /^https?:\/\//i.test(v) && /\.(mp4|webm|ogg|ogv|m3u8)(?:[?#].*)?$/i.test(v);
  });
  if (!url && !providerId) return null;
  const providerUrl = url || '';
  const id = providerId || tvSha256Hex_(providerUrl).slice(0, 24);
  if (!providerUrl) return null;
  return {
    provider: 'direct',
    provider_id: id,
    provider_url: providerUrl,
    embed_url: providerUrl
  };
}

function refreshTvMediaDirectMetadataInternal_() {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  tvAssertHeaders_(sheet, TV.MEDIA_HEADERS);
  const records = tvReadObjects_(sheet).filter(function(record) {
    return (
      tvNormalizeProvider_(record.provider) === 'direct' &&
      tvBoolean_(record.refresh_metadata, false)
    );
  });

  let updated = 0;
  let unavailable = 0;
  const errors = [];

  records.forEach(function(record) {
    const parsed = parseTvMediaIdentity_(record);
    if (!parsed) {
      const message = 'No se pudo resolver la identidad de vídeo directo.';
      tvPatchMediaTechnical_(record._rowNumber, {
        refresh_metadata: true,
        metadata_refresh_error: message
      });
      errors.push(String(record.media_id || 'fila ' + record._rowNumber) + ': ' + message);
      unavailable++;
      return;
    }

    tvPatchMediaTechnical_(record._rowNumber, {
      provider: parsed.provider,
      provider_id: parsed.provider_id,
      provider_url: parsed.provider_url,
      embed_url: parsed.embed_url,
      embeddable: true,
      metadata_updated_at: new Date(),
      refresh_metadata: false,
      metadata_refresh_error: ''
    });
    updated++;
  });

  return {
    total: records.length,
    updated: updated,
    unavailable: unavailable,
    errors: errors
  };
}

function tvIsMapDerivedMedia_(record) {
  const source = tvNormalizeKey_(record && record.source);
  return TV.MAP_MEDIA_SOURCES.some(function(value) {
    return tvNormalizeKey_(value) === source;
  });
}

function tvIsPendingReview_(value) {
  return tvNormalizeKey_(value) === tvNormalizeKey_(TV.MEDIA_STATUS_PENDING_REVIEW);
}

function reconcileTvMapMediaReviewState_(options) {
  const opts = options || {};
  const orphanCandidates = new Set((opts.orphan_candidates || []).map(function(v) {
    return String(v || '').trim();
  }).filter(Boolean));
  const reactivationCandidates = new Set((opts.reactivation_candidates || []).map(function(v) {
    return String(v || '').trim();
  }).filter(Boolean));
  const removedEntitiesByMedia = opts.removed_entities_by_media || {};
  const now = opts.now instanceof Date ? opts.now : new Date();

  if (!orphanCandidates.size && !reactivationCandidates.size) {
    return { pending_review: 0, reactivated: 0 };
  }

  const relationSheet = getTvSheet_(TV.SHEETS.ENTITY_MEDIA);
  const mediaSheet = getTvSheet_(TV.SHEETS.MEDIA);
  tvAssertHeaders_(relationSheet, TV.ENTITY_MEDIA_HEADERS);
  tvAssertHeaders_(mediaSheet, TV.MEDIA_HEADERS);

  const activeRelationsByMedia = {};
  const activeMapRelationsByMedia = {};

  tvReadObjects_(relationSheet).forEach(function(record) {
    if (!tvIsActive_(record.status)) return;
    const mediaId = String(record.media_id || '').trim();
    if (!mediaId) return;

    if (!activeRelationsByMedia[mediaId]) activeRelationsByMedia[mediaId] = [];
    activeRelationsByMedia[mediaId].push(record);

    if (tvNormalizeKey_(record.relation_type) === tvNormalizeKey_(TV.MAP_RELATION_TYPE)) {
      if (!activeMapRelationsByMedia[mediaId]) activeMapRelationsByMedia[mediaId] = [];
      activeMapRelationsByMedia[mediaId].push(record);
    }
  });

  const mediaById = {};
  tvReadObjects_(mediaSheet).forEach(function(record) {
    const mediaId = String(record.media_id || '').trim();
    if (mediaId) mediaById[mediaId] = record;
  });

  let pendingReview = 0;
  let reactivated = 0;

  orphanCandidates.forEach(function(mediaId) {
    const record = mediaById[mediaId];
    if (!record) return;
    if ((activeRelationsByMedia[mediaId] || []).length) return;
    if (!tvIsMapDerivedMedia_(record)) return;
    if (!tvIsActive_(record.status)) return;

    const entityIds = tvUnique_((removedEntitiesByMedia[mediaId] || []).map(function(v) {
      return String(v || '').trim().toUpperCase();
    }));

    const note = [
      'La última relación automática ' + TV.MAP_RELATION_TYPE + ' de este medio ha desaparecido del snapshot público del Mapa.',
      entityIds.length ? 'Entidad(es) afectada(s): ' + entityIds.join(', ') + '.' : '',
      'El medio queda fuera de programación hasta revisión editorial.',
      'Detectado: ' + now.toISOString()
    ].filter(Boolean).join(' ');

    tvPatchRow_(mediaSheet, record._rowNumber, {
      status: TV.MEDIA_STATUS_PENDING_REVIEW,
      review_reason: TV.REVIEW_REASON_ORPHANED_MAP_RELATION,
      review_requested_at: now,
      review_note: note,
      reviewed_at: '',
      reviewed_by: ''
    });
    pendingReview++;
  });

  reactivationCandidates.forEach(function(mediaId) {
    const record = mediaById[mediaId];
    if (!record) return;
    if (!(activeMapRelationsByMedia[mediaId] || []).length) return;
    if (!tvIsMapDerivedMedia_(record)) return;
    if (!tvIsPendingReview_(record.status)) return;
    if (tvNormalizeKey_(record.review_reason) !== tvNormalizeKey_(TV.REVIEW_REASON_ORPHANED_MAP_RELATION)) return;

    tvPatchRow_(mediaSheet, record._rowNumber, {
      status: TV.MEDIA_STATUS_ACTIVE,
      review_reason: '',
      review_requested_at: '',
      review_note: '',
      reviewed_at: '',
      reviewed_by: ''
    });
    reactivated++;
  });

  SpreadsheetApp.flush();
  return { pending_review: pendingReview, reactivated: reactivated };
}
