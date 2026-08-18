"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";

const formatBDT = (n: string | number) => `৳${Math.round(Number(n))}`;

export default function ProductCard({
  product,
  priority = false,
  onRemove, // Used in Wishlist page
}: {
  product: any;
  priority?: boolean;
  onRemove?: (id: number) => void;
}) {
  const [wishlisted, setWishlisted] = useState(false);

  const mainImage = product.images?.find((i: any) => i.is_main) || product.images?.[0];
  const imageUrl = mainImage?.url || `https://placehold.co/400x500/ebebeb/333?text=${encodeURIComponent(product.name || "Product")}`;

  const displayPrice = (() => {
    const vs = (product.variants || []).filter((v: any) => v.is_active !== false);
    if (!vs.length) return formatBDT(product.base_price || 0);
    const prices = vs.map((v: any) => parseFloat(v.selling_price || v.price || 0));
    const lo = Math.round(Math.min(...prices));
    const hi = Math.round(Math.max(...prices));
    return lo === hi ? formatBDT(lo) : `${formatBDT(lo)} – ${formatBDT(hi)}`;
  })();

  // Initialize wishlist state
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
    e.stopPropagation();
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
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
      <Link
        href={`/product/${product.slug}`}
        prefetch={true}
        style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", flex: 1 }}
      >
        <div style={{ position: "relative", background: "#f0f0f0", overflow: "hidden", aspectRatio: "3/4" }}>
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 12.5vw"
            style={{
              objectFit: "cover",
              transition: "transform 0.4s ease",
            }}
          />
          {product.is_featured && (
            <div style={{ position: "absolute", top: 8, left: 8, background: "#111", color: "#fff", fontSize: 8, fontWeight: 800, letterSpacing: "1.2px", padding: "2px 6px" }}>
              NEW
            </div>
          )}
        </div>
        <div style={{ paddingTop: 8, paddingBottom: 4, flex: 1 }}>
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

      {/* Wishlist Remove Button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(product.id);
          }}
          style={{
            marginTop: 8,
            padding: "6px",
            background: "#ffebee",
            color: "#c8102e",
            border: "1px solid #ffcdd2",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "center"
          }}
        >
          Remove from Wishlist
        </button>
      )}

      {/* Heart button */}
      <button
        aria-label="Toggle Wishlist"
        onClick={handleWishlistToggle}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(6px)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          transition: "all 0.2s ease",
          zIndex: 10,
        }}
      >
        <Heart
          size={16}
          fill={wishlisted ? "#e11d48" : "none"}
          color={wishlisted ? "#e11d48" : "#111"}
          strokeWidth={2}
        />
      </button>


    </div>
  );
}
