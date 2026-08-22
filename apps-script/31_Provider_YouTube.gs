/** TV App · PROVEEDOR YOUTUBE */

function parseYouTubeIdentity_(providerId, candidates) {
  let id = String(providerId || '').trim();
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return {
      provider: 'youtube',
      provider_id: id,
      provider_url: 'https://www.youtube.com/watch?v=' + id,
      embed_url: 'https://www.youtube.com/embed/' + id
    };
  }

  const list = candidates || [];
  for (let i = 0; i < list.length; i++) {
    id = parseYouTubeVideoId_(list[i]);
    if (id) {
      return {
        provider: 'youtube',
        provider_id: id,
        provider_url: 'https://www.youtube.com/watch?v=' + id,
        embed_url: 'https://www.youtube.com/embed/' + id
      };
    }
  }
  return null;
}

function parseYouTubeVideoId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;

  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) return match[1];
  }
  return '';
}

function refreshTvMediaYouTubeMetadata() {
  const result = refreshTvMediaYouTubeMetadataInternal_();

  SpreadsheetApp.getUi().alert(
    'YouTube · metadatos marcados\n\n' +
    'Marcados: ' + result.total +
    '\nActualizados: ' + result.updated +
    '\nNo disponibles / errores: ' + result.errors.length +
    '\nNo embebibles: ' + result.not_embeddable
  );

  return result;
}

function refreshTvMediaYouTubeMetadataInternal_() {
  assertYouTubeAdvancedService_();

  const sheet = getTvSheet_(TV.SHEETS.MEDIA);

  tvAssertHeaders_(
    sheet,
    TV.MEDIA_HEADERS
  );

  const records = tvReadObjects_(sheet).filter(function(record) {
    const isYoutube =
      tvNormalizeProvider_(record.provider) === 'youtube' ||
      /^YT-/i.test(
        String(record.media_id || '')
      );

    return (
      isYoutube &&
      tvBoolean_(record.refresh_metadata, false)
    );
  });

  const normalized = [];
  const errors = [];

  records.forEach(function(record) {
    const identity = parseTvMediaIdentity_(record);

    if (
      identity &&
      identity.provider === 'youtube'
    ) {
      normalized.push({
        record: record,
        identity: identity
      });
      return;
    }

    const message = 'No se pudo resolver la identidad YouTube.';

    tvPatchMediaTechnical_(
      record._rowNumber,
      {
        refresh_metadata: true,
        metadata_refresh_error: message
      }
    );

    errors.push(
      String(
        record.media_id ||
        'fila ' + record._rowNumber
      ) +
      ': ' +
      message
    );
  });

  const ids = tvUnique_(
    normalized.map(function(item) {
      return item.identity.provider_id;
    })
  );

  let metadata = {};

  try {
    metadata = fetchYouTubeMetadataByIds_(ids);
  } catch (error) {
    normalized.forEach(function(item) {
      const message = error.message || String(error);

      tvPatchMediaTechnical_(
        item.record._rowNumber,
        {
          refresh_metadata: true,
          metadata_refresh_error: message
        }
      );

      errors.push(
        String(
          item.record.media_id ||
          item.identity.provider_id
        ) +
        ': ' +
        message
      );
    });

    SpreadsheetApp.flush();

    return {
      total: records.length,
      updated: 0,
      unavailable: normalized.length,
      not_embeddable: 0,
      updated_media_ids: [],
      errors: errors
    };
  }

  let updated = 0;
  let unavailable = 0;
  let notEmbeddable = 0;
  const updatedMediaIds = [];

  normalized.forEach(function(item) {
    const meta = metadata[item.identity.provider_id];
    const mediaId = String(
      item.record.media_id ||
      buildTvMediaId_(item.identity)
    );

    if (!meta) {
      unavailable++;

      const message = 'Vídeo no disponible en YouTube Data API.';

      tvPatchMediaTechnical_(
        item.record._rowNumber,
        {
          refresh_metadata: true,
          metadata_refresh_error: message
        }
      );

      errors.push(mediaId + ': ' + message);
      return;
    }

    if (meta.embeddable === false) {
      notEmbeddable++;
    }

    tvPatchMediaTechnical_(
      item.record._rowNumber,
      {
        provider: 'youtube',
        provider_id: item.identity.provider_id,
        provider_url: item.identity.provider_url,
        embed_url: item.identity.embed_url,
        title: meta.title,
        description: meta.description,
        channel_title: meta.channel_title,
        thumbnail: meta.thumbnail,
        published_at: meta.published_at,
        youtube_tags: meta.youtube_tags,
        duration_seconds: meta.duration_seconds,
        youtube_license: meta.youtube_license,
        embeddable: meta.embeddable === true,
        privacy_status: meta.privacy_status,
        metadata_updated_at: new Date(),
        refresh_metadata: false,
        metadata_refresh_error: ''
      }
    );

    updated++;
    updatedMediaIds.push(mediaId);
  });

  SpreadsheetApp.flush();

  return {
    total: records.length,
    updated: updated,
    unavailable: unavailable,
    not_embeddable: notEmbeddable,
    updated_media_ids: updatedMediaIds,
    errors: errors
  };
}

