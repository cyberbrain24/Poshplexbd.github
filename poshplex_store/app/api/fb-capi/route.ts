import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const hashData = (
  val: string | undefined,
  type: "text" | "phone" | "gender" | "dob" | "zip" | "alpha" | "country" = "text"
): string | undefined => {
  if (!val) return undefined;
  let clean = String(val).trim().toLowerCase();
  if (!clean) return undefined;

  if (type === "phone") {
    clean = clean.replace(/\D/g, "");
    if (clean.startsWith("01") && clean.length === 11) {
      clean = "88" + clean;
    } else if (clean.startsWith("1") && clean.length === 10) {
      clean = "880" + clean;
    }
    if (clean.length < 8) return undefined;
  } else if (type === "gender") {
    // Meta expects 'm' or 'f'
    if (clean.startsWith("m")) clean = "m";
    else if (clean.startsWith("f")) clean = "f";
    else return undefined;
  } else if (type === "dob") {
    // Meta expects YYYYMMDD
    clean = clean.replace(/\D/g, "");
    if (clean.length !== 8) return undefined;
  } else if (type === "zip") {
    // Meta expects lowercase alphanumeric, no spaces, no dashes
    clean = clean.replace(/[\s\-]/g, "");
    if (!clean) return undefined;
  } else if (type === "alpha") {
    // Meta expects lowercase letters only, no spaces, no punctuation
    clean = clean.replace(/[^a-z]/g, "");
    if (!clean) return undefined;
  } else if (type === "country") {
    // Meta expects 2-letter ISO code in lowercase
    clean = clean.replace(/[^a-z]/g, "").slice(0, 2);
    if (!clean) return undefined;
  }

  return crypto.createHash("sha256").update(clean).digest("hex");
};

const BANGLADESH_DISTRICT_ZIP_MAP: Record<string, string> = {
  dhaka: "1200",
  gazipur: "1700",
  narayanganj: "1400",
  tangail: "1900",
  faridpur: "7800",
  manikganj: "1800",
  munshiganj: "1500",
  narsingdi: "1600",
  gopalganj: "8100",
  madaripur: "7900",
  rajbari: "7700",
  shariatpur: "8000",
  kishoreganj: "2300",
  chattogram: "4000",
  chittagong: "4000",
  coxsbazar: "4700",
  "cox's bazar": "4700",
  cumilla: "3500",
  comilla: "3500",
  feni: "3900",
  brahmanbaria: "3400",
  noakhali: "3800",
  chandpur: "3600",
  lakshmipur: "3700",
  sylhet: "3100",
  moulvibazar: "3200",
  habiganj: "3300",
  sunamganj: "3000",
  rajshahi: "6000",
  bogura: "5800",
  bogra: "5800",
  pabna: "6600",
  sirajganj: "6700",
  naogaon: "6500",
  natore: "6400",
  chapai: "6300",
  joypurhat: "5900",
  khulna: "9000",
  jashore: "7400",
  jessore: "7400",
  kushtia: "7000",
  satkhira: "9400",
  bagerhat: "9300",
  chuadanga: "7200",
  jhenaidah: "7300",
  magura: "7600",
  meherpur: "7100",
  narail: "7500",
  barishal: "8200",
  patuakhali: "8600",
  bhola: "8300",
  pirojpur: "8500",
  barguna: "8700",
  jhalokati: "8400",
  rangpur: "5400",
  dinajpur: "5200",
  gaibandha: "5700",
  kurigram: "5600",
  lalmonirhat: "5500",
  nilphamari: "5300",
  panchagarh: "5000",
  thakurgaon: "5100",
  mymensingh: "2200",
  jamalpur: "2000",
  netrokona: "2400",
  sherpur: "2100",
};

const resolveBangladeshZipServer = (cityOrRegion?: string): string => {
  if (!cityOrRegion) return "1200";
  const clean = cityOrRegion.trim().toLowerCase();
  for (const [key, zip] of Object.entries(BANGLADESH_DISTRICT_ZIP_MAP)) {
    if (clean.includes(key)) return zip;
  }
  return "1200";
};

