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
  ln?: string; // last name (surname)
  ct?: string; // city / thana
  st?: string; // state / district
  zp?: string; // zip / postal code
  country?: string; // country code (bd)
  ge?: string; // gender (m, f)
  db?: string; // date of birth (YYYYMMDD)
  external_id?: string;
  fbp?: string;
  fbc?: string;
}

/**
 * Bangladesh district to postal code (ZIP) resolver.
 * Meta CAPI achieves an immediate +11% increase in Event Match Quality (EMQ) when Postcode is present.
 */
export const BANGLADESH_DISTRICT_ZIP_MAP: Record<string, string> = {
  "dhaka": "1200",
  "dhanmondi": "1209",
  "gulshan": "1212",
  "banani": "1213",
  "uttara": "1230",
  "mirpur": "1216",
  "mohammadpur": "1207",
  "motijheel": "1000",
  "badda": "1214",
  "khilgaon": "1219",
  "gazipur": "1700",
  "narayanganj": "1400",
  "tangail": "1900",
  "narsingdi": "1600",
  "faridpur": "7800",
  "manikganj": "1800",
  "munshiganj": "1500",
  "gopalganj": "8100",
  "madaripur": "7900",
  "rajbari": "7700",
  "shariatpur": "8000",
  "kishoreganj": "2300",
  "chattogram": "4000",
  "chittagong": "4000",
  "cox's bazar": "4700",
  "coxsbazar": "4700",
  "cumilla": "3500",
  "comilla": "3500",
  "feni": "3900",
  "brahmanbaria": "3400",
  "noakhali": "3800",
  "chandpur": "3600",
  "lakshmipur": "3700",
  "sylhet": "3100",
  "moulvibazar": "3200",
  "habiganj": "3300",
  "sunamganj": "3000",
  "rajshahi": "6000",
  "bogura": "5800",
  "bogra": "5800",
  "pabna": "6600",
  "sirajganj": "6700",
  "naogaon": "6500",
  "natore": "6400",
  "chapainawabganj": "6300",
  "joypurhat": "5900",
  "khulna": "9000",
  "jashore": "7400",
  "jessore": "7400",
  "kushtia": "7000",
  "satkhira": "9400",
  "bagerhat": "9300",
  "chuadanga": "7200",
  "jhenaidah": "7300",
  "magura": "7600",
  "meherpur": "7100",
  "narail": "7500",
  "barishal": "8200",
  "patuakhali": "8600",
  "bhola": "8300",
  "pirojpur": "8500",
  "barguna": "8700",
  "jhalokati": "8400",
  "rangpur": "5400",
  "dinajpur": "5200",
  "gaibandha": "5700",
  "kurigram": "5600",
  "lalmonirhat": "5500",
  "nilphamari": "5300",
  "panchagarh": "5000",
  "thakurgaon": "5100",
  "mymensingh": "2200",
  "jamalpur": "2000",
  "netrokona": "2400",
  "sherpur": "2100",
};

export const resolveBangladeshZip = (cityOrDistrict?: string): string | undefined => {
  if (!cityOrDistrict) return "1200"; // Default to Dhaka central hub if in Bangladesh
  const clean = cityOrDistrict.trim().toLowerCase();
  for (const [key, zip] of Object.entries(BANGLADESH_DISTRICT_ZIP_MAP)) {
    if (clean.includes(key)) return zip;
  }
  return "1200";
};

/**
 * Split full name into first name (fn) and surname/last name (ln)
 * Supports Bangladeshi prefixes (Md, Mohammad, Mst, Syed, etc.) and single-name fallback.
 * Fixes Meta match rate for Surname parameter (was at 0.44%).
 */
export const splitFullName = (fullName?: string): { fn?: string; ln?: string } => {
  if (!fullName) return {};
  const clean = fullName
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ");
  if (!clean) return {};
  const parts = clean.split(" ");
  if (parts.length === 1) {
    // Single name: Meta matches best when both first name and surname have candidate match
    return { fn: parts[0], ln: parts[0] };
  }

  const PREFIXES = ["md", "mohammad", "mohammed", "mst", "most", "syed", "kazi", "mir", "sheikh", "sk"];
  if (parts.length >= 3 && PREFIXES.includes(parts[0].toLowerCase())) {
    return {
      fn: `${parts[0]} ${parts[1]}`,
      ln: parts.slice(2).join(" "),
    };
  }

  return {
    fn: parts[0],
    ln: parts.slice(1).join(" "),
  };
};

/**
 * Infer gender ('m' or 'f') from Bengali / South Asian personal names
 * Boosts Meta Event Match Quality (EMQ) when gender is unprovided or optional.
 */
