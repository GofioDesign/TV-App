/** TV App · UTILIDADES */

function setupTvProject() {
  const active = SpreadsheetApp.getActiveSpreadsheet();

  if (!active) {
    throw new Error(
      'Open ' + (TV.DATABASE_NAME || 'TV App — DB') + ' and run setupTvProject() from its bound Apps Script project.'
    );
  }

  PropertiesService.getScriptProperties()
    .setProperty(
      TV.PROPERTIES.SPREADSHEET_ID,
      active.getId()
    );

  /*
   * Solo migramos las nuevas columnas necesarias
   * para el refresco selectivo de metadatos.
   */
  const metadataMigration =
    ensureTvMediaMetadataRefreshColumns_();

  const validation = validateTvProject();

  const message = [
    'Proyecto TV registrado.',
    '',
    'Spreadsheet ID: ' + active.getId(),
    'Validación: ' + (validation.ok ? 'OK' : 'CON ERRORES'),
    'Errores: ' + validation.errors.length,
    'Avisos: ' + validation.warnings.length,
    'Columnas de actualización añadidas: ' +
      metadataMigration.added.length
  ].join('\n');

  SpreadsheetApp.getUi().alert(message);

  console.log(
    JSON.stringify(validation, null, 2)
  );

  return validation;
}

function ensureTvMediaReviewColumns_() {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);
  const headers = getTvHeaders_(sheet);
  const missing = TV.MEDIA_REVIEW_HEADERS.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (!missing.length) return { ok: true, added: [] };

  const startColumn = Math.max(1, sheet.getLastColumn() + 1);
  sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
  SpreadsheetApp.flush();
  return { ok: true, added: missing };
}

function ensureTvMediaMetadataRefreshColumns_() {
  const sheet = getTvSheet_(TV.SHEETS.MEDIA);

  let headers = getTvHeaders_(sheet);

  const required = [
    'refresh_metadata',
    'metadata_refresh_error'
  ];

  const missing = required.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (missing.length) {
    const startColumn =
      Math.max(1, sheet.getLastColumn() + 1);

    sheet
      .getRange(
        1,
        startColumn,
        1,
        missing.length
      )
      .setValues([missing]);

    SpreadsheetApp.flush();

    headers = getTvHeaders_(sheet);
  }

  const index = tvHeaderIndex_(headers);
  const refreshColumn = index.refresh_metadata;

  if (
    refreshColumn !== undefined &&
    sheet.getMaxRows() > 1
  ) {
    const checkboxRule =
      SpreadsheetApp
        .newDataValidation()
        .requireCheckbox()
        .setAllowInvalid(false)
        .build();

    sheet
      .getRange(
        2,
        refreshColumn + 1,
        sheet.getMaxRows() - 1,
        1
      )
      .setDataValidation(checkboxRule);
  }

  SpreadsheetApp.flush();

  return {
    ok: true,
    added: missing
  };
}

function getTvSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = String(props.getProperty(TV.PROPERTIES.SPREADSHEET_ID) || '').trim();

  if (!id) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) {
      throw new Error('No existe TV_SPREADSHEET_ID. Ejecuta setupTvProject() una vez desde la hoja TV.');
    }
    id = active.getId();
    props.setProperty(TV.PROPERTIES.SPREADSHEET_ID, id);
    return active;
  }

  return SpreadsheetApp.openById(id);
}

function getTvSheet_(name) {
  const sheet = getTvSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('No existe la hoja "' + name + '".');
  return sheet;
}

function getTvHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function(value) { return String(value || '').trim(); });
}

function tvHeaderIndex_(headers) {
  const index = {};
  headers.forEach(function(header, i) {
    const key = String(header || '').trim();
    if (key && index[key] === undefined) index[key] = i;
  });
  return index;
}

function tvRowToObject_(headers, row) {
  const obj = {};
  headers.forEach(function(header, i) {
    obj[String(header || '').trim()] = row[i];
  });
  return obj;
}

function tvReadObjects_(sheet) {
  const headers = getTvHeaders_(sheet);
  if (!headers.length || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, i) {
    const obj = tvRowToObject_(headers, row);
    Object.defineProperty(obj, '_rowNumber', { value: i + 2, enumerable: false });
    return obj;
  });
}

function tvAssertHeaders_(sheet, requiredHeaders) {
  const headers = getTvHeaders_(sheet);
  const missing = requiredHeaders.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missing.length) {
    throw new Error('Faltan columnas en ' + sheet.getName() + ': ' + missing.join(', '));
  }
  return headers;
}

