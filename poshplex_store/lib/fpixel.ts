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
}

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

  // 1. Fire Client-Side Pixel (FB handles hashing of user data automatically on client)
  if (typeof window !== "undefined" && window.fbq) {
    if (Object.keys(userData).length > 0) {
      // Re-initialize with user data for advanced matching before tracking
      window.fbq("init", FB_PIXEL_ID, userData);
    }
    window.fbq("track", eventName, eventData, { eventID: eventId });
  }

  // 2. Fire Server-Side CAPI
  sendServerEvent(eventName, eventData, userData, eventId, currentUrl);
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
