"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Filter, Camera, X, MessageSquare, ExternalLink } from "lucide-react";

export default function ReviewsDirectory() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "5star" | "4star_plus" | "photos">("all");
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let queryParams = "";
      if (filter === "5star") queryParams = "?rating=5";
      else if (filter === "4star_plus") queryParams = "?min_rating=4";
      else if (filter === "photos") queryParams = "?with_photos=true";

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/reviews${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (e) {
      console.error(e);
      // Fallback mock reviews
      const mock = [
        { id: 1, username: "sakib_a", product_name: "Ghost Ink Heavy Boxy Tee", product_slug: "ghost-ink", rating: 5, title: "Legit Heavyweight", comment: "The 240 GSM weight on this boxy tee is unreal. Fits perfectly boxy and holds its shape after wash.", images: ["https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop"], created_at: "2026-06-30T12:00:00Z" },
        { id: 2, username: "tasnim_w", product_name: "Printed Baggy Joggers", product_slug: "baggy-joggers", rating: 4, title: "Super comfy", comment: "Pairing the printed baggy joggers with sneakers. Heavyweight loopback cotton is super comfortable.", images: [], created_at: "2026-06-28T10:00:00Z" },
        { id: 3, username: "sajid_s", product_name: "Poshplex Coach Jacket", product_slug: "coach-jacket", rating: 5, title: "Clean lines", comment: "Jacket has clean lines and no bulk. Industrial look with square edges is exactly what Dhaka needed.", images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop"], created_at: "2026-06-27T08:00:00Z" }
      ];
      
      if (filter === "5star") {
        setReviews(mock.filter(m => m.rating === 5));
      } else if (filter === "4star_plus") {
        setReviews(mock.filter(m => m.rating >= 4));
      } else if (filter === "photos") {
        setReviews(mock.filter(m => m.images.length > 0));
      } else {
        setReviews(mock);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [filter]);

  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 60 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#e11d48", textTransform: "uppercase", letterSpacing: "2px" }}>
          Community Gallery
        </span>
        <h1 style={{ fontSize: 44, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1.5px", textTransform: "uppercase", marginTop: 8 }}>
          Fit Check Archive
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginTop: 12, maxWidth: 600, margin: "12px auto 0 auto" }}>
          Explore styled garments and detailed reviews straight from the streets of Dhaka.
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        gap: 12, 
        marginBottom: 48, 
        flexWrap: "wrap",
        borderBottom: "1px solid var(--border-glass)",
        paddingBottom: 24
      }}>
        {[
          { key: "all", label: "All Reviews" },
          { key: "5star", label: "5 ★ Only" },
          { key: "4star_plus", label: "4 ★ & Above" },
          { key: "photos", label: "With Photos", icon: <Camera size={14} /> }
        ].map((btn) => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key as any)}
            style={{
              padding: "12px 24px",
              background: filter === btn.key ? "var(--text-main)" : "transparent",
              color: filter === btn.key ? "var(--bg-primary)" : "var(--text-main)",
              border: filter === btn.key ? "1px solid var(--text-main)" : "1px solid var(--border-glass)",
              cursor: "pointer",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: 12,
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s ease"
            }}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>

      {/* Grid of Reviews */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Syncing logs from the grid...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, border: "1px dashed var(--border-glass)" }}>
          <p style={{ color: "var(--text-muted)" }}>No styled logs found matching this filter.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 32 }}>
          {reviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-glass)",
                padding: 28,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 280,
                borderRadius: 0,
                boxShadow: "0 8px 16px rgba(0,0,0,0.05)"
              }}
            >
              {/* Product link info */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                      {rev.username}
                    </h3>
                    <Link 
                      href={`/product/${rev.product_slug}`} 
                      style={{ 
                        fontSize: 12, 
                        color: "#e11d48", 
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 4,
                        fontWeight: 600
                      }}
                    >
                      {rev.product_name} <ExternalLink size={10} />
                    </Link>
                  </div>
                  
                  {/* Rating stars */}
                  <div style={{ display: "flex", gap: 2, color: "var(--text-main)" }}>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star 
                        key={idx} 
                        size={12} 
                        fill={idx < rev.rating ? "currentColor" : "none"} 
                        style={{ color: idx < rev.rating ? "var(--text-main)" : "var(--text-muted)" }}
                      />
                    ))}
                  </div>
                </div>

                {/* Review Text */}
                <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-main)", marginBottom: 8 }}>
                  {rev.title}
                </h4>
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  "{rev.comment}"
                </p>
              </div>

              {/* Photos Gallery */}
              <div style={{ marginTop: 20 }}>
                {rev.images && rev.images.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {rev.images.map((imgUrl: string, imgIdx: number) => (
                      <div key={imgIdx} style={{ position: "relative", width: 64, height: 64, cursor: "pointer", border: "1px solid var(--border-glass)", borderRadius: 4, overflow: "hidden" }}>
                        <Image
                          src={imgUrl}
                          alt="Fit check"
                          fill
                          sizes="64px"
                          onClick={() => setActivePhoto(imgUrl)}
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Date */}
                <div style={{ 
                  borderTop: "1px solid var(--border-glass)", 
                  paddingTop: 16, 
                  fontSize: 11, 
                  color: "var(--text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span>LOG ARCHIVE</span>
                  <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Lightbox for zooming review photos */}
      {activePhoto && (
        <div 
          onClick={() => setActivePhoto(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.95)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <button 
            onClick={() => setActivePhoto(null)}
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              background: "transparent",
              border: "none",
              color: "#ffffff",
              cursor: "pointer"
            }}
          >
            <X size={32} />
          </button>
          
          <div style={{ position: "relative", width: "90vw", height: "85vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Image 
              src={activePhoto} 
              alt="Zoomed fit check" 
              fill
              sizes="90vw"
              style={{ 
                objectFit: "contain",
                borderRadius: 8,
                filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5))"
              }} 
            />
          </div>
        </div>
      )}

    </div>
  );
}
