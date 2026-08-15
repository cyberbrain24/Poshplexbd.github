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

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export async function generateMetadata() {
  try {
    const [resSeo, resGen] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/seo`, {
        next: { revalidate: 3600 }
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/general`, {
        next: { revalidate: 3600 }
      })
    ]);
    
    if (resSeo.ok && resGen.ok) {
      const seoData = await resSeo.json();
      const genData = await resGen.json();
      
      const seo = seoData.value || {};
      const gen = genData.value || {};
      
      return {
        title: seo.meta_title || "Poshplex Storefront | Heavyweight Streetwear Brand",
        description: seo.meta_description || "Heavyweight distressed boxy street-culture brand. Mapped deliveries across Banani, Dhaka, Bangladesh.",
        keywords: seo.meta_keywords || "poshplex, streetwear, dhaka, heavyweight, t-shirts",
        openGraph: {
          title: seo.meta_title || "Poshplex Storefront",
          description: seo.meta_description || "Heavyweight distressed boxy street-culture brand.",
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
    title: "Poshplex Storefront | Heavyweight Streetwear Brand",
    description: "Heavyweight distressed boxy street-culture brand. Mapped deliveries across Banani, Dhaka, Bangladesh.",
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
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/categories/tree`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      categories = Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error("Failed to fetch categories for footer:", err);
  }
  return (
    <html lang="en" className={outfit.className} suppressHydrationWarning>
      <body suppressHydrationWarning>
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
