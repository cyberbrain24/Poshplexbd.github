"use client";

import React, { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import * as fpixel from "../../lib/fpixel";

interface Props {
  fbPixelId: string;
}

const FacebookPixel: React.FC<Props> = ({ fbPixelId }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    if (fbPixelId) {
      fpixel.setPixelId(fbPixelId);
    }
  }, [fbPixelId]);

  useEffect(() => {
    // This fires on every route change, including the initial load
    fpixel.trackEvent("PageView");
  }, [pathname, searchParams]);

  if (!fbPixelId) return null;

  return (
    <>
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${fbPixelId}');
          `,
        }}
      />
    </>
  );
};

export default FacebookPixel;
