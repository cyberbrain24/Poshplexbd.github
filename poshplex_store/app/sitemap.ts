import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  // Base routes
  const routes = [
    '',
    '/catalog',
    '/login',
    '/register',
    '/profile',
    '/brand',
    '/terms-conditions',
    '/privacy-policy',
    '/shipping-delivery',
  ].map((route) => ({
    url: `https://poshplexbd.com${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products?limit=1000`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const products = data.results || [];
      const productRoutes = products.map((product: any) => ({
        url: `https://poshplexbd.com/product/${product.slug}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      }));
      
      return [...routes, ...productRoutes];
    }
  } catch (err) {
    console.error("Failed to generate product sitemap", err);
  }

  return routes;
}
