import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const hashData = (val: string | undefined, isPhone: boolean = false): string | undefined => {
  if (!val) return undefined;
  let clean = val.trim().toLowerCase();
  if (!clean) return undefined;
  
  if (isPhone) {
    clean = clean.replace(/\D/g, '');
    if (clean.startsWith('01') && clean.length === 11) {
      clean = '88' + clean;
    }
  }
  
  return crypto.createHash("sha256").update(clean).digest("hex");
};

export async function POST(req: Request) {
  try {
    // 1. Fetch dynamic credentials from Django Backend
    let PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
    let ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN;

    try {
      const settingsRes = await fetch(
        `${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/tracking_pixels`,
        { next: { revalidate: 60 } }
      );
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data?.value?.fb_pixel) PIXEL_ID = data.value.fb_pixel;
        if (data?.value?.fb_capi_token) ACCESS_TOKEN = data.value.fb_capi_token;
      }
    } catch (err) {
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
    const fbp = cookieStore.get("_fbp")?.value;
    const fbc = cookieStore.get("_fbc")?.value;

    // 3. Get client IP and User Agent
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "";

    const timestamp = Math.floor(Date.now() / 1000);

    // 4. Securely Hash Advanced Matching User Data
    const hashedUserData: Record<string, string | undefined> = {
      client_ip_address: ip,
      client_user_agent: userAgent,
      fbp: fbp,
      fbc: fbc,
      country: hashData(userData?.country),
      em: hashData(userData?.em),
      ph: hashData(userData?.ph, true),
      fn: hashData(userData?.fn),
      ln: hashData(userData?.ln),
      ct: hashData(userData?.ct),
      st: hashData(userData?.st),
      zp: hashData(userData?.zp),
      external_id: hashData(userData?.external_id),
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
    return NextResponse.json(fbData, { status: fbRes.status });
  } catch (error) {
    console.error("Facebook CAPI Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
