"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, SlidersHorizontal, ChevronDown, X, Star } from "lucide-react";
import ProductCard from "../../components/ProductCard";

/* ─── helpers ─────────────────────────────────────────────────────── */
const toTitle = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatBDT = (n: string | number) => `৳${Math.round(Number(n))}`;

const getPriceDisplay = (p: any): string => {
  const variants = p.variants?.filter((v: any) => v.is_active !== false);
  if (variants && variants.length > 0) {
    const prices = variants.map((v: any) =>
      parseFloat(v.selling_price || v.price || 0)
    );
    const lo = Math.round(Math.min(...prices));
    const hi = Math.round(Math.max(...prices));
    if (lo === hi) return formatBDT(lo);
    return `${formatBDT(lo)} – ${formatBDT(hi)}`;
  }
  return formatBDT(p.price || p.base_price || 0);
};

const getCategoryIcon = (name: string) => {
  const lowercaseName = name.toLowerCase();
  if (lowercaseName.includes("jacket") || lowercaseName.includes("outerwear") || lowercaseName.includes("acid")) return "🧥";
  if (lowercaseName.includes("tank") || lowercaseName.includes("vest")) return "🎽";
  if (lowercaseName.includes("upper") || lowercaseName.includes("tee") || lowercaseName.includes("shirt") || lowercaseName.includes("drop")) return "👕";
  if (lowercaseName.includes("bottom") || lowercaseName.includes("pant") || lowercaseName.includes("jogger") || lowercaseName.includes("short")) return "👖";
  if (lowercaseName.includes("bag") || lowercaseName.includes("backpack")) return "👜";
  if (lowercaseName.includes("shoe") || lowercaseName.includes("sneaker")) return "👟";
  return "🏷️";
};

const PRICE_BUCKETS = [
  { label: "Under ৳500", test: (n: number) => n < 500 },
  { label: "৳500 – ৳1,000", test: (n: number) => n >= 500 && n <= 1000 },
  { label: "৳1,000 – ৳2,000", test: (n: number) => n > 1000 && n <= 2000 },
  { label: "Over ৳2,000", test: (n: number) => n > 2000 },
];

/* ─── types ────────────────────────────────────────────────────────── */
type Category = {
  id: number;
  name: string;
  slug: string;
  children: Category[];
  image?: string | null;
};

type Product = any;

type FilterState = {
  colors: string[];
  sizes: string[];
  priceBuckets: string[];
};

/* ─── subcomponents ────────────────────────────────────────────────── */

/** Subcategory pill row */
function SubcategoryNav({
  children,
  activeSlug,
}: {
  children: Category[];
  activeSlug?: string;
}) {
  if (!children.length) return null;
  return (
    <div
      className="subcategory-nav-grid"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      {children.map((sub, idx) => {
        const isActive =
          activeSlug?.toLowerCase() === sub.slug.toLowerCase();
        return (
          <Link
            key={sub.id}
            href={`/catalog/${encodeURIComponent(sub.slug)}`}
            scroll={false}
            style={{ 
              textDecoration: "none", 
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "auto",
              minWidth: 80
            }}
          >
            <div
              className={`sub-circle ${isActive ? "active" : ""}`}
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: isActive ? "#333333" : "#1e1e1e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                border: isActive ? "2.5px solid #c8102e" : "2.5px solid transparent",
                overflow: "hidden",
                position: "relative"
              }}
            >
              {sub.image ? (
                <Image src={sub.image} alt="" fill sizes="72px" priority={idx < 6} style={{ objectFit: "cover" }} />
              ) : (
                getCategoryIcon(sub.name)
              )}
            </div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: isActive ? "#ffffff" : "#cccccc",
                marginTop: 8,
                lineHeight: 1.2,
                whiteSpace: "nowrap"
              }}
            >
              {sub.name}
            </p>
          </Link>
        );
      })}
    </div>
  );
}