function assertYouTubeAdvancedService_() {
  if (typeof YouTube === 'undefined') {
    throw new Error(
      'YouTube Data API v3 no está habilitada como servicio avanzado. ' +
      'Añádela en Servicios (+) del editor Apps Script.'
    );
  }
}

function fetchYouTubeMetadataByIds_(ids) {
  const result = {};
  for (let offset = 0; offset < ids.length; offset += 50) {
    const chunk = ids.slice(offset, offset + 50);
    if (!chunk.length) continue;
    const response = YouTube.Videos.list('snippet,contentDetails,status', {
      id: chunk.join(','),
      maxResults: 50
    });
    (response.items || []).forEach(function(item) {
      result[item.id] = normalizeYouTubeMetadata_(item);
    });
  }
  return result;
}

function normalizeYouTubeMetadata_(item) {
  const snippet = item.snippet || {};
  const details = item.contentDetails || {};
  const status = item.status || {};
  return {
    title: snippet.title || '',
    description: snippet.description || '',
    channel_title: snippet.channelTitle || '',
    thumbnail: pickBestYouTubeThumbnail_(snippet.thumbnails || {}),
    published_at: snippet.publishedAt ? new Date(snippet.publishedAt) : '',
    youtube_tags: Array.isArray(snippet.tags) ? snippet.tags.join(', ') : '',
    duration_seconds: parseIso8601DurationSeconds_(details.duration),
    youtube_license: status.license || '',
    embeddable: status.embeddable,
    privacy_status: status.privacyStatus || ''
  };
}

function pickBestYouTubeThumbnail_(thumbnails) {
  const preference = ['maxres', 'standard', 'high', 'medium', 'default'];
  for (let i = 0; i < preference.length; i++) {
    const candidate = thumbnails[preference[i]];
    if (candidate && candidate.url) return candidate.url;
  }
  return '';
}

function parseIso8601DurationSeconds_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return '';
  return Number(match[1] || 0) * 86400 +
    Number(match[2] || 0) * 3600 +
    Number(match[3] || 0) * 60 +
    Number(match[4] || 0);
}

function diagnoseTvYouTubeEmbeddability() {
  assertYouTubeAdvancedService_();
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  const records = tvReadObjects_(sheet).filter(function(record) {
    return tvNormalizeProvider_(record.provider) === 'youtube';
  });
  const ids = tvUnique_(records.map(function(record) {
    const identity = parseTvMediaIdentity_(record);
    return identity ? identity.provider_id : '';
  }));
  const metadata = fetchYouTubeMetadataByIds_(ids);
  const blocked = [];
  const unavailable = [];

  ids.forEach(function(id) {
    if (!metadata[id]) unavailable.push(id);
    else if (metadata[id].embeddable === false) blocked.push(id + ' — ' + metadata[id].title);
  });

  SpreadsheetApp.getUi().alert(
    'Diagnóstico YouTube\n\n' +
    'No embebibles: ' + blocked.length +
    '\nNo disponibles: ' + unavailable.length +
    (blocked.length ? '\n\n' + blocked.slice(0, 50).join('\n') : '')
  );
  return { blocked: blocked, unavailable: unavailable };
}
