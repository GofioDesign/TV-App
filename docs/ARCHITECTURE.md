# TV App architecture

TV App is split into two layers:

1. **Engine** — reusable application code.
2. **Instance configuration** — branding, URLs, channels, programs, schedules and editorial settings for one deployment.

## Engine

The reusable engine lives mainly in:

```text
apps-script/
web/
schema/
scripts/
```

The engine must not hardcode instance-specific channel IDs, program IDs, domains, branding, organization names or data endpoints.

## Instance configuration

Deployments are described through a versioned configuration file. Presets live in:

```text
presets/<instance-id>/
```

The first reference preset is:

```text
presets/archipielago-vivo/
```

Archipiélago Vivo is therefore treated as the first TV App instance, not as part of the generic engine itself.

## Data flow

```text
Google Sheets
    ↓
Google Apps Script backend
    ↓
public TV feed
    ↓
static data endpoint
    ↓
TV App web player
```

The web application consumes a public feed and does not query the spreadsheet directly.

## Providers

The target provider abstraction supports:

- YouTube
- Vimeo
- PeerTube
- direct video files

Provider-specific playback logic belongs in the player adapter. Scheduling and editorial logic must remain provider-agnostic.

## Installation principle

```text
GitHub / clasp = installs application code
Apps Script setup = creates and configures data structures
```

The Apps Script installer must not attempt to recreate or copy the source `.gs` files into its own project.

## Refactor rule

The `main` branch preserves the imported working baseline while genericization is developed in `refactor/generic-engine` until the engine can reproduce the Archipiélago Vivo instance from configuration.
