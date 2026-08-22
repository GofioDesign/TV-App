(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    schema_version: 2,
    instance_id: "tv-app",
    name: "TV App",
    short_name: "TV",
    language: "en",
    locale: "en_US",
    timezone: "UTC",
    site_url: "",
    default_channel: "",
    branding: {
      logo: "assets/tv-app.svg",
      logo_alt: "TV App",
      social_image: "",
      favicon: "assets/tv-app.svg",
      theme_color: "#000000",
      color_scheme: "dark",
      theme: "default"
    },
    seo: {
      title: "TV App",
      description: "Configurable web television engine.",
      robots: "noindex,nofollow",
      canonical_url: "",
      og_type: "website",
      og_site_name: "TV App",
      twitter_card: "summary_large_image",
      twitter_site: "",
      twitter_creator: ""
    },
    publisher: { name: "", url: "", email: "" },
    navigation: {
      enabled: false,
      aria_label: "Main navigation",
      brand_url: "",
      items: []
    },
    ui: {
      channel_label: "CHANNEL",
      loading_channel: "Loading…",
      current_program: "Programming",
      player_aria_label: "Live television broadcast",
      loading_schedule: "Loading schedule…",
      standby_message: "Programming in preparation",
      continuity_aria_label: "Upcoming programme changes",
      entity_map_label: "View profile",
      entity_qr_alt: "QR code for entity profile",
      info_panel_aria_label: "Broadcast information",
      info_kicker: "NOW ON AIR",
      info_title: "Broadcast information",
      info_close: "Close information",
      labels: {
        channel: "Channel",
        program: "Programme",
        now: "Now",
        entity: "Entity",
        territory: "Territory"
      },
      participation: {
        enabled: true,
        label: "Participate",
        aria_label: "Participate in this TV",
        description: "Programming is collaborative. You can propose content or report an issue with this broadcast.",
        proposal: "Propose a video",
        correction: "Report an error or correction",
        removal: "Request removal of this video"
      },
      controls: {
        group_aria_label: "Broadcast controls",
        info: "Info",
        share: "Share",
        fullscreen: "Fullscreen",
        exit_fullscreen: "Exit fullscreen",
        mute: "Mute",
        unmute: "Unmute"
      }
    },
    analytics: { enabled: false, script_url: "" }
  };

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function merge(base, override) {
    if (!isObject(base)) return override;
    const out = { ...base };
    Object.entries(override || {}).forEach(([key, value]) => {
      out[key] = isObject(value) && isObject(base[key])
        ? merge(base[key], value)
        : value;
    });
    return out;
  }

  function absoluteUrl(value, base) {
    if (!value) return "";
    try {
      return new URL(value, base || location.href).toString();
    } catch (_) {
      return value;
    }
  }

  function ensureMeta(selector, attrs) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
      document.head.appendChild(node);
    }
    return node;
  }

  function setMetaName(name, content) {
    const node = ensureMeta(`meta[name="${name}"]`, { name });
    if (content) node.setAttribute("content", content);
    else node.removeAttribute("content");
  }

  function setMetaProperty(property, content) {
    const node = ensureMeta(`meta[property="${property}"]`, { property });
    if (content) node.setAttribute("content", content);
    else node.removeAttribute("content");
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node && value !== undefined && value !== null) node.textContent = String(value);
  }

  function setAria(id, value) {
    const node = document.getElementById(id);
    if (node && value) node.setAttribute("aria-label", String(value));
  }

  function setButtonCopy(id, label) {
    const button = document.getElementById(id);
    if (!button || !label) return;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    const copy = button.querySelector(".tv-control-label");
    if (copy) copy.textContent = label;
  }

  function applyNavigation(config) {
    const nav = document.getElementById("mainNav");
    if (!nav) return;
    const navigation = config.navigation || {};
    nav.hidden = navigation.enabled === false;
    nav.setAttribute("aria-label", navigation.aria_label || "Main navigation");
    nav.innerHTML = "";
    (navigation.items || []).forEach(item => {
      if (!item || !item.label || !item.url) return;
      const a = document.createElement("a");
      a.href = item.url;
      const strong = document.createElement("strong");
      strong.textContent = item.label;
      a.appendChild(strong);
      if (item.current) a.setAttribute("aria-current", "page");
      if (item.target) {
        a.target = item.target;
        if (item.target === "_blank") a.rel = "noopener noreferrer";
      }
      nav.appendChild(a);
    });
  }

  function applyStructuredData(config) {
    const siteUrl = config.site_url || location.href;
    const canonical = (config.seo && config.seo.canonical_url) || siteUrl;
    const socialImage = absoluteUrl(config.branding && config.branding.social_image, siteUrl);
    const publisher = config.publisher || {};
    const organizationId = publisher.url ? `${publisher.url.replace(/\/$/, "")}/#organization` : `${canonical}#publisher`;
    const graph = [];

    if (publisher.name) {
      const organization = {
        "@type": "Organization",
        "@id": organizationId,
        name: publisher.name
      };
      if (publisher.url) organization.url = publisher.url;
      if (publisher.email) organization.email = publisher.email;
      graph.push(organization);
    }

    let imageId = "";
    if (socialImage) {
      imageId = `${canonical}#primaryimage`;
      graph.push({
        "@type": "ImageObject",
        "@id": imageId,
        url: socialImage,
        contentUrl: socialImage,
        width: 1200,
        height: 630,
        caption: config.name
      });
    }

    const websiteId = `${canonical}#website`;
    const website = {
      "@type": "WebSite",
      "@id": websiteId,
      url: canonical,
      name: config.name,
      alternateName: config.short_name || config.name,
      description: config.seo && config.seo.description || "",
      inLanguage: config.language || "en"
    };
    if (publisher.name) website.publisher = { "@id": organizationId };
    graph.push(website);

    const webpage = {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: config.seo && config.seo.title || config.name,
      description: config.seo && config.seo.description || "",
      inLanguage: config.language || "en",
      isPartOf: { "@id": websiteId }
    };
    if (publisher.name) webpage.about = { "@id": organizationId };
    if (imageId) webpage.primaryImageOfPage = { "@id": imageId };
    graph.push(webpage);

    let script = document.getElementById("tvStructuredData");
    if (!script) {
      script = document.createElement("script");
      script.id = "tvStructuredData";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }

  function applyAnalytics(config) {
    const analytics = config.analytics || {};
    if (!analytics.enabled || !analytics.script_url) return;
    if (document.querySelector("script[data-tv-analytics]")) return;
    const script = document.createElement("script");
    script.src = analytics.script_url;
    script.async = true;
    script.dataset.tvAnalytics = "true";
    document.head.appendChild(script);
  }

  function applyConfig(config) {
    const branding = config.branding || {};
    const seo = config.seo || {};
    const ui = config.ui || {};
    const labels = ui.labels || {};
    const participation = ui.participation || {};
    const controls = ui.controls || {};
    const siteUrl = config.site_url || location.href;
    const canonical = seo.canonical_url || config.site_url || "";
    const socialImage = absoluteUrl(branding.social_image, siteUrl);
    const logo = absoluteUrl(branding.logo, location.href);

    document.documentElement.lang = config.language || "en";
    document.title = seo.title || config.name || "TV App";

    setMetaName("description", seo.description || "");
    setMetaName("application-name", config.name || "TV App");
    setMetaName("theme-color", branding.theme_color || "#000000");
    setMetaName("color-scheme", branding.color_scheme || "dark");
    setMetaName("robots", seo.robots || "noindex,nofollow");

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    if (canonical) canonicalLink.href = canonical;
    else canonicalLink.removeAttribute("href");

    setMetaProperty("og:type", seo.og_type || "website");
    setMetaProperty("og:locale", config.locale || "");
    setMetaProperty("og:site_name", seo.og_site_name || config.name || "TV App");
    setMetaProperty("og:title", seo.title || config.name || "TV App");
    setMetaProperty("og:description", seo.description || "");
    setMetaProperty("og:url", canonical);
    setMetaProperty("og:image", socialImage);
    setMetaProperty("og:image:secure_url", socialImage);
    setMetaProperty("og:image:type", socialImage ? "image/png" : "");
    setMetaProperty("og:image:width", socialImage ? "1200" : "");
    setMetaProperty("og:image:height", socialImage ? "630" : "");
    setMetaProperty("og:image:alt", branding.logo_alt || config.name || "TV App");

    setMetaName("twitter:card", seo.twitter_card || "summary_large_image");
    setMetaName("twitter:site", seo.twitter_site || "");
    setMetaName("twitter:creator", seo.twitter_creator || "");
    setMetaName("twitter:title", seo.title || config.name || "TV App");
    setMetaName("twitter:description", seo.description || "");
    setMetaName("twitter:image", socialImage);
    setMetaName("twitter:image:alt", branding.logo_alt || config.name || "TV App");

    const favicon = document.getElementById("tvFavicon");
    if (favicon && branding.favicon) favicon.href = absoluteUrl(branding.favicon, location.href);

    document.querySelectorAll("[data-tv-logo]").forEach(img => {
      if (logo) img.src = logo;
      img.alt = img.hasAttribute("data-tv-logo-decorative") ? "" : (branding.logo_alt || config.name || "TV App");
    });
    document.querySelectorAll("[data-tv-name]").forEach(node => {
      node.textContent = config.name || "TV App";
    });

    const brandLink = document.getElementById("headerBrand");
    if (brandLink) {
      brandLink.href = (config.navigation && config.navigation.brand_url) || config.site_url || "#";
      brandLink.setAttribute("aria-label", config.name || "TV App");
    }

    applyNavigation(config);

    setText("channelNumber", ui.channel_label);
    setText("channelName", ui.loading_channel);
    setText("currentProgram", ui.current_program);
    setText("statusText", ui.loading_schedule);
    setText("standbyCopy", ui.standby_message);
    setText("standbyProgram", config.name || "TV App");
    setText("entityMapLabel", ui.entity_map_label);
    setText("infoKicker", ui.info_kicker);
    setText("infoTitle", ui.info_title);
    setText("infoChannelLabel", labels.channel);
    setText("infoProgramLabel", labels.program);
    setText("infoNowLabel", labels.now);
    setText("infoEntityLabel", labels.entity);
    setText("infoTerritoryLabel", labels.territory);
    setText("infoMapLink", ui.entity_map_label);
    setText("participationLabel", participation.label);
    setText("participationDescription", participation.description);
    setText("infoProposeLink", participation.proposal);
    setText("infoCorrectionLink", participation.correction);
    setText("infoRemovalLink", participation.removal);

    setAria("player", ui.player_aria_label);
    setAria("continuityColumn", ui.continuity_aria_label);
    setAria("infoPanel", ui.info_panel_aria_label);
    setAria("infoCloseButton", ui.info_close);
    setAria("participationSection", participation.aria_label);
    setAria("tvControls", controls.group_aria_label);

    const qr = document.getElementById("entityQr");
    if (qr) qr.alt = ui.entity_qr_alt || "";

    const participationSection = document.getElementById("participationSection");
    if (participationSection) participationSection.hidden = participation.enabled === false;

    setButtonCopy("infoButton", controls.info);
    setButtonCopy("shareButton", controls.share);
    setButtonCopy("fullscreenButton", controls.fullscreen);
    setButtonCopy("soundButton", controls.mute);

    document.body.dataset.tvInstance = config.instance_id || "tv-app";
    document.body.dataset.tvTheme = branding.theme || "default";

    applyStructuredData(config);
    applyAnalytics(config);
  }

  async function load() {
    const configMeta = document.querySelector('meta[name="tv-app-config"]');
    const configUrl = configMeta && configMeta.content || "config.json";
    let loaded = {};
    try {
      const response = await fetch(configUrl, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      loaded = await response.json();
    } catch (error) {
      console.warn("TV App: could not load instance config; using defaults.", error);
    }
    const config = merge(DEFAULT_CONFIG, loaded);
    window.TV_APP_CONFIG = config;
    applyConfig(config);
    document.dispatchEvent(new CustomEvent("tvapp:config-ready", { detail: config }));
    return config;
  }

  const ready = document.readyState === "loading"
    ? new Promise(resolve => document.addEventListener("DOMContentLoaded", () => resolve(load()), { once: true })).then(value => value)
    : load();

  window.TVAppConfig = { ready, defaults: DEFAULT_CONFIG };
})();
