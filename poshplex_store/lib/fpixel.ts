export let FB_PIXEL_ID = "";

export const setPixelId = (id: string) => {
  FB_PIXEL_ID = id;
};

declare global {
  interface Window {
    fbq: any;
  }
}

// User Data interface matching FB Advanced Matching
export interface FBUserData {
  em?: string; // email
  ph?: string; // phone
  fn?: string; // first name
  ln?: string; // last name
  ct?: string; // city
  st?: string; // state
  zp?: string; // zip
  country?: string; // country code (bd)
  ge?: string; // gender (m, f)
  db?: string; // date of birth (YYYYMMDD)
  external_id?: string;
  fbp?: string;
  fbc?: string;
}

/**
 * Safe client-side cookie helper
 */
export const getCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : undefined;
};

export const setCookie = (name: string, value: string, maxAgeSeconds: number = 31536000) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
};

/**
 * Ensure a valid _fbp cookie exists according to Meta specifications:
 * fb.1.${timestamp}.${randomNumber}
 */
export const getOrCreateFbp = (): string => {
  if (typeof window === "undefined") return "";
  let fbp = getCookie("_fbp");
  if (!fbp) {
    const timestamp = Date.now();
    const random = Math.floor(1000000000 + Math.random() * 9000000000);
    fbp = `fb.1.${timestamp}.${random}`;
    setCookie("_fbp", fbp, 365 * 24 * 60 * 60);
  }
  return fbp;
};

/**
 * Ensure _fbc cookie exists if traffic came with fbclid parameter:
 * fb.1.${timestamp}.${fbclid}
 */
export const getOrCreateFbc = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  let fbc = getCookie("_fbc");
  if (!fbc && window.location.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const fbclid = params.get("fbclid");
      if (fbclid) {
        fbc = `fb.1.${Date.now()}.${fbclid}`;
        setCookie("_fbc", fbc, 90 * 24 * 60 * 60);
      }
    } catch {
      // ignore
    }
  }
  return fbc;
};

/**
 * Persistent anonymous external_id for cross-session & cross-event stitching
 */
export const getOrCreateExternalId = (): string => {
  if (typeof window === "undefined") return "";
  try {
    let extId = localStorage.getItem("poshplex_external_id") || getCookie("poshplex_external_id");
    if (!extId) {
      extId = typeof crypto !== "undefined" && crypto.randomUUID
        ? `ext_${crypto.randomUUID()}`
        : `ext_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("poshplex_external_id", extId);
      setCookie("poshplex_external_id", extId, 365 * 24 * 60 * 60);
    }
    return extId;
  } catch {
    return `ext_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
};

/**
 * Cache known user data (from auth or checkout) into localStorage for future events
 */
export const saveUserData = (userData: Partial<FBUserData>) => {
  if (typeof window === "undefined" || !userData) return;
  try {
    const existingRaw = localStorage.getItem("poshplex_user_profile");
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const merged = { ...existing };
    for (const [k, v] of Object.entries(userData)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        merged[k] = v;
      }
    }
    localStorage.setItem("poshplex_user_profile", JSON.stringify(merged));
  } catch {
    // ignore quota/private mode errors
  }
};

/**
 * Automatically enrich event user data with stored profile, cookies, and identifiers
 */
export const getEnrichedUserData = (explicitUserData: FBUserData = {}): FBUserData => {
  let cached: Partial<FBUserData> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("poshplex_user_profile");
      if (raw) cached = JSON.parse(raw);
    } catch {}

    // Check logged-in user in localStorage if not in profile
    if (!cached.em || !cached.fn) {
      try {
        const rawUser = localStorage.getItem("poshplex_user");
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user.email && !cached.em) cached.em = user.email;
          if (user.username && !cached.fn) cached.fn = user.username;
          if (user.id && !cached.external_id) cached.external_id = String(user.id);
        }
      } catch {}
    }
  }

  const fbp = explicitUserData.fbp || getOrCreateFbp();
  const fbc = explicitUserData.fbc || getOrCreateFbc();
  const external_id = explicitUserData.external_id || cached.external_id || getOrCreateExternalId();

  const result: FBUserData = {
    country: explicitUserData.country || cached.country || "bd",
    external_id,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    em: explicitUserData.em || cached.em || undefined,
    ph: explicitUserData.ph || cached.ph || undefined,
    fn: explicitUserData.fn || cached.fn || undefined,
    ln: explicitUserData.ln || cached.ln || undefined,
    ct: explicitUserData.ct || cached.ct || undefined,
    st: explicitUserData.st || cached.st || undefined,
    zp: explicitUserData.zp || cached.zp || undefined,
    ge: explicitUserData.ge || cached.ge || undefined,
    db: explicitUserData.db || cached.db || undefined,
  };

  // Remove empty/whitespace-only values
  Object.keys(result).forEach((k) => {
    const key = k as keyof FBUserData;
    if (!result[key] || String(result[key]).trim() === "") {
      delete result[key];
    }
  });

  return result;
};

// Helper to fire both Pixel and CAPI simultaneously
export const trackEvent = (
  eventName: string,
  eventData: Record<string, any> = {},
  userData: FBUserData = {}
) => {
  // Generate a random UUID for deduplication
  const eventId = typeof crypto !== "undefined" && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `evt_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
    
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const finalUserData = getEnrichedUserData(userData);

  // 1. Fire Client-Side Pixel (FB handles hashing of user data automatically on client)
  if (typeof window !== "undefined" && window.fbq) {
    if (Object.keys(finalUserData).length > 0) {
      // Pass advanced matching fields (excluding browser cookie objects)
      const { fbp, fbc, ...advancedMatchingData } = finalUserData;
      if (Object.keys(advancedMatchingData).length > 0) {
        window.fbq("init", FB_PIXEL_ID, advancedMatchingData);
      }
    }
    window.fbq("track", eventName, eventData, { eventID: eventId });
  }

  // 2. Fire Server-Side CAPI
  sendServerEvent(eventName, eventData, finalUserData, eventId, currentUrl);
};

// Fire API request to our CAPI route
export const sendServerEvent = async (
  eventName: string,
  eventData: Record<string, any> = {},
  userData: FBUserData = {},
  eventId: string,
  eventSourceUrl: string
) => {
  try {
    await fetch("/api/fb-capi", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName,
        eventData,
        userData, // Send raw to our Node API route for secure SHA-256 hashing
        eventId,
        eventSourceUrl,
      }),
    });
  } catch (error) {
    console.error("Failed to send CAPI event:", error);
  }
};

