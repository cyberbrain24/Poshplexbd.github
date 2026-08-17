"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";

const formatBDT = (n: string | number) => `৳${Math.round(Number(n))}`;

/* ─── colour name → hex map ─────────────────────────── */
const COLOR_HEX: Record<string, string> = {
  black: "#111111", white: "#f5f5f5", grey: "#888888", gray: "#888888",
  red: "#e11d48", blue: "#2563eb", green: "#16a34a", navy: "#1e3a5f",
  cream: "#f0e8d0", coffee: "#6f4e37", maroon: "#800000", olive: "#708238",
  brown: "#7c4a1e", beige: "#f5e6c8", pink: "#f472b6", yellow: "#fbbf24",
  orange: "#f97316", purple: "#9333ea",
};
const toHex = (name: string) =>
  COLOR_HEX[name.toLowerCase()] || "#555555";

/* ─── reusable compact product card ─────────────────── */
function ProductCard({ product, priority = false }: { product: any; priority?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const mainImage = product.images?.find((i: any) => i.is_main) || product.images?.[0];
  const imageUrl = mainImage?.url || `https://placehold.co/400x500/ebebeb/333?text=${encodeURIComponent(product.name)}`;
  const secondImage = product.images?.[1];

  const displayPrice = (() => {
    const vs = (product.variants || []).filter((v: any) => v.is_active !== false);
    if (!vs.length) return formatBDT(product.base_price || 0);
    const prices = vs.map((v: any) => parseFloat(v.selling_price || v.price || 0));
    const lo = Math.round(Math.min(...prices));
    const hi = Math.round(Math.max(...prices));
    return lo === hi ? formatBDT(lo) : `${formatBDT(lo)} – ${formatBDT(hi)}`;
  })();

  return (
    <Link
      href={`/product/${product.slug}`}
      style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div
        style={{ position: "relative", background: "#f0f0f0", overflow: "hidden", aspectRatio: "3/4" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Image
          src={hovered && secondImage ? secondImage.url : imageUrl}
          alt={product.name}
          fill
          priority={priority}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 12.5vw"
          style={{
            objectFit: "cover",
            transition: "transform 0.4s ease",
            transform: hovered ? "scale(1.04)" : "scale(1)",
          }}
        />
        {product.is_featured && (
          <div style={{ position: "absolute", top: 8, left: 8, background: "#111", color: "#fff", fontSize: 8, fontWeight: 800, letterSpacing: "1.2px", padding: "2px 6px" }}>
            NEW
          </div>
        )}
      </div>
      <div style={{ paddingTop: 8, paddingBottom: 4 }}>
        <p style={{ fontSize: 10, color: "#888", marginBottom: 2, letterSpacing: "0.2px", textTransform: "uppercase" }}>
          {product.category?.name || product.categories?.[0]?.name || "Apparel"}
        </p>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: "#111", margin: "0 0 2px", lineHeight: 1.3, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {product.name}
        </h3>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>
          {displayPrice}
        </span>
      </div>
    </Link>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* filter state */
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("q") || "";
    }
    return "";
  });
  const [searchInput, setSearchInput] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("q") || "";
    }
    return "";
  });
  const [sortBy, setSortBy] = useState("featured");
  const [visibleCount, setVisibleCount] = useState(16);

  /* load categories */
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const catRes = await fetch(`${API_URL}/api/v1/catalog/categories/tree`, { cache: 'no-store' });
        if (catRes.ok) {
          const cats = await catRes.json();
          setCategories(Array.isArray(cats) ? cats : []);
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    fetchCats();
  }, []);

  /* load products dynamically based on search */
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const url = new URL(`${API_URL}/api/v1/catalog/products`);
        url.searchParams.set("limit", "100");
        if (searchQuery.trim()) {
          url.searchParams.set("search", searchQuery.trim());
        }
        
        const prodRes = await fetch(url.toString());
        if (prodRes.ok) {
          const prods = await prodRes.json();
          setProducts(prods.results || prods || []);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* extract attributes dynamically from variants list */
  const availableSizes = Array.from(
    new Set(
      products.flatMap(p => p.variants || []).map(v => v.attributes?.size).filter(Boolean)
    )
  ).sort() as string[];

  const availableColors = Array.from(
    new Set(
      products.flatMap(p => p.variants || []).map(v => v.attributes?.color).filter(Boolean)
    )
  ).sort() as string[];

  /* apply filter logic */
  const filteredProducts = products.filter(p => {
    // 1 & 2. Category / Subcategory check
    if (selectedCategories.length > 0 || selectedSubcategories.length > 0) {
      const pCatSlug = (p.category?.slug || p.categories?.[0]?.slug || "").toLowerCase();
      
      let matchesCategory = false;
      let matchesSubcategory = false;

      // Check if it matches any selected subcategory EXACTLY
      if (selectedSubcategories.length > 0) {
        matchesSubcategory = selectedSubcategories.map(s => s.toLowerCase()).includes(pCatSlug);
      }
      
      // Check if it matches any selected parent category OR its children
      if (selectedCategories.length > 0) {
        const pCatSlugLower = pCatSlug.toLowerCase();
        
        for (const selCatSlug of selectedCategories) {
          const selCatSlugLower = selCatSlug.toLowerCase();
          if (pCatSlugLower === selCatSlugLower) {
            matchesCategory = true;
            break;
          }
          const parentMatch = categories.find(c => c.slug?.toLowerCase() === selCatSlugLower);
          const childSlugs = parentMatch ? (parentMatch.children || []).map((c: any) => (c.slug || "").toLowerCase()) : [];
          if (childSlugs.includes(pCatSlugLower)) {
            matchesCategory = true;
            break;
          }
        }
      }

      // OR logic for category and subcategory selections
      if (!matchesCategory && !matchesSubcategory) {
        return false;
      }
    }

    // 4. Size check
    if (selectedSize) {
      const hasSize = (p.variants || []).some((v: any) => v.attributes?.size === selectedSize);
      if (!hasSize) return false;
    }

    // 5. Color check
    if (selectedColor) {
      const hasColor = (p.variants || []).some((v: any) => v.attributes?.color === selectedColor);
      if (!hasColor) return false;
    }

    // 6. Price check
    const prices = (p.variants || []).map((v: any) => parseFloat(v.selling_price || v.price || 0));
    const activePrice = prices.length > 0 ? Math.min(...prices) : parseFloat(p.price || p.base_price || 0);
    if (priceRange && activePrice > priceRange) {
      return false;
    }

    return true;
  });

  /* apply sorting logic */
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const getPrice = (p: any) => {
      const prices = (p.variants || []).map((v: any) => parseFloat(v.selling_price || v.price || 0));
      return prices.length > 0 ? Math.min(...prices) : parseFloat(p.price || p.base_price || 0);
    };

    if (sortBy === "price-low") return getPrice(a) - getPrice(b);
    if (sortBy === "price-high") return getPrice(b) - getPrice(a);
    if (sortBy === "newest") return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return 0;
  });

  return (
    <div style={{ background: "#fff", minHeight: "100vh", paddingTop: 40, paddingBottom: 100 }}>
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 120 }}>
          <p style={{ fontSize: 13, color: "#888" }}>INITIALIZING CATALOG...</p>
        </div>
      ) : (
        <div className="catalog-wrapper">
          
          {/* Left Sidebar: Filters */}
          <aside className="catalog-sidebar">
            
            {/* Search */}
            <div style={{ marginBottom: 24, position: "relative" }}>
              <input
                type="text"
                placeholder="Search drops... (Press Enter)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchQuery(searchInput);
                  }
                }}
                style={{
                  width: "100%", padding: "10px 36px 10px 12px", border: "1px solid #ddd", fontSize: 13,
                  boxSizing: "border-box"
                }}
              />
              <Search size={16} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
            </div>

            {/* Categories Tree */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "#888", marginBottom: 12 }}>Categories</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: (selectedCategories.length === 0 && selectedSubcategories.length === 0) ? 700 : 400, color: (selectedCategories.length === 0 && selectedSubcategories.length === 0) ? "#111" : "#666", textTransform: "uppercase" }}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.length === 0 && selectedSubcategories.length === 0}
                    onChange={() => {
                      setSelectedCategories([]);
                      setSelectedSubcategories([]);
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  All Drops
                </label>

                {categories.map((cat: any) => {
                  const isCatActive = selectedCategories.includes(cat.slug);
                  return (
                    <div key={cat.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: isCatActive ? 700 : 400, color: isCatActive ? "#111" : "#666", textTransform: "uppercase" }}>
                        <input
                          type="checkbox"
                          checked={isCatActive}
                          onChange={() => {
                            setSelectedCategories(prev => 
                              prev.includes(cat.slug) ? prev.filter(c => c !== cat.slug) : [...prev, cat.slug]
                            );
                          }}
                          style={{ cursor: "pointer" }}
                        />
                        {cat.name}
                      </label>
                      
                      {/* Nested subcategories */}
                      {cat.children && cat.children.length > 0 && (
                        <div style={{ paddingLeft: 24, display: "flex", flexDirection: "column", gap: 6, borderLeft: "1px solid #eee", marginLeft: 6 }}>
                          {cat.children.map((sub: any) => {
                            const isSubActive = selectedSubcategories.includes(sub.slug);
                            return (
                              <label key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: isSubActive ? 700 : 400, color: isSubActive ? "#111" : "#888" }}>
                                <input
                                  type="checkbox"
                                  checked={isSubActive}
                                  onChange={() => {
                                    setSelectedSubcategories(prev => 
                                      prev.includes(sub.slug) ? prev.filter(c => c !== sub.slug) : [...prev, sub.slug]
                                    );
                                  }}
                                  style={{ cursor: "pointer" }}
                                />
                                {sub.name}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Size Filter */}
            {availableSizes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "#888", marginBottom: 12 }}>Size</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {availableSizes.map((size) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(isSelected ? null : size)}
                        style={{
                          padding: "6px 12px",
                          border: isSelected ? "1.5px solid #111" : "1px solid #ddd",
                          background: isSelected ? "#111" : "#fff",
                          color: isSelected ? "#fff" : "#111",
                          fontSize: 12, fontWeight: 600, cursor: "pointer", minWidth: 32
                        }}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Color Filter */}
            {availableColors.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "#888", marginBottom: 12 }}>Color</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {availableColors.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(isSelected ? null : color)}
                        title={color}
                        style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: toHex(color), border: "1px solid rgba(0,0,0,0.15)",
                          outline: isSelected ? "2px solid #111" : "none", outlineOffset: 2,
                          cursor: "pointer"
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Filter */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: "#888", margin: 0 }}>Max Price</h3>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{priceRange ? formatBDT(priceRange) : "All"}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="3000" 
                step="100"
                value={priceRange || 3000}
                onChange={(e) => setPriceRange(parseInt(e.target.value) === 3000 ? null : parseInt(e.target.value))}
                style={{ width: "100%", cursor: "pointer", accentColor: "#111" }}
              />
            </div>

            {/* Clear All Button */}
            {(selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedSize || selectedColor || priceRange || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategories([]);
                  setSelectedSubcategories([]);
                  setSelectedSize(null);
                  setSelectedColor(null);
                  setPriceRange(null);
                  setSearchQuery("");
                  setSearchInput("");
                }}
                style={{
                  width: "100%", padding: "10px 0", background: "none", border: "1px solid #111", color: "#111",
                  fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}
              >
                <X size={12} /> Clear Filters
              </button>
            )}

          </aside>

          {/* Right Area: Catalog Header + 8-column Grid */}
          <main className="catalog-main">
            
            {/* Header / Stats */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#888", fontWeight: 500 }}>
                {sortedProducts.length} drops found
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  border: "1px solid #ddd", padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", outline: "none"
                }}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest Drops</option>
              </select>
            </div>

            {/* Product Grid */}
            {sortedProducts.length > 0 ? (
              <>
                <div className="catalog-grid-6">
                  {sortedProducts.slice(0, visibleCount).map((p, idx) => (
                    <ProductCard key={p.id} product={p} priority={idx < 8} />
                  ))}
                </div>

                {/* Load More */}
                {visibleCount < sortedProducts.length && (
                  <div style={{ textAlign: "center", marginTop: 56 }}>
                    <button
                      onClick={() => setVisibleCount((n) => n + 16)}
                      style={{
                        padding: "14px 48px",
                        border: "1px solid #ccc",
                        background: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "#111";
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.borderColor = "#111";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "#fff";
                        e.currentTarget.style.color = "#111";
                        e.currentTarget.style.borderColor = "#ccc";
                      }}
                    >
                      Load More ({sortedProducts.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "80px 0" }}>
                <p style={{ fontSize: 13, color: "#999" }}>No drops found matching the filter criteria.</p>
              </div>
            )}

          </main>

        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .catalog-wrapper {
          display: flex;
          gap: 32px;
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 40px;
        }
        .catalog-sidebar {
          width: 220px;
          flex-shrink: 0;
          position: sticky;
          top: 120px;
          max-height: calc(100vh - 160px);
          overflow-y: auto;
          padding-right: 12px;
        }
        .catalog-sidebar::-webkit-scrollbar {
          width: 4px;
        }
        .catalog-sidebar::-webkit-scrollbar-thumb {
          background: #eee;
        }
        .catalog-main {
          flex: 1;
        }
        .catalog-grid-6 {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
        }

        @media (max-width: 1400px) {
          .catalog-grid-6 {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (max-width: 1200px) {
          .catalog-grid-6 {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 900px) {
          .catalog-wrapper {
            flex-direction: column;
            padding: 0 20px;
          }
          .catalog-sidebar {
            width: 100%;
            position: relative;
            top: 0;
            max-height: none;
            overflow-y: visible;
          }
        }
        @media (max-width: 768px) {
          .catalog-grid-6 {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }
      ` }} />
    </div>
  );
}
