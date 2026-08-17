"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Trash2 } from "lucide-react";

const formatBDT = (n: string | number) => `৳${Math.round(Number(n))}`;

function WishlistProductCard({ product, onRemove }: { product: any; onRemove: (id: number) => void }) {
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
    <div style={{ position: "relative" }}>
      <Link
        href={`/product/${product.slug}`}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
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
            sizes="(max-width: 768px) 50vw, 25vw"
            style={{
              objectFit: "cover",
              transition: "transform 0.4s ease",
              transform: hovered ? "scale(1.04)" : "scale(1)",
            }}
          />
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
      
      {/* Remove from wishlist button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove(product.id);
        }}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.9)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
          zIndex: 2,
        }}
        title="Remove from wishlist"
      >
        <Trash2 size={14} color="#e11d48" />
      </button>
    </div>
  );
}

export default function WishlistPage() {
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load wishlist IDs from local storage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wishlist");
      if (stored) {
        try {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            setWishlistIds(list);
          }
        } catch (e) {
          console.error("Failed to parse wishlist");
        }
      }
    }
  }, []);

  useEffect(() => {
    if (wishlistIds.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        // Fetch products that match the wishlist IDs
        // In a real app with many products, you'd pass IDs to backend, here we fetch a batch
        const res = await fetch(`${API_URL}/api/v1/catalog/products?limit=500`);
        if (res.ok) {
          const data = await res.json();
          const allProducts = data.results || data || [];
          const wishlistedProducts = allProducts.filter((p: any) => wishlistIds.includes(p.id));
          setProducts(wishlistedProducts);
        }
      } catch (err) {
        console.error("Failed to load wishlist products:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [wishlistIds]);

  const handleRemove = (id: number) => {
    const newList = wishlistIds.filter(wid => wid !== id);
    setWishlistIds(newList);
    setProducts(products.filter(p => p.id !== id));
    if (typeof window !== "undefined") {
      localStorage.setItem("wishlist", JSON.stringify(newList));
      window.dispatchEvent(new Event("wishlist_updated"));
    }
  };

  return (
    <div style={{ background: "#fff", minHeight: "100vh", paddingTop: 40, paddingBottom: 100 }}>
      <div className="container" style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px" }}>
        
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
            My Wishlist
          </h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            {wishlistIds.length} {wishlistIds.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 32 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div style={{ aspectRatio: "3/4", background: "#f5f5f5", animation: "pulse 1.5s infinite" }} />
                <div style={{ marginTop: 12, height: 12, background: "#f5f5f5", width: "60%" }} />
                <div style={{ marginTop: 8, height: 16, background: "#f5f5f5", width: "40%" }} />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Heart size={48} color="#ccc" style={{ marginBottom: 16 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Your wishlist is empty</h2>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
              Save your favorite items to keep track of them.
            </p>
            <Link 
              href="/catalog" 
              style={{
                display: "inline-block",
                background: "#111",
                color: "#fff",
                padding: "12px 32px",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                textDecoration: "none"
              }}
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div 
            style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
              gap: "32px 16px" 
            }}
          >
            {products.map(p => (
              <WishlistProductCard key={p.id} product={p} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        @media (max-width: 768px) {
          .container > div:last-child {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px 8px !important;
          }
        }
      `}} />
    </div>
  );
}
