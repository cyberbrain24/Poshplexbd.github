"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, ShoppingBag, User, Music } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useMusic } from "../../context/MusicContext";
// [TEMPORARY DISCONNECT] AI Fit Check module temporarily disconnected
// import { Sparkles } from "lucide-react";
// import { useFitCheckConfig } from "../hooks/useFitCheckConfig";
// import VirtualTryOnModal from "./VirtualTryOnModal";

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount, openCart, closeCart, isCartOpen } = useCart();
  const { isPlaying, play, pause, isMinimized, toggleMinimize, isMusicActive } = useMusic();
  // [TEMPORARY DISCONNECT] AI Fit Check disabled temporarily
  const isFitCheckActive = false;
  // const [isGlobalFitModalOpen, setIsGlobalFitModalOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  useEffect(() => {
    const handleMenuState = (e: any) => {
      if (e?.detail && typeof e.detail.isOpen === "boolean") {
        setIsCategoryMenuOpen(e.detail.isOpen);
      }
    };
    document.addEventListener("mobile-menu-state", handleMenuState);
    return () => document.removeEventListener("mobile-menu-state", handleMenuState);
  }, []);

  const handleNavCloseMenus = () => {
    closeCart();
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("close-mobile-menu"));
    }
  };

  const handleAiFitCheckClick = () => {
    if (!isFitCheckActive) return;
    handleNavCloseMenus();
    if (pathname.startsWith("/product/")) {
      document.dispatchEvent(new CustomEvent("open-ai-fit-check"));
    }
  };

  return (
    <>
      <div className="mobile-bottom-nav">
        {/* 5-Tab Grid layout */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", height: "100%", width: "100%", position: "relative" }}>
          
          {/* Home */}
          <Link href="/" onClick={handleNavCloseMenus} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none", color: pathname === "/" && !isCategoryMenuOpen ? "var(--text-main)" : "var(--text-muted)", gap: 4, flex: 1 }}>
            <Home size={20} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Home</span>
          </Link>

          {/* Category */}
          <Link 
            href="/catalog" 
            className="category-toggle-btn"
            onClick={(e) => {
              if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent("toggle-mobile-menu"));
                closeCart();
              } else {
                closeCart();
              }
            }} 
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none", color: (pathname.startsWith("/catalog") || isCategoryMenuOpen) ? "var(--text-main)" : "var(--text-muted)", gap: 4, flex: 1 }}
          >
            <Grid size={20} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Category</span>
          </Link>

          {/* Music Play / Pause / Expand Controller */}
          {isMusicActive && (
            <div style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative", height: "100%" }}>
              <button 
                id="mobile-music-btn"
                className="music-nav-btn music-toggle-btn"
                aria-label={isPlaying ? "Music Playing - Open Controls" : "Play Music & Open Controls"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPlaying) {
                    play();
                  }
                  if (isMinimized) {
                    toggleMinimize();
                  } else if (isPlaying) {
                    toggleMinimize();
                  }
                }}
                style={{ 
                  position: "absolute",
                  bottom: 14,
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: isPlaying ? "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)" : "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
                  color: "#ffffff",
                  border: "2.5px solid var(--bg-primary, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: isPlaying ? "0 4px 14px rgba(225, 29, 72, 0.45)" : "0 3px 10px rgba(0, 0, 0, 0.25)",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  padding: 0,
                  zIndex: 2
                }}
              >
                <Music 
                  size={19} 
                  color="#ffffff"
                  style={{
                    animation: isPlaying ? "musicSpin 3s linear infinite" : "none"
                  }}
                />
              </button>
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPlaying) play();
                  toggleMinimize();
                }}
                style={{ 
                  position: "absolute",
                  bottom: 2,
                  fontSize: 8.5, 
                  fontWeight: 800, 
                  textTransform: "uppercase", 
                  letterSpacing: "0.4px",
                  color: isPlaying ? "#e11d48" : "var(--text-muted)",
                  whiteSpace: "nowrap",
                  cursor: "pointer"
                }}
              >
                {isPlaying ? "PLAYING" : "MUSIC"}
              </span>
            </div>
          )}

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
          <Link href="/profile" onClick={handleNavCloseMenus} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none", color: pathname === "/profile" ? "var(--text-main)" : "var(--text-muted)", gap: 4, flex: 1 }}>
            <User size={20} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Account</span>
          </Link>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes musicSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .music-nav-btn:active {
            transform: scale(0.92);
          }
          @keyframes aiSparklePulse {
            0%, 100% {
              transform: scale(1) rotate(0deg);
              filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
            }
            50% {
              transform: scale(1.12) rotate(10deg);
              filter: drop-shadow(0 0 9px rgba(255, 255, 255, 1));
            }
          }
          .ai-fit-check-nav-btn:active {
            transform: scale(0.92);
          }
        `}} />
      </div>

      {/* [TEMPORARY DISCONNECT] Global Virtual Try-On Modal disconnected temporarily */}
      {/* <VirtualTryOnModal
        isOpen={isGlobalFitModalOpen}
        onClose={() => setIsGlobalFitModalOpen(false)}
        product={{
          id: "poshplex-signature",
          name: "PoshPlex Signature Fit Check",
          image_url: "/logo.png"
        }}
      /> */}
    </>
  );
}
