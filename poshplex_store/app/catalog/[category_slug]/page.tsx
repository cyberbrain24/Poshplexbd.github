import React from "react";
import { Metadata } from "next";
import CategoryClient from "./CategoryClient";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { category_slug: string } }): Promise<Metadata> {
  const slug = decodeURIComponent(params.category_slug);
  try {
    const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const catRes = await fetch(`${API_URL}/api/v1/catalog/categories/tree`, { next: { revalidate: 60 } });
    if (catRes.ok) {
      const tree = await catRes.json();
      let category = null;
      const findCat = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.slug === slug) category = n;
          else if (n.children) findCat(n.children);
        }
      };
      findCat(Array.isArray(tree) ? tree : []);
      
      if (category) {
        return {
          title: `${category.name} | Poshplex Streetwear`,
          description: `Shop our exclusive ${category.name} collection at Poshplex.`,
          openGraph: {
            title: `${category.name} | Poshplex`,
            description: `Shop our exclusive ${category.name} collection at Poshplex.`,
            images: category.image ? [{ url: category.image, width: 800, height: 800, alt: category.name }] : [],
          }
        };
      }
    }
  } catch (err) {}
  return { title: "Shop | Poshplex Streetwear" };
}

export default async function CategoryPage({
  params,
}: {
  params: { category_slug: string };
}) {
  const slug = decodeURIComponent(params.category_slug);

  let initialProducts: any[] = [];
  let initialCategoryTree: any[] = [];

  try {
    const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const [prodRes, catRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/catalog/products?category_slug=${slug}&limit=100`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/api/v1/catalog/categories/tree`, { next: { revalidate: 60 } }),
    ]);

    if (!prodRes.ok || !catRes.ok) {
      throw new Error(`API Error - Products: ${prodRes.status}, Categories: ${catRes.status}`);
    }

    const d = await prodRes.json();
    initialProducts = d.results || d || [];
    initialCategoryTree = await catRes.json();
    
  } catch (err) {
    console.error("Failed to fetch server-side catalog data:", err);
    throw err; // Prevent Next.js from caching a broken category page
  }

  return (
    <CategoryClient
      slug={slug}
      initialProducts={initialProducts}
      initialCategoryTree={initialCategoryTree}
    />
  );
}
