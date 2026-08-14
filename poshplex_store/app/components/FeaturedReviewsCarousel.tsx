"use client";

import React, { useState, useEffect, useRef } from "react";
import { Star, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function FeaturedReviewsCarousel() {
  const [featuredReviews, setFeaturedReviews] = useState<any[]>([]);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadFeaturedReviews = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API}/api/v1/catalog/reviews?is_featured=true`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          setFeaturedReviews(data);
        }
      } catch {
        // Backend offline or timeout — carousel silently hidden
        clearTimeout(timeout);
      } finally {
        setLoading(false);
      }
    };
    loadFeaturedReviews();
  }, []);

  // Auto-slide timer
  useEffect(() => {
    if (featuredReviews.length <= 1) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        // The first child is the <style> tag, so reviews start at index 1
        const item = scrollRef.current.children[1] as HTMLElement;
        const itemWidth = item ? item.clientWidth + 20 : 300;
        let nextScroll = scrollLeft + itemWidth;
        if (nextScroll + clientWidth >= scrollWidth - 10) {
          nextScroll = 0;
        }
        scrollRef.current.scrollTo({ left: nextScroll, behavior: 'smooth' });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredReviews]);

  if (loading) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 40px" }}>
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-glass)",
          padding: "48px 40px",
          animation: "skeletonPulse 1.5s ease-in-out infinite"
        }}>
          <div style={{ height: 16, width: "60%", background: "var(--border-glass)", borderRadius: 4, marginBottom: 16 }} />
        </div>
      </div>
    );
  }

  if (featuredReviews.length === 0) {
    return null;
  }

  return (
    <div style={{ position: "relative", width: "100%", margin: "0 auto", padding: "0 20px" }}>
      <style>{`
        .reviews-slider {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -ms-overflow-style: none;
          scrollbar-width: none;
          padding-bottom: 20px;
        }
        .reviews-slider::-webkit-scrollbar {
          display: none;
        }
        .review-card {
          scroll-snap-align: start;
          flex: 0 0 calc(100% / 6 - 20px * 5 / 6);
          background: var(--bg-secondary);
          border: 1px solid var(--border-glass);
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          position: relative;
          overflow: hidden;
        }
        @media (max-width: 1400px) {
          .review-card { flex: 0 0 calc(100% / 4 - 20px * 3 / 4); }
        }
        @media (max-width: 1024px) {
          .review-card { flex: 0 0 calc(100% / 3 - 20px * 2 / 3); }
        }
        @media (max-width: 768px) {
          .review-card { flex: 0 0 calc(50% - 10px); }
        }
      `}</style>

      <div ref={scrollRef} className="reviews-slider">
        <style>{`/* placeholder to ensure index 1 is first element */`}</style>
        {featuredReviews.map((currentReview, idx) => (
          <div key={idx} className="review-card">
            {currentReview.images && currentReview.images.length > 0 && (
              <Link 
                href={`/product/${currentReview.product_slug}`} 
                style={{ display: "block", position: "relative", width: "100%", aspectRatio: "3/4" }}
              >
                <Image src={currentReview.images[0] || "https://placehold.co/600x600/f0f0f0/999.png?text=No+Image"} alt={`Review by ${currentReview.username}`} fill style={{ objectFit: "cover" }} />
              </Link>
            )}

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <div style={{ display: "flex", gap: 2, color: "var(--text-main)" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i} 
                    size={12} 
                    fill={i < currentReview.rating ? "currentColor" : "none"} 
                    style={{ color: i < currentReview.rating ? "var(--text-main)" : "var(--text-muted)" }}
                  />
                ))}
              </div>

              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, flex: 1 }}>
                {currentReview.comment}
              </p>

              <h3 style={{ fontSize: 13, fontWeight: 900, color: "var(--text-main)", textTransform: "uppercase", margin: 0 }}>
                {currentReview.username}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Full-Screen Zoomable Lightbox */}
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
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <button 
            suppressHydrationWarning
            onClick={() => setActivePhoto(null)}
            aria-label="Close Lightbox"
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
          
          <div style={{ position: "relative", width: "90vw", height: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <Image 
              src={activePhoto} 
              alt="Zoomed Fit" 
              fill
              style={{ objectFit: "contain" }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
