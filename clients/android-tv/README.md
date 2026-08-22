# TV App — Android TV client

This directory contains the native Android TV / Google TV client for TV App.

The client is intentionally a **consumer of the same TV App instance contract** used by the browser client. It must not contain editorial channels, programme IDs, feed URLs or project branding in application code.

## Architecture

```text
app.config.json + feed.json
          │
          ├─────────────── browser client
          │
          └─────────────── Android TV client
                              ├── Compose for TV UI
                              ├── Media3 ExoPlayer
                              ├── Media3 MediaSession
                              ├── deep links
                              ├── Android TV home channels
                              └── Watch Next
```

The goal is **one instance, one schedule, multiple clients**.

## Current foundation

The initial native client establishes the platform contract:

- TV-only launcher through `CATEGORY_LEANBACK_LAUNCHER`;
- touchscreen declared as optional;
- remote/D-pad-first Compose for TV UI;
- Media3 ExoPlayer + `MediaSession` playback foundation;
- deep-link contract `tvapp://channel/<channel_id>`;
- permission and dependency foundation for Android TV home-screen channels;
- no dependency on Archipiélago Vivo or any other instance.

## Instance data

The Android client will consume these generic fields from TV App:

```text
app.config.json
├── instance_id
├── name
├── language / locale / timezone
├── branding
├── providers
├── default_channel
└── data.feed_url

feed.json
├── channels[]
├── programs[]
├── media[]
├── entities[]
├── entity_media[]
└── schedule[]
```

The Android client must never maintain a second editorial database.

## Mapping to Android TV

```text
TV App                         Android TV / Google TV
────────────────────────────────────────────────────────
channel_id                  -> channel deep link
channel.name                -> home-screen channel name
program_id                  -> programme context
media_id                    -> internal provider ID
media.title                 -> PreviewProgram title
media.thumbnail             -> poster art
media description           -> PreviewProgram description
current channel             -> playback destination
```

Home-screen recommendation channels are an optional discovery surface. They are not the TV App scheduling engine and must not become an independent source of truth.

## Platform baseline

The scaffold follows the current Android TV recommendations:

- `compileSdk 37`;
- `minSdk 21` so the player remains available on older Android TV devices;
- home-screen channels are enabled only on API 26+;
- Compose BOM `2026.08.00`;
- Compose for TV (`androidx.tv:tv-material`);
- Media3 ExoPlayer and MediaSession;
- JDK 17 / Android Gradle Plugin 9.3.x.

The Gradle wrapper is deliberately not committed yet. Open this directory in the current stable Android Studio and generate/update the wrapper from the IDE before the first device build.

## Next implementation steps

1. Load the generated TV App `app.config.json`.
2. Fetch and validate `feed.json` schema v2.
3. Port the deterministic schedule resolver to a shared client contract/test suite.
4. Resolve the current broadcast for a selected channel.
5. Map direct/HLS media to Media3.
6. Define provider strategy for YouTube, Vimeo and PeerTube on native TV.
7. Publish configured TV App channels to the Android TV home screen on API 26+.
8. Add Watch Next where it makes editorial sense.
9. Add Google Cast after native playback is stable.
