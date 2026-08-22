/** ARCHIPIÉLAGO VIVO TV · EXPORT PÚBLICO · SCHEMA v2 */

function buildTvExport() {
  const validation = validateTvProject();
  const channels = readTvChannels_();
  const programs = readTvPrograms_();
  const schedule = readTvSchedule_();
  const entities = readTvEntitiesForExport_();
  const relations = readTvEntityRelationsForExport_();
  const mediaResult = readTvMediaForExport_(entities, relations);

  const playableEntityMedia = mediaResult.media.filter(function(item) {
    return item.type === 'entity' && item.playable === true && item.entity_id;
  });
  const playableEntityIds = tvUnique_(playableEntityMedia.map(function(item) { return item.entity_id; }));
  const totalDurationSeconds = playableEntityMedia.reduce(function(sum, item) {
    const seconds = Number(item.duration_seconds || 0);
    return sum + (Number.isFinite(seconds) ? seconds : 0);
  }, 0);
  const fullCycleHours = tvRotationHoursForMinutes_(totalDurationSeconds / 60);

  const legacy = buildLegacyEntityCompatibility_(entities, relations, mediaResult.media);
  const warnings = validation.warnings.concat(mediaResult.warnings);
  const errors = validation.errors.concat(mediaResult.errors);

  return {
    schema_version: TV.SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    timezone: TV.TIMEZONE,

    channel: {
      name: TV.NAME
    },

    tv_config: {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      name: TV.NAME,
      default_channel_id: TV.DEFAULT_CHANNEL_ID,
      timezone: TV.TIMEZONE,
      channel_switching: true,
      storage_model: 'normalized_entities_v1',
      frontend_supported_providers: TV.FRONTEND_SUPPORTED_PROVIDERS.slice()
    },

    presentation: TV.PRESENTATION,

    channels: channels,
    programs: programs,
    media: mediaResult.media,
    schedule: schedule,

    policy: {
      entity_rotation: {
        selection_order: [
          'deadline_risk',
          'least_recently_aired',
          'fewest_historical_airs',
          'deterministic_entity_id'
        ],
        total_playable_entities: playableEntityIds.length,
        total_playable_media: playableEntityMedia.length,
        total_duration_seconds: totalDurationSeconds,
        current_full_cycle_hours: fullCycleHours,
        tiers: TV.ROTATION_TIERS
      },
      entity_new: {
        new_for_hours: TV.NEW_ENTITY_HOURS,
        selection_rule: 'entity_new',
        premium_windows: ['09:00', '13:30', '18:30', '21:30'],
        basis: 'first_synced_to_tv'
      },
      rights: {
        external_allowed_statuses: TV.EXTERNAL_RIGHTS_ALLOWED.slice(),
        entity_rule: 'La entidad y su relación media deben estar activas; el medio debe ser reproducible.'
      },
      providers: {
        catalog_supported: TV.PROVIDERS.slice(),
        frontend_playback_supported: TV.FRONTEND_SUPPORTED_PROVIDERS.slice()
      }
    },

    entities: entities,
    entity_media: relations,

    videos: legacy.videos,
    conflicts: legacy.conflicts,

    warnings: warnings
  };
}

