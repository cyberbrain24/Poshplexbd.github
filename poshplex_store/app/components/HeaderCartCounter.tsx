"use client";

import React, { useState, useEffect } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../../context/CartContext";

export const HeaderCartCounter: React.FC = () => {
  const { cartCount, openCart } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      onClick={openCart}
      style={{
        background: "transparent",
        color: "var(--text-main)",
        border: "1px solid var(--text-main)",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.5px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: "0px", /* Sharp corners */
        position: "relative",
        textTransform: "uppercase",
        transition: "all 0.2s ease",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--text-main)";
        e.currentTarget.style.color = "var(--bg-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-main)";
      }}
    >
      <ShoppingBag size={14} />
      <span>Bag</span>
      {mounted && cartCount > 0 && (
        <span
          style={{
            background: "#ef4444", /* Alert red for visibility */
            color: "#ffffff",
            fontSize: 9,
            fontWeight: 800,
            borderRadius: "0px", /* Sharp corners */
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
            top: -8,
            right: -8,
            border: "1px solid var(--text-main)"
          }}
        >
          {cartCount}
        </span>
      )}
    </button>
  );
};