function tvNormalizeKey_(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function tvIsActive_(value) {
  const key = tvNormalizeKey_(value);
  return ['activo', 'active', 'published', 'public', 'si', 'yes', 'true', '1'].indexOf(key) !== -1;
}

function tvBoolean_(value, fallback) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const key = tvNormalizeKey_(value);
  if (['true', 'si', 'yes', '1', 'activo', 'active'].indexOf(key) !== -1) return true;
  if (['false', 'no', '0', 'inactivo', 'inactive'].indexOf(key) !== -1) return false;
  return fallback === undefined ? false : Boolean(fallback);
}

function tvList_(value) {
  if (Array.isArray(value)) {
    return value.map(function(v) { return String(v || '').trim(); }).filter(Boolean);
  }
  return String(value == null ? '' : value)
    .split(/[\n\r,;]+/)
    .map(function(v) { return v.trim(); })
    .filter(Boolean);
}

function tvUnique_(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function tvNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function tvDateIso_(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value).trim() : d.toISOString();
}

function tvTimeHHmm_(value) {
  if (value === '' || value === null || value === undefined) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TV.TIMEZONE, 'HH:mm');
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const totalMinutes = Math.round((((value % 1) + 1) % 1) * 24 * 60) % (24 * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hh = Math.min(23, Number(match[1]));
    const mm = Math.min(59, Number(match[2]));
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, TV.TIMEZONE, 'HH:mm');
  return text;
}

function tvCleanCell_(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  return typeof value === 'string' ? value.trim() : value;
}

function tvSha256Hex_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    const n = (b + 256) % 256;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function tvFindRowByField_(sheet, field, value, normalizer) {
  const headers = getTvHeaders_(sheet);
  const index = headers.indexOf(field);
  if (index === -1) throw new Error('No existe ' + field + ' en ' + sheet.getName());
  const normalize = normalizer || function(v) { return String(v == null ? '' : v).trim(); };
  const needle = normalize(value);
  if (sheet.getLastRow() < 2) return null;
  const values = sheet.getRange(2, index + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (normalize(values[i][0]) === needle) return i + 2;
  }
  return null;
}

function tvPatchRow_(sheet, rowNumber, patch, allowedFields) {
  const headers = getTvHeaders_(sheet);
  const index = tvHeaderIndex_(headers);
  const allowed = allowedFields ? new Set(allowedFields) : null;

  Object.keys(patch).forEach(function(field) {
    if (allowed && !allowed.has(field)) {
      throw new Error('Intento de modificar un campo no permitido: ' + field);
    }
    if (index[field] === undefined) return;
    sheet.getRange(rowNumber, index[field] + 1).setValue(patch[field]);
  });
}

function tvAppendObject_(sheet, record) {
  const headers = getTvHeaders_(sheet);
  const row = headers.map(function(header) {
    return record[header] === undefined ? '' : record[header];
  });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function tvUpsertByField_(sheet, keyField, record, options) {
  const opts = options || {};
  const keyValue = record[keyField];
  if (!String(keyValue == null ? '' : keyValue).trim()) {
    throw new Error('Falta ' + keyField + ' para upsert en ' + sheet.getName());
  }

  const rowNumber = tvFindRowByField_(sheet, keyField, keyValue, opts.normalizer);
  if (!rowNumber) {
    return { action: 'created', rowNumber: tvAppendObject_(sheet, record) };
  }

  const headers = getTvHeaders_(sheet);
  const existing = tvRowToObject_(headers, sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]);
  const merged = {};
  headers.forEach(function(header) {
    if (opts.preserveExisting && opts.preserveExisting.indexOf(header) !== -1 && existing[header] !== '') {
      merged[header] = existing[header];
    } else if (record[header] !== undefined) {
      merged[header] = record[header];
    } else {
      merged[header] = existing[header];
    }
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map(function(h) { return merged[h] === undefined ? '' : merged[h]; })
  ]);
  return { action: 'updated', rowNumber: rowNumber };
}

function tvJsonResponse_(payload, callback) {
  const json = JSON.stringify(payload);
  const cb = String(callback || '').trim();
  if (cb) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(cb)) {
      throw new Error('callback JSONP no válido.');
    }
    return ContentService.createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function tvSafeUrl_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) return '';
  return text;
}

function tvOperator_() {
  try {
    return Session.getEffectiveUser().getEmail() || 'script';
  } catch (_) {
    return 'script';
  }
}

function tvSafeSheetValue_(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
