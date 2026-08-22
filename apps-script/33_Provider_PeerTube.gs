/** ARCHIPIÉLAGO VIVO TV · PROVEEDOR PEERTUBE */

function parsePeerTubeIdentity_(providerId, candidates) {
  let id = String(providerId || '').trim();
  let origin = '';

  (candidates || []).some(function(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(https?:\/\/[^/]+)\/(?:w\/|videos\/watch\/|videos\/embed\/)([A-Za-z0-9-]+)/i);
    if (!match) return false;
    origin = match[1];
    id = match[2];
    return true;
  });

  if (!id || !origin) return null;
  return {
    provider: 'peertube',
    provider_id: id,
    provider_url: origin + '/videos/watch/' + id,
    embed_url: origin + '/videos/embed/' + id,
    origin: origin
  };
}

function refreshTvMediaPeerTubeMetadataInternal_() {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  tvAssertHeaders_(sheet, TV.MEDIA_HEADERS);
  const records = tvReadObjects_(sheet).filter(function(record) {
    return tvNormalizeProvider_(record.provider) === 'peertube';
  });

  let updated = 0;
  let unavailable = 0;

  records.forEach(function(record) {
    const identity = parseTvMediaIdentity_(record);
    if (!identity || !identity.origin) { unavailable++; return; }

    try {
      const endpoint = identity.origin + '/api/v1/videos/' + encodeURIComponent(identity.provider_id);
      const response = UrlFetchApp.fetch(endpoint, {
        method: 'get', muteHttpExceptions: true, followRedirects: true,
        headers: { Accept: 'application/json' }
      });
      if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) { unavailable++; return; }

      const data = JSON.parse(response.getContentText() || '{}');
      const thumbnail = data.thumbnailPath
        ? identity.origin + data.thumbnailPath
        : (data.previewPath ? identity.origin + data.previewPath : record.thumbnail || '');
      const channelTitle = data.channel && (data.channel.displayName || data.channel.name)
        ? (data.channel.displayName || data.channel.name)
        : record.channel_title || '';
      const privacy = data.privacy && (data.privacy.label || data.privacy.id)
        ? String(data.privacy.label || data.privacy.id)
        : record.privacy_status || '';

      tvPatchMediaTechnical_(record._rowNumber, {
        provider: 'peertube', provider_id: identity.provider_id,
        provider_url: identity.provider_url, embed_url: identity.embed_url,
        title: data.name || record.title || '', description: data.description || record.description || '',
        channel_title: channelTitle, thumbnail: thumbnail,
        published_at: data.publishedAt ? new Date(data.publishedAt) : record.published_at,
        duration_seconds: data.duration === undefined ? record.duration_seconds : data.duration,
        privacy_status: privacy, embeddable: true, metadata_updated_at: new Date()
      });
      updated++;
    } catch (error) {
      console.warn('PeerTube ' + identity.provider_id + ': ' + error.message);
      unavailable++;
    }
  });

  return { total: records.length, updated: updated, unavailable: unavailable };
}
