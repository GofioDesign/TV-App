/** TV App · PROVEEDOR VIMEO */

function parseVimeoIdentity_(providerId, candidates) {
  let id = String(providerId || '').trim();
  let original = '';
  let unlistedHash = '';

  (candidates || []).some(function(value) {
    const text = String(value || '').trim();
    const match = text.match(/https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)(?:\/([A-Za-z0-9]+))?/i) ||
      text.match(/https?:\/\/player\.vimeo\.com\/video\/(\d+)(?:\?[^#]*h=([A-Za-z0-9]+))?/i);
    if (!match) return false;
    id = match[1];
    unlistedHash = match[2] || '';
    original = text;
    return true;
  });

  if (!/^\d+$/.test(id)) return null;
  const providerUrl = original && /^https?:\/\/(?:www\.)?vimeo\.com\//i.test(original)
    ? original
    : 'https://vimeo.com/' + id + (unlistedHash ? '/' + unlistedHash : '');
  const embedUrl = 'https://player.vimeo.com/video/' + id + (unlistedHash ? '?h=' + encodeURIComponent(unlistedHash) : '');

  return { provider: 'vimeo', provider_id: id, provider_url: providerUrl, embed_url: embedUrl };
}

function refreshTvMediaVimeoMetadataInternal_() {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  tvAssertHeaders_(sheet, TV.MEDIA_HEADERS);
  const records = tvReadObjects_(sheet).filter(function(record) {
    return (
      tvNormalizeProvider_(record.provider) === 'vimeo' &&
      tvBoolean_(record.refresh_metadata, false)
    );
  });

  let updated = 0;
  let unavailable = 0;
  const errors = [];

  records.forEach(function(record) {
    const identity = parseTvMediaIdentity_(record);
    if (!identity) {
      const message = 'No se pudo resolver la identidad Vimeo.';
      tvPatchMediaTechnical_(record._rowNumber, {
        refresh_metadata: true,
        metadata_refresh_error: message
      });
      errors.push(String(record.media_id || 'fila ' + record._rowNumber) + ': ' + message);
      unavailable++;
      return;
    }

    try {
      const endpoint = 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(identity.provider_url);
      const response = UrlFetchApp.fetch(endpoint, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { Accept: 'application/json' }
      });
      const responseCode = response.getResponseCode();
      if (responseCode < 200 || responseCode >= 300) {
        const message = 'Vimeo oEmbed respondió HTTP ' + responseCode + '.';
        tvPatchMediaTechnical_(record._rowNumber, {
          refresh_metadata: true,
          metadata_refresh_error: message
        });
        errors.push(String(record.media_id || identity.provider_id) + ': ' + message);
        unavailable++;
        return;
      }
      const data = JSON.parse(response.getContentText() || '{}');
      const embedFromHtml = extractIframeSrc_(data.html || '') || identity.embed_url;

      tvPatchMediaTechnical_(record._rowNumber, {
        provider: 'vimeo',
        provider_id: identity.provider_id,
        provider_url: identity.provider_url,
        embed_url: embedFromHtml,
        title: data.title || record.title || '',
        channel_title: data.author_name || record.channel_title || '',
        thumbnail: data.thumbnail_url || record.thumbnail || '',
        duration_seconds: data.duration === undefined ? record.duration_seconds : data.duration,
        published_at: data.upload_date ? new Date(data.upload_date) : record.published_at,
        embeddable: true,
        metadata_updated_at: new Date(),
        refresh_metadata: false,
        metadata_refresh_error: ''
      });
      updated++;
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      tvPatchMediaTechnical_(record._rowNumber, {
        refresh_metadata: true,
        metadata_refresh_error: message
      });
      console.warn('Vimeo ' + identity.provider_id + ': ' + message);
      errors.push(String(record.media_id || identity.provider_id) + ': ' + message);
      unavailable++;
    }
  });

  return {
    total: records.length,
    updated: updated,
    unavailable: unavailable,
    errors: errors
  };
}

function extractIframeSrc_(html) {
  const match = String(html || '').match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match ? match[1].replace(/&amp;/g, '&') : '';
}
