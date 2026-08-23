"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "../../context/CartContext";

const formatBDT = (n: number) => `৳${Math.round(n)}`;

export default function CartDrawer() {
  const { cart, isCartOpen, closeCart, removeFromCart, updateQuantity, cartTotal, cartCount, toastItem } = useCart();
  const pathname = usePathname();

  /* close drawer on navigation changes */
  useEffect(() => {
    closeCart();
  }, [pathname, closeCart]);

  /* lock body scroll when drawer is open */
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isCartOpen]);

  /* close on Escape key */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeCart(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeCart]);

  return (
    <>
      {/* ── Dark overlay ── */}
      <div
        onClick={closeCart}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 1000,
          opacity: isCartOpen ? 1 : 0,
          pointerEvents: isCartOpen ? "all" : "none",
          transition: "opacity 0.3s ease",
        }}
      />

      {/* ── Drawer panel ── */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 400,
          background: "#fff",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          transform: isCartOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-12px 0 48px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 24px", borderBottom: "1px solid #eee",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#111" }}>
            Shopping Bag
          </h2>
          <button
            onClick={closeCart}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 4, display: "flex" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Item list — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 80, color: "#aaa" }}>
              <ShoppingBag size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>Your bag is empty</p>
              <button
                onClick={closeCart}
                style={{ marginTop: 20, padding: "10px 28px", border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer", borderRadius: 2, color: "#111" }}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {cart.map((item) => (
                <div
                  key={item.sku}
                  style={{
                    display: "flex", gap: 14, padding: "18px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: 72, height: 90, background: "#f5f5f5", flexShrink: 0, position: "relative", borderRadius: 2, overflow: "hidden" }}>
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill sizes="72px" style={{ objectFit: "cover" }} />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ShoppingBag size={24} color="#ccc" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name + price */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </p>
                        {/* Attributes */}
                        {Object.entries(item.attributes || {}).length > 0 && (
                          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                            {Object.values(item.attributes).join(" / ")}
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#111", marginLeft: 12, flexShrink: 0 }}>
                        {formatBDT(item.price)}
                      </span>
                    </div>

                    {/* Qty stepper + remove */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #e0e0e0", borderRadius: 2 }}>
                        <button
                          onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                          style={{ width: 28, height: 28, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 500, color: "#111" }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                          style={{ width: 28, height: 28, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.sku)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#aaa", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — subtotal + buttons (only when cart has items) */}
        {cart.length > 0 && (
          <div style={{ padding: "20px 24px", borderTop: "1px solid #eee" }}>
            {/* Subtotal */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: "#111", fontWeight: 500 }}>Subtotal</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{formatBDT(cartTotal)}</span>
            </div>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
              Shipping and taxes calculated at checkout.
            </p>

            {/* Proceed to Checkout */}
            <Link
              href="/checkout"
              onClick={closeCart}
              style={{
                display: "block", width: "100%", padding: "14px 0",
                background: "#111", color: "#fff", textAlign: "center",
                fontSize: 13, fontWeight: 500, textDecoration: "none",
                borderRadius: 2, marginBottom: 10,
                letterSpacing: "0.3px", boxSizing: "border-box",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#333")}
              onMouseLeave={e => (e.currentTarget.style.background = "#111")}
            >
              Proceed to Checkout
            </Link>

            {/* Continue shopping */}
            <button
              onClick={closeCart}
              style={{
                display: "block", width: "100%", padding: "13px 0",
                background: "#fff", color: "#111",
                border: "1px solid #ddd", fontSize: 13, fontWeight: 400,
                cursor: "pointer", borderRadius: 2, letterSpacing: "0.3px",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#999")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#ddd")}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>

      {/* ── Toast notification ── */}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: toastItem ? "translate(-50%, 0)" : "translate(-50%, 20px)",
          opacity: toastItem ? 1 : 0,
          pointerEvents: "none",
          transition: "all 0.3s ease",
          zIndex: 999999,
          background: "#fff",
          borderRadius: 8,
          padding: "14px 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          minWidth: 260,
          border: "1px solid #eee",
        }}
      >
        {toastItem && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: "0 0 2px" }}>
              {toastItem.name} added to cart
            </p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
              {Object.values(toastItem.attributes || {}).join(" ")}
              {toastItem.quantity > 1 ? ` × ${toastItem.quantity}` : ""}
            </p>
          </>
        )}
      </div>
    </>
  );
}