const splitFullNameServer = (fullName?: string): { fn?: string; ln?: string } => {
  if (!fullName) return {};
  const clean = fullName
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ");
  if (!clean) return {};
  const parts = clean.split(" ");
  if (parts.length === 1) {
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
 * Check if an IP address belongs to private, loopback, or reserved subnets
 */
const isPrivateOrReservedIP = (ip: string): boolean => {
  if (
    ip === "0.0.0.0" ||
    ip === "127.0.0.1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.")
  ) {
    return true;
  }
  if (ip.startsWith("172.")) {
    const parts = ip.split(".");
    if (parts.length > 1) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }
  if (
    ip === "::1" ||
    ip === "::" ||
    ip.toLowerCase().startsWith("fc") ||
    ip.toLowerCase().startsWith("fd") ||
    ip.toLowerCase().startsWith("fe80")
  ) {
    return true;
  }
  return false;
};

/**
 * Validate that an IP is a legitimate, public IPv4 or IPv6 string
 */
const isValidPublicIP = (ip: string | undefined): boolean => {
  if (!ip) return false;
  const clean = ip.trim().replace(/^::ffff:/, "");
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const isIPv4 = ipv4Regex.test(clean);
  const isIPv6 = clean.includes(":") && clean.length >= 2 && clean.length <= 45;

  if (!isIPv4 && !isIPv6) return false;
  return !isPrivateOrReservedIP(clean);
};

/**
 * Extract the true client public IP in a Cloudflare / Reverse-Proxy architecture
 */
const extractClientIP = (req: Request): string | undefined => {
  // 1. Cloudflare raw visitor IP (highest priority)
  const cfConnectingIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp && isValidPublicIP(cfConnectingIp)) {
    return cfConnectingIp.replace(/^::ffff:/, "");
  }

  // 2. Akamai / Cloudflare Enterprise
  const trueClientIp = req.headers.get("true-client-ip")?.trim();
  if (trueClientIp && isValidPublicIP(trueClientIp)) {
    return trueClientIp.replace(/^::ffff:/, "");
  }

  // 3. X-Real-IP (populated by Nginx with real client IP)
  const xRealIp = req.headers.get("x-real-ip")?.trim();
  if (xRealIp && isValidPublicIP(xRealIp)) {
    return xRealIp.replace(/^::ffff:/, "");
  }

  // 4. X-Forwarded-For (comma-separated chain: client, proxy1, proxy2...)
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((p) => p.trim());
    for (const rawIp of ips) {
      const ip = rawIp.replace(/:\d+$/, "").replace(/^::ffff:/, "");
      if (isValidPublicIP(ip)) {
        return ip;
      }
    }
  }

  // 5. X-Client-IP
  const xClientIp = req.headers.get("x-client-ip")?.trim();
  if (xClientIp && isValidPublicIP(xClientIp)) {
    return xClientIp.replace(/^::ffff:/, "");
  }

  // Do not send dummy "0.0.0.0" or private IPs to Meta. Return undefined so it is omitted cleanly.
  return undefined;
};

