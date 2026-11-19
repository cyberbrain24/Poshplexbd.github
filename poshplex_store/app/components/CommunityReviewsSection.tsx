"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, MessageSquare } from "lucide-react";

interface CommunityReviewItem {
  id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  username: string;
  rating: number;
  comment: string;
  images: string[];
  created_at: string;
}

interface CommunityReviewsSectionProps {
  currentProductSlug?: string;
  onImageClick?: (url: string) => void;
}

export default function CommunityReviewsSection({
  currentProductSlug,
  onImageClick
}: CommunityReviewsSectionProps) {
  const [reviews, setReviews] = useState<CommunityReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchCommunityReviews = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://poshplexbd.com";
        const res = await fetch(`${API_URL}/api/v1/catalog/reviews`, {
          headers: { "Accept": "application/json" }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            // Filter reviews that have images first or take approved reviews
            const sorted = data.sort((a: any, b: any) => {
              const aHasImg = (a.images && a.images.length > 0) ? 1 : 0;
              const bHasImg = (b.images && b.images.length > 0) ? 1 : 0;
              return bHasImg - aHasImg;
            });
            setReviews(sorted);
          }
        }
      } catch (err) {
        console.error("Failed to load community reviews:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCommunityReviews();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="community-reviews-wrapper" style={{ maxWidth: 1400, margin: "48px auto 0", padding: "0 40px 60px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-muted)", borderBottom: "1px solid var(--border-glass)", paddingBottom: 16, marginBottom: 24 }}>
          Community Reviews
        </h2>
        <p style={{ fontSize: 13, color: "#888", textAlign: "center", padding: "24px 0" }}>
          Loading community reviews...
        </p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return null;
  }

  return (
    <div className="community-reviews-wrapper" style={{ maxWidth: 1400, margin: "48px auto 0", padding: "0 40px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid var(--border-glass)", paddingBottom: 16, marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-muted)", margin: 0 }}>
            Community Reviews
          </h2>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0 0" }}>
            Real customer fits, ratings & verified feedback
          </p>
        </div>
        <Link
          href="/reviews"
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            color: "var(--text-main)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }}
        >
          View All Reviews →
        </Link>
      </div>

      <div
        className="community-reviews-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 20,
        }}
      >
        {reviews.slice(0, 8).map((rev) => {
          const primaryImage = (rev.images && rev.images.length > 0) ? rev.images[0] : null;

          return (
            <div
              key={rev.id}
              className="community-review-card"
              style={{
                display: "flex",
                flexDirection: "row",
                background: "var(--bg-secondary, #18181b)",
                border: "1px solid var(--border-glass, rgba(255, 255, 255, 0.08))",
                borderRadius: 8,
                overflow: "hidden",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                minHeight: 180,
              }}
            >
              {/* Left Side: Product Uploaded Image */}
              <div
                style={{
                  width: "38%",
                  minWidth: 140,
                  maxWidth: 200,
                  position: "relative",
                  background: "#09090b",
                  cursor: primaryImage && onImageClick ? "zoom-in" : "default",
                  flexShrink: 0
                }}
                onClick={() => {
                  if (primaryImage && onImageClick) {
                    onImageClick(primaryImage);
                  }
                }}
              >
                {primaryImage ? (
                  <Image
                    src={primaryImage}
                    alt={`Fit by ${rev.username}`}
                    fill
                    sizes="(max-width: 768px) 140px, 200px"
                    style={{ objectFit: "cover" }}
                    unoptimized={true}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#71717a",
                      gap: 8,
                      padding: 12,
                      textAlign: "center"
                    }}
                  >
                    <MessageSquare size={24} strokeWidth={1.5} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Verified Review</span>
                  </div>
                )}
              </div>

              {/* Right Side: Rating & Review Notes / Comments */}
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  flex: 1,
                  minWidth: 0,
                  gap: 12
                }}
              >
                <div>
                  {/* Rating Stars + Product badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 3, color: "#facc15" }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={13}
                          fill={star <= rev.rating ? "currentColor" : "none"}
                          strokeWidth={1.5}
                          style={{ color: star <= rev.rating ? "#facc15" : "rgba(255, 255, 255, 0.2)" }}
                        />
                      ))}
                    </div>

                    <Link
                      href={`/product/${rev.product_slug}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#94a3b8",
                        textDecoration: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 160
                      }}
                    >
                      {rev.product_name}
                    </Link>
                  </div>

                  {/* Comment / Review notes */}
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--text-main, #e4e4e7)",
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    "{rev.comment}"
                  </p>
                </div>

                {/* Reviewer signature and details */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    fontSize: 11
                  }}
                >
                  <span style={{ fontWeight: 800, color: "var(--text-main, #ffffff)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {rev.username}
                  </span>
                  <span style={{ color: "#71717a", fontWeight: 500 }}>
                    Verified Buyer
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .community-reviews-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 768px) {
          .community-reviews-wrapper {
            margin-top: 24px !important;
            padding: 0 16px 40px !important;
          }
        }
      `}</style>
    </div>
  );
}
