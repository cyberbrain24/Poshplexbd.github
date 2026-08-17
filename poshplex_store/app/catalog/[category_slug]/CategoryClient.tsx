"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, SlidersHorizontal, ChevronDown, X, Star } from "lucide-react";

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
        gap: 20,
        flexWrap: "wrap",
        marginTop: 10,
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
            style={{ 
              textDecoration: "none", 
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 115
            }}
          >
            <div
              className={`sub-circle ${isActive ? "active" : ""}`}
              style={{
                width: 96,
                height: 96,
                borderRadius: 16,
                background: isActive ? "#333333" : "#1e1e1e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                border: isActive ? "2.5px solid #c8102e" : "2.5px solid transparent",
                overflow: "hidden",
                position: "relative"
              }}
            >
              {sub.image ? (
                <Image src={sub.image} alt={sub.name} fill sizes="84px" priority={idx < 6} style={{ objectFit: "cover" }} />
              ) : (
                getCategoryIcon(sub.name)
              )}
            </div>
            <p
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                color: isActive ? "#ffffff" : "#cccccc",
                marginTop: 8,
                lineHeight: 1.3,
                wordWrap: "break-word"
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

/** Single product card */
function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [imgHovered, setImgHovered] = useState(false);
  const mainImage =
    product.images?.find((i: any) => i.is_main) || product.images?.[0];
  const imageUrl =
    mainImage?.url ||
    `https://placehold.co/400x500/ebebeb/333?text=${encodeURIComponent(
      product.name || "Product"
    )}`;
  const secondImage = product.images?.[1];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wishlist");
      if (stored) {
        try {
          const list = JSON.parse(stored);
          if (Array.isArray(list) && list.includes(product.id)) {
            setWishlisted(true);
          }
        } catch (e) {}
      }
    }
  }, [product.id]);

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setWishlisted(prev => {
      const next = !prev;
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("wishlist");
        let list: any[] = [];
        if (stored) {
          try {
            list = JSON.parse(stored);
            if (!Array.isArray(list)) list = [];
          } catch (e) {
            list = [];
          }
        }
        if (next) {
          if (!list.includes(product.id)) list.push(product.id);
        } else {
          list = list.filter(id => id !== product.id);
        }
        localStorage.setItem("wishlist", JSON.stringify(list));
      }
      return next;
    });
  };

  return (
    <Link
      href={`/product/${product.slug}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      {/* Image */}
      <div
        style={{ position: "relative", background: "#f0f0f0", overflow: "hidden", aspectRatio: "3/4" }}
        onMouseEnter={() => setImgHovered(true)}
        onMouseLeave={() => setImgHovered(false)}
      >
          <Image
            src={imgHovered && secondImage ? secondImage.url : imageUrl}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 768px) 50vw, 25vw"
            style={{
              objectFit: "cover",
              transition: "transform 0.4s ease",
              transform: imgHovered ? "scale(1.04)" : "scale(1)",
            }}
          />

        {/* Heart button */}
        <button
          onClick={handleWishlistToggle}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(6px)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: imgHovered ? 1 : 0,
            transform: imgHovered ? "scale(1)" : "scale(0.8)",
            transition: "all 0.2s ease",
            zIndex: 2,
          }}
        >
          <Heart
            size={16}
            fill={wishlisted ? "#e11d48" : "none"}
            color={wishlisted ? "#e11d48" : "#111"}
            strokeWidth={2}
          />
        </button>

        {/* NEW badge */}
        {product.is_featured && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: "#111",
              color: "#fff",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "1.2px",
              padding: "3px 8px",
            }}
          >
            NEW
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ paddingTop: 10, paddingBottom: 6 }}>
        {/* Category tag */}
        <p
          style={{
            fontSize: 11,
            color: "#666",
            marginBottom: 3,
            letterSpacing: "0.2px",
          }}
        >
          {product.category?.name || product.categories?.[0]?.name || ""}
        </p>

        {/* Name + Price row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
              margin: 0,
              lineHeight: 1.35,
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name}
          </h3>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#111",
              flexShrink: 0,
            }}
          >
            {getPriceDisplay(product)}
          </span>
        </div>

        {/* Stars */}
        {product.rating_count > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              marginTop: 4,
            }}
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={11}
                fill={s <= Math.round(product.rating_average) ? "#111" : "none"}
                color="#111"
                strokeWidth={1.5}
              />
            ))}
            <span style={{ fontSize: 11, color: "#888", marginLeft: 2 }}>
              ({product.rating_count})
            </span>
          </div>
        )}
      </div>
    </Link>
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

  // Client-side fetch fallback / refresh if initial data is empty
  useEffect(() => {
    if (initialProducts.length > 0 && initialCategoryTree.length > 0) {
      return;
    }
    const load = async () => {
      try {
        setIsLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const [prodRes, catRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/catalog/products?limit=100`),
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
          padding: 16px 24px 12px !important;
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
            display: block !important;
          }
          .category-header-container {
            padding: 12px 16px 12px !important;
          }
          .subcategory-nav-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 12px 6px !important;
            padding: 0 !important;
            margin-top: 12px !important;
          }
          .subcategory-nav-grid > a {
            width: 100% !important;
          }
          .subcategory-nav-grid .sub-circle {
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 1/1 !important;
          }
          .subcategory-nav-grid p {
            font-size: 9px !important;
            margin-top: 4px !important;
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
          }}
        >
          {categoryName}
        </h1>

        {/* Subcategory pill nav */}
        <SubcategoryNav children={subcategories} activeSlug={slug} />
      </div>

      {/* ── Toolbar (count + sort + filter) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 24px",
          borderBottom: "1px solid #eee",
          background: "#f3f3f5",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <span style={{ fontSize: 13, color: "#666" }}>
          {isLoading ? "Loading…" : `${sorted.length} items`}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Sort */}
          <div style={{ position: "relative" }}>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              style={{
                appearance: "none",
                background: "none",
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                color: "#111",
                cursor: "pointer",
                paddingRight: 20,
                outline: "none",
              }}
            >
              <option value="newest">Newest</option>
              <option value="asc">Price: Low to High</option>
              <option value="desc">Price: High to Low</option>
            </select>
            <ChevronDown
              size={14}
              style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#555" }}
            />
          </div>

          {/* Filters button */}
          <button
            onClick={() => setFilterOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              color: "#111",
              padding: 0,
            }}
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: "#111",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
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
      </div>

      {/* ── Product Grid ── */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "24px 24px 80px",
        }}
      >
        {isLoading ? (
          /* Skeleton */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "2px",
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
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
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "32px 16px",
              }}
            >
              {visible.map((p, idx) => (
                <ProductCard key={p.id} product={p} priority={idx < 4} />
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
