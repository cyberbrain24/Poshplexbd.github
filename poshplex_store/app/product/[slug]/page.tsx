import React from "react";
import { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

type Props = {
  params: { slug: string };
};

async function getProduct(slug: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/products/${slug}`, { next: { revalidate: 60 } });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Backend unavailable
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Product Not Found | Poshplex Streetwear" };
  return {
    title: `${product.name} | Poshplex Streetwear`,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [
        {
          url: `https://placehold.co/600x400?text=${product.name.replace(/ /g, "+")}`,
          width: 600,
          height: 400,
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
  return <ProductDetailClient product={product} />;
}