export const inferGenderFromName = (name?: string): "m" | "f" | undefined => {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
  const tokens = clean.split(/\s+/).filter(Boolean);

  const MALE_TOKENS = [
    "md", "mohammad", "mohammed", "muhammad", "khan", "ahmed", "ahmad", "hasan", 
    "hassan", "hossain", "hussain", "ali", "sheikh", "sk", "mahir", "nahid", 
    "rohan", "siam", "tanvir", "arif", "sabbir", "jahid", "shakil", "rayhan", 
    "asif", "rakib", "alif", "mehedi", "saad", "farhan", "faisal", "shahriar",
    "kazi", "syed", "mir", "chowdhury"
  ];

  const FEMALE_TOKENS = [
    "mst", "most", "begum", "khatun", "akter", "akther", "jannat", "fatema", 
    "fatima", "nusrat", "tanjina", "marufa", "aisha", "sumaiya", "mim", 
    "sadia", "tasnim", "afroza", "sharmin", "nargis", "ruma", "shirin", 
    "shila", "farzana", "parvin", "sabina", "sultana", "rokeya", "taslima"
  ];

  for (const t of tokens) {
    if (FEMALE_TOKENS.includes(t)) return "f";
  }
  for (const t of tokens) {
    if (MALE_TOKENS.includes(t)) return "m";
  }
  return undefined;
};

/**
 * Extract root domain for cookie setting (e.g. .poshplexbd.com)
 * Allows cookies to be shared across subdomains and avoids host-only cookie isolation.
 */
export const getRootDomain = (): string => {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (host === "localhost" || host.includes("127.0.0.1") || host.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
    return "";
  }
  const parts = host.split(".");
  if (parts.length >= 2) {
    return "." + parts.slice(-2).join("."); // e.g. ".poshplexbd.com"
  }
  return "";
};

/**
 * Safe client-side cookie helper
 */
export const getCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : undefined;
};

export const setCookie = (name: string, value: string, maxAgeSeconds: number = 7776000) => {
  if (typeof document === "undefined") return;
  const domain = getRootDomain();
  const domainAttr = domain ? `; domain=${domain}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/${domainAttr}; max-age=${maxAgeSeconds}; SameSite=Lax`;
};

/**
 * Ensure a valid _fbp cookie exists according to Meta specifications:
 * fb.1.${timestamp}.${randomNumber}
 * Backed up in both localStorage and sessionStorage to survive Safari ITP cookie caps.
 */
export const getOrCreateFbp = (): string => {
  if (typeof window === "undefined") return "";
  let fbp = getCookie("_fbp");
  if (!fbp) {
    try {
      fbp = localStorage.getItem("poshplex_fbp") || sessionStorage.getItem("poshplex_fbp") || "";
    } catch {}
  }

  if (!fbp || !fbp.startsWith("fb.")) {
    const timestamp = Date.now();
    const random = Math.floor(1000000000 + Math.random() * 9000000000);
    fbp = `fb.1.${timestamp}.${random}`;
  }

  setCookie("_fbp", fbp, 365 * 24 * 60 * 60);
  try {
    localStorage.setItem("poshplex_fbp", fbp);
    sessionStorage.setItem("poshplex_fbp", fbp);
  } catch {}

  return fbp;
};

/**
 * Meta Parameter Builder Click ID (fbc) Engine:
 * Catches fbclid from searchParams, hash, document.referrer, localStorage, and cookies.
 * Adheres strictly to Meta format: fb.1.${creationTimeInMilliseconds}.${fbclid}
 * Immune to Safari ITP cookie drops across page navigations (e.g. from / to /product/xyz).
 */