function readTvMediaForExport_(entities, relations) {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  tvAssertHeaders_(sheet, TV.MEDIA_HEADERS);
  const now = Date.now();
  const warnings = [];
  const errors = [];

  const relationsByMedia = {};
  relations.forEach(function(relation) {
    if (!relationsByMedia[relation.media_id]) relationsByMedia[relation.media_id] = [];
    relationsByMedia[relation.media_id].push(relation);
  });

  Object.keys(relationsByMedia).forEach(function(mediaId) {
    relationsByMedia[mediaId].sort(function(a, b) {
      return Number(b.is_primary) - Number(a.is_primary) || a.entity_id.localeCompare(b.entity_id);
    });
  });

  const media = tvReadObjects_(sheet).map(function(record) {
    const mediaId = String(record.media_id || '').trim();
    const provider = tvNormalizeProvider_(record.provider);
    const identity = parseTvMediaIdentity_(record);
    const providerId = identity ? identity.provider_id : String(record.provider_id || '').trim();
    const providerUrl = identity ? identity.provider_url : String(record.provider_url || '').trim();
    const embedUrl = identity ? identity.embed_url : String(record.embed_url || '').trim();
    const internalType = String(record.type || '').trim();
    const status = String(record.status || '').trim();
    const pendingReview = tvIsPendingReview_(status);
    const active = tvIsActive_(status) && !pendingReview;
    const embeddable = tvBoolean_(record.embeddable, false);
    const privacyStatus = String(record.privacy_status || '').trim();
    const rightsStatus = String(record.rights_status || '').trim();

    const mediaRelations = (relationsByMedia[mediaId] || []).filter(function(rel) {
      return Boolean(entities[rel.entity_id]);
    });
    const primaryRelation = mediaRelations.find(function(rel) { return rel.is_primary; }) || mediaRelations[0] || null;
    const entityId = primaryRelation ? primaryRelation.entity_id : '';
    const entityIds = tvUnique_(mediaRelations.map(function(rel) { return rel.entity_id; }));
    const isEntityMedia = Boolean(entityId);
    const publicType = isEntityMedia ? 'entity' : internalType;

    const providerSupported = TV.FRONTEND_SUPPORTED_PROVIDERS.indexOf(provider) !== -1;
    let rightsAllowed = isEntityMedia;
    if (!isEntityMedia) {
      rightsAllowed = TV.EXTERNAL_RIGHTS_ALLOWED.indexOf(tvNormalizeKey_(rightsStatus)) !== -1;
      if (active && !rightsAllowed) {
        warnings.push(mediaId + ': Activo pero rights_status no permite emisión automática (' + (rightsStatus || 'vacío') + ').');
      }
    }

    let isNewEntity = false;
    let entityCreatedAt = '';
    if (entityId && entities[entityId]) {
      const entity = entities[entityId];
      entityCreatedAt = entity.synced_at || entity.source_updated_at || '';
      const seenMs = entity.synced_at ? new Date(entity.synced_at).getTime() : NaN;
      if (Number.isFinite(seenMs)) {
        isNewEntity = (now - seenMs) <= TV.NEW_ENTITY_HOURS * 3600000;
      }
    }

    const playable = active &&
      !pendingReview &&
      providerSupported &&
      embeddable === true &&
      tvNormalizeKey_(privacyStatus) !== 'private' &&
      rightsAllowed &&
      Boolean(providerId) &&
      (!isEntityMedia || Boolean(entityId));

    const programId = String(record.program_id || '').trim();
    const schedulable = playable && (isEntityMedia || Boolean(programId));

    return {
      media_id: mediaId,
      provider: provider,
      provider_id: providerId,
      provider_url: providerUrl,
      embed_url: embedUrl,
      youtube_id: provider === 'youtube' ? providerId : '',
      type: publicType,
      media_type: internalType,
      program_id: programId,
      tv_description: String(record.tv_description || '').trim(),
      display_description: String(record.tv_description || record.description || '').trim(),
      tags: tvList_(record.tags),
      channels: tvList_(record.channels),
      rights_status: rightsStatus,
      source: String(record.source || '').trim(),
      status: status,
      embeddable: embeddable,
      privacy_status: privacyStatus,
      title: String(record.title || '').trim(),
      description: String(record.description || '').trim(),
      channel_title: String(record.channel_title || '').trim(),
      thumbnail: String(record.thumbnail || '').trim(),
      published_at: tvDateIso_(record.published_at),
      youtube_tags: String(record.youtube_tags || '').trim(),
      duration_seconds: tvNullableNumber_(record.duration_seconds),
      youtube_license: String(record.youtube_license || '').trim(),
      metadata_updated_at: tvDateIso_(record.metadata_updated_at),
      entity_id: entityId,
      entity_ids: entityIds,
      entity_relation_type: primaryRelation ? primaryRelation.relation_type : '',
      entity_created_at: entityCreatedAt,
      is_new_entity: isNewEntity,
      active: active,
      review_required: pendingReview,
      provider_supported_by_frontend: providerSupported,
      playable: playable,
      schedulable: schedulable
    };
  });

  return { media: media, warnings: warnings, errors: errors };
}

function buildLegacyEntityCompatibility_(entities, relations, media) {
  const videos = {};
  const conflicts = {};
  const mediaById = {};
  media.forEach(function(item) { mediaById[item.media_id] = item; });

  relations.forEach(function(relation) {
    const item = mediaById[relation.media_id];
    const entity = entities[relation.entity_id];
    if (!item || !entity || item.provider !== 'youtube' || !item.provider_id) return;

    const mapping = {
      entity_id: entity.entity_id,
      name: entity.name,
      map_url: entity.map_url,
      img: entity.img || '',
      date_created: entity.synced_at || entity.source_updated_at || ''
    };

    if (videos[item.provider_id]) {
      conflicts[item.provider_id] = conflicts[item.provider_id] || [videos[item.provider_id]];
      conflicts[item.provider_id].push(mapping);
      delete videos[item.provider_id];
    } else if (conflicts[item.provider_id]) {
      conflicts[item.provider_id].push(mapping);
    } else {
      videos[item.provider_id] = mapping;
    }
  });

  return { videos: videos, conflicts: conflicts };
}

function tvRotationHoursForMinutes_(totalMinutes) {
  const minutes = Number(totalMinutes || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  for (let i = 0; i < TV.ROTATION_TIERS.length; i++) {
    const tier = TV.ROTATION_TIERS[i];
    if (tier.max_minutes === null || minutes <= tier.max_minutes) return tier.full_cycle_hours;
  }
  return 720;
}

function showTvExportSummary() {
  const feed = buildTvExport();
  const message = [
    'Export TV schema v' + feed.schema_version,
    '',
    'Válido: ' + feed.tv_config.valid,
    'Canales: ' + feed.channels.length,
    'Programas: ' + feed.programs.length,
    'Media: ' + feed.media.length,
    'Media reproducible: ' + feed.media.filter(function(m) { return m.playable; }).length,
    'Entidades: ' + Object.keys(feed.entities).length,
    'Relaciones entidad↔media: ' + feed.entity_media.length,
    'Reglas de parrilla: ' + feed.schedule.length,
    'Errores: ' + feed.tv_config.errors.length,
    'Avisos: ' + feed.tv_config.warnings.length
  ].join('\n');
  SpreadsheetApp.getUi().alert(message);
  return feed;
}
