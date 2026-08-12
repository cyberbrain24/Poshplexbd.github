"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

type AccordionSection = "shop" | "about" | "legal";

export default function Footer() {
  const [openSection, setOpenSection] = useState<AccordionSection | null>(null);

  const toggleSection = (section: AccordionSection) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <footer style={{
      background: "#18181b",
      color: "rgba(255, 255, 255, 0.6)",
      padding: "60px 0 32px 0",
      borderTop: "1px solid rgba(255, 255, 255, 0.08)",
      fontSize: "13px"
    }}>
      <div className="container" style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px" }}>
        
        {/* Desktop Footer Grid */}
        <div className="desktop-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr", gap: 48, marginBottom: 48 }}>
          
          {/* Column 1: Brand & Newsletter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-1px", margin: "0 0 4px" }}>
                POSHPLEX
              </h2>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255, 255, 255, 0.4)", letterSpacing: "1.2px", textTransform: "uppercase", margin: 0 }}>
                BE POSH WITH POSHPLEX
              </p>
            </div>
            
            <div style={{ marginTop: 8 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>
                JOIN THE MOVEMENT
              </h4>
              <div style={{ display: "flex", width: "100%", maxWidth: 320 }}>
                <input
                  type="email"
                  placeholder="ENTER YOUR EMAIL"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1.5px solid rgba(255, 255, 255, 0.25)",
                    borderRight: "none",
                    color: "#fff",
                    padding: "10px 14px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 0,
                    outline: "none",
                    letterSpacing: "0.5px"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.25)"}
                />
                <button style={{
                  background: "#fff",
                  color: "#18181b",
                  border: "none",
                  padding: "0 18px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderRadius: 0
                }}>
                  SUBSCRIBE
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Shop */}
          <div className="footer-col-links">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 18 }}>
              SHOP
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/catalog" className="footer-link">All Products</Link>
              <Link href="/catalog?sort=newest" className="footer-link">New Arrivals</Link>
              <Link href="/reviews" className="footer-link">Customer Reviews</Link>
              <Link href="/profile" className="footer-link">Members</Link>
            </div>
          </div>

          {/* Column 3: About */}
          <div className="footer-col-links">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 18 }}>
              ABOUT
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/brand" className="footer-link">Our Story</Link>
              <Link href="/store-locator" className="footer-link">Find Us</Link>
            </div>
          </div>

          {/* Column 4: Legal */}
          <div className="footer-col-links">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 18 }}>
              LEGAL
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/privacy-policy" className="footer-link">Privacy Policy</Link>
              <Link href="/terms-conditions" className="footer-link">Terms & Conditions</Link>
              <Link href="/shipping-delivery" className="footer-link">Shipping & Delivery</Link>
            </div>
          </div>

        </div>

        {/* Mobile Accordions */}
        <div className="mobile-footer-accordions" style={{ display: "none", flexDirection: "column", marginBottom: 32 }}>
          {/* Brand header */}
          <div style={{ padding: "0 0 24px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-1px", margin: "0 0 4px" }}>
              POSHPLEX
            </h2>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255, 255, 255, 0.4)", letterSpacing: "1.2px", textTransform: "uppercase", margin: "0 0 16px" }}>
              BE POSH WITH POSHPLEX
            </p>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
              JOIN THE MOVEMENT
            </h4>
            <div style={{ display: "flex", width: "100%" }}>
              <input
                type="email"
                placeholder="ENTER YOUR EMAIL"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1.5px solid rgba(255, 255, 255, 0.25)",
                  borderRight: "none",
                  color: "#fff",
                  padding: "10px 14px",
                  fontSize: 12,
                  borderRadius: 0,
                  outline: "none"
                }}
              />
              <button style={{
                background: "#fff",
                color: "#18181b",
                border: "none",
                padding: "0 18px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                cursor: "pointer",
                borderRadius: 0
              }}>
                SUBSCRIBE
              </button>
            </div>
          </div>

          {/* Shop Accordion */}
          <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <button
              onClick={() => toggleSection("shop")}
              style={{
                width: "100%", background: "none", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "18px 0", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", cursor: "pointer"
              }}
            >
              <span>SHOP</span>
              {openSection === "shop" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {openSection === "shop" && (
              <div style={{ paddingBottom: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <Link href="/catalog" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>All Products</Link>
                <Link href="/catalog?sort=newest" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>New Arrivals</Link>
                <Link href="/reviews" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>Customer Reviews</Link>
                <Link href="/profile" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>Members</Link>
              </div>
            )}
          </div>

          {/* About Accordion */}
          <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <button
              onClick={() => toggleSection("about")}
              style={{
                width: "100%", background: "none", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "18px 0", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", cursor: "pointer"
              }}
            >
              <span>ABOUT</span>
              {openSection === "about" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {openSection === "about" && (
              <div style={{ paddingBottom: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <Link href="/brand" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>Our Story</Link>
                <Link href="/store-locator" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>Find Us</Link>
              </div>
            )}
          </div>

          {/* Legal Accordion */}
          <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <button
              onClick={() => toggleSection("legal")}
              style={{
                width: "100%", background: "none", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "18px 0", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", cursor: "pointer"
              }}
            >
              <span>LEGAL</span>
              {openSection === "legal" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {openSection === "legal" && (
              <div style={{ paddingBottom: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <Link href="/privacy-policy" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>Privacy Policy</Link>
                <Link href="/terms-conditions" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>Terms & Conditions</Link>
                <Link href="/shipping-delivery" style={{ textDecoration: "none", color: "rgba(255,255,255,0.6)" }}>Shipping & Delivery</Link>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="bottom-copyright-bar" style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          paddingTop: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "rgba(255, 255, 255, 0.4)"
        }}>
          <div>
            <a href="mailto:business@poshplexbd.com" style={{ color: "rgba(255, 255, 255, 0.4)", textDecoration: "none" }} onMouseEnter={(e) => e.currentTarget.style.color = "#fff"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
              business@poshplexbd.com
            </a>
          </div>
          <div>
            © 2026 Poshplex. All rights reserved.
          </div>
          <div>
            <a href="https://cyberbrain.com.bd" target="_blank" rel="noreferrer" style={{ color: "rgba(255, 255, 255, 0.4)", textDecoration: "none" }} onMouseEnter={(e) => e.currentTarget.style.color = "#fff"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
              Design & Developed by CyberBrain.com.bd
            </a>
          </div>
        </div>

      </div>

      {/* Styled JSX link interactions */}
      <style>{`
        .footer-link {
          text-decoration: none;
          color: rgba(255, 255, 255, 0.6);
          transition: color 0.2s ease;
        }
        .footer-link:hover {
          color: #ffffff;
        }
        @media (max-width: 768px) {
          .desktop-footer-grid {
            display: none !important;
          }
          .mobile-footer-accordions {
            display: flex !important;
          }
          .bottom-copyright-bar {
            flex-direction: column !important;
            gap: 12px !important;
            text-align: center !important;
          }
        }
      `}</style>
    </footer>
  );
}
