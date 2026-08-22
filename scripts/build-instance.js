#!/usr/bin/env node

/**
 * TV App instance builder
 *
 * Usage:
 *   node scripts/build-instance.js presets/archipielago-vivo/app.config.json
 *   node scripts/build-instance.js path/to/app.config.json dist/my-tv
 *
 * app.config.json is the single source of instance-specific customization.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const inputArg = process.argv[2] || 'web/config.json';
const CONFIG_PATH = path.resolve(ROOT, inputArg);

if (!fs.existsSync(CONFIG_PATH)) {
  fail(`Config file not found: ${CONFIG_PATH}`);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
validateConfig(config);

const instanceId = safeName(config.instance_id || 'tv-app');
const outputArg = process.argv[3] || path.join('dist', instanceId);
const OUT = path.resolve(ROOT, outputArg);
const OUT_WEB = path.join(OUT, 'web');
const OUT_APPS = path.join(OUT, 'apps-script');
const configDir = path.dirname(CONFIG_PATH);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT_WEB, { recursive: true });
fs.mkdirSync(OUT_APPS, { recursive: true });

buildWeb();
buildAppsScript();
writeJson(path.join(OUT, 'build.json'), {
  tv_app_schema_version: config.schema_version,
  instance_id: config.instance_id,
  source_config: path.relative(ROOT, CONFIG_PATH).replaceAll('\\', '/'),
  generated_at: new Date().toISOString()
});

console.log(`TV App instance built: ${path.relative(ROOT, OUT)}`);

function buildWeb() {
  const runtimeFiles = [
    'index.html',
    'app.js',
    'runtime-config.js',
    'tv-engine.js',
    'tv-player.js',
    'styles.css',
    'tv-info.css'
  ];

  for (const file of runtimeFiles) {
    copyFile(path.join(ROOT, 'web', file), path.join(OUT_WEB, file));
  }

  // Always ship the generic fallback brand asset.
  copyDirIfPresent(
    path.join(ROOT, 'web', 'assets'),
    path.join(OUT_WEB, 'assets')
  );

  // Instance assets override generic assets with the same path.
  copyDirIfPresent(
    path.join(configDir, 'assets'),
    path.join(OUT_WEB, 'assets')
  );

  writeJson(path.join(OUT_WEB, 'config.json'), config);

  const indexPath = path.join(OUT_WEB, 'index.html');
  const index = fs.readFileSync(indexPath, 'utf8');
  fs.writeFileSync(indexPath, injectStaticMetadata(index, config));

  writeJson(path.join(OUT_WEB, 'site.webmanifest'), buildWebManifest(config));
  fs.writeFileSync(path.join(OUT_WEB, 'robots.txt'), buildRobots(config));

  if (config.site_url) {
    fs.writeFileSync(path.join(OUT_WEB, 'sitemap.xml'), buildSitemap(config));
  }

  const cname = clean(config.deployment && config.deployment.cname);
  if (cname) fs.writeFileSync(path.join(OUT_WEB, 'CNAME'), `${cname}\n`);
}

function buildAppsScript() {
  const src = path.join(ROOT, 'apps-script');
  const files = fs.readdirSync(src)
    .filter(file => file.endsWith('.gs') || file === 'appsscript.json')
    .filter(file => file !== '00_Instance_Config.gs');

  for (const file of files) {
    copyFile(path.join(src, file), path.join(OUT_APPS, file));
  }

  fs.writeFileSync(
    path.join(OUT_APPS, '00_Instance_Config.gs'),
    buildAppsScriptInstanceConfig(config)
  );

  const manifestPath = path.join(OUT_APPS, 'appsscript.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.timeZone = config.timezone || 'UTC';
  writeJson(manifestPath, manifest);
}

function buildAppsScriptInstanceConfig(c) {
  const b = c.backend || {};
  const providers = array(c.providers, ['youtube', 'vimeo', 'peertube', 'direct']);
  const sources = array(b.entity_media_sources, ['entity-sync']);
  const rights = array(b.external_rights_allowed, ['embed_only', 'authorized']);

  return `/**
 * TV App · INSTANCE CONFIGURATION
 * Generated from ${path.basename(CONFIG_PATH)}. Do not edit the built copy manually.
 */

