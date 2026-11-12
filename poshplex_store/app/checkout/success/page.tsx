"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderFromQuery = searchParams?.get("order") || "";
  const [orderSummary, setOrderSummary] = useState<{
    orderNumber?: string;
    total?: number;
    currency?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("poshplex_last_order");
      if (raw) {
        const parsed = JSON.parse(raw);
        setOrderSummary(parsed);
      } else if (orderFromQuery) {
        setOrderSummary({ orderNumber: orderFromQuery });
      }
    } catch {
      if (orderFromQuery) {
        setOrderSummary({ orderNumber: orderFromQuery });
      }
    }
  }, [orderFromQuery]);

  const displayOrderNumber = orderSummary?.orderNumber || orderFromQuery;

  return (
    <div
      className="container"
      style={{ paddingTop: 100, paddingBottom: 100, minHeight: "60vh", textAlign: "center" }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, color: "#e11d48" }}>
        <CheckCircle2 size={80} />
      </div>
      <h2
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: "var(--text-main)",
          marginBottom: 16,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
        }}
      >
        Order Confirmed
      </h2>
      {displayOrderNumber && (
        <div
          style={{
            display: "inline-block",
            padding: "6px 14px",
            marginBottom: 18,
            borderRadius: 4,
            border: "1px solid var(--border-color, #333)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--text-main)",
          }}
        >
          ORDER ID: {displayOrderNumber}
        </div>
      )}
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: 16,
          maxWidth: 500,
          margin: "0 auto 40px auto",
          lineHeight: 1.6,
        }}
      >
        Thank you for shopping with POSHPLEX. Your order has been securely placed. We will contact
        you shortly to confirm delivery.
      </p>
      <Link
        href="/"
        style={{
          padding: "16px 48px",
          fontSize: 15,
          textDecoration: "none",
          display: "inline-block",
          fontWeight: 800,
          textTransform: "uppercase",
          backgroundColor: "#000000",
          color: "#ffffff",
          border: "1px solid #000000",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#e11d48";
          e.currentTarget.style.borderColor = "#e11d48";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(225, 29, 72, 0.4)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#000000";
          e.currentTarget.style.borderColor = "#000000";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "none";
        }}
      >
        RETURN TO HOME
      </Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <React.Suspense fallback={null}>
      <CheckoutSuccessContent />
    </React.Suspense>
  );
}