export async function POST(req: Request) {
  try {
    // 1. Fetch dynamic credentials from Django Backend
    let PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1764455794927154";
    let ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN || "EAARa5vP9uQgBRnv7be9OjfT2xmNKJQZCDUInk1oS6w4ZCt3ZBrMyAu0JnwjP3Ts5OIdlfr3t4wPbVVomE5yZA52HdORaB1dJUeZBL1ZBjYU1OIoCZCrWZAJsrZAvHRX0NdDJEBs0D0uhjvn1nbqP9XncePtfxIroIsmoVDd7jovHiB32CQdP6tZCDutkk8UZCwGkWg9UQZDZD";

    try {
      const settingsRes = await fetch(
        `${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/tracking_pixels`,
        { next: { revalidate: 60 } }
      );
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data?.value?.fb_pixel) PIXEL_ID = data.value.fb_pixel;
        if (data?.value?.fb_capi_token) ACCESS_TOKEN = data.value.fb_capi_token;
      }
    } catch {
      console.warn("Could not fetch CAPI credentials from backend, using env fallback.");
    }

    if (!PIXEL_ID || !ACCESS_TOKEN) {
      // Return 200 OK so we don't pollute the browser console with 500 errors when CAPI is just disabled/not configured
      return NextResponse.json({ message: "CAPI disabled (no credentials)" }, { status: 200 });
    }

    const body = await req.json();
    const { eventName, eventData, userData, eventId, eventSourceUrl } = body;

    // 2. Extract cookies for FB deduplication / matching
    const cookieStore = cookies();
    let fbp = userData?.fbp || cookieStore.get("_fbp")?.value;
    let fbc = userData?.fbc || cookieStore.get("_fbc")?.value;
    let external_id = userData?.external_id || cookieStore.get("poshplex_external_id")?.value;

    const newCookies: { name: string; value: string; maxAge: number }[] = [];
    const timestamp = Math.floor(Date.now() / 1000);

    // Fallback: Generate valid _fbp if missing (format: fb.1.${timestamp}.${random})
    if (!fbp) {
      const random = Math.floor(1000000000 + Math.random() * 9000000000);
      fbp = `fb.1.${Date.now()}.${random}`;
      newCookies.push({ name: "_fbp", value: fbp, maxAge: 31536000 });
    }

    // Fallback: Extract fbclid from eventSourceUrl or Referer header to construct valid _fbc
    if (!fbc) {
      let fbclidFromUrl: string | null = null;
      if (eventSourceUrl) {
        try {
          const parsedUrl = new URL(eventSourceUrl);
          fbclidFromUrl = parsedUrl.searchParams.get("fbclid");
        } catch {}
      }
      if (!fbclidFromUrl) {
        const referer = req.headers.get("referer");
        if (referer) {
          try {
            const parsedRef = new URL(referer);
            fbclidFromUrl = parsedRef.searchParams.get("fbclid");
          } catch {}
        }
      }
      if (fbclidFromUrl) {
        // Meta requires creation time in milliseconds (13 digits)
        fbc = `fb.1.${Date.now()}.${fbclidFromUrl}`;
        newCookies.push({ name: "_fbc", value: fbc, maxAge: 7776000 });
      }
    }

    // Clean and validate fbc format: must start with fb.1.
    if (fbc && !fbc.startsWith("fb.")) {
      fbc = `fb.1.${Date.now()}.${fbc}`;
      newCookies.push({ name: "_fbc", value: fbc, maxAge: 7776000 });
    }

    // Fallback: Generate persistent external_id if missing
    if (!external_id) {
      external_id = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      newCookies.push({ name: "poshplex_external_id", value: external_id, maxAge: 31536000 });
    }

    // 3. Get validated client IP and User Agent
    const clientIp = extractClientIP(req);
    const userAgent = req.headers.get("user-agent")?.trim() || undefined;

    // 4. Smart Name Resolution (Fixes 0.44% Surname issue)
    let rawFn = userData?.fn;
    let rawLn = userData?.ln;
    if (rawFn && !rawLn) {
      const split = splitFullNameServer(rawFn);
      rawFn = split.fn;
      rawLn = split.ln;
    } else if (!rawFn && rawLn) {
      rawFn = rawLn;
    }

    // 5. GeoIP & Location Resolution (Fixes Postcode missing +9% boost & City/Region)
    const cfCountry = req.headers.get("cf-ipcountry")?.trim().toLowerCase();
    const resolvedCountry = (userData?.country || cfCountry || "bd").toLowerCase();

    const cfCity = req.headers.get("cf-ipcity")?.trim().toLowerCase();
    const resolvedCity = userData?.ct || cfCity || (resolvedCountry === "bd" ? "dhaka" : undefined);

    const cfRegion = req.headers.get("cf-region")?.trim().toLowerCase();
    const resolvedState = userData?.st || cfRegion || (resolvedCountry === "bd" ? "dhaka" : undefined);

    const cfPostal = req.headers.get("cf-postal-code")?.trim();
    let resolvedZip = userData?.zp || cfPostal;
    if (!resolvedZip && resolvedCountry === "bd") {
      resolvedZip = resolveBangladeshZipServer(resolvedState || resolvedCity);
    }

    // 6. Securely Hash Advanced Matching User Data strictly per Meta specs
    const hashedUserData: Record<string, string | undefined> = {
      client_ip_address: clientIp,
      client_user_agent: userAgent,
      fbp: fbp,
      fbc: fbc || undefined,
      country: hashData(resolvedCountry, "country"),
      ct: hashData(resolvedCity, "alpha"),
      st: hashData(resolvedState, "alpha"),
      zp: hashData(resolvedZip, "zip"),
      fn: hashData(rawFn, "alpha"),
      ln: hashData(rawLn, "alpha"),
      em: hashData(userData?.em),
      ph: hashData(userData?.ph, "phone"),
      ge: hashData(userData?.ge, "gender"),
      db: hashData(userData?.db, "dob"),
      // Meta Events Manager explicitly specifies external_id as "Not hashed - no hash required"
      external_id: external_id,
    };

    // Remove undefined fields
    Object.keys(hashedUserData).forEach((key) => {
      if (hashedUserData[key] === undefined) {
        delete hashedUserData[key];
      }
    });

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: timestamp,
          action_source: "website",
          event_id: eventId,
          event_source_url: eventSourceUrl,
          user_data: hashedUserData,
          custom_data: eventData,
        },
      ],
    };

    // 5. Delay PageView by ~2.5s for optimal browser deduplication
    if (eventName === "PageView") {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    // 6. Dispatch to Facebook Graph API
    const fbRes = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const fbData = await fbRes.json();
    const response = NextResponse.json(fbData, { status: fbRes.status });

    // Set any newly created cookies so future requests persist them
    for (const c of newCookies) {
      response.cookies.set(c.name, c.value, {
        path: "/",
        maxAge: c.maxAge,
        sameSite: "lax",
        httpOnly: false,
      });
    }

    return response;
  } catch (error) {
    console.error("Facebook CAPI Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