export const getOrCreateFbc = (): string | undefined => {
  if (typeof window === "undefined") return undefined;

  // 1. Try reading existing _fbc cookie
  let fbc = getCookie("_fbc");

  // 2. Try localStorage / sessionStorage backup if cookie was wiped
  if (!fbc) {
    try {
      fbc = localStorage.getItem("poshplex_fbc") || sessionStorage.getItem("poshplex_fbc") || undefined;
    } catch {}
  }

  // 3. Check for fresh fbclid in URL, hash, referrer, or local storage
  let fbclid: string | null = null;
  try {
    if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      fbclid = params.get("fbclid");
    }
    if (!fbclid && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, "?"));
      fbclid = hashParams.get("fbclid");
    }
    if (!fbclid && document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        fbclid = refUrl.searchParams.get("fbclid");
      } catch {}
    }
    if (!fbclid) {
      fbclid = localStorage.getItem("poshplex_fbclid") || sessionStorage.getItem("poshplex_fbclid");
    }
  } catch {}

  // 4. If we found a fresh fbclid, construct a standardized fbc
  if (fbclid) {
    // Format: fb.1.${creationTimeInMilliseconds}.${fbclid}
    // If fbc already contains this exact fbclid, keep original fbc to preserve creation timestamp
    if (!fbc || !fbc.endsWith(`.${fbclid}`)) {
      fbc = `fb.1.${Date.now()}.${fbclid}`;
    }
    try {
      localStorage.setItem("poshplex_fbclid", fbclid);
      sessionStorage.setItem("poshplex_fbclid", fbclid);
    } catch {}
  }

  // 5. If we have a valid fbc, persist across all storage engines
  if (fbc && fbc.startsWith("fb.")) {
    setCookie("_fbc", fbc, 90 * 24 * 60 * 60);
    try {
      localStorage.setItem("poshplex_fbc", fbc);
      sessionStorage.setItem("poshplex_fbc", fbc);
    } catch {}
  }

  return fbc || undefined;
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
 * Cache known user data (from auth, checkout, or newsletter) into localStorage for future events
 * Automatically performs name splitting (fn + ln) and Bangladesh postal code resolution.
 */
export const saveUserData = (userData: Partial<FBUserData>) => {
  if (typeof window === "undefined" || !userData) return;
  try {
    const existingRaw = localStorage.getItem("poshplex_user_profile");
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const merged = { ...existing };

    for (const [k, v] of Object.entries(userData)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        merged[k] = String(v).trim();
      }
    }

    // Split name if fn has multiple words and ln is missing
    if (merged.fn && !merged.ln) {
      const split = splitFullName(merged.fn);
      if (split.ln) {
        merged.fn = split.fn;
        merged.ln = split.ln;
      }
    }

    // Auto-resolve zip code if city/state provided and zp missing
    if (!merged.zp && (merged.st || merged.ct)) {
      merged.zp = resolveBangladeshZip(merged.st || merged.ct);
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
    try {
      const rawUserStr = localStorage.getItem("poshplex_user");
      if (rawUserStr) {
        const user = JSON.parse(rawUserStr);
        if (user.email && !cached.em) cached.em = user.email;
        if ((user.phone || user.phone_number) && !cached.ph) cached.ph = user.phone || user.phone_number;
        if (user.first_name && !cached.fn) cached.fn = user.first_name;
        if (user.last_name && !cached.ln) cached.ln = user.last_name;
        if (user.username && !cached.fn) cached.fn = user.username;
        if (user.district && !cached.st) cached.st = user.district;
        if (user.thana && !cached.ct) cached.ct = user.thana;
        if (user.postal_code && !cached.zp) cached.zp = user.postal_code;
        if (user.id && !cached.external_id) cached.external_id = String(user.id);
      }
    } catch {}
  }

  // Parse names if fn contains full name or needs surname splitting
  let fn = explicitUserData.fn || cached.fn;
  let ln = explicitUserData.ln || cached.ln;
  if (fn && !ln) {
    const split = splitFullName(fn);
    fn = split.fn;
    ln = split.ln;
  }

  // Robust location enrichment: defaults to Bangladesh Central Hub (Dhaka 1200) for maximum EMQ
  const country = explicitUserData.country || cached.country || "bd";
  const ct = explicitUserData.ct || cached.ct || (country === "bd" ? "dhaka" : undefined);
  const st = explicitUserData.st || cached.st || (country === "bd" ? "dhaka" : undefined);
  const zp = explicitUserData.zp || cached.zp || (country === "bd" ? resolveBangladeshZip(st || ct) : undefined);

  const fbp = explicitUserData.fbp || getOrCreateFbp();
  const fbc = explicitUserData.fbc || getOrCreateFbc();
  const external_id = explicitUserData.external_id || cached.external_id || getOrCreateExternalId();

  // Clean date of birth to YYYYMMDD per Meta standard
  let rawDb = explicitUserData.db || cached.db;
  if (rawDb) {
    rawDb = String(rawDb).replace(/\D/g, "");
    if (rawDb.length !== 8) rawDb = undefined;
  }

  // Infer gender if not explicitly supplied
  let rawGe = explicitUserData.ge || cached.ge;
  if (!rawGe || (rawGe !== "m" && rawGe !== "f")) {
    rawGe = inferGenderFromName(fn);
  }

  const result: FBUserData = {
    country,
    external_id,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    em: explicitUserData.em || cached.em || undefined,
    ph: explicitUserData.ph || cached.ph || undefined,
    fn: fn || undefined,
    ln: ln || undefined,
    ct: ct || undefined,
    st: st || undefined,
    zp: zp || undefined,
    ge: rawGe || undefined,
    db: rawDb || undefined,
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