/** Right-slide filter drawer */
function FilterDrawer({
  open,
  onClose,
  filters,
  setFilters,
  availableColors,
  availableSizes,
}: {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  availableColors: string[];
  availableSizes: string[];
}) {
  const toggle = (key: keyof FilterState, val: string) => {
    const arr = filters[key] as string[];
    setFilters({
      ...filters,
      [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
    });
  };

  const colorMap: Record<string, string> = {
    Black: "#111",
    White: "#fff",
    Grey: "#888",
    Red: "#e11d48",
    Blue: "#2563eb",
    Green: "#16a34a",
    Cream: "#f5f0e8",
    Coffee: "#6f4e37",
    Navy: "#1e3a5f",
    Maroon: "#800000",
  };

  return (
    <>
      {/* overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 200,
          }}
        />
      )}

      {/* drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: "#fff",
          zIndex: 201,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid #eee",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Filters</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "#555",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* Color */}
          {availableColors.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginBottom: 14,
                  color: "#111",
                }}
              >
                Color
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {availableColors.map((c) => {
                  const selected = filters.colors.includes(c);
                  return (
                    <button
                      key={c}
                      title={c}
                      onClick={() => toggle("colors", c)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: colorMap[c] || "#ccc",
                        border: selected
                          ? "3px solid #111"
                          : "2px solid rgba(0,0,0,0.15)",
                        cursor: "pointer",
                        boxShadow: selected ? "0 0 0 2px #fff inset" : "none",
                        transition: "all 0.15s",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Size */}
          {availableSizes.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginBottom: 14,
                  color: "#111",
                }}
              >
                Size
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {availableSizes.map((s) => {
                  const selected = filters.sizes.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggle("sizes", s)}
                      style={{
                        padding: "6px 14px",
                        border: selected ? "1.5px solid #111" : "1.5px solid #ddd",
                        background: selected ? "#111" : "#fff",
                        color: selected ? "#fff" : "#111",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        borderRadius: 2,
                        transition: "all 0.15s",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price */}
          <div style={{ marginBottom: 32 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: 14,
                color: "#111",
              }}
            >
              Price
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PRICE_BUCKETS.map((b) => {
                const checked = filters.priceBuckets.includes(b.label);
                return (
                  <label
                    key={b.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#333",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle("priceBuckets", b.label)}
                      style={{ accentColor: "#111", width: 14, height: 14 }}
                    />
                    {b.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #eee",
            display: "flex",
            gap: 20,
          }}
        >
          <button
            onClick={onClose}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Apply Filters
          </button>
          <button
            onClick={() =>
              setFilters({ colors: [], sizes: [], priceBuckets: [] })
            }
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#666",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Clear All
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── main page ─────────────────────────────────────────────────────── */
interface CategoryClientProps {
  slug: string;
  initialProducts: Product[];
  initialCategoryTree: Category[];
}

export default function CategoryClient({
  slug,
  initialProducts,
  initialCategoryTree,
}: CategoryClientProps) {
  const categoryName = toTitle(slug);

  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [categoryTree, setCategoryTree] = useState<Category[]>(initialCategoryTree);
  const [isLoading, setIsLoading] = useState(initialProducts.length === 0 && initialCategoryTree.length === 0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "asc" | "desc">("newest");
  const [visibleCount, setVisibleCount] = useState(16);
  const [filters, setFilters] = useState<FilterState>({
    colors: [],
    sizes: [],
    priceBuckets: [],
  });

  // Handle scroll position on category change
  useEffect(() => {
    const headerHeight = window.innerWidth >= 768 ? 96 : 79;
    if (window.scrollY > headerHeight) {
      // Ensure we run this after the browser has completed any layout shifts
      requestAnimationFrame(() => {
        window.scrollTo({ top: headerHeight, behavior: "smooth" });
      });
    }
  }, [slug]);

  // Sync server props to client state on navigation
  useEffect(() => {
    if (initialProducts.length > 0) setAllProducts(initialProducts);
    if (initialCategoryTree.length > 0) setCategoryTree(initialCategoryTree);
  }, [initialProducts, initialCategoryTree]);

  // Client-side fetch fallback / refresh if initial data is empty
  useEffect(() => {
    if (initialProducts.length > 0 && initialCategoryTree.length > 0) {
      return;
    }
    const load = async () => {
      try {
        setIsLoading(true);
        const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const [prodRes, catRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/catalog/products?category_slug=${slug}&limit=100`),
          fetch(`${API_URL}/api/v1/catalog/categories/tree`, { cache: 'no-store' }),
        ]);
        if (prodRes.ok) {
          const d = await prodRes.json();
          setAllProducts(d.results || d || []);
        }
        if (catRes.ok) {
          const d = await catRes.json();
          setCategoryTree(Array.isArray(d) ? d : []);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [initialProducts, initialCategoryTree]);

  // Find current category & its parent
  const findCategory = useCallback(
    (tree: Category[], s: string): Category | null => {
      for (const cat of tree) {
        if (cat.slug.toLowerCase() === s.toLowerCase()) return cat;
        const found = findCategory(cat.children, s);
        if (found) return found;
      }
      return null;
    },
    []
  );

  const currentCat = findCategory(categoryTree, slug);
  // Find parent to get siblings as subcategory nav
  const parentCat = categoryTree.find(
    (c) =>
      c.slug.toLowerCase() === slug.toLowerCase() ||
      c.children.some((ch) => ch.slug.toLowerCase() === slug.toLowerCase())
  );
  const subcategories =
    parentCat?.children?.length ? parentCat.children : currentCat?.children || [];

  // Filter products to this category (and subcategories)
  const collectSlugs = (cat: Category): string[] => [
    cat.slug.toLowerCase(),
    ...cat.children.flatMap(collectSlugs),
  ];
  const validSlugs = currentCat ? collectSlugs(currentCat) : [slug.toLowerCase()];

  const categoryProducts = allProducts.filter((p) => {
    const cats: string[] = [
      ...(p.categories || []).map((c: any) => c.slug?.toLowerCase()),
      p.category?.slug?.toLowerCase(),
    ].filter(Boolean);
    return cats.some((cs) => validSlugs.includes(cs));
  });

  // Derive available filter options
  const availableColors = Array.from(
    new Set(
      categoryProducts.flatMap((p) =>
        (p.variants || []).map((v: any) => v.attributes?.color).filter(Boolean)
      )
    )
  ) as string[];

  const availableSizes = Array.from(
    new Set(
      categoryProducts.flatMap((p) =>
        (p.variants || []).map((v: any) => v.attributes?.size).filter(Boolean)
      )
    )
  ) as string[];

  // Apply filters
  const filtered = categoryProducts.filter((p) => {
    const variants = p.variants || [];
    if (filters.colors.length) {
      const ok = variants.some((v: any) =>
        filters.colors.includes(v.attributes?.color)
      );
      if (!ok) return false;
    }
    if (filters.sizes.length) {
      const ok = variants.some((v: any) =>
        filters.sizes.includes(v.attributes?.size)
      );
      if (!ok) return false;
    }
    if (filters.priceBuckets.length) {
      const minPrice = variants.length
        ? Math.min(...variants.map((v: any) => parseFloat(v.selling_price || v.price || 0)))
        : parseFloat(p.price || 0);
      const ok = filters.priceBuckets.some((label) => {
        const bucket = PRICE_BUCKETS.find((b) => b.label === label);
        return bucket?.test(minPrice);
      });
      if (!ok) return false;
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const getMin = (p: Product) => {
      const vs = p.variants?.filter((v: any) => v.is_active !== false);
      return vs?.length
        ? Math.min(...vs.map((v: any) => parseFloat(v.selling_price || v.price || 0)))
        : parseFloat(p.price || 0);
    };
    if (sortOrder === "asc") return getMin(a) - getMin(b);
    if (sortOrder === "desc") return getMin(b) - getMin(a);
    return 0; // newest = API order
  });

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const activeFilterCount =
    filters.colors.length + filters.sizes.length + filters.priceBuckets.length;

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .category-title {
          display: none !important;
        }
        .category-header-container {
          position: sticky !important;
          z-index: 50 !important;
          padding: 8px 24px 8px !important;
        }
        @media (min-width: 768px) {
          .street-header {
            position: relative !important;
          }
          .category-header-container {
            top: 0 !important;
            z-index: 101 !important;
          }
        }
        .subcategory-nav-grid {
          margin-top: 4px !important;
          margin-bottom: 0px !important;
        }
        @keyframes activePulse {
          0% {
            box-shadow: 0 0 8px rgba(200, 16, 46, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 18px rgba(200, 16, 46, 0.85);
            transform: scale(1.03);
          }
          100% {
            box-shadow: 0 0 8px rgba(200, 16, 46, 0.3);
            transform: scale(1);
          }
        }
        .sub-circle {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .sub-circle:hover {
          transform: translateY(-3px) scale(1.05) !important;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45) !important;
        }
        .sub-circle.active {
          animation: activePulse 1.2s infinite ease-in-out !important;
          border-color: #c8102e !important;
        }

        @media (max-width: 767px) {
          .category-title {
            display: none !important;
          }
          .category-toolbar {
            display: none !important;
          }
          .category-header-container {
            position: sticky !important;
            top: 79px !important;
            z-index: 50 !important;
            padding: 8px 12px 8px !important;
          }
          .subcategory-nav-grid {
            display: flex !important;
            justify-content: center !important;
            flex-wrap: wrap !important;
            gap: 12px 16px !important;
            padding: 0 !important;
            margin-top: 4px !important;
          }
          .subcategory-nav-grid > a {
            width: auto !important;
          }
          .subcategory-nav-grid .sub-circle {
            width: 64px !important;
            height: 64px !important;
            border-radius: 14px !important;
          }
          .subcategory-nav-grid p {
            font-size: 10px !important;
            margin-top: 4px !important;
          }
          .desktop-filter-btn {
            display: none !important;
          }
          .cat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px 8px !important;
          }
        }
      `}} />
      {/* ── Category header ── */}
      <div
        className="category-header-container"
        style={{
          textAlign: "center",
          padding: "12px 24px 8px",
          borderBottom: "1px solid #3d3d3d",
          background: "#2f2f2f",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <h1
          className="category-title"
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.5px",
            color: "#ffffff",
            marginBottom: 10,
            fontFamily: "Georgia, serif",
            textTransform: "uppercase",
            display: "none"
          }}
        >
          {categoryName}
        </h1>

        {/* Subcategory pill nav */}
        <SubcategoryNav children={subcategories} activeSlug={slug} />

        {/* Desktop Filter Button */}
        <button
          className="desktop-filter-btn"
          onClick={() => setFilterOpen(true)}
          style={{
            position: "absolute",
            right: 24,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            color: "#ffffff",
            padding: "6px 12px",
            textTransform: "uppercase"
          }}
        >
          <SlidersHorizontal size={14} />
          Filter
          {activeFilterCount > 0 && (
            <span
              style={{
                background: "#c8102e",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: "50%",
                width: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>


      {/* ── Product Grid ── */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "8px 24px 80px",
        }}
      >
        {isLoading ? (
          /* Skeleton */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "2px",
            }}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <div
                  style={{
                    aspectRatio: "3/4",
                    background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite",
                  }}
                />
                <div style={{ padding: "10px 0" }}>
                  <div style={{ height: 10, background: "#eee", borderRadius: 4, marginBottom: 6, width: "60%" }} />
                  <div style={{ height: 13, background: "#eee", borderRadius: 4, width: "90%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#888" }}>
            <p style={{ fontSize: 15, marginBottom: 16 }}>
              No products found{activeFilterCount > 0 ? " for these filters" : " in this category"}.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({ colors: [], sizes: [], priceBuckets: [] })}
                style={{
                  border: "1px solid #ccc",
                  background: "#fff",
                  padding: "10px 24px",
                  fontSize: 13,
                  cursor: "pointer",
                  borderRadius: 4,
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className="cat-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: "32px 16px",
              }}
            >
              {visible.map((p, idx) => (
                <ProductCard key={p.id} product={p} priority={idx < 5} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: 56 }}>
                <button
                  onClick={() => setVisibleCount((n) => n + 16)}
                  style={{
                    padding: "14px 48px",
                    border: "1px solid #ccc",
                    background: "#fff",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    borderRadius: 4,
                    color: "#111",
                    letterSpacing: "0.3px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.background = "#111";
                    (e.target as HTMLButtonElement).style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.background = "#fff";
                    (e.target as HTMLButtonElement).style.color = "#111";
                  }}
                >
                  Load More ({sorted.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Filter drawer ── */}
      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        availableColors={availableColors}
        availableSizes={availableSizes}
      />

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 1024px) {
          .cat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 640px) {
          .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
