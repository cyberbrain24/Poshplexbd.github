"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, Heart } from "lucide-react";
import ProductCard from "../components/ProductCard";

const formatBDT = (n: string | number) => `৳${Math.round(Number(n))}`;

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
        const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
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
              <ProductCard key={p.id} product={p} onRemove={handleRemove} />
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