const TV_INSTANCE = Object.freeze({
  NAME: ${js(c.name || 'TV App')},
  MENU_NAME: ${js(b.menu_name || c.name || 'TV App')},
  DATABASE_NAME: ${js(b.database_name || `${c.name || 'TV App'} — DB`)},
  TIMEZONE: ${js(c.timezone || 'UTC')},
  PUBLIC_FEED_TARGET: ${js(b.public_feed_target || (c.data && c.data.feed_url) || '')},

  DEFAULT_CHANNEL_ID: ${js(b.default_channel_id || c.default_channel || 'general')},
  ENTITY_PROGRAM_ID: ${js(b.entity_program_id || 'entities')},
  DEFAULT_STATUS: ${js(b.default_status || 'Active')},
  REQUEST_PENDING_STATUS: ${js(b.request_pending_status || 'Pending')},

  MEDIA_STATUS_ACTIVE: ${js(b.media_status_active || 'Active')},
  MEDIA_STATUS_INACTIVE: ${js(b.media_status_inactive || 'Inactive')},
  MEDIA_STATUS_RETIRED: ${js(b.media_status_retired || 'Retired')},
  MEDIA_STATUS_PENDING_REVIEW: ${js(b.media_status_pending_review || 'Pending review')},
  ORPHANED_RELATION_REASON: ${js(b.orphaned_relation_reason || 'orphaned_entity_relation')},

  ENTITY_RELATION_TYPE: ${js(b.entity_relation_type || 'entity_profile')},
  ENTITY_MEDIA_SOURCE: ${js(b.entity_media_source || 'entity-sync')},
  ENTITY_MEDIA_SOURCES: Object.freeze(${JSON.stringify(sources)}),

  EXTERNAL_RIGHTS_ALLOWED: Object.freeze(${JSON.stringify(rights)}),
  NEW_ENTITY_HOURS: ${number(b.new_entity_hours, 72)},
  FRONTEND_SUPPORTED_PROVIDERS: Object.freeze(${JSON.stringify(providers)})
});
`;
}

function injectStaticMetadata(html, c) {
  const branding = c.branding || {};
  const seo = c.seo || {};
  const publisher = c.publisher || {};
  const canonical = clean(seo.canonical_url || c.site_url);
  const image = absoluteUrl(branding.social_image, c.site_url);
  const title = seo.title || c.name || 'TV App';
  const description = seo.description || '';
  const locale = c.locale || '';

  const staticMeta = [
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${attr(description)}">`,
    `  <meta name="application-name" content="${attr(c.name || 'TV App')}">`,
    `  <meta name="theme-color" content="${attr(branding.theme_color || '#000000')}">`,
    `  <meta name="color-scheme" content="${attr(branding.color_scheme || 'dark')}">`,
    `  <meta name="robots" content="${attr(seo.robots || 'noindex,nofollow')}">`,
    canonical ? `  <link rel="canonical" href="${attr(canonical)}">` : '  <link rel="canonical">',
    `  <link id="tvFavicon" rel="icon" href="${attr(branding.favicon || 'favicon.ico')}" sizes="any">`,
    '',
    `  <meta property="og:type" content="${attr(seo.og_type || 'website')}">`,
    locale ? `  <meta property="og:locale" content="${attr(locale)}">` : '',
    `  <meta property="og:site_name" content="${attr(seo.og_site_name || c.name || 'TV App')}">`,
    `  <meta property="og:title" content="${attr(title)}">`,
    `  <meta property="og:description" content="${attr(description)}">`,
    canonical ? `  <meta property="og:url" content="${attr(canonical)}">` : '',
    image ? `  <meta property="og:image" content="${attr(image)}">` : '',
    image ? `  <meta property="og:image:secure_url" content="${attr(image)}">` : '',
    image ? '  <meta property="og:image:type" content="image/png">' : '',
    image ? '  <meta property="og:image:width" content="1200">' : '',
    image ? '  <meta property="og:image:height" content="630">' : '',
    image ? `  <meta property="og:image:alt" content="${attr(branding.logo_alt || c.name || 'TV App')}">` : '',
    '',
    `  <meta name="twitter:card" content="${attr(seo.twitter_card || 'summary_large_image')}">`,
    seo.twitter_site ? `  <meta name="twitter:site" content="${attr(seo.twitter_site)}">` : '',
    seo.twitter_creator ? `  <meta name="twitter:creator" content="${attr(seo.twitter_creator)}">` : '',
    `  <meta name="twitter:title" content="${attr(title)}">`,
    `  <meta name="twitter:description" content="${attr(description)}">`,
    image ? `  <meta name="twitter:image" content="${attr(image)}">` : '',
    image ? `  <meta name="twitter:image:alt" content="${attr(branding.logo_alt || c.name || 'TV App')}">` : '',
    '',
    `  <script id="tvStructuredData" type="application/ld+json">${JSON.stringify(buildStructuredData(c))}</script>`,
    ''
  ].filter(Boolean).join('\n');

  const pattern = /  <title>[\s\S]*?(?=  <link rel="stylesheet" href="styles\.css">)/;
  if (!pattern.test(html)) fail('Could not locate the static metadata block in web/index.html');
  return html.replace(pattern, `${staticMeta}\n`);
}

