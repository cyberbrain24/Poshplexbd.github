import React from "react";
import { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

type Props = {
  params: { slug: string };
};

async function getProduct(slug: string) {
  const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/products/${slug}`, { next: { revalidate: 60 } });
  
  if (res.ok) {
    return await res.json();
  }
  
  if (res.status === 404) {
    return null; // Product explicitly not found
  }
  
// Prevent Next.js from caching a temporary backend crash as a permanent 'Not Found' page
  throw new Error(`Backend unavailable: ${res.status}`);
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
    const res = await fetch(`${API_URL}/api/v1/catalog/products?limit=100`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      const list = data.results || data || [];
      const filtered = list.filter((p: any) => p.id !== product.id);
      const currentCatSlug = product.category?.slug || product.categories?.[0]?.slug;
      
      const sameCategory = filtered.filter((p: any) => {
        const slugs = [p.category?.slug, ...(p.categories || []).map((c: any) => c.slug)].filter(Boolean);
        return currentCatSlug && slugs.includes(currentCatSlug);
      });
      
      if (sameCategory.length >= 4) {
        return sameCategory;
      } else {
        return [...sameCategory, ...filtered.filter((p: any) => !sameCategory.includes(p))];
      }
    }
  } catch (err) {
    console.error("Failed to fetch related products:", err);
  }
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Product Not Found | Poshplex Streetwear" };
  
  const imageUrl = product.images?.[0]?.url || `https://placehold.co/600x400?text=${product.name.replace(/ /g, "+")}`;
  
  return {
    title: `${product.name} | Poshplex Streetwear`,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
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
  const [reviews, relatedProducts] = await Promise.all([
    getReviews(params.slug),
    getRelatedProducts(product)
  ]);

  return <ProductDetailClient product={product} initialReviews={reviews} initialRelatedProducts={relatedProducts} />;
}
