"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, Music, ShoppingBag, User } from "lucide-react";
import { useCart } from "../../context/CartContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount, openCart, closeCart, isCartOpen } = useCart();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const handleMusicState = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.isPlaying !== undefined) {
        setIsPlaying(customEvent.detail.isPlaying);
      }
    };
    document.addEventListener("music-state", handleMusicState);
    return () => {
      document.removeEventListener("music-state", handleMusicState);
    };
  }, []);

  const handleMusicToggle = () => {
    document.dispatchEvent(new CustomEvent("toggle-music"));
  };

  return (
    <div className="mobile-bottom-nav">
      {/* 5-Tab Grid layout */}
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", height: "100%", width: "100%", position: "relative" }}>
        
        {/* Home */}
        <Link href="/" onClick={closeCart} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none", color: pathname === "/" ? "var(--text-main)" : "var(--text-muted)", gap: 4, flex: 1 }}>
          <Home size={20} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Home</span>
        </Link>

        {/* Category */}
        <Link 
          href="/catalog" 
          className="category-toggle-btn"
          onClick={(e) => {
            if (typeof window !== "undefined" && window.innerWidth <= 768) {
              e.preventDefault();
              document.dispatchEvent(new CustomEvent("toggle-mobile-menu"));
              closeCart();
            } else {
              closeCart();
            }
          }} 
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none", color: pathname.startsWith("/catalog") ? "var(--text-main)" : "var(--text-muted)", gap: 4, flex: 1 }}
        >
          <Grid size={20} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Category</span>
        </Link>

        {/* Music Button - Raised Circular Center */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative", height: "100%" }}>
          <button 
            className="music-toggle-btn"
            onClick={() => { handleMusicToggle(); closeCart(); }}
            style={{ 
              position: "absolute",
              bottom: 12,
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: isPlaying ? "#e11d48" : "#2e2e2e",
              color: "#ffffff",
              border: "4px solid var(--bg-primary)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 -2px 10px rgba(0,0,0,0.15)",
              transition: "all 0.3s ease",
              padding: 0
            }}
          >
            <Music 
              size={18} 
              style={{ 
                animation: isPlaying ? "spin 4s linear infinite" : "none" 
              }} 
            />
          </button>
          <span style={{ 
            position: "absolute",
            bottom: 4,
            fontSize: 10, 
            fontWeight: 700, 
            textTransform: "uppercase", 
            letterSpacing: "0.5px",
            color: isPlaying ? "#e11d48" : "var(--text-muted)"
          }}>
            Music
          </span>
        </div>

        {/* Cart */}
        <button 
          onClick={isCartOpen ? closeCart : openCart} 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: isCartOpen ? "var(--text-main)" : "var(--text-muted)", 
            gap: 4, 
            position: "relative", 
            flex: 1 
          }}
        >
          <ShoppingBag size={20} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Cart</span>
          {cartCount > 0 && (
            <span 
              style={{
                position: "absolute",
                top: -4,
                right: "22%",
                background: "#ef4444",
                color: "#ffffff",
                fontSize: 8,
                fontWeight: 900,
                padding: "2px 5px",
                lineHeight: 1,
                borderRadius: "50%"
              }}
            >
              {cartCount}
            </span>
          )}
        </button>

        {/* Account */}
        <Link href="/profile" onClick={closeCart} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none", color: pathname === "/profile" ? "var(--text-main)" : "var(--text-muted)", gap: 4, flex: 1 }}>
          <User size={20} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Account</span>
        </Link>
      </div>
    </div>
  );
}
