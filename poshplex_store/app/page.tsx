import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import FeaturedReviewsCarousel from "./components/FeaturedReviewsCarousel";

async function getFeaturedProducts() {
  try {
    const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/products?is_featured=true&limit=18`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (err) {
    console.error("Failed to fetch featured products:", err);
  }
  return [];
}

// NOTE: layout.tsx also fetches categories/tree — Next.js deduplicates same-URL fetches
// within a render pass, but we keep the same options so the cache entry is shared.
async function getCategories() {
  try {
    const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/categories/tree`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error("Failed to fetch categories:", err);
  }
  return [];
}

const formatPrice = (bdt: string | number) => {
  return `৳${Math.round(Number(bdt))}`;
};

async function getGeneralSettings() {
  try {
    const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/settings/general`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      return data.value || null;
    }
  } catch (err) {
    console.error("Failed to fetch settings:", err);
  }
  return null;
}

const getPriceDisplay = (p: any): string => {
  const variants = p.variants?.filter((v: any) => v.is_active !== false);
  if (variants && variants.length > 0) {
    const prices = variants.map((v: any) => parseFloat(v.selling_price || v.price || 0));
    const min = Math.round(Math.min(...prices));
    const max = Math.round(Math.max(...prices));
    if (min === max) return `৳${min}`;
    return `৳${min} – ৳${max}`;
  }
  return formatPrice(p.price || p.base_price || 0);
};

export default async function Home() {
  // Run all three fetches in parallel — no waterfall
  const [products, categories, settings] = await Promise.all([
    getFeaturedProducts(),
    getCategories(),
    getGeneralSettings(),
  ]);

  const desktopBannerUrl =
    settings?.desktop_hero_banner_url
      ? `${settings.desktop_hero_banner_url}`
      : (settings?.banner_image_url ? `${settings.banner_image_url}` : null);

  const mobileBannerUrl =
    settings?.mobile_hero_banner_url
      ? `${settings.mobile_hero_banner_url}`
      : desktopBannerUrl;

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Hero Section */}
      {desktopBannerUrl && (
        <section
          style={{
            position: "relative",
            width: "100%",
            minHeight: "70vh",
            overflow: "hidden",
          }}
        >
          <Image
            src={desktopBannerUrl}
            alt="Streetwear Hero Desktop"
            fill
            priority
            sizes="100vw"
            className={mobileBannerUrl && mobileBannerUrl !== desktopBannerUrl ? "hide-on-mobile" : ""}
            style={{ objectFit: "cover" }}
            unoptimized
          />
          {mobileBannerUrl && mobileBannerUrl !== desktopBannerUrl && (
            <Image
              src={mobileBannerUrl}
              alt="Streetwear Hero Mobile"
              fill
              priority
              sizes="100vw"
              className="hide-on-desktop"
              style={{ objectFit: "cover" }}
              unoptimized
            />
          )}
        </section>
      )}

      {/* Categories */}
      <section className="container" style={{ paddingTop: 80, paddingBottom: 40 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            textTransform: "uppercase",
            marginBottom: 32,
            letterSpacing: "1px",
            textAlign: "center",
          }}
        >
          Shop by Category
        </h2>
        <div className="home-categories-grid">
          {categories.map((cat: any) => (
            <Link key={cat.id} href={`/catalog/${cat.slug}`} style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div
                  className="category-image-wrapper"
                  style={{
                    position: "relative",
                    background: "#f1f1f1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                    overflow: "hidden",
                    border: "1px solid #eaeaea",
                  }}
                >
                  {cat.image ? (
                    <Image src={cat.image} alt="" fill sizes="(max-width: 768px) 33vw, 160px" priority unoptimized style={{ objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#777", fontSize: 10, textTransform: "uppercase" }}>No Image</span>
                  )}
                </div>
                <span
                  className="category-name-text"
                  style={{
                    color: "var(--text-main)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    textAlign: "center",
                    letterSpacing: "0.5px"
                  }}
                >
                  {cat.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          .home-categories-grid {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 20px;
          }
          .category-image-wrapper {
            width: 160px;
            height: 160px;
          }
          .category-name-text {
            font-size: 14px;
          }
          @media (max-width: 768px) {
            .home-categories-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
            }
            .category-image-wrapper {
              width: 100%;
              aspect-ratio: 1/1;
              height: auto;
            }
            .category-name-text {
              font-size: 11px;
            }
          }
        `}} />
      </section>

      {/* Featured Products */}
      <section className="container" style={{ padding: "40px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Featured Drops
          </h2>
          <Link
            href="/catalog"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#111",
              textDecoration: "none",
              borderBottom: "2px solid #111",
              paddingBottom: 2,
            }}
          >
            VIEW ALL
          </Link>
        </div>

        <div className="product-grid">
          {products.slice(0, 18).map((product: any, i: number) => (
            <div
              key={product.id}
              className="product-card"
              style={{ display: "flex", flexDirection: "column" }}
            >
              <Link href={`/product/${product.slug}`} style={{ flex: 1, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    background: "#f5f5f5",
                    aspectRatio: "3/4",
                    position: "relative",
                    marginBottom: 12,
                  }}
                >
                  <Image
                    src={
                      product.images?.[0]?.url ||
                      `https://placehold.co/400x500/eee/111?text=${product.name.replace(/ /g, "+")}`
                    }
                    alt={product.name}
                    fill
                    priority={i < 4}
                    unoptimized
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 240px"
                    style={{ objectFit: "cover" }}
                  />
                  {i < 2 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        background: "#111",
                        color: "#fff",
                        padding: "4px 8px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "1px",
                      }}
                    >
                      NEW
                    </div>
                  )}
                </div>
                <div style={{ padding: "0 4px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, lineHeight: 1.3, color: "#111" }}>
                    {product.name}
                  </h3>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#111" }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{getPriceDisplay(product)}</span>
                    {product.rating_count > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Star size={12} fill="#111" color="#111" />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{product.rating_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="container" style={{ padding: "60px 0" }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            textTransform: "uppercase",
            marginBottom: 32,
            letterSpacing: "1px",
            textAlign: "center",
          }}
        >
          Community Reviews
        </h2>
        <FeaturedReviewsCarousel />
      </section>
    </div>
  );
}
