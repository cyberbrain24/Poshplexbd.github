import React from "react";
import { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

type Props = {
  params: { slug: string };
};

async function getProduct(slug: string) {
  try {
    const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/products/${slug}`, { next: { revalidate: 60 } });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 404) {
      return null;
    }
    console.error(`Backend returned status ${res.status} for product slug "${slug}"`);
    return null;
  } catch (err) {
    console.error(`Error fetching product slug "${slug}":`, err);
    return null;
  }
}

async function getReviews(slug: string) {
  try {
    const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${API_URL}/api/v1/catalog/products/${slug}/reviews`, { next: { revalidate: 60 } });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch reviews:", err);
  }
  return [];
}

async function getRelatedProducts(product: any) {
  try {
    const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${API_URL}/api/v1/catalog/products/${product.slug}/related`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error("Failed to fetch related products:", err);
  }
  return [];
}

async function getAttributes() {
  try {
    const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${API_URL}/api/v1/catalog/attributes`, { next: { revalidate: 60 } });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch attributes:", err);
  }
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Product Not Found | Poshplex Streetwear" };
  
  const imageUrl = product.images?.[0]?.url || `https://placehold.co/600x400?text=${encodeURIComponent(product.name)}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://store.poshplexbd.com";
  const productUrl = `${siteUrl.replace(/\/$/, "")}/product/${product.slug}`;
  const price = String(product.selling_price || product.price || product.base_price || 0);
  const inStock = product.is_active && !product.is_sold_out;
  const sku = product.sku || `PROD-${product.id}`;
  const brandName = product.brand?.name || "Poshplex";
  const desc = product.description || product.short_description || product.name;

  return {
    title: `${product.name} | Poshplex Streetwear`,
    description: desc,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: product.name,
      description: desc,
      url: productUrl,
      type: "website",
      siteName: "Poshplex",
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
    },
    other: {
      "product:retailer_item_id": sku,
      "product:price:amount": price,
      "product:price:currency": "BDT",
      "product:availability": inStock ? "in stock" : "out of stock",
      "product:condition": "new",
      "product:brand": brandName,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);
  if (!product) {
    return (
      <div style={{ padding: "100px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Product Not Found</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 12 }}>This product may no longer be available.</p>
      </div>
    );
  }

  // Fetch reviews and related products in parallel on the server
  const [reviews, relatedProducts, attributes] = await Promise.all([
    getReviews(params.slug),
    getRelatedProducts(product),
    getAttributes()
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://store.poshplexbd.com";
  const productUrl = `${siteUrl.replace(/\/$/, "")}/product/${product.slug}`;
  const price = parseFloat(product.selling_price || product.price || product.base_price || 0);
  const inStock = product.is_active && !product.is_sold_out;
  const sku = product.sku || `PROD-${product.id}`;
  const brandName = product.brand?.name || "Poshplex";
  const imageUrls = (product.images || []).map((img: any) => img.url).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": imageUrls.length > 0 ? imageUrls : undefined,
    "description": product.description || product.short_description || product.name,
    "sku": sku,
    "mpn": sku,
    "brand": {
      "@type": "Brand",
      "name": brandName
    },
    "offers": {
      "@type": "Offer",
      "url": productUrl,
      "priceCurrency": "BDT",
      "price": price.toFixed(2),
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient
        product={product}
        initialReviews={reviews}
        initialRelatedProducts={relatedProducts}
        initialAttributes={attributes}
      />
    </>
  );
}
