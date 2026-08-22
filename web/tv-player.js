(() => {
  "use strict";

  const STATE = Object.freeze({
    UNSTARTED: "unstarted",
    PLAYING: "playing",
    PAUSED: "paused",
    BUFFERING: "buffering",
    ENDED: "ended",
    ERROR: "error"
  });

  let youtubeReadyResolved = false;
  let resolveYoutubeReady;
  const youtubeReadyPromise = new Promise(resolve => {
    resolveYoutubeReady = resolve;
  });

  function notifyYouTubeIframeAPIReady() {
    if (youtubeReadyResolved) return;
    youtubeReadyResolved = true;
    resolveYoutubeReady();
  }

  if (window.YT && window.YT.Player) {
    notifyYouTubeIframeAPIReady();
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeProvider(media) {
    const explicit = clean(media && media.provider).toLowerCase();
    const aliases = {
      youtube: "youtube",
      yt: "youtube",
      vimeo: "vimeo",
      vm: "vimeo",
      peertube: "peertube",
      pt: "peertube",
      direct: "direct",
      file: "direct",
      html5: "direct"
    };

    if (aliases[explicit]) return aliases[explicit];
    if (clean(media && media.youtube_id)) return "youtube";

    const mediaId = clean(media && media.media_id).toUpperCase();
    if (mediaId.startsWith("YT-")) return "youtube";
    if (mediaId.startsWith("VM-")) return "vimeo";
    if (mediaId.startsWith("PT-")) return "peertube";
    if (mediaId.startsWith("AV-")) return "direct";

    return explicit;
  }

  function stripKnownPrefix(value, prefix) {
    const text = clean(value);
    return text.toUpperCase().startsWith(prefix)
      ? text.slice(prefix.length)
      : text;
  }

  function providerMediaId(media) {
    const provider = normalizeProvider(media);

    if (provider === "youtube") {
      return clean(media && media.youtube_id) ||
        stripKnownPrefix(media && media.provider_id, "YT-") ||
        stripKnownPrefix(media && media.media_id, "YT-");
    }

    if (provider === "vimeo") {
      return stripKnownPrefix(media && media.provider_id, "VM-") ||
        stripKnownPrefix(media && media.media_id, "VM-");
    }

    if (provider === "peertube") {
      return stripKnownPrefix(media && media.provider_id, "PT-") ||
        stripKnownPrefix(media && media.media_id, "PT-");
    }

    return clean(media && media.provider_id) || clean(media && media.media_id);
  }

  function mediaKey(media) {
    if (!media) return "";
    const stable = clean(media.media_id);
    if (stable) return stable;
    const provider = normalizeProvider(media);
    const id = providerMediaId(media);
    return provider && id ? `${provider}:${id}` : clean(media.provider_url || media.embed_url || media.url);
  }

  function isSupported(media) {
    const provider = normalizeProvider(media);
    if (!["youtube", "vimeo", "peertube", "direct"].includes(provider)) return false;

    if (provider === "youtube") return Boolean(providerMediaId(media));
    if (provider === "vimeo") {
      return Boolean(clean(media && (media.provider_url || media.embed_url)) || providerMediaId(media));
    }
    if (provider === "peertube") {
      return Boolean(
        clean(media && media.embed_url) ||
        (clean(media && media.provider_url) && providerMediaId(media))
      );
    }
    return Boolean(clean(media && (media.embed_url || media.provider_url || media.url)));
  }

  function buildPeerTubeEmbedUrl(media, startSeconds, muted) {
    let source = clean(media && media.embed_url);
    const id = providerMediaId(media);

    if (!source) {
      const providerUrl = clean(media && media.provider_url);
      if (!providerUrl || !id) return "";
      try {
        const parsed = new URL(providerUrl, window.location.href);
        source = `${parsed.origin}/videos/embed/${encodeURIComponent(id)}`;
      } catch (_) {
        return "";
      }
    }

    try {
      const url = new URL(source, window.location.href);
      url.searchParams.set("api", "1");
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("muted", muted ? "1" : "0");
      url.searchParams.set("controls", "0");
      url.searchParams.set("controlBar", "0");
      url.searchParams.set("peertubeLink", "0");
      url.searchParams.set("title", "0");
      url.searchParams.set("warningTitle", "0");
      if (Number(startSeconds) > 0) {
        url.searchParams.set("start", String(Math.max(0, Math.floor(Number(startSeconds)))));
      }
      return url.toString();
    } catch (_) {
      return "";
    }
  }

  class MultiSourcePlayer {
    constructor(container, callbacks = {}) {
      this.container = typeof container === "string"
        ? document.getElementById(container)
        : container;
      if (!this.container) throw new Error("No se encontró el contenedor del reproductor.");

      this.callbacks = callbacks;
      this.active = null;
      this.currentMedia = null;
      this.currentKey = "";
      this.provider = "";
      this.state = STATE.UNSTARTED;
      this.muted = false;
      this.volume = 1;
      this.loadToken = 0;
    }

    supports(media) {
      return isSupported(media);
    }

    getState() {
      return this.state;
    }

    getProvider() {
      return this.provider;
    }

    getProviderMediaId() {
      return providerMediaId(this.currentMedia);
    }

    getMediaKey() {
      return this.currentKey;
    }

    async load(media, options = {}) {
      const token = ++this.loadToken;
      const startSeconds = Math.max(0, Number(options.startSeconds || 0));
      this.muted = Boolean(options.muted);
      this.volume = Math.max(0, Math.min(1, Number(options.volume == null ? 1 : options.volume)));

      if (!this.supports(media)) {
        throw new Error(`Proveedor no compatible o referencia incompleta: ${normalizeProvider(media) || "desconocido"}`);
      }

      await this._destroyActive();
      if (token !== this.loadToken) return;

      this.currentMedia = media;
      this.currentKey = mediaKey(media);
      this.provider = normalizeProvider(media);
      this._setState(STATE.UNSTARTED);

      if (this.provider === "youtube") {
        await this._loadYouTube(media, startSeconds, token);
      } else if (this.provider === "vimeo") {
        await this._loadVimeo(media, startSeconds, token);
      } else if (this.provider === "peertube") {
        await this._loadPeerTube(media, startSeconds, token);
      } else if (this.provider === "direct") {
        await this._loadDirect(media, startSeconds, token);
      }
    }

    async play() {
      const active = this.active;
      if (!active) return;
      try {
        if (active.provider === "youtube") active.instance.playVideo();
        else if (active.provider === "vimeo") await active.instance.play();
        else if (active.provider === "peertube") await active.instance.play();
        else if (active.provider === "direct") await active.instance.play();
      } catch (_) {}
    }

    async pause() {
      const active = this.active;
      if (!active) return;
      try {
        if (active.provider === "youtube") active.instance.pauseVideo();
        else if (active.provider === "vimeo") await active.instance.pause();
        else if (active.provider === "peertube") await active.instance.pause();
        else if (active.provider === "direct") active.instance.pause();
      } catch (_) {}
    }

    async setMuted(muted) {
      this.muted = Boolean(muted);
      const active = this.active;
      if (!active) return;

      try {
        if (active.provider === "youtube") {
          if (this.muted) active.instance.mute();
          else active.instance.unMute();
        } else if (active.provider === "vimeo") {
          await active.instance.setVolume(this.muted ? 0 : this.volume);
        } else if (active.provider === "peertube") {
          await active.instance.setVolume(this.muted ? 0 : this.volume);
        } else if (active.provider === "direct") {
          active.instance.muted = this.muted;
          active.instance.volume = this.volume;
        }
      } catch (_) {}
    }

    async setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, Number(volume == null ? 1 : volume)));
      const active = this.active;
      if (!active) return;

      try {
        if (active.provider === "youtube") {
          active.instance.setVolume(Math.round(this.volume * 100));
        } else if (active.provider === "vimeo") {
          await active.instance.setVolume(this.muted ? 0 : this.volume);
        } else if (active.provider === "peertube") {
          await active.instance.setVolume(this.muted ? 0 : this.volume);
        } else if (active.provider === "direct") {
          active.instance.volume = this.volume;
        }
      } catch (_) {}
    }

    async destroy() {
      ++this.loadToken;
      await this._destroyActive();
      this.currentMedia = null;
      this.currentKey = "";
      this.provider = "";
      this._setState(STATE.UNSTARTED);
    }

    _emitReady() {
      if (typeof this.callbacks.onReady === "function") {
        this.callbacks.onReady({
          provider: this.provider,
          media: this.currentMedia,
          mediaKey: this.currentKey
        });
      }
    }

    _setState(nextState, data) {
      if (!nextState) return;
      const previous = this.state;
      this.state = nextState;
      if (previous === nextState && nextState !== STATE.BUFFERING) return;
      if (typeof this.callbacks.onStateChange === "function") {
        this.callbacks.onStateChange(nextState, {
          previousState: previous,
          provider: this.provider,
          media: this.currentMedia,
          mediaKey: this.currentKey,
          data: data || null
        });
      }
    }

    _emitError(code, error) {
      this._setState(STATE.ERROR, error);
      if (typeof this.callbacks.onError === "function") {
        this.callbacks.onError({
          code: clean(code) || "player_error",
          provider: this.provider || normalizeProvider(this.currentMedia),
          media: this.currentMedia,
          mediaKey: this.currentKey || mediaKey(this.currentMedia),
          error
        });
      }
    }

    _makeHost(tagName = "div") {
      this.container.replaceChildren();
      const node = document.createElement(tagName);
      node.className = "tvapp-provider-player";
      this.container.appendChild(node);
      return node;
    }

    async _destroyActive() {
      const active = this.active;
      this.active = null;
      if (!active) {
        this.container.replaceChildren();
        return;
      }

      try {
        if (active.provider === "youtube" && active.instance && active.instance.destroy) {
          active.instance.destroy();
        } else if (active.provider === "vimeo" && active.instance && active.instance.destroy) {
          await active.instance.destroy();
        } else if (active.provider === "direct" && active.instance) {
          active.instance.pause();
          active.instance.removeAttribute("src");
          active.instance.load();
        }
      } catch (_) {}

      this.container.replaceChildren();
    }

    async _loadYouTube(media, startSeconds, token) {
      if (!(window.YT && window.YT.Player)) {
        await youtubeReadyPromise;
      }
      if (token !== this.loadToken) return;
      if (!(window.YT && window.YT.Player)) throw new Error("YouTube IFrame API no disponible.");

      const videoId = providerMediaId(media);
      const host = this._makeHost("div");

      await new Promise((resolve, reject) => {
        let settled = false;
        const instance = new window.YT.Player(host, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            modestbranding: 1
          },
          events: {
            onReady: () => {
              if (token !== this.loadToken) return;
              this.active = { provider: "youtube", instance };
              try {
                instance.loadVideoById({
                  videoId,
                  startSeconds: Math.max(0, Math.floor(startSeconds))
                });
                if (this.muted) instance.mute();
                else instance.unMute();
                instance.setVolume(Math.round(this.volume * 100));
              } catch (error) {
                reject(error);
                return;
              }
              this._emitReady();
              if (!settled) {
                settled = true;
                resolve();
              }
            },
            onStateChange: event => {
              if (token !== this.loadToken) return;
              const state = event.data;
              if (state === window.YT.PlayerState.PLAYING) this._setState(STATE.PLAYING, event);
              else if (state === window.YT.PlayerState.PAUSED) this._setState(STATE.PAUSED, event);
              else if (state === window.YT.PlayerState.BUFFERING) this._setState(STATE.BUFFERING, event);
              else if (state === window.YT.PlayerState.ENDED) this._setState(STATE.ENDED, event);
              else this._setState(STATE.UNSTARTED, event);
            },
            onError: event => {
              if (token !== this.loadToken) return;
              this._emitError(`youtube_${event.data}`, event);
              if (!settled) {
                settled = true;
                reject(new Error(`YouTube error ${event.data}`));
              }
            }
          }
        });
        this.active = { provider: "youtube", instance };
      });
    }

    async _loadVimeo(media, startSeconds, token) {
      if (!(window.Vimeo && window.Vimeo.Player)) {
        throw new Error("Vimeo Player SDK no disponible.");
      }

      const host = this._makeHost("div");
      const providerUrl = clean(media.embed_url || media.provider_url);
      const id = providerMediaId(media);
      const options = {
        autoplay: true,
        controls: false,
        muted: this.muted,
        playsinline: true,
        dnt: true,
        autopause: false
      };
      if (providerUrl) options.url = providerUrl;
      else options.id = /^\d+$/.test(id) ? Number(id) : id;

      const instance = new window.Vimeo.Player(host, options);
      this.active = { provider: "vimeo", instance };

      instance.on("bufferstart", () => {
        if (token === this.loadToken) this._setState(STATE.BUFFERING);
      });
      instance.on("bufferend", () => {
        if (token === this.loadToken && this.state === STATE.BUFFERING) this._setState(STATE.UNSTARTED);
      });
      instance.on("play", data => {
        if (token === this.loadToken) this._setState(STATE.PLAYING, data);
      });
      instance.on("pause", data => {
        if (token === this.loadToken) this._setState(STATE.PAUSED, data);
      });
      instance.on("ended", data => {
        if (token === this.loadToken) this._setState(STATE.ENDED, data);
      });
      instance.on("error", error => {
        if (token === this.loadToken) this._emitError(`vimeo_${clean(error && error.name) || "error"}`, error);
      });

      await instance.ready();
      if (token !== this.loadToken) return;
      if (startSeconds > 0) {
        try { await instance.setCurrentTime(startSeconds); } catch (_) {}
      }
      try { await instance.setVolume(this.muted ? 0 : this.volume); } catch (_) {}
      this._emitReady();
      try { await instance.play(); } catch (_) { this._setState(STATE.PAUSED); }
    }

    async _loadPeerTube(media, startSeconds, token) {
      if (!window.PeerTubePlayer) {
        throw new Error("PeerTube Embed API no disponible.");
      }

      const embedUrl = buildPeerTubeEmbedUrl(media, startSeconds, this.muted);
      if (!embedUrl) throw new Error("No se pudo construir la URL embed de PeerTube.");

      const iframe = this._makeHost("iframe");
      iframe.src = embedUrl;
      iframe.title = clean(media.title) || clean(window.TV_APP_CONFIG && window.TV_APP_CONFIG.name) || "TV App";
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";

      const instance = new window.PeerTubePlayer(iframe);
      this.active = { provider: "peertube", instance, element: iframe };

      const handleStatus = payload => {
        if (token !== this.loadToken) return;
        const state = clean(
          payload && typeof payload === "object"
            ? payload.playbackState
            : payload
        ).toLowerCase();
        if (state === "playing") this._setState(STATE.PLAYING, payload);
        else if (state === "paused") this._setState(STATE.PAUSED, payload);
        else if (state === "ended") this._setState(STATE.ENDED, payload);
        else if (state) this._setState(STATE.UNSTARTED, payload);
      };

      instance.addEventListener("playbackStatusUpdate", handleStatus);
      instance.addEventListener("playbackStatusChange", handleStatus);

      await instance.ready;
      if (token !== this.loadToken) return;
      if (startSeconds > 0) {
        try { await instance.seek(startSeconds); } catch (_) {}
      }
      try { await instance.setVolume(this.muted ? 0 : this.volume); } catch (_) {}
      this._emitReady();
      try { await instance.play(); } catch (_) { this._setState(STATE.PAUSED); }
    }

    async _loadDirect(media, startSeconds, token) {
      const source = clean(media.embed_url || media.provider_url || media.url);
      if (!source) throw new Error("Fuente de vídeo directa vacía.");

      const video = this._makeHost("video");
      video.src = source;
      video.autoplay = true;
      video.controls = false;
      video.playsInline = true;
      video.preload = "auto";
      video.muted = this.muted;
      video.volume = this.volume;

      this.active = { provider: "direct", instance: video };

      video.addEventListener("waiting", () => {
        if (token === this.loadToken) this._setState(STATE.BUFFERING);
      });
      video.addEventListener("stalled", () => {
        if (token === this.loadToken) this._setState(STATE.BUFFERING);
      });
      video.addEventListener("playing", () => {
        if (token === this.loadToken) this._setState(STATE.PLAYING);
      });
      video.addEventListener("pause", () => {
        if (token === this.loadToken && !video.ended) this._setState(STATE.PAUSED);
      });
      video.addEventListener("ended", () => {
        if (token === this.loadToken) this._setState(STATE.ENDED);
      });
      video.addEventListener("error", () => {
        if (token === this.loadToken) this._emitError("direct_media_error", video.error);
      });

      await new Promise((resolve, reject) => {
        const ready = () => {
          cleanup();
          resolve();
        };
        const failed = () => {
          cleanup();
          reject(video.error || new Error("No se pudo cargar el vídeo directo."));
        };
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", ready);
          video.removeEventListener("error", failed);
        };
        video.addEventListener("loadedmetadata", ready, { once: true });
        video.addEventListener("error", failed, { once: true });
      });

      if (token !== this.loadToken) return;
      if (startSeconds > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(startSeconds, Math.max(0, video.duration - 0.1));
      }
      this._emitReady();
      try { await video.play(); } catch (_) { this._setState(STATE.PAUSED); }
    }
  }

  window.TVAppPlayer = Object.freeze({
    STATE,
    MultiSourcePlayer,
    normalizeProvider,
    providerMediaId,
    mediaKey,
    isSupported,
    notifyYouTubeIframeAPIReady
  });
})();
