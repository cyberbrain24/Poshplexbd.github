/**
 * First-Party Customer Data and Attribution Tracker (M1 - M5)
 * Captures visitor journeys, stitches sessions, and dispatches non-blocking events
 * to Poshplex's high-speed backend queue without impacting page speed or checkout.
 */

import * as fpixel from "../../lib/fpixel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://poshplexbd.com";

export interface AttributionContext {
  visitor_id: string;
  session_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbc?: string;
  fbp?: string;
  landing_page: string;
  referrer: string;
}

/**
 * Cookie Helper
 */
const getCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : undefined;
};

const setCookie = (name: string, value: string, maxAgeSeconds: number = 31536000) => {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const domainAttr = host.includes("poshplexbd.com") ? "; domain=.poshplexbd.com" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/${domainAttr}; max-age=${maxAgeSeconds}; SameSite=Lax`;
};

/**
 * Generates or retrieves a persistent 1-year first-party Visitor UUID.
 */
export const getOrCreateVisitorId = (): string => {
  if (typeof window === "undefined") return "";
  let vid = getCookie("posh_visitor_id");
  if (!vid) {
    try {
      vid = localStorage.getItem("posh_visitor_id") || undefined;
    } catch {}
  }

  if (!vid) {
    vid = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `vis_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  setCookie("posh_visitor_id", vid, 365 * 24 * 60 * 60);
  try {
    localStorage.setItem("posh_visitor_id", vid);
  } catch {}

  return vid;
};

/**
 * Generates or retrieves a 30-minute rolling session UUID.
 */
export const getOrCreateSessionId = (): string => {
  if (typeof window === "undefined") return "";
  const now = Date.now();
  let sid: string | null = null;
  let lastActive = 0;

  try {
    sid = sessionStorage.getItem("posh_session_id") || localStorage.getItem("posh_session_id");
    const storedActive = localStorage.getItem("posh_session_last_active");
    if (storedActive) {
      lastActive = parseInt(storedActive, 10) || 0;
    }
  } catch {}

  // Expire after 30 minutes of inactivity
  if (!sid || (now - lastActive > 30 * 60 * 1000)) {
    sid = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `ses_${now}_${Math.random().toString(36).substring(2, 10)}`;
  }

  try {
    sessionStorage.setItem("posh_session_id", sid);
    localStorage.setItem("posh_session_id", sid);
    localStorage.setItem("posh_session_last_active", String(now));
  } catch {}

  return sid;
};

/**
 * Captures and caches UTM parameters from current URL or landing storage.
 */
export const captureLandingParameters = (): void => {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    const utmMedium = params.get("utm_medium");
    const utmCampaign = params.get("utm_campaign");
    const utmContent = params.get("utm_content");
    const utmTerm = params.get("utm_term");
    const fbclid = params.get("fbclid");

    if (utmSource || utmCampaign || fbclid) {
      const captured = {
        utm_source: utmSource || "",
        utm_medium: utmMedium || "",
        utm_campaign: utmCampaign || "",
        utm_content: utmContent || "",
        utm_term: utmTerm || "",
        fbclid: fbclid || "",
        landing_page: window.location.href,
        referrer: document.referrer || "",
        captured_at: Date.now(),
      };
      localStorage.setItem("posh_landing_attribution", JSON.stringify(captured));
    }
  } catch {}
};

/**
 * Returns full attribution context for order checkout and event enrichment.
 */
export const getAttributionContext = (): AttributionContext => {
  const visitor_id = getOrCreateVisitorId();
  const session_id = getOrCreateSessionId();

  let utm_source = "";
  let utm_medium = "";
  let utm_campaign = "";
  let utm_content = "";
  let utm_term = "";
  let landing_page = "";
  let referrer = "";

  if (typeof window !== "undefined") {
    referrer = document.referrer || "";
    landing_page = window.location.href;

    // 1. Check current URL search parameters
    try {
      const params = new URLSearchParams(window.location.search);
      utm_source = params.get("utm_source") || "";
      utm_medium = params.get("utm_medium") || "";
      utm_campaign = params.get("utm_campaign") || "";
      utm_content = params.get("utm_content") || "";
      utm_term = params.get("utm_term") || "";
    } catch {}

    // 2. Fallback to cached landing parameters if direct navigation within session
    if (!utm_campaign && !utm_source) {
      try {
        const storedRaw = localStorage.getItem("posh_landing_attribution");
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          // Only use if within 30 days
          if (Date.now() - (stored.captured_at || 0) < 30 * 24 * 60 * 60 * 1000) {
            utm_source = stored.utm_source || "";
            utm_medium = stored.utm_medium || "";
            utm_campaign = stored.utm_campaign || "";
            utm_content = stored.utm_content || "";
            utm_term = stored.utm_term || "";
            if (!referrer) referrer = stored.referrer || "";
            if (stored.landing_page) landing_page = stored.landing_page;
          }
        }
      } catch {}
    }
  }

  const fbc = fpixel.getOrCreateFbc();
  const fbp = fpixel.getOrCreateFbp();

  return {
    visitor_id,
    session_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    fbc: fbc || undefined,
    fbp: fbp || undefined,
    landing_page,
    referrer,
  };
};

/**
 * Dispatches a first-party tracking event to the fast ingestion endpoint.
 * Uses navigator.sendBeacon when possible to prevent blocking page transitions.
 */
export const trackEvent = (
  eventName: string,
  payload: Record<string, any> = {}
): string => {
  if (typeof window === "undefined") return "";

  const event_id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `trk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  captureLandingParameters();
  const ctx = getAttributionContext();

  const eventData = {
    event_id,
    event_name: eventName,
    visitor_id: ctx.visitor_id,
    session_id: ctx.session_id,
    client_timestamp: new Date().toISOString(),
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
    utm_content: ctx.utm_content,
    utm_term: ctx.utm_term,
    fbc: ctx.fbc,
    fbp: ctx.fbp,
    landing_page: ctx.landing_page,
    referrer: ctx.referrer,
    phone: payload.phone || undefined,
    email: payload.email || undefined,
    user_id: payload.user_id || undefined,
    payload,
  };

  const endpoint = `${API_BASE}/api/v1/marketing/track/event/`;
  const bodyString = JSON.stringify(eventData);

  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([bodyString], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (!sent) {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyString,
          keepalive: true,
        }).catch(() => {});
      }
    } else {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyString,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (err) {
    // Fail silently without disrupting user experience
  }

  return event_id;
};
