"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

interface GoogleTagProps {
  gtmId?: string;
  gaId?: string;
}

export default function GoogleTag({ gtmId, gaId }: GoogleTagProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRouteRef = useRef(true);

  const cleanGtmId = (gtmId || "").trim();
  const cleanGaId = (gaId || "").trim();
  const isGtmContainer = cleanGtmId.toUpperCase().startsWith("GTM-");
  const gtagDirectId = cleanGaId || (!isGtmContainer ? cleanGtmId : "");

  useEffect(() => {
    if (!cleanGtmId && !cleanGaId) return;

    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname || "/";

    // On initial mount, GTM / gtag('config') already records the first page view.
    if (isFirstRouteRef.current) {
      isFirstRouteRef.current = false;
      return;
    }

    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      if (isGtmContainer) {
        window.dataLayer.push({
          event: "page_view",
          page_path: pagePath,
          page_location: window.location.href,
          page_title: typeof document !== "undefined" ? document.title : undefined,
        });
      }
      if (gtagDirectId && typeof window.gtag === "function") {
        window.gtag("config", gtagDirectId, {
          page_path: pagePath,
        });
      }
    }
  }, [pathname, searchParams, cleanGtmId, cleanGaId, isGtmContainer, gtagDirectId]);

  if (!cleanGtmId && !cleanGaId) {
    return null;
  }

  return (
    <>
      {isGtmContainer && cleanGtmId && (
        <Script
          id="google-tag-gtm"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(cleanGtmId)}`}
        />
      )}

      {gtagDirectId && (
        <Script
          id="google-tag-gtag-src"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagDirectId)}`}
        />
      )}

      <Script
        id="google-tag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            window.gtag = window.gtag || gtag;
            ${isGtmContainer && cleanGtmId ? `window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});` : ""}
            gtag('js', new Date());
            ${gtagDirectId ? `gtag('config', ${JSON.stringify(gtagDirectId)});` : ""}
          `,
        }}
      />

      {isGtmContainer && cleanGtmId && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(cleanGtmId)}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      )}
    </>
  );
}