function buildStructuredData(c) {
  const seo = c.seo || {};
  const branding = c.branding || {};
  const publisher = c.publisher || {};
  const canonical = clean(seo.canonical_url || c.site_url) || 'https://example.invalid/';
  const image = absoluteUrl(branding.social_image, c.site_url);
  const graph = [];
  const orgId = publisher.url
    ? `${publisher.url.replace(/\/$/, '')}/#organization`
    : `${canonical}#publisher`;

  if (publisher.name) {
    const org = { '@type': 'Organization', '@id': orgId, name: publisher.name };
    if (publisher.url) org.url = publisher.url;
    if (publisher.email) org.email = publisher.email;
    graph.push(org);
  }

  let imageId = '';
  if (image) {
    imageId = `${canonical}#primaryimage`;
    graph.push({
      '@type': 'ImageObject',
      '@id': imageId,
      url: image,
      contentUrl: image,
      width: 1200,
      height: 630,
      caption: c.name || 'TV App'
    });
  }

  const websiteId = `${canonical}#website`;
  const website = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: canonical,
    name: c.name || 'TV App',
    alternateName: c.short_name || c.name || 'TV App',
    description: seo.description || '',
    inLanguage: c.language || 'en'
  };
  if (publisher.name) website.publisher = { '@id': orgId };
  graph.push(website);

  const webpage = {
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: seo.title || c.name || 'TV App',
    description: seo.description || '',
    inLanguage: c.language || 'en',
    isPartOf: { '@id': websiteId }
  };
  if (publisher.name) webpage.about = { '@id': orgId };
  if (imageId) webpage.primaryImageOfPage = { '@id': imageId };
  graph.push(webpage);

  return { '@context': 'https://schema.org', '@graph': graph };
}

function buildWebManifest(c) {
  const b = c.branding || {};
  return {
    name: c.name || 'TV App',
    short_name: c.short_name || c.name || 'TV App',
    start_url: './',
    display: 'standalone',
    background_color: b.theme_color || '#000000',
    theme_color: b.theme_color || '#000000',
    icons: []
  };
}

function buildRobots(c) {
  const robots = String(c.seo && c.seo.robots || '').toLowerCase();
  const blocked = robots.includes('noindex');
  const lines = ['User-agent: *', blocked ? 'Disallow: /' : 'Allow: /'];
  if (!blocked && c.site_url) {
    lines.push(`Sitemap: ${new URL('sitemap.xml', c.site_url).toString()}`);
  }
  return `${lines.join('\n')}\n`;
}

function buildSitemap(c) {
  const url = clean(c.seo && c.seo.canonical_url || c.site_url);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${xml(url)}</loc>\n  </url>\n</urlset>\n`;
}

function validateConfig(c) {
  if (!c || typeof c !== 'object') fail('Config must be a JSON object.');
  if (Number(c.schema_version || 0) < 2) fail('app.config.json requires schema_version >= 2.');
  if (!clean(c.instance_id)) fail('instance_id is required.');
  if (!clean(c.name)) fail('name is required.');
  if (!Array.isArray(c.providers) || !c.providers.length) fail('providers must be a non-empty array.');
}

function copyFile(from, to) {
  if (!fs.existsSync(from)) fail(`Required source file not found: ${from}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDirIfPresent(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true, force: true });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function safeName(value) {
  return String(value || 'tv-app').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function array(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function number(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function js(value) {
  return JSON.stringify(String(value == null ? '' : value));
}

function absoluteUrl(value, base) {
  const v = clean(value);
  if (!v) return '';
  try {
    return new URL(v, clean(base) || 'https://example.invalid/').toString();
  } catch (_) {
    return v;
  }
}

function esc(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function attr(value) {
  return esc(value).replaceAll('"', '&quot;');
}

function xml(value) {
  return attr(value).replaceAll("'", '&apos;');
}

function fail(message) {
  console.error(`TV App build error: ${message}`);
  process.exit(1);
}
