import React from "react";
import CategoryClient from "./CategoryClient";

export const revalidate = 60;

export default async function CategoryPage({
  params,
}: {
  params: { category_slug: string };
}) {
  const slug = decodeURIComponent(params.category_slug);

  let initialProducts: any[] = [];
  let initialCategoryTree: any[] = [];

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const [prodRes, catRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/catalog/products?limit=100`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/api/v1/catalog/categories/tree`, { cache: 'no-store' }),
    ]);

    if (prodRes.ok) {
      const d = await prodRes.json();
      initialProducts = d.results || d || [];
    }
    if (catRes.ok) {
      initialCategoryTree = await catRes.json();
    }
  } catch (err) {
    console.error("Failed to fetch server-side catalog data:", err);
  }

  return (
    <CategoryClient
      slug={slug}
      initialProducts={initialProducts}
      initialCategoryTree={initialCategoryTree}
    />
  );
}
