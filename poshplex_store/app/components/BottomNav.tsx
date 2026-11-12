"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, ShoppingBag, User } from "lucide-react";
import { useCart } from "../../context/CartContext";
// [TEMPORARY DISCONNECT] AI Fit Check module temporarily disconnected
// import { Sparkles } from "lucide-react";
// import { useFitCheckConfig } from "../hooks/useFitCheckConfig";
// import VirtualTryOnModal from "./VirtualTryOnModal";

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount, openCart, closeCart, isCartOpen } = useCart();
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

          {/* [TEMPORARY DISCONNECT] AI FIT CHECK Button temporarily disconnected */}
          {/* {isFitCheckActive && (
            <div style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative", height: "100%" }}>
              <button 
                id="mobile-ai-fit-check-btn"
                className="ai-fit-check-nav-btn"
                aria-label="AI Fit Check"
                onClick={handleAiFitCheckClick}
                style={{ 
                  position: "absolute",
                  bottom: 16,
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #06b6d4 100%)",
                  color: "#ffffff",
                  border: "3px solid var(--bg-primary, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(124, 58, 237, 0.5), 0 0 12px rgba(236, 72, 153, 0.35)",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  padding: 0,
                  zIndex: 2
                }}
              >
                <Sparkles 
                  size={21} 
                  color="#ffffff"
                  style={{
                    filter: "drop-shadow(0 0 4px rgba(255, 255, 255, 0.9))",
                    animation: "aiSparklePulse 2.5s ease-in-out infinite"
                  }}
                />
              </button>
              <span style={{ 
                position: "absolute",
                bottom: 2,
                fontSize: 8.5, 
                fontWeight: 800, 
                textTransform: "uppercase", 
                letterSpacing: "0.3px",
                color: "#7c3aed",
                whiteSpace: "nowrap"
              }}>
                AI FIT CHECK
              </span>
            </div>
          )} */}

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
