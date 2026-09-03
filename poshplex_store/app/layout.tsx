import "./globals.css";
import React from "react";
import { Outfit } from "next/font/google";
import { CartProvider } from "../context/CartContext";
import { MusicProvider } from "../context/MusicContext";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import FloatingPlayer from "./components/FloatingPlayer";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import CartDrawer from "./components/CartDrawer";
import Footer from "./components/Footer";
import FacebookPixel from "./components/FacebookPixel";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  preload: false,
});

export async function generateMetadata() {
  try {
    const [resSeo, resGen, resTracking] = await Promise.all([
      fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/seo`, {
        next: { revalidate: 60 }
      }),
      fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/general`, {
        next: { revalidate: 60 }
      }),
      fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/tracking_pixels`, {
        next: { revalidate: 60 }
      })
    ]);
    
    if (resSeo.ok && resGen.ok) {
      const seoData = await resSeo.json();
      const genData = await resGen.json();
      
      const seo = seoData.value || {};
      const gen = genData.value || {};
      
      return {
        title: seo.meta_title || "POSHPLEX | BE POSH WITH POSHPLEX",
        description: seo.meta_description || "Premium streetwear brand based in Dhaka, Bangladesh.",
        keywords: seo.meta_keywords || "poshplex, streetwear, dhaka, heavyweight, t-shirts",
        openGraph: {
          title: seo.meta_title || "POSHPLEX | BE POSH WITH POSHPLEX",
          description: seo.meta_description || "Premium streetwear brand based in Dhaka, Bangladesh.",
          images: seo.og_image_url ? [seo.og_image_url] : [],
        },
        icons: {
          icon: gen.favicon_url || "/favicon.ico",
        },
        manifest: "/manifest.json",
      };
    }
  } catch (err) {
    console.error("Failed to fetch dynamic SEO metadata:", err);
  }

  // Fallback to defaults
  return {
    title: "POSHPLEX | BE POSH WITH POSHPLEX",
    description: "Premium streetwear brand based in Dhaka, Bangladesh.",
    manifest: "/manifest.json",
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let categories: any[] = [];
  try {
    const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/categories/tree`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      categories = Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error("Failed to fetch categories for footer:", err);
  }
  let fbPixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1764455794927154";
  try {
    const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/tracking_pixels`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      if (data?.value?.fb_pixel) {
        fbPixelId = data.value.fb_pixel;
      }
    }
  } catch (err) {
    console.error("Failed to fetch tracking_pixels:", err);
  }

  // Fetch hero banner URL for preloading to improve LCP
  let desktopBannerUrl = null;
  let mobileBannerUrl = null;
  try {
    const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/general`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      const settings = data.value;
      desktopBannerUrl = settings?.desktop_hero_banner_url
        ? `${settings.desktop_hero_banner_url}`
        : (settings?.banner_image_url ? `${settings.banner_image_url}` : null);
      mobileBannerUrl = settings?.mobile_hero_banner_url
        ? `${settings.mobile_hero_banner_url}`
        : desktopBannerUrl;
    }
  } catch (err) {
    console.error("Failed to fetch settings for preload:", err);
  }

  return (
    <html lang="en" className={outfit.className} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://media.poshplexbd.com" />
        {desktopBannerUrl && (
          <link rel="preload" href={desktopBannerUrl} as="image" fetchPriority="high" media="(min-width: 769px)" />
        )}
        {mobileBannerUrl && mobileBannerUrl !== desktopBannerUrl && (
          <link rel="preload" href={mobileBannerUrl} as="image" fetchPriority="high" media="(max-width: 768px)" />
        )}
        {mobileBannerUrl === desktopBannerUrl && desktopBannerUrl && (
          <link rel="preload" href={desktopBannerUrl} as="image" fetchPriority="high" />
        )}
      </head>
      <body suppressHydrationWarning>
        <React.Suspense fallback={null}>
          <FacebookPixel fbPixelId={fbPixelId} />
        </React.Suspense>
        <GlobalErrorBoundary>
          <CartProvider>
            <MusicProvider>
              <div className="flex flex-col min-h-screen w-full md:w-[80%] mx-auto relative bg-white">
              
              {/* Sticky Navigation Bar */}
              <Header categories={categories} />

              {/* Cart Slide-in Drawer (global, available on all pages) */}
              <CartDrawer />

              {/* Core Page Content */}
              <main style={{ flex: 1 }}>{children}</main>

              {/* Modular responsive footer */}
              <Footer />

              {/* Persistent Audio Loop Player */}
              <FloatingPlayer />

              {/* Sticky Mobile/Tablet Bottom Menu */}
              <BottomNav />
            </div>
            </MusicProvider>
          </CartProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
