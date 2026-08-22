# Multiplatform architecture

TV App is evolving from a browser television engine into a **multiplatform television platform**.

The invariant is simple:

> One instance, one editorial database, one schedule, multiple clients.

## Source of truth

The backend and generated public feed remain authoritative:

```text
TV App instance
├── app.config.json
├── channels
├── programs
├── media
├── entities
├── entity-media relations
└── schedule
```

Clients do not maintain their own editorial copies of this data.

## Clients

```text
TV App
├── apps-script/          backend + editorial database integration
├── web/                  browser client
├── clients/
│   └── android-tv/       native Android TV / Google TV client
├── presets/              instance-specific configuration/assets
└── scripts/              build/validation tooling
```

The existing `web/` path is kept during the refactor to avoid breaking the current instance builder. It may later move to `clients/web/` once build/deployment paths are migrated atomically.

## Client contract

Every client must be able to derive its runtime from the same two public inputs:

### `app.config.json`

Instance identity and client-independent configuration:

- `schema_version`
- `instance_id`
- `name`
- `short_name`
- `language`
- `locale`
- `timezone`
- `default_channel`
- `providers`
- `branding`
- `data.feed_url`

Client-specific optional sections may be added under `clients` without changing the editorial model.

### `feed.json`

The public television state:

- channels
- programs
- media
- entities
- entity/media relations
- schedule
- presentation settings required to resolve a broadcast

## Scheduling rule

The answer to this question must be identical on every client:

```text
(channel_id, timestamp) -> broadcast
```

A browser, Android TV device or future client must not independently invent a different schedule policy.

The current JavaScript `TVEngine` is therefore a reference implementation. The next step is to formalize its resolver behavior as platform-neutral fixtures/tests so native clients can reproduce exactly the same result.

## Android TV / Google TV

The Android client uses platform-native surfaces:

- Compose for TV for ten-foot UI and D-pad navigation;
- Media3 ExoPlayer for native compatible playback;
- Media3 `MediaSession` for system playback control;
- deep links for direct channel entry;
- Android TV home-screen preview channels on API 26+;
- Watch Next where appropriate;
- Google Cast as a later capability.

Home-screen channels are **derived discovery surfaces**. They do not replace TV App channels or the schedule engine.

## Provider policy

TV App's provider model is broader than ExoPlayer alone:

```text
youtube
vimeo
peertube
direct
```

The Android client therefore needs a provider adapter layer equivalent in purpose to the browser's `tv-player.js`:

```text
ProviderPlayer
├── Direct / HLS -> Media3
├── YouTube      -> provider strategy
├── Vimeo        -> provider strategy
└── PeerTube     -> native/direct stream when available, otherwise provider strategy
```

The scheduling engine must never depend on a specific provider implementation.

## Deep-link contract

The initial native deep link is:

```text
tvapp://channel/<channel_id>
```

A home-screen recommendation for a channel or programme should resolve to the relevant TV App channel and immediately enter the playback experience.

## Roadmap

1. Freeze schema v2 client contract.
2. Add deterministic schedule fixtures shared by web/native implementations.
3. Load `app.config.json` in Android.
4. Load and validate `feed.json` in Android.
5. Port schedule resolution.
6. Implement native direct/HLS playback.
7. Define YouTube/Vimeo/PeerTube provider adapters.
8. Publish Android TV home channels.
9. Add Watch Next.
10. Add Cast.
