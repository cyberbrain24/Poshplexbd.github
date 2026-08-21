"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Star, ChevronDown, ChevronUp, Minus, Plus, Camera, X, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { useCart } from "../../../context/CartContext";
import ProductCard from "../../components/ProductCard";
import * as fpixel from "../../../lib/fpixel";

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

const getAttributeWeight = (k: string) => {
  const lower = k.toLowerCase();
  if (lower === 'color' || lower === 'colour') return 1;
  if (lower === 'size') return 2;
  return 3;
};

/* ─── accordion ─────────────────────────────────────── */
type AccordionSection = "description" | "sizeGuide" | "care" | "reviews";


export default function ProductDetailClient({ 
  product, 
  initialReviews = [], 
  initialRelatedProducts = [] 
}: { 
  product: any, 
  initialReviews?: any[], 
  initialRelatedProducts?: any[] 
}) {
  const router = useRouter();
  const { addToCart } = useCart();

  /* variant state */
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useEffect(() => {
    if (product) {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(() => {
          fpixel.trackEvent("ViewContent", {
            content_name: product.name,
            content_ids: [product.sku || product.id],
            content_type: "product",
            value: parseFloat(product.selling_price || product.price || product.base_price || 0),
            currency: "BDT",
          });
        });
      } else {
        setTimeout(() => {
          fpixel.trackEvent("ViewContent", {
            content_name: product.name,
            content_ids: [product.sku || product.id],
            content_type: "product",
            value: parseFloat(product.selling_price || product.price || product.base_price || 0),
            currency: "BDT",
          });
        }, 1000);
      }
    }
  }, [product]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wishlist");
      if (stored) {
        try {
          const list = JSON.parse(stored);
          if (Array.isArray(list) && list.includes(product.id)) {
            setWishlisted(true);
          }
        } catch (e) { }
      }
    }
  }, [product.id]);

  const handleWishlistToggle = () => {
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
        window.dispatchEvent(new Event("wishlist_updated"));
      }
      return next;
    });
  };

  /* accordion: only one open at a time, like poshplexbd */
  const [openSection, setOpenSection] = useState<AccordionSection | null>(null);
  const toggleSection = (s: AccordionSection) =>
    setOpenSection((prev) => (prev === s ? null : s));

  /* active gallery image (desktop: vertical stack — click to zoom) */
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  /* reviews */
  const [reviews, setReviews] = useState<any[]>(initialReviews);
  const [avgRating, setAvgRating] = useState(() => {
    if (initialReviews.length) {
      const sum = initialReviews.reduce((a: number, r: any) => a + r.rating, 0);
      return +(sum / initialReviews.length).toFixed(1);
    }
    return product.rating_average || 0;
  });
  const [reviewCount, setReviewCount] = useState(initialReviews.length || product.rating_count || 0);
  const [relatedProducts, setRelatedProducts] = useState<any[]>(initialRelatedProducts);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);

  /* review form */
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [attachedPhotos, setAttachedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewIsApproved, setReviewIsApproved] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  /* ── check user review ── */
  useEffect(() => {
    const checkMyReview = async () => {
      const token = localStorage.getItem("poshplex_access_token");
      if (!token) return;
      try {
        const res = await fetchWithAuth(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/my-reviews`);
        if (res.ok) {
          const data = await res.json();
          const myReview = data.find((r: any) => r.product_id === product.id);
          if (myReview) {
            setHasReviewed(true);
            setReviewIsApproved(myReview.is_approved);
            setReviewRating(myReview.rating);
            setReviewComment(myReview.comment);
            setAttachedPhotos(myReview.images || []);
          }
        }
      } catch { }
    };
    checkMyReview();
  }, [product.id]);

  /* ── auto-open review form if edit_review is true ── */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit_review") === "true") {
        setShowReviewForm(true);
      }
    }
  }, []);

  /* ── variant helpers ── */
  const attributeGroups: Record<string, Set<string>> = {};
  (product.variants || []).forEach((v: any) => {
    Object.entries(v.attributes || {}).forEach(([k, val]) => {
      if (!attributeGroups[k]) attributeGroups[k] = new Set();
      attributeGroups[k].add(val as string);
    });
  });

  /* Auto-select single variation */
  useEffect(() => {
    const autoSelect: Record<string, string> = {};
    let changed = false;
    Object.entries(attributeGroups).forEach(([k, valueSet]) => {
      if (valueSet.size === 1) {
        const val = Array.from(valueSet)[0];
        if (selectedAttributes[k] !== val) {
          autoSelect[k] = val;
          changed = true;
        }
      }
    });
    if (changed) {
      setSelectedAttributes(prev => ({ ...prev, ...autoSelect }));
    }
  }, [product.variants]);

  const selectAttr = (key: string, val: string) => {
    setSelectedAttributes((prev) => ({ ...prev, [key]: val }));
  };

  const matchedVariant = product.variants?.find((v: any) =>
    Object.entries(selectedAttributes).every(([k, val]) => v.attributes[k] === val)
  ) || null;

  useEffect(() => {
    if (Object.keys(selectedAttributes).length > 0 && matchedVariant && matchedVariant.image_id) {
      const idx = product.images?.findIndex((img: any) => img.id === matchedVariant.image_id);
      if (idx !== undefined && idx !== -1) {
        setActiveImageIdx(idx);
        const el = document.getElementById("gallery-scroll-container");
        if (el) {
          el.scrollTo({ left: el.clientWidth * idx, behavior: "smooth" });
        }
      }
    }
  }, [selectedAttributes, matchedVariant, product.images]);

  const allSelected =
    Object.keys(attributeGroups).length === 0 ||
    Object.keys(attributeGroups).every((k) => selectedAttributes[k]);

  /* ── images ── */
  const images: any[] = product.images || [];
  const mainImage =
    images.find((i) => i.is_main) || images[0];

  /* ── add to cart ── */
  const handleAddToCart = () => {
    const hasAttributes = Object.keys(attributeGroups).length > 0;
    if (hasAttributes && (!allSelected || !matchedVariant)) return;

    const img = matchedVariant
      ? (images.find((i: any) => i.id === matchedVariant.image_id)?.url || mainImage?.url || "")
      : (mainImage?.url || "");
      
    const finalSku = matchedVariant ? matchedVariant.sku : product.sku;
    const finalPrice = matchedVariant 
      ? parseFloat(matchedVariant.selling_price || matchedVariant.price)
      : parseFloat(product.selling_price || product.price || product.base_price || 0);
    const finalAttributes = matchedVariant ? matchedVariant.attributes : {};

    addToCart({
      sku: finalSku || `PROD-${product.id}`,
      name: product.name,
      price: finalPrice,
      quantity,
      image: img,
      attributes: finalAttributes,
    });
  };

  /* ── photo upload ── */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const token = localStorage.getItem("poshplex_access_token");
    if (!token) { router.push(`/login?next=/product/${product.slug}`); return; }
    if (attachedPhotos.length + files.length > 3) { alert("Max 3 photos."); return; }
    setUploading(true);
    const urls = [...attachedPhotos];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      if (product?.id) {
        fd.append("product_id", product.id.toString());
      }
      try {
        const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_URL}/api/v1/catalog/reviews/upload-photo`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        if (res.ok) urls.push((await res.json()).url);
        else urls.push(URL.createObjectURL(file));
      } catch { urls.push(URL.createObjectURL(file)); }
    }
    setAttachedPhotos(urls);
    setUploading(false);
  };

  /* ── submit review ── */
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("poshplex_access_token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetchWithAuth(
        `${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/products/${product.slug}/reviews`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            rating: reviewRating,
            comment: reviewComment,
            photos: attachedPhotos,
          }),
        }
      );
      if (res.ok) {
        setHasReviewed(true);
        setSubmitMsg("Review submitted! It will appear after approval.");
        setShowReviewForm(false);
        setTimeout(() => setSubmitMsg(""), 6000);
      } else {
        const err = await res.json();
        setSubmitMsg(err.detail || "Failed to submit review.");
      }
    } catch {
      setSubmitMsg("Network error. Please try again.");
    }
  };

  /* ── price to display ── */
  const displayPrice = matchedVariant
    ? formatBDT(matchedVariant.selling_price || matchedVariant.price)
    : (() => {
      const vs = (product.variants || []).filter((v: any) => v.is_active !== false);
      if (!vs.length) return formatBDT(product.base_price || 0);
      const prices = vs.map((v: any) => parseFloat(v.selling_price || v.price || 0));
      const lo = Math.round(Math.min(...prices));
      const hi = Math.round(Math.max(...prices));
      return lo === hi ? formatBDT(lo) : `${formatBDT(lo)} – ${formatBDT(hi)}`;
    })();

  /* ── gallery scroll tracker ── */
  const handleGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const clientWidth = target.clientWidth;
    if (clientWidth > 0) {
      const idx = Math.round(scrollLeft / clientWidth);
      if (idx !== activeImageIdx) {
        setActiveImageIdx(idx);
      }
    }
  };
  const missingKeys = Object.keys(attributeGroups).filter(k => !selectedAttributes[k]);
  const placeholderText = missingKeys.length > 0
    ? `CHOOSE ${missingKeys.map(k => k.toLowerCase()).join(" & ")}`
    : "SELECT OPTIONS";

  const handlePlaceholderClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="product-page-wrapper" style={{ background: "#fff", minHeight: "100vh" }}>

      {/* ── TOP: Two-column layout ── */}
      <div
        className="product-two-col"
        style={{
          display: "grid",
          gap: 0,
          maxWidth: 1400,
          margin: "0 auto",
          alignItems: "start",
          padding: "0 0",
        }}
      >

        {/* LEFT: Image Gallery */}
        <div className="product-gallery-container" style={{ position: "relative", width: "100%", background: "#f0f0f3", overflow: "hidden" }}>
          <div
            className="product-gallery-inner hide-scrollbar"
            style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", width: "100%", cursor: "zoom-in", scrollBehavior: "smooth" }}
            onScroll={handleGalleryScroll}
            id="gallery-scroll-container"
          >
            {images.length > 0 ? (
              images.map((img: any, idx: number) => (
                <div key={idx} suppressHydrationWarning style={{ flex: "0 0 100%", scrollSnapAlign: "start", position: "relative", width: "100%", aspectRatio: "1/1" }}>
                  <img
                    src={img.url || "https://placehold.co/600x600/f0f0f0/999.png?text=No+Image"}
                    alt={`${product.name} view ${idx + 1}`}
                    className="product-hero-img object-contain"
                    style={{ width: "100%", height: "100%", objectFit: 'contain', position: 'absolute', top: 0, left: 0 }}
                    onClick={() => setLightboxUrl(img.url)}
                  />
                </div>
              ))
            ) : (
              <div suppressHydrationWarning style={{ flex: "0 0 100%", scrollSnapAlign: "start", position: "relative", width: "100%", aspectRatio: "1/1" }}>
                <img
                  src={`https://placehold.co/600x600/f0f0f0/999.png?text=${encodeURIComponent(product.name)}`}
                  alt={product.name}
                  className="product-hero-img object-contain"
                  style={{ width: "100%", height: "100%", objectFit: 'contain', position: 'absolute', top: 0, left: 0 }}
                />
              </div>
            )}
          </div>

          {/* Slider Controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const el = document.getElementById("gallery-scroll-container");
                  if (el) {
                    if (activeImageIdx === 0) {
                      el.scrollTo({ left: el.clientWidth * (images.length - 1), behavior: "smooth" });
                    } else {
                      el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
                    }
                  }
                }}
                style={{
                  position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.8)", border: "none", width: 40, height: 40,
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.8)")}
              >
                <ChevronLeft size={24} color="#111" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const el = document.getElementById("gallery-scroll-container");
                  if (el) {
                    if (activeImageIdx === images.length - 1) {
                      el.scrollTo({ left: 0, behavior: "smooth" });
                    } else {
                      el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
                    }
                  }
                }}
                style={{
                  position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.8)", border: "none", width: 40, height: 40,
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.8)")}
              >
                <ChevronRight size={24} color="#111" />
              </button>

              <div style={{
                position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                display: "flex", gap: 8, zIndex: 10
              }}>
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const el = document.getElementById("gallery-scroll-container");
                      if (el) el.scrollTo({ left: el.clientWidth * idx, behavior: "smooth" });
                    }}
                    style={{
                      width: activeImageIdx === idx ? 24 : 8,
                      height: 8,
                      borderRadius: 4,
                      background: activeImageIdx === idx ? "#111" : "rgba(0,0,0,0.2)",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      transition: "all 0.3s ease"
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Sticky info panel */}
        <div
          className="product-sticky-right"
          style={{
            position: "sticky",
            top: 0,
            padding: "40px 48px 40px 40px",
            maxHeight: "100vh",
            overflowY: "auto",
          }}
        >

          {/* Category breadcrumb — small blue text */}
          {(product.category?.name || product.categories?.[0]?.name) && (
            <p style={{ fontSize: 13, color: "#2563eb", marginBottom: 6, fontWeight: 400 }}>
              <Link href={`/catalog/${encodeURIComponent(product.category?.slug || product.categories?.[0]?.slug || "")}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                {product.category?.name || product.categories?.[0]?.name}
              </Link>
            </p>
          )}

          {/* Product name + heart on same row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <h1 className="product-title" style={{ color: "#111", margin: 0, textTransform: "uppercase" }}>
              {product.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 16, paddingTop: 2 }}>
              <span className="product-price-display" style={{ color: "#111" }}>{displayPrice}</span>
              <button
                onClick={handleWishlistToggle}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: wishlisted ? "#e11d48" : "#111" }}
              >
                <Heart size={20} fill={wishlisted ? "#e11d48" : "none"} />
              </button>
            </div>
          </div>

          {/* GSM / Composition specs */}
          {product.gsm && (
            <p style={{ fontSize: 13, color: "#888", marginBottom: 12, fontWeight: 400 }}>
              {product.gsm} GSM {product.composition ? `| ${product.composition}` : ""}
            </p>
          )}

          {/* Short description */}
          {product.short_description && (
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 1.6, fontStyle: "italic" }}>
              {product.short_description}
            </p>
          )}

          <div className="product-divider" style={{ borderTop: "1px solid #eee", paddingTop: 20, marginBottom: 20 }} />

          {/* ── Color & Size selectors side-by-side ── */}
          {Object.keys(attributeGroups).length > 0 && (
            <div className="product-selectors-container">
              {Object.entries(attributeGroups)
                .sort(([a], [b]) => {
                  const wA = getAttributeWeight(a);
                  const wB = getAttributeWeight(b);
                  if (wA !== wB) return wA - wB;
                  return a.localeCompare(b);
                })
                .map(([key, valueSet]) => {
                  const isColor = key.toLowerCase() === "color" || key.toLowerCase() === "colour";
                  return (
                    <div key={key}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#2f2f2f", marginBottom: 10, letterSpacing: "0.2px" }}>
                        Choose {key.charAt(0).toUpperCase() + key.slice(1)}
                      </p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} className="selectors-flex">
                        {Array.from(valueSet).map((val) => {
                          const isSelected = selectedAttributes[key] === val;
                          if (isColor) {
                            return (
                              <button
                                key={val}
                                title={val}
                                onClick={() => selectAttr(key, val)}
                                style={{
                                  width: 28, height: 28, borderRadius: "50%",
                                  background: toHex(val),
                                  border: "1px solid rgba(0,0,0,0.2)",
                                  outline: isSelected ? "2px solid #111" : "none",
                                  outlineOffset: 2,
                                  cursor: "pointer",
                                  transition: "outline 0.15s",
                                }}
                              />
                            );
                          }
                          return (
                            <button
                              key={val}
                              onClick={() => selectAttr(key, val)}
                              style={{
                                padding: "6px 14px",
                                border: isSelected ? "1.5px solid #111" : "1.5px solid #ddd",
                                background: isSelected ? "#111" : "#fff",
                                color: isSelected ? "#fff" : "#111",
                                fontSize: 13, fontWeight: 400,
                                cursor: "pointer", borderRadius: 2,
                                transition: "all 0.15s",
                                minWidth: 38,
                              }}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Quantity stepper */}
          <div className="product-qty-container" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: "#111", fontWeight: 400, minWidth: 60 }}>Quantity</span>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: 2 }}>
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}
              >
                <Minus size={14} />
              </button>
              <span style={{ width: 36, textAlign: "center", fontSize: 14, fontWeight: 500, color: "#111" }}>{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* State-dependent Action buttons */}
          <div className="product-action-buttons-wrapper">
            {allSelected ? (
              <>
                <button
                  onClick={handleAddToCart}
                  style={{
                    flex: 1, height: 48, fontSize: 13, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "1px",
                    background: "#111", color: "#fff", border: "none",
                    cursor: "pointer", transition: "background 0.2s", borderRadius: 0,
                  }}
                  onMouseEnter={e => (e.target as HTMLButtonElement).style.background = "#333"}
                  onMouseLeave={e => (e.target as HTMLButtonElement).style.background = "#111"}
                >
                  Add to Cart
                </button>
                <button
                  onClick={() => {
                    handleAddToCart();
                    router.push("/checkout");
                  }}
                  style={{
                    flex: 1, height: 48, fontSize: 13, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "1px",
                    background: "#fff", color: "#111", border: "2px solid #111",
                    cursor: "pointer", transition: "all 0.2s", borderRadius: 0,
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLButtonElement).style.background = "#111";
                    (e.target as HTMLButtonElement).style.color = "#fff";
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLButtonElement).style.background = "#fff";
                    (e.target as HTMLButtonElement).style.color = "#111";
                  }}
                >
                  Buy Now
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handlePlaceholderClick}
                  style={{
                    flex: 1, height: 48, fontSize: 11, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "1px",
                    background: "#f0f0f3", color: "#2f2f2f", border: "1px solid #ddd",
                    cursor: "pointer", borderRadius: 0,
                  }}
                >
                  {placeholderText}
                </button>
                <button
                  onClick={handlePlaceholderClick}
                  style={{
                    flex: 1, height: 48, fontSize: 11, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "1px",
                    background: "#fff", color: "#ccc", border: "2px dashed #ddd",
                    cursor: "pointer", borderRadius: 0,
                  }}
                >
                  Buy Now
                </button>
              </>
            )}
          </div>

          {/* Helper prompt */}
          {!allSelected && Object.keys(attributeGroups).length > 0 && (
            <p style={{ fontSize: 12, color: "#888", textAlign: "center", marginBottom: 16 }}>
              Please select {Object.keys(attributeGroups).sort((a, b) => getAttributeWeight(a) - getAttributeWeight(b)).join(" and ")} to view purchase actions
            </p>
          )}

          <div style={{ borderTop: "1px solid #eee", marginTop: 8 }} />

          {/* ── Accordions ── */}
          {([
            { key: "description" as AccordionSection, label: "Description", show: !!product.description },
            { key: "sizeGuide" as AccordionSection, label: "Size Guide", show: !!product.size_guide },
            { key: "care" as AccordionSection, label: "Care & Cleaning", show: !!product.care_instructions },
            { key: "reviews" as AccordionSection, label: `Customer Reviews`, badge: reviewCount, show: true },
          ] as { key: AccordionSection; label: string; badge?: number; show: boolean }[]).map(({ key, label, badge, show }) => {
            if (!show) return null;
            const isOpen = key === "reviews" ? true : openSection === key;
            return (
              <div key={key} style={{ borderBottom: "1px solid #eee" }}>
                <button
                  onClick={() => key !== "reviews" && toggleSection(key)}
                  className="accordion-toggle-btn"
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "16px 0", background: "none",
                    border: "none", cursor: key === "reviews" ? "default" : "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: isOpen ? 600 : 400, color: "#111", display: "flex", alignItems: "center", gap: 8 }}>
                    {label}
                    {badge != null && badge > 0 && (
                      <span style={{ background: "#111", color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {badge}
                      </span>
                    )}
                  </span>
                  {key !== "reviews" && (isOpen ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />)}
                </button>

                {isOpen && (
                  <div className="accordion-content-box" style={{ paddingBottom: 20 }}>

                    {/* Description */}
                    {key === "description" && (
                      <p style={{ fontSize: 13, color: "#555", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                        {product.description}
                      </p>
                    )}

                    {/* Size Guide table */}
                    {key === "sizeGuide" && product.size_guide && (
                      <div style={{ width: "100%", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              {product.size_guide.headers.map((h: string) => (
                                <th key={h} style={{ borderBottom: "1px solid #eee", padding: "8px 0", textAlign: "left", fontWeight: 600, color: "#111", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {product.size_guide.rows.map((row: string[], idx: number) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #f5f5f5" }}>
                                {row.map((col: string, ci: number) => (
                                  <td key={ci} style={{ padding: "10px 0", color: "#444", fontSize: 13 }}>{col}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Care instructions */}
                    {key === "care" && (
                      <p style={{ fontSize: 13, color: "#555", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                        {product.care_instructions}
                      </p>
                    )}

                    {/* Reviews section */}
                    {key === "reviews" && (
                      <div>
                        {/* Review product button */}
                        {!reviewIsApproved ? (
                          <button
                            onClick={() => setShowReviewForm(f => !f)}
                            style={{
                              width: "100%", padding: "13px 0", background: "#6b7280", color: "#fff",
                              border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
                              marginBottom: 16, borderRadius: 2, letterSpacing: "0.3px",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#e4e4e4")}
                            onMouseLeave={e => (e.currentTarget.style.background = "#f0f0f0")}
                          >
                            {hasReviewed ? "Edit your pending review" : "Review product"}
                          </button>
                        ) : (
                          <p style={{ fontSize: 13, color: "#16a34a", textAlign: "center", marginBottom: 16, padding: "12px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0" }}>
                            Your review has been published.
                          </p>
                        )}

                        {submitMsg && (
                          <p style={{ fontSize: 12, color: "#16a34a", textAlign: "center", marginBottom: 12 }}>{submitMsg}</p>
                        )}

                        {/* Review form */}
                        {showReviewForm && !reviewIsApproved && (
                          <form onSubmit={handleSubmitReview} style={{ border: "1px solid #eee", padding: 20, borderRadius: 4, marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                            {/* Star rating picker */}
                            <div>
                              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 8 }}>Your Rating</label>
                              <div style={{ display: "flex", gap: 4 }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                  <button key={s} type="button" onClick={() => setReviewRating(s)}
                                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                                  >
                                    <Star size={20} fill={s <= reviewRating ? "#111" : "none"} color="#111" />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Comment</label>
                              <textarea required value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                                rows={3} placeholder="Tell us about fit, fabric, quality…"
                                style={{ width: "100%", border: "1px solid #ddd", padding: "9px 12px", fontSize: 13, borderRadius: 2, resize: "none", outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                            {/* Photo attach */}
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              {attachedPhotos.map((url, i) => (
                                <div key={i} style={{ position: "relative", width: 52, height: 52 }}>
                                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, position: "absolute", top: 0, left: 0 }} />
                                  <button type="button" onClick={() => setAttachedPhotos(p => p.filter((_, j) => j !== i))}
                                    style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, background: "#e11d48", color: "#fff", border: "none", borderRadius: "50%", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                  >×</button>
                                </div>
                              ))}
                              {attachedPhotos.length < 3 && (
                                <label style={{ width: 52, height: 52, border: "1.5px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 4, color: "#999" }}>
                                  <Camera size={18} />
                                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploading} style={{ display: "none" }} />
                                </label>
                              )}
                            </div>
                            <button type="submit" style={{ background: "#111", color: "#fff", border: "none", padding: "12px 0", fontSize: 13, cursor: "pointer", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <Send size={13} /> {hasReviewed ? "Update Review" : "Submit Review"}
                            </button>
                          </form>
                        )}

                        {/* Review cards — 3-column photo grid like poshplexbd */}
                        {reviews.length > 0 ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                            {reviews.map((rev) => {
                              const thumb = rev.images?.[0] || null;
                              return (
                                <div
                                  key={rev.id}
                                  style={{ position: "relative", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", display: "flex", flexDirection: "column" }}
                                >
                                  {thumb && (
                                    <div
                                      style={{ width: "100%", aspectRatio: "3/4", position: "relative", cursor: "zoom-in" }}
                                      onClick={() => setLightboxUrl(thumb)}
                                    >
                                      <img src={thumb} alt="Review" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0 }} />
                                    </div>
                                  )}
                                  <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                                    <div style={{ display: "flex", gap: 2, color: "var(--text-main)" }}>
                                      {[1, 2, 3, 4, 5].map(s => (
                                        <Star key={s} size={11} fill={s <= rev.rating ? "currentColor" : "none"} color={s <= rev.rating ? "var(--text-main)" : "var(--text-muted)"} strokeWidth={1.5} />
                                      ))}
                                    </div>
                                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, margin: 0, flex: 1 }}>
                                      {rev.comment}
                                    </p>
                                    <h3 style={{ fontSize: 12, fontWeight: 900, color: "var(--text-main)", textTransform: "uppercase", margin: 0 }}>
                                      {rev.username}
                                    </h3>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>
                            No reviews yet — be the first!
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Related Products ── */}
      <div className="related-products-wrapper">
        <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-glass)", paddingBottom: 16, marginBottom: 32 }}>
          You might also like
        </h2>
        {isRelatedLoading ? (
          <p style={{ fontSize: 13, color: "#888", textAlign: "center", padding: "20px 0" }}>Loading related drops...</p>
        ) : relatedProducts.length > 0 ? (
          <div className="related-products-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 24,
          }}>
            {relatedProducts.slice(0, 6).map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "#888", textAlign: "center", padding: "20px 0" }}>No related products found</p>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <button onClick={() => setLightboxUrl(null)}
            style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <X size={30} />
          </button>
          <div style={{ position: "relative", width: "80vw", height: "85vh" }}>
            <img src={lightboxUrl} alt="Zoomed" style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", top: 0, left: 0 }} />
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .product-page-wrapper {
          padding-bottom: 100px;
        }
        .product-gallery-container {
          position: relative;
          width: 100%;
        }
        .product-gallery-slider {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .product-gallery-slide {
          position: relative;
          width: 100%;
          aspect-ratio: 1/1;
          background: #f0f0f0;
          cursor: zoom-in;
        }
        .gallery-dots-indicator {
          display: none;
        }
        .related-products-wrapper {
          max-width: 1400px;
          margin: 64px auto 0;
          padding: 0 40px 80px;
        }
        .product-selectors-container {
          display: flex;
          gap: 32px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .product-action-buttons-wrapper {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .product-title {
          font-size: 26px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }
        .product-price-display {
          font-size: 18px;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .product-page-wrapper {
            padding-bottom: 140px !important;
          }
          .product-title {
            font-size: 20px !important;
            letter-spacing: -0.5px !important;
            line-height: 1.15 !important;
            font-weight: 800 !important;
          }
          .product-price-display {
            font-size: 15px !important;
          }
          .product-two-col {
            grid-template-columns: 1fr !important;
          }
          .product-sticky-right {
            position: static !important;
            max-height: none !important;
            padding: 16px 16px !important;
            overflow-y: visible !important;
          }
          .product-gallery-slider {
            flex-direction: row !important;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            scroll-behavior: smooth;
            gap: 0;
            -webkit-overflow-scrolling: touch;
          }
          .product-gallery-slider::-webkit-scrollbar {
            display: none;
          }
          .product-gallery-slide {
            min-width: 100%;
            scroll-snap-align: start;
          }
          .gallery-dots-indicator {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 12px;
            margin-bottom: 8px;
          }
          .gallery-dots-indicator .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #e5e5e5;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .gallery-dots-indicator .dot.active {
            background: #111;
            transform: scale(1.2);
          }
          .related-products-wrapper {
            margin-top: 24px !important;
            padding: 0 16px 40px !important;
          }
          .related-products-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
          }
          .product-selectors-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            margin-bottom: 12px !important;
          }
          .product-selectors-container > div {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 16px !important;
            width: 100% !important;
            margin-bottom: 0 !important;
          }
          .product-selectors-container > div > p {
            margin-bottom: 0 !important;
            min-width: 60px !important;
            text-align: left !important;
          }
          .selectors-flex {
            justify-content: flex-start !important;
            flex: 1 !important;
          }
          .product-qty-container {
            justify-content: flex-start !important;
            margin-bottom: 12px !important;
            gap: 16px !important;
          }
          .product-qty-container > span {
            min-width: 60px !important;
            text-align: left !important;
          }
          .product-divider {
            padding-top: 12px !important;
            margin-bottom: 12px !important;
          }
          .accordion-toggle-btn {
            padding: 10px 0 !important;
          }
          .accordion-content-box {
            padding-bottom: 12px !important;
          }
          .product-action-buttons-wrapper {
            position: fixed !important;
            bottom: 64px !important;
            left: 0 !important;
            right: 0 !important;
            background: #fff !important;
            border-top: 1px solid #eee !important;
            padding: 10px 16px !important;
            margin-bottom: 0 !important;
            z-index: 1000 !important;
            box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08) !important;
          }
        }

        @media (max-width: 480px) {
          .related-products-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      ` }} />
    </div>
  );
}
