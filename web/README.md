# TV App web frontend

The `web/` directory contains the reusable TV App browser client.

It is intentionally instance-neutral. Names, URLs, branding, navigation, SEO metadata, interface copy, request links, analytics integration and deployment details come from `config.json`.

## Development configuration

`config.json` contains safe generic defaults. Use `config.example.json` as a reference when creating a new instance configuration.

For production instances, use the repository-level builder instead of editing the engine files:

```bash
node scripts/build-instance.js presets/<instance>/app.config.json
```

The builder creates a deployable instance under `dist/<instance_id>/` and generates both the web configuration and the Google Apps Script instance configuration from the same JSON source.

## Runtime files

```text
index.html
runtime-config.js
app.js
tv-engine.js
tv-player.js
styles.css
tv-info.css
```

`tv-engine.js` contains scheduling and broadcast-selection logic. `tv-player.js` provides the common playback adapter for YouTube, Vimeo, PeerTube and direct video sources. `runtime-config.js` applies instance branding and metadata without requiring changes to engine code.

Instance-specific assets belong under `presets/<instance>/assets/`, not in this directory.
