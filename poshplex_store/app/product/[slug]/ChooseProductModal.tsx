"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Check, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  image: string | null;
  children?: CategoryNode[];
}

interface ChooseProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: any, variant: any) => void;
  discountPercentage?: number;
  excludeProductId?: number;
  initialProduct?: any;
  initialVariant?: any;
  bundleName?: string;
}

export default function ChooseProductModal({
  isOpen,
  onClose,
  onSelectProduct,
  discountPercentage = 0,
  excludeProductId,
  initialProduct = null,
  initialVariant = null,
  bundleName
}: ChooseProductModalProps) {
  // Category tree & active filters
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string | null>(null);

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Selection state
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [modalAttributes, setModalAttributes] = useState<{ size?: string; color?: string }>({});
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Sizing view state (single product view with full images, size & color picker + size chart)
  const [sizingProduct, setSizingProduct] = useState<any | null>(null);
  const [sizingActiveImgIdx, setSizingActiveImgIdx] = useState<number>(0);

  // Refs for horizontal scrolling
  const mainCatScrollRef = useRef<HTMLDivElement>(null);
  const subCatScrollRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Helper for category image URL
  const getFullImgUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
  };

  // 1. Fetch category tree on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/catalog/categories/tree`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data) && data.length > 0) {
            setCategories(data);
            setSelectedCategorySlug((prev) => prev || data[0].slug);
          }
        }
      } catch (err) {
        console.error("Failed to fetch category tree for modal", err);
      }
    };

    fetchCategories();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, API_URL]);

  // 2. Fetch products whenever category/subcategory filter changes
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        let catParam = "";
        if (selectedSubcategorySlug) {
          catParam = `&category_slug=${encodeURIComponent(selectedSubcategorySlug)}`;
        } else if (selectedCategorySlug) {
          catParam = `&category_slug=${encodeURIComponent(selectedCategorySlug)}`;
        }

        const res = await fetch(`${API_URL}/api/v1/catalog/products?limit=50&is_active=true${catParam}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            const list = data.results || (Array.isArray(data) ? data : []);
            setProducts(list);
            setTotalCount(data.count || list.length);
          }
        }
      } catch (err) {
        console.error("Failed to fetch products for modal", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedCategorySlug, selectedSubcategorySlug, API_URL]);

  // Reset internal states or initialize with initialProduct/initialVariant on open
  useEffect(() => {
    if (isOpen) {
      if (initialProduct) {
        setSelectedProductId(initialProduct.id);
        setSizingProduct(initialProduct);

        const initAttrs: { size?: string; color?: string } = {};
        if (initialVariant?.attributes) {
          for (const [k, val] of Object.entries(initialVariant.attributes)) {
            const lower = k.toLowerCase();
            if (lower.includes("color") || lower.includes("colour")) initAttrs.color = val as string;
            if (lower.includes("size")) initAttrs.size = val as string;
          }
        }
        setModalAttributes(initAttrs);
        setSelectedVariantId(initialVariant?.id || null);

        if (initialVariant?.image_id && Array.isArray(initialProduct.images)) {
          const foundIdx = initialProduct.images.findIndex((img: any) => img.id === initialVariant.image_id);
          setSizingActiveImgIdx(foundIdx !== -1 ? foundIdx : 0);
        } else {
          setSizingActiveImgIdx(0);
        }
      } else {
        setSelectedProductId(null);
        setSelectedVariantId(null);
        setModalAttributes({});
        setSizingProduct(null);
        setSizingActiveImgIdx(0);
      }

      setErrorNotice(null);
      setSelectedSubcategorySlug(null);
      if (typeof document !== "undefined") {
        document.body.classList.add("cpm-modal-open");
      }
    } else {
      if (typeof document !== "undefined") {
        document.body.classList.remove("cpm-modal-open");
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("cpm-modal-open");
      }
    };
  }, [isOpen, initialProduct, initialVariant]);

  // Currently selected category object (to get its children)
  const activeCategory = useMemo(() => {
    if (!selectedCategorySlug) return null;
    return categories.find(c => c.slug.toLowerCase() === selectedCategorySlug.toLowerCase()) || null;
  }, [categories, selectedCategorySlug]);

  // Active subcategories list
  const activeSubcategories = useMemo(() => {
    return activeCategory?.children || [];
  }, [activeCategory]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // When a product card is clicked in the grid:
  // DO NOT pre-select variation by default! Customer must pick their size & color!
  const handleToggleProduct = (product: any) => {
    if (product.is_sold_out) {
      toast.error("This product is currently sold out.");
      return;
    }
    if (selectedProductId === product.id) {
      setSelectedProductId(null);
      setSelectedVariantId(null);
      setModalAttributes({});
      setErrorNotice(null);
    } else {
      setSelectedProductId(product.id);
      setSelectedVariantId(null);
      setModalAttributes({});
      setErrorNotice(null);
    }
  };

  // Open single-product view (sizing & color variation + images + size chart)
  const handleOpenSizingView = (e: React.MouseEvent | null, product: any) => {
    if (e) e.stopPropagation();
    setSelectedProductId(product.id);
    setSizingProduct(product);
    setSizingActiveImgIdx(0);
    setErrorNotice(null);
  };

  // Available attributes for currently opened sizingProduct
  const { availableColors, availableSizes } = useMemo(() => {
    if (!sizingProduct) return { availableColors: [], availableSizes: [] };
    const colors = new Set<string>();
    const sizes = new Set<string>();
    (sizingProduct.variants || []).forEach((v: any) => {
      if (v.is_active !== false) {
        let col = null;
        let s = null;
        for (const [k, val] of Object.entries(v.attributes || {})) {
          const lower = k.toLowerCase();
          if (lower.includes("color") || lower.includes("colour")) col = val as string;
          if (lower.includes("size")) s = val as string;
        }
        if (col) colors.add(col);
        if (s) sizes.add(s);
      }
    });
    return {
      availableColors: Array.from(colors),
      availableSizes: Array.from(sizes)
    };
  }, [sizingProduct]);

  // Product images for sizing view
  const sizingProductImages = useMemo(() => {
    if (!sizingProduct) return [];
    return (sizingProduct.images && sizingProduct.images.length > 0)
      ? sizingProduct.images
      : [{ id: 0, url: "https://placehold.co/400x400?text=Product", is_main: true }];
  }, [sizingProduct]);

  // Select attribute in modal sizing view (Color or Size)
  const handleSelectModalAttribute = (key: "color" | "size", value: string) => {
    if (!sizingProduct) return;
    const updated = { ...modalAttributes, [key]: value };
    setModalAttributes(updated);
    setErrorNotice(null);

    const activeVariants = (sizingProduct.variants || []).filter((v: any) => v.is_active !== false);

    // Match variant by both color and size
    const matched = activeVariants.find((v: any) => {
      let vSize = null;
      let vCol = null;
      for (const [k, val] of Object.entries(v.attributes || {})) {
        const lower = k.toLowerCase();
        if (lower.includes("color") || lower.includes("colour")) vCol = val;
        if (lower.includes("size")) vSize = val;
      }
      const sizeMatch = !updated.size || vSize === updated.size;
      const colorMatch = !updated.color || vCol === updated.color;
      return sizeMatch && colorMatch;
    }) || activeVariants.find((v: any) => v.id === selectedVariantId) || activeVariants[0] || null;

    if (matched) {
      setSelectedVariantId(matched.id);

      // Switch product image when variation / color is selected
      if (matched.image_id && sizingProductImages.length > 0) {
        const foundIdx = sizingProductImages.findIndex((img: any) => img.id === matched.image_id);
        if (foundIdx !== -1) {
          setSizingActiveImgIdx(foundIdx);
        }
      } else if (key === "color") {
        const foundColorIdx = sizingProductImages.findIndex((img: any) =>
          img.color_tag?.toLowerCase() === value.toLowerCase() ||
          img.alt_text?.toLowerCase().includes(value.toLowerCase()) ||
          img.url?.toLowerCase().includes(value.toLowerCase())
        );
        if (foundColorIdx !== -1) {
          setSizingActiveImgIdx(foundColorIdx);
        }
      }
    }
  };

  // Confirm selection from inside Single Product view and directly apply to bundle slot
  const handleConfirmSizingView = () => {
    if (!sizingProduct) return;

    const needsColor = availableColors.length > 0 && !modalAttributes.color;
    const needsSize = availableSizes.length > 0 && !modalAttributes.size;

    if (needsColor && needsSize) {
      toast.error("Please select a size and color first");
      return;
    }
    if (needsColor) {
      toast.error("Please select a color first");
      return;
    }
    if (needsSize) {
      toast.error("Please select a size first");
      return;
    }

    const activeVariants = (sizingProduct.variants || []).filter((v: any) => v.is_active !== false);

    // Find the best matched variant based on selected size and color
    const matched = activeVariants.find((v: any) => {
      let vSize = null;
      let vCol = null;
      for (const [k, val] of Object.entries(v.attributes || {})) {
        const lower = k.toLowerCase();
        if (lower.includes("color") || lower.includes("colour")) vCol = val;
        if (lower.includes("size")) vSize = val;
      }
      const sizeMatch = !modalAttributes.size || vSize === modalAttributes.size;
      const colorMatch = !modalAttributes.color || vCol === modalAttributes.color;
      return sizeMatch && colorMatch;
    }) || activeVariants.find((v: any) => v.id === selectedVariantId) || activeVariants[0] || null;

    onSelectProduct(sizingProduct, matched);
    onClose();
  };

  // "Explore More" - returns to the 2-column product listing view inside the modal
  const handleExploreMore = () => {
    if (sizingProduct) {
      setSelectedProductId(sizingProduct.id);
    }
    setSizingProduct(null);
  };

  // Helper to get variation button info for each product card in the 2-column grid
  const getProductVariationInfo = (product: any, isSelected: boolean) => {
    const activeVariants = (product.variants || []).filter((v: any) => v.is_active !== false);
    const hasColor = activeVariants.some((v: any) => 
      Object.keys(v.attributes || {}).some(k => k.toLowerCase().includes("color") || k.toLowerCase().includes("colour"))
    );
    const hasSize = activeVariants.some((v: any) => 
      Object.keys(v.attributes || {}).some(k => k.toLowerCase().includes("size"))
    );

    let defaultTitle = "Select Option";
    if (hasColor && hasSize) {
      defaultTitle = "Select Size & Color";
    } else if (hasSize) {
      defaultTitle = "Select Size";
    } else if (hasColor) {
      defaultTitle = "Select Color";
    }

    // Only show chosen attributes if this product is currently selected AND user has configured attributes
    const isCurrent = isSelected && selectedProductId === product.id;
    const chosenSize = isCurrent ? modalAttributes.size : null;
    const chosenColor = isCurrent ? modalAttributes.color : null;
    const hasConfigured = Boolean(
      isCurrent &&
      (!hasSize || chosenSize) &&
      (!hasColor || chosenColor) &&
      selectedVariantId
    );

    const selectionDetails = [chosenSize, chosenColor].filter(Boolean).join(" • ");

    return {
      hasColor,
      hasSize,
      defaultTitle,
      hasConfigured,
      selectionDetails
    };
  };

  // Sticky "CONFIRM PRODUCT" action handler on product list view
  const handleConfirmProduct = () => {
    if (!selectedProduct) {
      toast.error("Please tap a product first");
      return;
    }

    const activeVariants = (selectedProduct.variants || []).filter((v: any) => v.is_active !== false);
    const hasColor = activeVariants.some((v: any) => v.attributes?.color || v.attributes?.Color);
    const hasSize = activeVariants.some((v: any) => v.attributes?.size || v.attributes?.Size);

    const needsColor = hasColor && !modalAttributes.color;
    const needsSize = hasSize && !modalAttributes.size;

    if (needsColor && needsSize) {
      const msg = "Please select size and color variation first";
      setErrorNotice(msg);
      toast.error(msg);
      handleOpenSizingView(null, selectedProduct);
      return;
    }
    if (needsColor) {
      const msg = "Please select a color variation first";
      setErrorNotice(msg);
      toast.error(msg);
      handleOpenSizingView(null, selectedProduct);
      return;
    }
    if (needsSize) {
      const msg = "Please select a size variation first";
      setErrorNotice(msg);
      toast.error(msg);
      handleOpenSizingView(null, selectedProduct);
      return;
    }

    // Variations confirmed!
    const chosenVariant = activeVariants.find((v: any) => v.id === selectedVariantId) || activeVariants[0] || null;
    onSelectProduct(selectedProduct, chosenVariant);
    onClose();
  };

  if (!isOpen || typeof document === "undefined") return null;

  // Active single product image URL
  const currentSizingImgUrl = sizingProductImages[sizingActiveImgIdx]?.url || sizingProductImages[0]?.url;

  // Size guide data resolution
  const sizeGuideHeaders = sizingProduct?.size_guide?.headers || ["Size", "Chest", "Length", "Sleeve"];
  const sizeGuideRows = sizingProduct?.size_guide?.rows || [
    ["M", "40\"", "28\"", "8\""],
    ["L", "42\"", "29\"", "8.5\""],
    ["XL", "44\"", "30\"", "9\""],
    ["XXL", "46\"", "31\"", "9.5\""]
  ];

  return createPortal(
    <div className="cpm-backdrop">
      <div className="cpm-dialog">
        {/* --- MODAL TOP HEADER (MINIMAL HEIGHT) --- */}
        <div style={{
          padding: "8px 14px",
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#ffffff",
          flexShrink: 0
        }}>
          {sizingProduct ? (
            <button
              onClick={() => setSizingProduct(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                color: "#111",
                padding: 0
              }}
            >
              <ArrowLeft size={15} /> Back to Products
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#111", letterSpacing: "0.2px" }}>
                Choose product
              </h3>
              {bundleName && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#166534",
                    backgroundColor: "#dcfce7",
                    border: "1px solid #bbf7d0",
                    padding: "1.5px 7px",
                    borderRadius: 4,
                    letterSpacing: "0.2px",
                    whiteSpace: "nowrap"
                  }}
                >
                  {bundleName}
                </span>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "#f2f2f2",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#333",
              transition: "background 0.15s"
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ======================================================== */}
        {/* SINGLE PRODUCT PAGE VIEW (FULL IMAGES + VARIATIONS + SIZE CHART) */}
        {/* ======================================================== */}
        {sizingProduct ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#fff" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {/* 1. Full Product Images Gallery */}
              <div style={{ marginBottom: 14 }}>
                {/* Main Prominent Image */}
                <div style={{
                  position: "relative",
                  width: "100%",
                  height: 270,
                  backgroundColor: "#f5f5f5",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(0, 0, 0, 0.08)"
                }}>
                  <Image
                    unoptimized
                    src={currentSizingImgUrl}
                    alt={sizingProduct.name}
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>

                {/* All Product Image Thumbnails */}
                {sizingProductImages.length > 1 && (
                  <div style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    padding: "8px 2px 2px",
                    scrollbarWidth: "none"
                  }}>
                    {sizingProductImages.map((img: any, idx: number) => (
                      <button
                        key={img.id || idx}
                        type="button"
                        onClick={() => setSizingActiveImgIdx(idx)}
                        style={{
                          position: "relative",
                          width: 48,
                          height: 48,
                          borderRadius: 6,
                          overflow: "hidden",
                          backgroundColor: "#f5f5f5",
                          border: idx === sizingActiveImgIdx ? "2px solid #111" : "1px solid rgba(0,0,0,0.15)",
                          cursor: "pointer",
                          flexShrink: 0,
                          padding: 0
                        }}
                      >
                        <Image unoptimized src={img.url} alt="" fill style={{ objectFit: "cover" }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Product Title & Pricing */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#111", textTransform: "uppercase" }}>
                  {sizingProduct.name}
                </h4>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 4 }}>
                  {discountPercentage > 0 && (
                    <span style={{ textDecoration: "line-through", color: "#888", fontSize: 11.5 }}>
                      Tk {Math.round(parseFloat(sizingProduct.selling_price || sizingProduct.price || sizingProduct.base_price || 0))}
                    </span>
                  )}
                  <span style={{ fontWeight: 800, color: "#111", fontSize: 13.5 }}>
                    Tk {Math.round(parseFloat(sizingProduct.selling_price || sizingProduct.price || sizingProduct.base_price || 0) * (1 - discountPercentage / 100))}
                  </span>
                  {discountPercentage > 0 && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#111", background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.1)", padding: "1px 5px", borderRadius: 3 }}>
                      {discountPercentage}% OFF
                    </span>
                  )}
                </div>
              </div>

              {/* 3. Color Variation Selection (if product has colors) */}
              {availableColors.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 7, textTransform: "uppercase", color: "#111" }}>
                    Select Color: <span style={{ fontWeight: 600, color: modalAttributes.color ? "#111" : "#e11d48" }}>{modalAttributes.color || "Choose a color"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {availableColors.map((colorName: string) => {
                      const isColSelected = modalAttributes.color === colorName;
                      return (
                        <button
                          key={colorName}
                          onClick={() => handleSelectModalAttribute("color", colorName)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "4px",
                            border: isColSelected ? "1.5px solid #111" : "1px solid rgba(0,0,0,0.22)",
                            backgroundColor: isColSelected ? "#111" : "#fff",
                            color: isColSelected ? "#fff" : "#111",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          {colorName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Size Variation Selection (if product has sizes) */}
              {availableSizes.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 7, textTransform: "uppercase", color: "#111" }}>
                    Select Size: <span style={{ fontWeight: 600, color: modalAttributes.size ? "#111" : "#e11d48" }}>{modalAttributes.size || "Choose a size"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {availableSizes.map((sizeName: string) => {
                      const isSizeSelected = modalAttributes.size === sizeName;
                      return (
                        <button
                          key={sizeName}
                          onClick={() => handleSelectModalAttribute("size", sizeName)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "999px",
                            border: isSizeSelected ? "1.5px solid #111" : "1px solid rgba(0,0,0,0.22)",
                            backgroundColor: isSizeSelected ? "#111" : "#fff",
                            color: isSizeSelected ? "#fff" : "#111",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            minWidth: 36,
                            transition: "all 0.15s"
                          }}
                        >
                          {sizeName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Product Size Chart */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14, marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h5 style={{ fontSize: 12, fontWeight: 800, margin: 0, textTransform: "uppercase", color: "#111", letterSpacing: "0.5px" }}>
                    Size Chart (Inches)
                  </h5>
                  <span style={{ fontSize: 10, color: "#666", fontWeight: 600 }}>Standard Measurements</span>
                </div>
                <div style={{ width: "100%", overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, backgroundColor: "#fff" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {sizeGuideHeaders.map((h: string) => (
                          <th key={h} style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", padding: "7px 10px", textAlign: "left", fontWeight: 700, color: "#111", background: "#f8f8f8", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sizeGuideRows.map((row: string[], rIdx: number) => (
                        <tr key={rIdx} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: rIdx % 2 === 1 ? "#fafafa" : "#fff" }}>
                          {row.map((col: string, cIdx: number) => (
                            <td key={cIdx} style={{ padding: "7px 10px", color: cIdx === 0 ? "#111" : "#555", fontWeight: cIdx === 0 ? 700 : 500 }}>
                              {col}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sticky Action Buttons inside Single Product View (Explore More & Add to Bundle) */}
            <div style={{
              padding: "10px 14px",
              borderTop: "1px solid rgba(0, 0, 0, 0.08)",
              backgroundColor: "#ffffff",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 10
            }}>
              {/* Left Button: Explore More in Red */}
              <button
                type="button"
                onClick={handleExploreMore}
                style={{
                  flex: 1,
                  padding: "11px 8px",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "1px solid #b91c1c",
                  borderRadius: "4px",
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  transition: "opacity 0.15s, background 0.15s"
                }}
              >
                Explore More
              </button>

              {/* Right Button: Add to Bundle in Green */}
              <button
                type="button"
                onClick={handleConfirmSizingView}
                style={{
                  flex: 1,
                  padding: "11px 8px",
                  backgroundColor: "#166534",
                  color: "#ffffff",
                  border: "1px solid #14532d",
                  borderRadius: "4px",
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  transition: "opacity 0.15s, background 0.15s"
                }}
              >
                Add to Bundle
              </button>
            </div>
          </div>
        ) : (
          /* --- MAIN 2-COLUMN PRODUCT LISTING VIEW --- */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* ======================================================== */}
            {/* STICKY MAIN CATEGORIES BAR (CENTERED, MINIMAL HEIGHT) */}
            {/* ======================================================== */}
            <div style={{
              backgroundColor: "#ffffff",
              borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
              padding: "5px 8px 4px",
              flexShrink: 0,
              position: "sticky",
              top: 0,
              zIndex: 20,
              display: "flex",
              justifyContent: "center"
            }}>
              <div
                ref={mainCatScrollRef}
                className="cpm-hide-scrollbar"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 16,
                  overflowX: "auto",
                  scrollBehavior: "smooth",
                  maxWidth: "100%",
                  padding: "1px 4px"
                }}
              >
                {/* Dynamic Main Categories Only (Centered) */}
                {categories.map((cat) => {
                  const isCatActive = selectedCategorySlug?.toLowerCase() === cat.slug.toLowerCase();
                  const catImg = getFullImgUrl(cat.image);

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategorySlug(cat.slug);
                        setSelectedSubcategorySlug(null);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        minWidth: 48,
                        padding: 0
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          overflow: "hidden",
                          position: "relative",
                          backgroundColor: "#f5f5f5",
                          border: isCatActive ? "2px solid #111111" : "1px solid rgba(0, 0, 0, 0.16)",
                          boxShadow: isCatActive ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
                          transition: "all 0.15s"
                        }}
                      >
                        {catImg ? (
                          <Image unoptimized src={catImg} alt={cat.name} fill style={{ objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "#666" }}>
                            {cat.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          marginTop: 2,
                          color: isCatActive ? "#111111" : "#777777",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ======================================================== */}
            {/* STICKY SUBCATEGORY MENU (MINIMAL HEIGHT, APPEARS ON CAT CLICK) */}
            {/* ======================================================== */}
            {activeSubcategories.length > 0 && (
              <div
                style={{
                  backgroundColor: "#161616",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "4px 4px 3px",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  position: "sticky",
                  top: 0,
                  zIndex: 19
                }}
              >
                {/* Scroll Left Button */}
                <button
                  type="button"
                  onClick={() => {
                    subCatScrollRef.current?.scrollBy({ left: -90, behavior: "smooth" });
                  }}
                  aria-label="Scroll subcategories left"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    border: "none",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    marginRight: 2
                  }}
                >
                  <ChevronLeft size={12} />
                </button>

                {/* Subcategory Row */}
                <div
                  ref={subCatScrollRef}
                  className="cpm-hide-scrollbar"
                  style={{
                    display: "flex",
                    gap: 10,
                    overflowX: "auto",
                    scrollBehavior: "smooth",
                    flex: 1,
                    padding: "0 2px"
                  }}
                >
                  {activeSubcategories.map((sub) => {
                    const isSubActive = selectedSubcategorySlug?.toLowerCase() === sub.slug.toLowerCase();
                    const subImg = getFullImgUrl(sub.image);

                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          if (isSubActive) {
                            setSelectedSubcategorySlug(null);
                          } else {
                            setSelectedSubcategorySlug(sub.slug);
                          }
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          minWidth: 48,
                          padding: 0
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            overflow: "hidden",
                            position: "relative",
                            backgroundColor: "#252525",
                            border: isSubActive ? "2px solid #38bdf8" : "2px solid transparent",
                            boxShadow: isSubActive ? "0 0 6px rgba(56, 189, 248, 0.4)" : "none",
                            transition: "all 0.15s"
                          }}
                        >
                          {subImg ? (
                            <Image unoptimized src={subImg} alt={sub.name} fill style={{ objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#888" }}>
                              {sub.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                            marginTop: 2,
                            color: isSubActive ? "#38bdf8" : "#cfcfcf",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {sub.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Scroll Right Button */}
                <button
                  type="button"
                  onClick={() => {
                    subCatScrollRef.current?.scrollBy({ left: 90, behavior: "smooth" });
                  }}
                  aria-label="Scroll subcategories right"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    border: "none",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    marginLeft: 2
                  }}
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            )}

            {/* ======================================================== */}
            {/* 2-COLUMN PRODUCT GRID */}
            {/* ======================================================== */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px", backgroundColor: "#f9f9f9" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#888", fontSize: 11.5, fontWeight: 600 }}>
                  Loading collection...
                </div>
              ) : products.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#888", fontSize: 11.5, fontWeight: 600 }}>
                  No matching products found.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px",
                    paddingBottom: "10px"
                  }}
                >
                  {products.map((product) => {
                    const isSelected = selectedProductId === product.id;
                    const origPrice = parseFloat(product.selling_price || product.price || product.base_price || 0);
                    const discPrice = Math.round(origPrice * (1 - discountPercentage / 100));
                    const imgUrl = product.images?.[0]?.url || "https://placehold.co/300x300?text=Product";

                    const varInfo = getProductVariationInfo(product, isSelected);

                    return (
                      <div
                        key={product.id}
                        onClick={() => handleToggleProduct(product)}
                        style={{
                          backgroundColor: "#ffffff",
                          border: isSelected ? (varInfo.hasConfigured ? "1.5px solid #166534" : "1.5px solid #111") : "1px solid rgba(0, 0, 0, 0.22)",
                          borderRadius: "6px",
                          padding: "7px",
                          display: "flex",
                          flexDirection: "column",
                          cursor: product.is_sold_out ? "not-allowed" : "pointer",
                          position: "relative",
                          opacity: product.is_sold_out ? 0.7 : 1,
                          transition: "all 0.15s ease",
                          boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none"
                        }}
                      >
                        {/* Checkbox UI on top-left */}
                        <div
                          style={{
                            position: "absolute",
                            top: 7,
                            left: 7,
                            zIndex: 2,
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: isSelected ? (varInfo.hasConfigured ? "1.5px solid #14532d" : "1.5px solid #111") : "1.5px solid #888",
                            backgroundColor: isSelected ? (varInfo.hasConfigured ? "#166534" : "#111") : "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s"
                          }}
                        >
                          {isSelected && <Check size={13} color="#ffffff" strokeWidth={3} />}
                        </div>

                        {/* Product Image */}
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            paddingBottom: "100%",
                            backgroundColor: "#f5f5f5",
                            borderRadius: "5px",
                            overflow: "hidden",
                            marginBottom: "6px"
                          }}
                        >
                          <Image
                            unoptimized
                            src={imgUrl}
                            alt={product.name}
                            fill
                            style={{ objectFit: "contain" }}
                          />
                          {product.is_sold_out && (
                            <div
                              style={{
                                position: "absolute",
                                top: 6,
                                right: 6,
                                background: "#dc2626",
                                color: "#fff",
                                fontSize: 8,
                                fontWeight: 800,
                                padding: "2px 5px",
                                borderRadius: 2,
                                zIndex: 3,
                                textTransform: "uppercase"
                              }}
                            >
                              SOLD OUT
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "#111",
                            lineHeight: 1.25,
                            textTransform: "uppercase",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            minHeight: 26,
                            marginBottom: 3
                          }}
                        >
                          {product.name}
                        </div>

                        {/* Price */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
                          {discountPercentage > 0 && (
                            <span style={{ fontSize: 9.5, color: "#888", textDecoration: "line-through" }}>
                              Tk {Math.round(origPrice)}
                            </span>
                          )}
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#111" }}>
                            Tk {discPrice}
                          </span>
                          {product.is_sold_out && (
                            <span style={{ fontSize: 9.5, fontWeight: 800, color: "#dc2626", textTransform: "uppercase" }}>
                              SOLD OUT
                            </span>
                          )}
                        </div>

                        {/* Variation Action Button (Always visible on selected card) */}
                        {isSelected && (
                          <div style={{ marginTop: "auto", paddingTop: 3 }}>
                            <button
                              onClick={(e) => handleOpenSizingView(e, product)}
                              style={{
                                width: "100%",
                                padding: "5px 6px",
                                backgroundColor: varInfo.hasConfigured ? "#166534" : "#e11d48",
                                border: varInfo.hasConfigured ? "1px solid #14532d" : "1px solid #e11d48",
                                borderRadius: 4,
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                transition: "all 0.15s"
                              }}
                            >
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", lineHeight: 1.15, minWidth: 0 }}>
                                <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {varInfo.hasConfigured ? "VARIATION SELECTED" : varInfo.defaultTitle}
                                </span>
                                <span style={{ fontSize: 8, opacity: 0.9, fontWeight: 600, color: "#ffffff" }}>
                                  {varInfo.hasConfigured ? varInfo.selectionDetails : "Tap to select variation"}
                                </span>
                              </div>
                              <ChevronDown size={12} color="#ffffff" style={{ flexShrink: 0, marginLeft: 3 }} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* STICKY CONFIRM PRODUCT BOTTOM BAR (ON CHOOSE PRODUCT PAGE) */}
            {/* ======================================================== */}
            <div style={{
              padding: "10px 14px",
              borderTop: "1px solid rgba(0, 0, 0, 0.08)",
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flexShrink: 0,
              boxShadow: "0 -4px 15px rgba(0, 0, 0, 0.06)",
              zIndex: 30
            }}>
              {/* Product Info & Error notice */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 18 }}>
                <span style={{ fontSize: 11.5, color: "#444", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedProduct ? `Selected: ${selectedProduct.name}` : `Please tap a product to select`}
                </span>
                {selectedProduct && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: (modalAttributes.size || modalAttributes.color) ? "#16a34a" : "#e11d48" }}>
                    {[modalAttributes.size, modalAttributes.color].filter(Boolean).join(" • ") || "No variation selected"}
                  </span>
                )}
              </div>

              {errorNotice && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#e11d48", fontSize: 11, fontWeight: 700 }}>
                  <AlertCircle size={13} />
                  <span>{errorNotice}</span>
                </div>
              )}

              {/* Prominent Sticky Confirm Product Button */}
              <button
                onClick={handleConfirmProduct}
                disabled={!selectedProductId}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: selectedProductId ? "#111111" : "#cccccc",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  cursor: selectedProductId ? "pointer" : "not-allowed",
                  letterSpacing: "0.5px",
                  transition: "background 0.15s"
                }}
              >
                Confirm Product
              </button>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cpm-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.76);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 99999999 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: cpmFadeIn 0.2s ease-out;
        }
        body.cpm-modal-open .mobile-bottom-nav,
        body.cpm-modal-open .music-toggle-btn {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -1 !important;
        }
        .cpm-dialog {
          background-color: #ffffff;
          width: 100%;
          max-width: 500px;
          height: 88vh;
          max-height: 88vh;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
          position: relative;
          animation: cpmPop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cpm-hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .cpm-hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes cpmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cpmPop {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (max-width: 640px) {
          .cpm-backdrop {
            padding: 0 !important;
          }
          .cpm-dialog {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}} />
    </div>,
    document.body
  );
}
