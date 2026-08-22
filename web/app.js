(() => {
  "use strict";

  const DEFAULT_APP_CONFIG = Object.freeze({
  schema_version: 1,
  instance_id: "tv-app",
  name: "TV App",
  language: "en",
  timezone: "UTC",
  site_url: "",
  default_channel: "",
  data: Object.freeze({ feed_url: "" }),
  requests: Object.freeze({
    enabled: false,
    form_url: "",
    type_entry: "",
    url_entry: "",
    types: Object.freeze({
      proposal: "Propose a video",
      correction: "Report a problem or correction",
      removal: "Request video removal"
    })
  })
});

  let appConfig = DEFAULT_APP_CONFIG;
  let TV_DATA_URL = "";
  let TV_REQUEST_FORM_URL = "";
  let TV_REQUEST_TYPE_ENTRY = "";
  let TV_REQUEST_URL_ENTRY = "";
  let TV_REQUEST_TYPES = DEFAULT_APP_CONFIG.requests.types;
  const DATA_REFRESH_MS = 5 * 60 * 1000;
  const PLAYBACK_HEALTH_MS = 1000;
  const UI_TICK_MS = 250;
  const REQUEST_TIMEOUT_MS = 15000;
  const INTERMISSION_LOOKAHEAD_SECONDS = 180;
  const BUFFERING_DEGRADED_MS = 4000;
  const DEGRADED_REPORT_COOLDOWN_MS = 60 * 1000;
  const START_SUCCESS_TOLERANCE_MS = 2500;
  const PROGRAM_START_TIMEOUT_MS = 20 * 1000;
  const DEBUG_SCHEDULE_REPORT_MS = 300 * 1000;
  const DEBUG_SCHEDULE_LOOKAHEAD_SECONDS = 24 * 60 * 60;

  // TV App funciona como señal lineal: una pausa accidental o provocada
  // por el usuario no debe dejar la instancia retrasada respecto a la emisión.
  const PAUSE_PLAY_RETRY_MS = 120;
  const PAUSE_FORCE_LIVE_MS = 1500;

  const $ = id => document.getElementById(id);
  const debugEnabled = new URLSearchParams(location.search).get("debug") === "1";

  let tvData = null;
  let engine = null;
  let selectedChannel = null;
  let player = null;
  let playerReady = false;
  let currentMediaKey = "";
  let currentBroadcast = null;
  let currentPlaybackContextKey = "";
  let failedMediaKeys = new Set();
  let soundEnabled = true;
  let fallbackMuteTimer = null;
  let currentEntityCardId = "";
  const continuityCards = new Map();

  let healthTimer = null;
  let uiTimer = null;
  let refreshTimer = null;
  let debugScheduleTimer = null;
  let intermissionTimer = null;
  let transitionTimeoutTimer = null;
  let pausePlayTimer = null;
  let pauseForceLiveTimer = null;
  let intermission = null;
  let pendingTransition = null;

  let bufferingStartedAt = 0;
  let mediaBufferingMs = 0;
  let lastDegradedReportAt = 0;
  let lastPlayerState = null;

  let tvStartTracked = false;
  let lastTrackedMediaKey = "";
  let lastTrackedProgramKey = "";

  function log(...parts) {
    if (!debugEnabled) return;
    const stamp = new Date().toISOString().slice(11, 19);
    $("debug").classList.add("visible");
    $("debug").textContent =
      `[${stamp}] ${parts.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ")}\n` +
      $("debug").textContent.slice(0, 7000);
  }

  function setStatus(message, visible = true) {
    $("statusText").textContent = message;
    $("statusScreen").classList.toggle("hidden", !visible);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function mergeAppConfig(base, override) {
  const value = override && typeof override === "object" ? override : {};
  return {
    ...base,
    ...value,
    data: { ...(base.data || {}), ...(value.data || {}) },
    requests: {
      ...(base.requests || {}),
      ...(value.requests || {}),
      types: {
        ...((base.requests && base.requests.types) || {}),
        ...((value.requests && value.requests.types) || {})
      }
    },
    entities: { ...(base.entities || {}), ...(value.entities || {}) },
    analytics: { ...(base.analytics || {}), ...(value.analytics || {}) },
    branding: { ...(base.branding || {}), ...(value.branding || {}) },
    seo: { ...(base.seo || {}), ...(value.seo || {}) },
    publisher: { ...(base.publisher || {}), ...(value.publisher || {}) },
    navigation: { ...(base.navigation || {}), ...(value.navigation || {}) },
    ui: {
      ...(base.ui || {}),
      ...(value.ui || {}),
      labels: { ...((base.ui && base.ui.labels) || {}), ...((value.ui && value.ui.labels) || {}) },
      participation: { ...((base.ui && base.ui.participation) || {}), ...((value.ui && value.ui.participation) || {}) },
      share: { ...((base.ui && base.ui.share) || {}), ...((value.ui && value.ui.share) || {}) },
      intermission: { ...((base.ui && base.ui.intermission) || {}), ...((value.ui && value.ui.intermission) || {}) },
      continuity: { ...((base.ui && base.ui.continuity) || {}), ...((value.ui && value.ui.continuity) || {}) },
      errors: { ...((base.ui && base.ui.errors) || {}), ...((value.ui && value.ui.errors) || {}) },
      controls: { ...((base.ui && base.ui.controls) || {}), ...((value.ui && value.ui.controls) || {}) }
    }
  };
}

  async function loadAppConfig() {
    try {
      const loaded = window.TVAppConfig && window.TVAppConfig.ready ? await window.TVAppConfig.ready : await fetchJson("config.json");
      appConfig = mergeAppConfig(DEFAULT_APP_CONFIG, loaded);
    } catch (error) {
      appConfig = DEFAULT_APP_CONFIG;
      log("config", `Could not load config.json: ${error && error.message || error}`);
    }

    TV_DATA_URL = String(appConfig.data && appConfig.data.feed_url || "").trim();
    TV_REQUEST_FORM_URL = String(appConfig.requests && appConfig.requests.form_url || "").trim();
    TV_REQUEST_TYPE_ENTRY = String(appConfig.requests && appConfig.requests.type_entry || "").trim();
    TV_REQUEST_URL_ENTRY = String(appConfig.requests && appConfig.requests.url_entry || "").trim();
    TV_REQUEST_TYPES = Object.freeze({
      ...DEFAULT_APP_CONFIG.requests.types,
      ...((appConfig.requests && appConfig.requests.types) || {})
    });

    if (!TV_DATA_URL) {
      throw new Error("config.json debe definir data.feed_url.");
    }
  }

  function storageKey(name) {
    const prefix = String(appConfig.instance_id || "tv-app").trim() || "tv-app";
    return `${prefix}_${name}`;
  }

  function resolveRequestedChannel() {
    const params = new URLSearchParams(location.search);
    return params.get("channel") || localStorage.getItem(storageKey("channel")) || appConfig.default_channel || null;
  }

  function updateUrlChannel(channel) {
    const url = new URL(location.href);
    url.searchParams.set("channel", channel.slug || channel.channel_id);
    history.replaceState({}, "", url);
    localStorage.setItem(storageKey("channel"), channel.slug || channel.channel_id);
  }

  function channelShareUrl(channel = selectedChannel) {
    const baseUrl = String(appConfig.site_url || "").trim() || `${location.origin}/`;
    const url = new URL(baseUrl);
    if (channel) {
      url.searchParams.set(
        "channel",
        channel.slug || channel.channel_id
      );
    }
    return url.toString();
  }

  function currentSharePayload() {
    const broadcast = currentBroadcast;
    const media = broadcast && broadcast.media;
    const program = broadcast && broadcast.program;
    const channel = broadcast && broadcast.channel
      ? broadcast.channel
      : selectedChannel;
    const entity = currentEntity(broadcast);

    const isEntityPromo = Boolean(
      media &&
      (
        String(media.type || "").toLowerCase() === "entity" ||
        broadcast && broadcast.is_global_entity_block
      )
    );

    const url = channelShareUrl(channel);

    if (isEntityPromo && entity) {
      const entityName = firstText(
        entity.name,
        entity.title,
        media.title,
        configValue("ui.entity_fallback_name", "View profile")
      );

      return {
        title: entityName,
        text: formatTemplate(configValue("ui.share.entity_template", "I am watching the presentation of {entity} on {tv}"), { entity: entityName, tv: appConfig.name || "TV App" }),
        url
      };
    }

    const emission = firstText(
      media && media.title,
      media && media.name,
      program && program.name,
      appConfig.name,
      "TV App"
    );

    const topic = firstText(
      program && program.name,
      channel && channel.name,
      configValue("ui.share.default_topic")
    );

    return {
      title: emission,
      text: formatTemplate(configValue("ui.share.generic_template", "I am watching {emission} on {tv}"), { emission, topic, tv: appConfig.name || "TV App" }),
      url
    };
  }

  async function shareCurrentBroadcast() {
    const payload = currentSharePayload();

    // Share one editorial text body plus the configured TV URL.
    // Social previews come from the instance Open Graph metadata.
    const shareText = [
      payload.text,
      payload.url
    ].filter(Boolean).join("\n");

    trackTv("tv_share", {
      ...broadcastDetails(),
      action_from: "player",
      action_to: "native_share"
    });

    if (navigator.share) {
      try {
        await navigator.share({
          title: payload.title || appConfig.name || "TV App",
          text: shareText
        });
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
        log("share", {
          mode: "text_tv_url",
          error: String(error)
        });
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);

      trackTv("tv_share", {
        ...broadcastDetails(),
        action_from: "player",
        action_to: "clipboard"
      });

      const button = $("shareButton");
      if (button) {
        const original = button.innerHTML;
        button.textContent = configValue("ui.share.copied", "Link copied");
        setTimeout(() => {
          button.innerHTML = original;
        }, 1800);
      }
    } catch (_) {
      window.prompt(
        configValue("ui.share.copy_prompt", "Copy this content to share the broadcast:"),
        shareText
      );
    }
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function fullscreenSupported() {
    const root = document.documentElement;
    return Boolean(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      typeof root.requestFullscreen === "function" ||
      typeof root.webkitRequestFullscreen === "function"
    );
  }

  function detectDeviceClass() {
    const ua = String(navigator.userAgent || "").toLowerCase();
    if (/android tv|googletv|smart-tv|smarttv|hbbtv|tizen|web0s|webos|netcast|aft[a-z0-9]*/i.test(ua)) return "tv";
    if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return "mobile";
    return "desktop";
  }

  function technicalContext() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const platform = navigator.userAgentData && navigator.userAgentData.platform
      ? navigator.userAgentData.platform
      : navigator.platform || "";

    const result = {
      user_agent: String(navigator.userAgent || "").slice(0, 1000),
      platform: String(platform || "").slice(0, 200),
      device_class: detectDeviceClass(),
      fullscreen_supported: fullscreenSupported() ? 1 : 0
    };

    if (connection) {
      if (connection.effectiveType) result.connection_effective_type = String(connection.effectiveType);
      if (Number.isFinite(Number(connection.downlink))) result.connection_downlink = Number(connection.downlink);
      if (Number.isFinite(Number(connection.rtt))) result.connection_rtt = Number(connection.rtt);
    }
    return result;
  }

  function trackTv(eventName, details = {}, includeTechnical = false) {
      const analytics = appConfig.analytics || {};
      if (analytics.enabled === false || !analytics.global_object) return false;
      const tracker = window[analytics.global_object];
      const method = analytics.track_method || "track";
      if (!tracker || typeof tracker[method] !== "function") return false;
      return tracker[method](
        eventName,
        includeTechnical ? { ...technicalContext(), ...details } : details
      );
    }

  function broadcastDetails(broadcast = currentBroadcast) {
    const channel = broadcast && broadcast.channel ? broadcast.channel : selectedChannel;
    const program = broadcast && broadcast.program;
    const media = broadcast && broadcast.media;
    const details = {};
    if (channel && channel.channel_id) details.channel_id = channel.channel_id;
    if (channel && channel.channel_number !== undefined && channel.channel_number !== null && channel.channel_number !== "") {
      details.channel_number = channel.channel_number;
    }
    if (program && program.program_id) details.program_id = program.program_id;
    if (media && media.media_id) details.media_id = media.media_id;
    if (media && media.type) details.media_type = media.type;
    if (media && media.entity_id) details.entity_id = media.entity_id;
    if (media && media.youtube_id) details.youtube_id = media.youtube_id;
    return details;
  }

  function playbackContextKey(broadcast) {
    if (!broadcast) return "";
    return [
      broadcast.channel && broadcast.channel.channel_id || "",
      broadcast.is_global_entity_block ? "global_entity" : "thematic",
      broadcast.program && broadcast.program.program_id || ""
    ].join("|");
  }

  function firstText(...values) {
    for (const value of values) {
      const text = String(value == null ? "" : value).trim();
      if (text) return text;
    }
    return "";
  }

  function configValue(path, fallback = "") {
      const parts = String(path || "").split(".").filter(Boolean);
      let value = appConfig;
      for (const part of parts) {
        if (!value || typeof value !== "object" || !(part in value)) return fallback;
        value = value[part];
      }
      return value === undefined || value === null || value === "" ? fallback : value;
    }

    function formatTemplate(template, values) {
      return String(template || "")
        .replace(/\{([a-z0-9_]+)\}/gi, (_, key) => values && values[key] != null ? String(values[key]) : "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function configuredLogo() {
      return firstText(configValue("branding.logo"), "assets/tv-app.svg");
    }

  function mediaProvider(media) {
    return window.TVAppPlayer
      ? window.TVAppPlayer.normalizeProvider(media)
      : String(media && media.provider || "").trim().toLowerCase();
  }

  function mediaPlaybackKey(media) {
    if (!media) return "";
    if (window.TVAppPlayer) return window.TVAppPlayer.mediaKey(media);
    return firstText(media.media_id, media.provider_id, media.youtube_id);
  }

  function mediaSupportedByPlayer(media) {
    return Boolean(
      media &&
      window.TVAppPlayer &&
      window.TVAppPlayer.isSupported(media)
    );
  }

  function mediaOriginalUrl(media) {
    if (!media) return "";

    const explicitUrl = firstText(
      media.provider_url,
      media.original_url,
      media.url
    );

    if (explicitUrl) return explicitUrl;

    const provider = mediaProvider(media);
    const providerId = window.TVAppPlayer
      ? window.TVAppPlayer.providerMediaId(media)
      : firstText(media.provider_id, media.youtube_id);

    if (provider === "youtube" && providerId) {
      const url = new URL("https://www.youtube.com/watch");
      url.searchParams.set("v", providerId);
      return url.toString();
    }

    if (provider === "vimeo" && providerId) {
      return `https://vimeo.com/${encodeURIComponent(providerId)}`;
    }

    // Para PeerTube y fuentes directas el host forma parte de la identidad
    // de la fuente. Si no hay provider_url, conservamos embed_url como enlace
    // original en vez de inventar un dominio.
    return firstText(media.embed_url);
  }

  function tvRequestUrl(requestType, mediaUrl = "") {
  if (!appConfig.requests || !appConfig.requests.enabled || !TV_REQUEST_FORM_URL) return "";

  const url = new URL(TV_REQUEST_FORM_URL);
  url.searchParams.set("usp", "pp_url");
  if (TV_REQUEST_TYPE_ENTRY) url.searchParams.set(TV_REQUEST_TYPE_ENTRY, requestType);

  if (mediaUrl && TV_REQUEST_URL_ENTRY) {
    url.searchParams.set(TV_REQUEST_URL_ENTRY, mediaUrl);
  }

  return url.toString();
}

  function setTvRequestLink(id, requestType, mediaUrl = "", requiresMedia = false) {
    const link = $(id);
    if (!link) return;

    const requestUrl = tvRequestUrl(requestType, mediaUrl);
    const enabled = Boolean(requestUrl) && (!requiresMedia || Boolean(mediaUrl));
    link.hidden = !enabled;

    if (!enabled) {
      link.removeAttribute("href");
      return;
    }

    link.href = requestUrl;
  }

  function currentEntity(broadcast = currentBroadcast) {
    const media = broadcast && broadcast.media;
    if (!media || !media.entity_id || !tvData || !tvData.entities) return null;
    return tvData.entities[media.entity_id] || null;
  }

  function setInfoRow(id, label, value) {
    const row = $(id);
    if (!row) return;

    const text = String(value == null ? "" : value).trim();
    row.hidden = !text;

    if (!text) return;

    const labelEl = row.querySelector(".info-label");
    const valueEl = row.querySelector(".info-value");

    if (labelEl) labelEl.textContent = label;
    if (valueEl) valueEl.textContent = text;
  }

  function updateInfoPanel(broadcast = currentBroadcast) {
    const button = $("infoButton");
    const panel = $("infoPanel");
    if (!button || !panel) return;

    const channel = broadcast && broadcast.channel;
    const program = broadcast && broadcast.program;
    const media = broadcast && broadcast.media;
    const entity = currentEntity(broadcast);

    const hasEmission = Boolean(
      broadcast &&
      broadcast.kind === "media" &&
      media
    );

    button.disabled = !hasEmission;
    button.setAttribute(
      "aria-disabled",
      hasEmission ? "false" : "true"
    );

    const channelText = channel
      ? [
          channel.channel_number ? `${configValue("ui.channel_label", "CHANNEL")} ${channel.channel_number}` : "",
          channel.name || channel.channel_id || ""
        ].filter(Boolean).join(" · ")
      : "";

    setInfoRow(
      "infoChannelRow",
      configValue("ui.labels.channel", "Channel"),
      channelText
    );

    setInfoRow(
      "infoProgramRow",
      configValue("ui.labels.program", "Programme"),
      program && firstText(
        program.name,
        program.title,
        program.program_id
      )
    );

    setInfoRow(
      "infoMediaRow",
      configValue("ui.labels.now", "Now"),
      media && firstText(
        media.title,
        media.name
      )
    );

    const mediaLink = $("infoMediaLink");
    let originalMediaUrl = mediaOriginalUrl(media);

    // Compatibilidad con feeds legacy de YouTube sin provider_url.
    if (!originalMediaUrl && media && mediaProvider(media) === "youtube") {
      const youtubeId = firstText(
        media.youtube_id,
        playerReady && player && player.getProviderMediaId
          ? player.getProviderMediaId()
          : ""
      );

      if (youtubeId) {
        const youtubeUrl = new URL("https://www.youtube.com/watch");
        youtubeUrl.searchParams.set("v", youtubeId);
        originalMediaUrl = youtubeUrl.toString();
      }
    }

    if (mediaLink) {
      if (originalMediaUrl) {
        mediaLink.href = originalMediaUrl;
        mediaLink.target = "_blank";
        mediaLink.rel = "noopener noreferrer";
        mediaLink.setAttribute(
          "aria-label",
          formatTemplate(configValue("ui.media_original_aria_template", "{title} · open original video"), { title: firstText(media && media.title, media && media.name, configValue("ui.video_label", "Video")) })
        );
      } else {
        // Nunca dejamos href="#": si no hay una URL original real, no hay enlace.
        mediaLink.removeAttribute("href");
        mediaLink.removeAttribute("aria-label");
      }
    }

    setTvRequestLink(
      "infoProposeLink",
      TV_REQUEST_TYPES.proposal
    );

    setTvRequestLink(
      "infoCorrectionLink",
      TV_REQUEST_TYPES.correction,
      originalMediaUrl,
      true
    );

    setTvRequestLink(
      "infoRemovalLink",
      TV_REQUEST_TYPES.removal,
      originalMediaUrl,
      true
    );

    const description = firstText(
      media && media.description,
      media && media.summary,
      program && program.description,
      program && program.summary
    );

    const descriptionEl = $("infoDescription");
    if (descriptionEl) {
      descriptionEl.textContent = description;
      descriptionEl.hidden = !description;
    }

    const entityName = entity && firstText(
      entity.name,
      entity.title
    );

    setInfoRow(
      "infoEntityRow",
      configValue("ui.labels.entity", "Entity"),
      entityName
    );

    const territory = entity && [
      firstText(
        entity.island,
        entity.av_island,
        entity.isla
      ),
      firstText(
        entity.municipality,
        entity.av_municipality,
        entity.municipio
      )
    ].filter(Boolean).join(" · ");

    setInfoRow(
      "infoTerritoryRow",
      configValue("ui.labels.territory", "Territory"),
      territory
    );

    const mapLink = $("infoMapLink");
    if (mapLink) {
      const mapUrl = entity && entity.map_url
        ? String(entity.map_url)
        : "";

      mapLink.hidden = !mapUrl;

      if (mapUrl) {
        mapLink.href = mapUrl;
      } else {
        mapLink.removeAttribute("href");
      }
    }

    if (!hasEmission && panel.classList.contains("open")) {
      closeInfoPanel();
    }
  }

  function openInfoPanel() {
    if (!currentBroadcast || !currentBroadcast.media) return;

    updateInfoPanel(currentBroadcast);

    const panel = $("infoPanel");
    const button = $("infoButton");
    if (!panel || !button) return;

    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    button.setAttribute("aria-expanded", "true");

    trackTv(
      "tv_program_info_open",
      broadcastDetails()
    );
  }

  function closeInfoPanel() {
    const panel = $("infoPanel");
    const button = $("infoButton");
    if (!panel || !button) return;

    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
  }

  function toggleInfoPanel() {
    const panel = $("infoPanel");
    if (!panel) return;

    if (panel.classList.contains("open")) {
      closeInfoPanel();
    } else {
      openInfoPanel();
    }
  }

  function renderChannelMenu() {
    if (!engine) return;
    const menu = $("channelMenu");
    const now = Date.now();
    menu.replaceChildren();

    [...engine.channels]
      .sort((a, b) => Number(a.channel_number || 999) - Number(b.channel_number || 999))
      .forEach(channel => {
        const broadcast = engine.resolve(channel.channel_id, now);
        const media = broadcast && broadcast.media;
        const program = broadcast && broadcast.program;
        const thumb = media && media.thumbnail ? media.thumbnail : configuredLogo();
        const button = document.createElement("button");
        button.type = "button";
        button.className = "channel-option";
        button.dataset.channel = channel.channel_id;
        button.setAttribute("aria-current", selectedChannel && selectedChannel.channel_id === channel.channel_id ? "true" : "false");
        button.innerHTML = `
          <span class="channel-option-thumb-wrap">
            <img class="channel-option-thumb" src="${escapeText(thumb)}" alt="" loading="eager">
            <span class="channel-option-number">${escapeText(channel.channel_number || "")}</span>
          </span>
          <span class="channel-option-copy">
            <strong>${escapeText(channel.name)}</strong>
            <span class="channel-option-program">${escapeText(program && program.name ? program.name : configValue("ui.programming_placeholder", "Programming"))}</span>
            <span class="channel-option-title">${escapeText(media && media.title ? media.title : configValue("ui.standby_message", "Programming in preparation"))}</span>
          </span>`;
        button.addEventListener("click", () => {
          selectChannel(channel.channel_id);
          closeChannelMenu();
        });
        menu.appendChild(button);
      });
  }

  function updateChannelHeader(broadcast) {
    const channel = broadcast && broadcast.channel;
    const program = broadcast && broadcast.program;
    if (channel) {
      const channelLabel = configValue("ui.channel_label", "CHANNEL");
      $("channelNumber").textContent = channel.channel_number ? `${channelLabel} ${channel.channel_number}` : channelLabel;
      $("channelName").textContent = channel.name || channel.channel_id;
    }
    $("currentProgram").textContent = program && program.name ? program.name : configValue("ui.programming_placeholder", "Programming");
  }

  function cancelIntermission() {
    clearTimeout(intermissionTimer);
    clearTimeout(transitionTimeoutTimer);
    clearPauseRecovery();
    intermissionTimer = null;
    transitionTimeoutTimer = null;
    intermission = null;
    pendingTransition = null;
  }

  function selectChannel(channelValue) {
    if (!engine) return;
    const channel = engine.resolveChannel(channelValue);
    if (!channel) return;
    const previous = selectedChannel && selectedChannel.channel_id;
    cancelIntermission();
    closeInfoPanel();
    selectedChannel = channel;
    if (previous && previous !== channel.channel_id) {
      trackTv("tv_channel_change", {
        action_from: previous,
        action_to: channel.channel_id,
        channel_id: channel.channel_id,
        channel_number: channel.channel_number
      });
    }
    updateUrlChannel(channel);
    currentMediaKey = "";
    currentPlaybackContextKey = "";

    updateSoundButton();

    if (playerReady && player) {
      player.setVolume(1);
      player.setMuted(!soundEnabled);
    }

    syncPlayback(true);

    if (debugEnabled) {
      setTimeout(debugScheduleReport, 250);
    }
  }

  function toggleChannelMenu() {
    const menu = $("channelMenu");
    const button = $("channelButton");
    const open = !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  }

  function closeChannelMenu() {
    $("channelMenu").classList.remove("open");
    $("channelButton").setAttribute("aria-expanded", "false");
  }

  function resetStandbyPresentation() {
    const standby = $("standby");
    const image = standby.querySelector("img");
    const copy = standby.querySelector(".standby-copy");
    standby.classList.remove("intermission");
    if (image) {
      image.style.width = "";
      image.style.maxHeight = "";
      image.style.marginBottom = "";
    }
    if (copy) copy.textContent = configValue("ui.standby_message", "Programming in preparation");
  }

  function showStandby(broadcast) {
    resetStandbyPresentation();
    const programName = broadcast && broadcast.program && broadcast.program.name;
    $("standbyProgram").textContent = programName || configValue("ui.standby_program", "Programming");
    $("standby").classList.add("visible");
  }

  function showIntermissionScreen() {
    const standby = $("standby");
    const image = standby.querySelector("img");
    const copy = standby.querySelector(".standby-copy");
    standby.classList.add("intermission");
    if (image) {
      image.style.width = "min(300px, 48vw)";
      image.style.maxHeight = "300px";
      image.style.marginBottom = "1.4rem";
    }
    if (copy) copy.textContent = configValue("ui.intermission.brand_line", appConfig.name || "TV App");
    $("standbyProgram").textContent = configValue("ui.intermission.continue_message", "We will continue shortly");
    standby.classList.add("visible");
    $("entityCard").classList.remove("visible");
    clearContinuity();
  }

  function hideStandby() {
    $("standby").classList.remove("visible");
  }

  function qrImageUrl(target) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(target)}`;
  }

  function updateEntityCard(broadcast) {
    const card = $("entityCard");
    const media = broadcast && broadcast.media;
    if (!media || String(media.type || "").toLowerCase() !== "entity" || !media.entity_id) {
      currentEntityCardId = "";
      card.classList.remove("visible");
      return;
    }
    const entity = tvData && tvData.entities && tvData.entities[media.entity_id];
    if (!entity || !entity.map_url) {
      currentEntityCardId = "";
      card.classList.remove("visible");
      return;
    }
    if (currentEntityCardId !== media.entity_id) {
      currentEntityCardId = media.entity_id;
      $("entityQr").src = qrImageUrl(entity.map_url);
      $("entityName").textContent = entity.name || media.title || configValue("ui.entity_fallback_name", "View profile");
      $("entityLink").href = entity.map_url;
    }
    card.classList.add("visible");
  }

  function clearContinuity() {
    continuityCards.forEach(card => card.remove());
    continuityCards.clear();
    $("continuityColumn").classList.remove("visible");
  }

  function renderContinuity() {
    if (!engine || !selectedChannel || !tvData || intermission) return;
    const config = tvData.presentation && tvData.presentation.program_change_teasers
      ? tvData.presentation.program_change_teasers
      : {};
    const column = $("continuityColumn");
    if (config.enabled === false || (currentBroadcast && currentBroadcast.is_global_entity_block)) {
      clearContinuity();
      return;
    }
    const leadSeconds = Number(config.lead_seconds || 30);
    const changes = engine.nextProgramChanges(Date.now(), leadSeconds);
    if (!changes.length) {
      clearContinuity();
      return;
    }
    const activeKeys = new Set();
    changes.forEach(change => {
      const key = `${change.channel.channel_id}|${Math.round(change.change_at_ms)}`;
      activeKeys.add(key);
      let card = continuityCards.get(key);
      if (!card) {
        card = document.createElement("button");
        card.type = "button";
        card.className = "continuity-card";
        card.dataset.channel = change.channel.channel_id;
        const thumb = change.next_media && change.next_media.thumbnail ? change.next_media.thumbnail : configuredLogo();
        card.innerHTML = `
          <div class="continuity-thumb-wrap">
            <img class="continuity-thumb" src="${escapeText(thumb)}" alt="" loading="eager">
            <span class="continuity-countdown"></span>
          </div>
          <div class="continuity-copy">
            <span class="continuity-channel">${change.channel.channel_number ? `${escapeText(change.channel.channel_number)} · ` : ""}${escapeText(change.channel.name)}</span>
            <strong>${escapeText(change.next_program.name)}</strong>
          </div>`;
        card.addEventListener("click", () => selectChannel(change.channel.channel_id));
        continuityCards.set(key, card);
      }
      const remaining = Math.max(0, Math.ceil((change.change_at_ms - Date.now()) / 1000));
      const countdown = card.querySelector(".continuity-countdown");
      if (countdown) countdown.textContent = `${configValue("ui.continuity.countdown_prefix", "IN")} ${String(remaining).padStart(2, "0")} s`;
      column.appendChild(card);
    });
    [...continuityCards.entries()].forEach(([key, card]) => {
      if (!activeKeys.has(key)) {
        card.remove();
        continuityCards.delete(key);
      }
    });
    column.classList.toggle("visible", continuityCards.size > 0);
  }

  async function loadTvData({ quiet = false } = {}) {
    if (!quiet) setStatus(configValue("ui.loading_schedule", "Loading schedule…"), true);
    try {
      const data = await fetchJson(TV_DATA_URL);
      if (Number(data.schema_version || 0) < 2 || !Array.isArray(data.channels) || !Array.isArray(data.schedule)) {
        throw new Error(configValue("ui.errors.feed_schema", "The TV endpoint is not publishing a compatible schema."));
      }
      if (data.tv_config && data.tv_config.valid === false) log("Errores de configuración", data.tv_config.errors || []);
      tvData = data;
      engine = new window.TVAppEngine.TVEngine(data);
      selectedChannel = engine.resolveChannel(
        (selectedChannel && selectedChannel.channel_id) || resolveRequestedChannel()
      );
      if (!selectedChannel) throw new Error(configValue("ui.errors.no_channels", "There are no active channels."));
      renderChannelMenu();
      updateUrlChannel(selectedChannel);
      setStatus("", false);
      syncPlayback(!currentMediaKey);
      log("TV cargada", {
        schema: data.schema_version,
        channels: engine.channels.length,
        media: engine.media.length,
        schedule: engine.schedule.length,
        channel: selectedChannel.channel_id
      });
    } catch (error) {
      log("Error cargando TV", String(error && error.message || error));
      trackTv("tv_error", { ...broadcastDetails(), error_code: "feed_load_error" }, true);
      if (!engine) setStatus(`${configValue("ui.errors.feed_load", "The broadcast could not be loaded")}: ${error.message || error}`, true);
    }
  }

  function expectedBroadcast() {
    if (!engine || !selectedChannel) return null;
    let broadcast = engine.resolve(selectedChannel.channel_id, Date.now());
    const failedKey = broadcast && broadcast.media
      ? mediaPlaybackKey(broadcast.media)
      : "";
    if (failedKey && failedMediaKeys.has(failedKey)) {
      broadcast = { ...broadcast, kind: "standby", media: null };
    }
    return broadcast;
  }

  function updateSoundButton() {
    const button = $("soundButton");
    const label = $("soundLabel");
    const icon = $("soundIcon");
    const actionLabel = soundEnabled ? configValue("ui.controls.mute", "Mute") : configValue("ui.controls.unmute", "Unmute");

    button.classList.add("visible");
    if (label) label.textContent = actionLabel;
    if (icon) icon.textContent = soundEnabled ? "🔊" : "🔇";

    button.setAttribute("aria-label", actionLabel);
    button.setAttribute("title", actionLabel);
    button.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  }

  function ensureAutoplay() {
    if (!playerReady || !player) return;

    clearTimeout(fallbackMuteTimer);

    player.setVolume(1);
    player.setMuted(!soundEnabled);
    updateSoundButton();

    fallbackMuteTimer = setTimeout(() => {
      if (!playerReady || !player) return;
      player.setVolume(1);
      player.setMuted(!soundEnabled);
      if (player.getState() !== "playing") {
        player.play();
      }
    }, 1400);
  }

  function formatClock(timestampMs) {
    try {
      return new Intl.DateTimeFormat(appConfig.language || "en", {
        timeZone: appConfig.timezone || "UTC",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date(timestampMs));
    } catch (_) {
      return new Date(timestampMs).toLocaleTimeString(appConfig.language || "en");
    }
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function selectedNextProgramChange(timestampMs = Date.now(), lookaheadSeconds = INTERMISSION_LOOKAHEAD_SECONDS) {
    if (!engine || !selectedChannel) return null;
    return engine.nextProgramChanges(timestampMs, lookaheadSeconds)
      .find(change => change.channel && change.channel.channel_id === selectedChannel.channel_id) || null;
  }

  function debugScheduleReport() {
    if (!debugEnabled || !engine || !selectedChannel) return;

    const now = Date.now();
    const broadcast = currentBroadcast || expectedBroadcast();
    const media = broadcast && broadcast.media;
    const program = broadcast && broadcast.program;

    const change = selectedNextProgramChange(
      now,
      DEBUG_SCHEDULE_LOOKAHEAD_SECONDS
    );

    const payload = {
      channel: selectedChannel.channel_id,
      channel_name: selectedChannel.name || "",
      program: program && (program.name || program.program_id) || "",
      media: media && (media.title || media.media_id) || "",
      media_offset_seconds: Math.round(
        Number(
          broadcast &&
          broadcast.media_offset_seconds || 0
        )
      )
    };

    if (change) {
      const remainingSeconds = Math.max(
        0,
        Math.round(
          (change.change_at_ms - now) / 1000
        )
      );

      payload.next_program =
        change.next_program &&
        (change.next_program.name ||
         change.next_program.program_id) ||
        "";

      payload.next_program_at =
        formatClock(change.change_at_ms);

      payload.seconds_until_next_program =
        remainingSeconds;

      payload.time_until_next_program =
        formatDuration(remainingSeconds);

      // Con el motor actual conocemos con exactitud el cambio de programa,
      // pero la cortinilla empieza cuando termina el último vídeo real.
      // Hasta que exista schedule.json compilado, no fingimos una hora exacta.
      payload.next_intermission =
        "pending_media_end";

      payload.intermission_boundary_at =
        formatClock(change.change_at_ms);
    } else {
      payload.next_program =
        "none_in_24h";
      payload.next_intermission =
        "none_in_24h";
    }

    log("schedule_heartbeat", payload);
  }

  function beginIntermissionFromEnded() {
    if (!engine || !selectedChannel || !currentBroadcast) return false;
    const media = currentBroadcast.media;
    if (!media || currentBroadcast.is_global_entity_block || String(media.type || "").toLowerCase() === "entity") return false;

    const now = Date.now();
    const change = selectedNextProgramChange(now);
    if (!change || !change.current_program || !currentBroadcast.program ||
        change.current_program.program_id !== currentBroadcast.program.program_id) return false;

    const plannedSeconds = Math.max(0, (change.change_at_ms - now) / 1000);
    if (plannedSeconds <= 0 || plannedSeconds > INTERMISSION_LOOKAHEAD_SECONDS) return false;

    intermission = {
      started_at_ms: now,
      scheduled_start_ms: change.change_at_ms,
      planned_seconds: plannedSeconds,
      actual_seconds: plannedSeconds,
      previous_program_id: currentBroadcast.program && currentBroadcast.program.program_id || "",
      next_program_id: change.next_program && change.next_program.program_id || "",
      buffering_ms: Math.round(mediaBufferingMs)
    };

    currentMediaKey = "";
    currentPlaybackContextKey = "";
    closeInfoPanel();
    showIntermissionScreen();

    trackTv("tv_intermission_start", {
      ...broadcastDetails(currentBroadcast),
      intermission_planned_seconds: Number(plannedSeconds.toFixed(3)),
      intermission_actual_seconds: Number(plannedSeconds.toFixed(3)),
      playback_buffering_ms: Math.round(mediaBufferingMs)
    });

    clearTimeout(intermissionTimer);
    intermissionTimer = setTimeout(finishIntermission, Math.max(0, change.change_at_ms - Date.now()));
    log("intermission", { planned: plannedSeconds.toFixed(1), next: intermission.next_program_id });
    return true;
  }

  function finishIntermission() {
    if (!intermission) return;
    const now = Date.now();
    if (now < intermission.scheduled_start_ms) {
      clearTimeout(intermissionTimer);
      intermissionTimer = setTimeout(finishIntermission, intermission.scheduled_start_ms - now);
      return;
    }

    const transition = intermission;
    intermission = null;
    intermissionTimer = null;
    hideStandby();
    pendingTransition = {
      ...transition,
      load_requested_at_ms: Date.now(),
      startup_buffering_ms: 0,
      reported: false
    };
    mediaBufferingMs = 0;
    bufferingStartedAt = 0;
    currentMediaKey = "";
    currentPlaybackContextKey = "";
    syncPlayback(true);

    clearTimeout(transitionTimeoutTimer);
    transitionTimeoutTimer = setTimeout(() => {
      if (!pendingTransition || pendingTransition.reported) return;
      pendingTransition.reported = true;
      const delay = Math.max(0, Date.now() - pendingTransition.scheduled_start_ms);
      trackTv("tv_intermission_end", {
        ...broadcastDetails(),
        intermission_planned_seconds: Number(pendingTransition.planned_seconds.toFixed(3)),
        intermission_actual_seconds: Number(pendingTransition.actual_seconds.toFixed(3)),
        next_program_start_delay_ms: Math.round(delay),
        intermission_success: 0,
        playback_buffering_ms: Math.round(pendingTransition.startup_buffering_ms),
        error_code: "program_start_timeout"
      }, true);
    }, PROGRAM_START_TIMEOUT_MS);
  }

  function reportTransitionStarted() {
    if (!pendingTransition || pendingTransition.reported) return;
    pendingTransition.reported = true;
    clearTimeout(transitionTimeoutTimer);
    transitionTimeoutTimer = null;
    const delay = Math.max(0, Date.now() - pendingTransition.scheduled_start_ms);
    const success = delay <= START_SUCCESS_TOLERANCE_MS;
    trackTv("tv_intermission_end", {
      ...broadcastDetails(),
      intermission_planned_seconds: Number(pendingTransition.planned_seconds.toFixed(3)),
      intermission_actual_seconds: Number(pendingTransition.actual_seconds.toFixed(3)),
      next_program_start_delay_ms: Math.round(delay),
      intermission_success: success ? 1 : 0,
      playback_buffering_ms: Math.round(pendingTransition.startup_buffering_ms),
      ...(success ? {} : { error_code: "intermission_overrun" })
    }, true);
    pendingTransition = null;
  }

  function trackPlaybackStart() {
    const details = broadcastDetails();
    const mediaKey = [details.channel_id || "", details.program_id || "", details.media_id || "", details.youtube_id || ""].join("|");
    const programKey = [details.channel_id || "", details.program_id || ""].join("|");

    if (!tvStartTracked) {
      tvStartTracked = true;
      trackTv("tv_start", details, true);
    }
    if (mediaKey && mediaKey !== lastTrackedMediaKey) {
      lastTrackedMediaKey = mediaKey;
      trackTv("tv_media_start", details);
    }
    if (details.program_id && programKey !== lastTrackedProgramKey) {
      lastTrackedProgramKey = programKey;
      trackTv("tv_program_change", details);
    }
    reportTransitionStarted();
  }

  function loadBroadcast(broadcast, expectedOffset) {
    const media = broadcast && broadcast.media;
    const expectedKey = mediaPlaybackKey(media);
    currentMediaKey = expectedKey;
    currentPlaybackContextKey = playbackContextKey(broadcast);
    mediaBufferingMs = 0;
    bufferingStartedAt = 0;

    Promise.resolve(
      player.load(media, {
        startSeconds: Math.max(0, expectedOffset),
        muted: !soundEnabled,
        volume: 1
      })
    ).then(() => {
      ensureAutoplay();
      log(
        "load",
        expectedKey,
        "provider",
        mediaProvider(media),
        "offset",
        expectedOffset.toFixed(1),
        "channel",
        selectedChannel.channel_id
      );
    }).catch(error => {
      const failedKey = mediaPlaybackKey(media);
      if (failedKey) failedMediaKeys.add(failedKey);
      log("load error", String(error));
      trackTv("tv_error", {
        ...broadcastDetails(broadcast),
        error_code: `${mediaProvider(media) || "player"}_load_error`
      }, true);
      currentMediaKey = "";
      currentPlaybackContextKey = "";
      syncPlayback(true);
    });
  }

  function syncPlayback(force = false) {
    if (!engine || !selectedChannel) return;
    if (intermission) {
      if (Date.now() >= intermission.scheduled_start_ms) finishIntermission();
      return;
    }

    const previousBroadcast = currentBroadcast;
    const broadcast = expectedBroadcast();
    const nextContextKey = playbackContextKey(broadcast);
    currentBroadcast = broadcast;
    updateChannelHeader(broadcast);
    updateEntityCard(broadcast);
    updateInfoPanel(broadcast);
    renderChannelMenu();
    renderContinuity();

    if (
      !broadcast ||
      broadcast.kind !== "media" ||
      !broadcast.media ||
      !mediaSupportedByPlayer(broadcast.media)
    ) {
      showStandby(broadcast);
      if (playerReady && player) player.pause();
      return;
    }

    hideStandby();

    const expectedKey = mediaPlaybackKey(broadcast.media);
    const expectedOffset = Math.max(0, Number(broadcast.media_offset_seconds || 0));
    if (!playerReady || !player || !expectedKey) return;

    const contextChanged = Boolean(
      previousBroadcast &&
      nextContextKey !== currentPlaybackContextKey
    );
    const mediaChanged = currentMediaKey !== expectedKey;

    if (force || !currentMediaKey || contextChanged || mediaChanged) {
      loadBroadcast(broadcast, expectedOffset);
    }
  }

  function handleBufferingStart() {
    if (!bufferingStartedAt) bufferingStartedAt = performance.now();
  }

  function handleBufferingEnd() {
    if (!bufferingStartedAt) return;
    const duration = Math.max(0, performance.now() - bufferingStartedAt);
    bufferingStartedAt = 0;
    mediaBufferingMs += duration;
    if (pendingTransition) pendingTransition.startup_buffering_ms += duration;

    if (duration >= BUFFERING_DEGRADED_MS && Date.now() - lastDegradedReportAt >= DEGRADED_REPORT_COOLDOWN_MS) {
      lastDegradedReportAt = Date.now();
      trackTv("tv_playback_degraded", {
        ...broadcastDetails(),
        playback_buffering_ms: Math.round(duration),
        error_code: "buffering_prolonged"
      }, true);
    }
    log("buffering", Math.round(duration), "ms");
  }

  function clearPauseRecovery() {
    clearTimeout(pausePlayTimer);
    clearTimeout(pauseForceLiveTimer);
    pausePlayTimer = null;
    pauseForceLiveTimer = null;
  }

  function canRecoverPausedPlayback() {
    return Boolean(
      playerReady &&
      player &&
      !intermission &&
      currentMediaKey &&
      currentBroadcast &&
      currentBroadcast.kind === "media" &&
      currentBroadcast.media &&
      mediaSupportedByPlayer(currentBroadcast.media)
    );
  }

  function forceLiveAfterPause() {
    if (!canRecoverPausedPlayback()) return;

    const state = player.getState();

    // Si play() ya consiguió reanudar, no hacemos una
    // resincronización innecesaria.
    if (state !== "paused") return;

    log("paused -> force live", currentMediaKey);

    trackTv("tv_playback_resync", {
      ...broadcastDetails(),
      action_from: "paused",
      action_to: "live"
    }, true);

    currentMediaKey = "";
    currentPlaybackContextKey = "";

    // syncPlayback(true) consulta de nuevo el motor con Date.now(),
    // por lo que carga el medio y offset que corresponden al directo.
    syncPlayback(true);
  }

  function handlePausedPlayback() {
    if (!canRecoverPausedPlayback()) return;

    clearPauseRecovery();

    log("paused", currentMediaKey);

    // Primer nivel: la pausa dura sólo unas décimas.
    // Intentamos continuar sin recargar el iframe ni alterar la calidad.
    pausePlayTimer = setTimeout(() => {
      if (!canRecoverPausedPlayback()) return;

      if (player.getState() === "paused") {
        player.play();
      }
    }, PAUSE_PLAY_RETRY_MS);

    // Segundo nivel: si el navegador sigue realmente pausado,
    // abandonamos ese punto y volvemos a la emisión actual.
    pauseForceLiveTimer = setTimeout(
      forceLiveAfterPause,
      PAUSE_FORCE_LIVE_MS
    );
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (playerReady && player) {
      player.setVolume(1);
      player.setMuted(!soundEnabled);
      if (soundEnabled) {
        player.play();
        trackTv("tv_sound_on", broadcastDetails());
      }
    }
    updateSoundButton();
  }

  async function toggleFullscreen() {
    const root = document.documentElement;
    if (!fullscreenSupported()) {
      log("fullscreen", "not supported");
      trackTv("tv_error", { ...broadcastDetails(), error_code: "fullscreen_unsupported" }, true);
      return;
    }
    try {
      if (!fullscreenElement()) {
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        await request.call(root);
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      }
    } catch (error) {
      log("fullscreen", String(error));
      trackTv("tv_error", { ...broadcastDetails(), error_code: "fullscreen_failed" }, true);
    }
  }

  function updateFullscreenLabel() {
    const button = $("fullscreenButton");
    const label = $("fullscreenLabel");
    const active = Boolean(fullscreenElement());
    const actionLabel = active ? configValue("ui.controls.exit_fullscreen", "Exit fullscreen") : configValue("ui.controls.fullscreen", "Fullscreen");

    if (!fullscreenSupported()) {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    if (label) label.textContent = actionLabel;
    button.setAttribute("aria-label", actionLabel);
    button.setAttribute("title", actionLabel);

    if (active) trackTv("tv_fullscreen_on", broadcastDetails());
  }

  function playbackHealthTick() {
    if (intermission && Date.now() >= intermission.scheduled_start_ms) {
      finishIntermission();
      return;
    }
    syncPlayback(false);
  }

  function startTimers() {
    clearInterval(healthTimer);
    clearInterval(uiTimer);
    clearInterval(refreshTimer);
    clearInterval(debugScheduleTimer);

    healthTimer = setInterval(playbackHealthTick, PLAYBACK_HEALTH_MS);
    uiTimer = setInterval(renderContinuity, UI_TICK_MS);
    refreshTimer = setInterval(() => loadTvData({ quiet: true }), DATA_REFRESH_MS);

    if (debugEnabled) {
      debugScheduleReport();
      debugScheduleTimer = setInterval(
        debugScheduleReport,
        DEBUG_SCHEDULE_REPORT_MS
      );
    }
  }

  function initPlayer() {
    if (!window.TVAppPlayer || !window.TVAppPlayer.MultiSourcePlayer) {
      throw new Error(configValue("ui.errors.player_missing", "The multi-provider player could not be loaded."));
    }

    player = new window.TVAppPlayer.MultiSourcePlayer("player", {
      onReady(info) {
        playerReady = true;
        player.setVolume(1);
        player.setMuted(!soundEnabled);
        updateSoundButton();
        log("player ready", info && info.provider || "");
      },

      onStateChange(state) {
        if (lastPlayerState === "buffering" && state !== "buffering") {
          handleBufferingEnd();
        }
        if (state === "buffering") handleBufferingStart();

        if (state !== "paused") {
          clearPauseRecovery();
        }

        lastPlayerState = state;

        if (state === "paused") {
          handlePausedPlayback();
          return;
        }

        if (state === "playing") {
          player.setVolume(1);
          player.setMuted(!soundEnabled);
          trackPlaybackStart();
          updateInfoPanel(currentBroadcast);
        }

        if (state === "ended") {
          if (
            currentBroadcast &&
            (currentBroadcast.is_global_entity_block ||
             String(currentBroadcast.media && currentBroadcast.media.type || "").toLowerCase() === "entity")
          ) {
            currentMediaKey = "";
            syncPlayback(true);
            return;
          }
          if (beginIntermissionFromEnded()) return;
          currentMediaKey = "";
          syncPlayback(true);
        }
      },

      onError(info) {
        handleBufferingEnd();
        const failedKey = info && info.mediaKey
          ? info.mediaKey
          : currentMediaKey;
        if (failedKey) failedMediaKeys.add(failedKey);

        const provider = info && info.provider
          ? info.provider
          : mediaProvider(currentBroadcast && currentBroadcast.media);

        const code = info && info.code
          ? info.code
          : `${provider || "player"}_error`;

        log("player error", provider, code, failedKey);
        trackTv("tv_error", {
          ...broadcastDetails(),
          playback_buffering_ms: Math.round(mediaBufferingMs),
          error_code: code
        }, true);

        currentMediaKey = "";
        currentPlaybackContextKey = "";
        syncPlayback(true);
      }
    });

    // El gestor multiproveedor está listo para recibir una carga aunque
    // el SDK concreto (YouTube, Vimeo, PeerTube) termine de inicializarse
    // unos instantes después.
    playerReady = true;
    updateSoundButton();
  }

  window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
    if (window.TVAppPlayer && window.TVAppPlayer.notifyYouTubeIframeAPIReady) {
      window.TVAppPlayer.notifyYouTubeIframeAPIReady();
    }
  };

  function bindUi() {
    $("channelButton").addEventListener("click", event => {
      event.stopPropagation();
      renderChannelMenu();
      toggleChannelMenu();
    });

    document.addEventListener("click", event => {
      if (!$("channelSwitcher").contains(event.target)) closeChannelMenu();

      const panel = $("infoPanel");
      const infoButton = $("infoButton");

      if (
        panel &&
        panel.classList.contains("open") &&
        !panel.contains(event.target) &&
        infoButton &&
        !infoButton.contains(event.target)
      ) {
        closeInfoPanel();
      }
    });

    $("shareButton").addEventListener("click", shareCurrentBroadcast);
    $("soundButton").addEventListener("click", toggleSound);
    $("fullscreenButton").addEventListener("click", toggleFullscreen);
    $("infoButton").addEventListener("click", event => {
      event.stopPropagation();
      toggleInfoPanel();
    });
    $("infoCloseButton").addEventListener("click", closeInfoPanel);
    document.addEventListener("fullscreenchange", updateFullscreenLabel);
    document.addEventListener("webkitfullscreenchange", updateFullscreenLabel);

    $("infoMapLink").addEventListener("click", () => {
      trackTv("tv_entity_open", {
        ...broadcastDetails(),
        action_from: "program_info",
        action_to: $("infoMapLink").href || ""
      });
    });

    [
      ["infoProposeLink", "proposal"],
      ["infoCorrectionLink", "correction"],
      ["infoRemovalLink", "removal"]
    ].forEach(([id, action]) => {
      const link = $(id);
      if (!link) return;

      link.addEventListener("click", () => {
        trackTv("tv_request_open", {
          ...broadcastDetails(),
          action_from: "program_info",
          action_to: action
        });
      });
    });

    $("entityLink").addEventListener("click", () => {
      trackTv("tv_entity_open", {
        ...broadcastDetails(),
        action_from: currentBroadcast && currentBroadcast.is_global_entity_block ? "entity_promo" : "entity_card",
        action_to: $("entityLink").href || ""
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        clearPauseRecovery();
        return;
      }
      if (intermission && Date.now() >= intermission.scheduled_start_ms) {
        finishIntermission();
      } else {
        currentPlaybackContextKey = "";
        syncPlayback(true);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeChannelMenu();
        closeInfoPanel();
      }
      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) toggleFullscreen();
    });

    updateFullscreenLabel();
  }

  async function init() {
    await loadAppConfig();
    initPlayer();
    bindUi();
    startTimers();
    await loadTvData();
  }

  init();
})();
