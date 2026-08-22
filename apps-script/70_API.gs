/** TV App · WEB APP / SOURCE API */

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const type = tvNormalizeKey_(params.export || 'tv');
    let payload;
    if (type === 'tv') payload = buildTvExport();
    else if (type === 'validate' || type === 'validation') payload = validateTvProject();
    else if (type === 'health') payload = buildTvHealth_();
    else if (type === 'manifest') payload = buildTvManifest_();
    else payload = { ok: false, status: 400, error: 'Invalid export: ' + type, allowed: ['tv', 'validate', 'health', 'manifest'] };
    return tvJsonResponse_(payload, params.callback);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return tvJsonResponse_({ ok: false, status: 500, error: error.message || String(error), generated_at: new Date().toISOString() }, e && e.parameter ? e.parameter.callback : '');
  }
}

function buildTvHealth_() {
  const validation = validateTvProject();
  return {
    ok: validation.ok,
    service: TV.NAME,
    schema_version: TV.SCHEMA_VERSION,
    time: new Date().toISOString(),
    timezone: TV.TIMEZONE,
    spreadsheet_id: PropertiesService.getScriptProperties().getProperty(TV.PROPERTIES.SPREADSHEET_ID) || '',
    entities_source_configured: Boolean(getTvEntitiesSourceUrl_()),
    validation: {
      errors: validation.errors.length,
      warnings: validation.warnings.length
    }
  };
}

function buildTvManifest_() {
  const serviceUrl = ScriptApp.getService().getUrl() || '';
  return {
    name: TV.NAME,
    schema_version: TV.SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    endpoints: {
      tv: serviceUrl ? serviceUrl + '?export=tv' : '',
      validate: serviceUrl ? serviceUrl + '?export=validate' : '',
      health: serviceUrl ? serviceUrl + '?export=health' : '',
      manifest: serviceUrl ? serviceUrl + '?export=manifest' : ''
    },
    public_feed_target: TV.PUBLIC_FEED_TARGET || '',
    note: 'This Web App is the synchronization source. Public TV clients should consume the configured static feed when available.'
  };
}

function showTvExportUrls() {
  const serviceUrl = ScriptApp.getService().getUrl();
  if (!serviceUrl) {
    SpreadsheetApp.getUi().alert('There is no active Web App deployment yet.');
    return;
  }
  SpreadsheetApp.getUi().alert(
    'TV\n' + serviceUrl + '?export=tv' +
    '\n\nVALIDATE\n' + serviceUrl + '?export=validate' +
    '\n\nHEALTH\n' + serviceUrl + '?export=health' +
    '\n\nMANIFEST\n' + serviceUrl + '?export=manifest'
  );
}
