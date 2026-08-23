"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star, Camera, Send } from "lucide-react";
import { fetchWithAuth } from "../../utils/fetchWithAuth";

export default function ProductReviews({ 
  product, 
  initialReviews, 
  setLightboxUrl 
}: { 
  product: any, 
  initialReviews: any[], 
  setLightboxUrl: (url: string | null) => void 
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState<any[]>(initialReviews);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [attachedPhotos, setAttachedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewIsApproved, setReviewIsApproved] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    const checkMyReview = async () => {
      const token = localStorage.getItem("poshplex_access_token");
      if (!token) return;
      try {
        const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetchWithAuth(`${API_URL}/api/v1/catalog/my-reviews`);
        if (res.ok) {
          const data = await res.json();
          const myReview = data.find((r: any) => r.product_id === product.id);
          if (myReview) {
            setHasReviewed(true);
            setReviewIsApproved(myReview.is_approved);
            setReviewRating(myReview.rating);
            setReviewComment(myReview.comment);
            setAttachedPhotos(myReview.images || []);
          }
        }
      } catch { }
    };
    checkMyReview();
  }, [product.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit_review") === "true") {
        setShowReviewForm(true);
      }
    }
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const token = localStorage.getItem("poshplex_access_token");
    if (!token) { router.push(`/login?next=/product/${product.slug}`); return; }
    if (attachedPhotos.length + files.length > 3) { alert("Max 3 photos."); return; }
    setUploading(true);
    const urls = [...attachedPhotos];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      if (product?.id) {
        fd.append("product_id", product.id.toString());
      }
      try {
        const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_URL}/api/v1/catalog/reviews/upload-photo`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        if (res.ok) urls.push((await res.json()).url);
        else urls.push(URL.createObjectURL(file));
      } catch { urls.push(URL.createObjectURL(file)); }
    }
    setAttachedPhotos(urls);
    setUploading(false);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("poshplex_access_token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetchWithAuth(
        `${API_URL}/api/v1/catalog/products/${product.slug}/reviews`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            rating: reviewRating,
            comment: reviewComment,
            photos: attachedPhotos,
          }),
        }
      );
      if (res.ok) {
        setHasReviewed(true);
        setSubmitMsg("Review submitted! It will appear after approval.");
        setShowReviewForm(false);
        setTimeout(() => setSubmitMsg(""), 6000);
      } else {
        const err = await res.json();
        setSubmitMsg(err.detail || "Failed to submit review.");
      }
    } catch {
      setSubmitMsg("Network error. Please try again.");
    }
  };

  return (
    <div>
      {!reviewIsApproved ? (
        <button
          onClick={() => setShowReviewForm(f => !f)}
          style={{
            width: "100%", padding: "13px 0", background: "#6b7280", color: "#fff",
            border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
            marginBottom: 16, borderRadius: 2, letterSpacing: "0.3px",
            transition: "background 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#e4e4e4")}
          onMouseLeave={e => (e.currentTarget.style.background = "#f0f0f0")}
        >
          {hasReviewed ? "Edit your pending review" : "Review product"}
        </button>
      ) : (
        <p style={{ fontSize: 13, color: "#16a34a", textAlign: "center", marginBottom: 16, padding: "12px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0" }}>
          Your review has been published.
        </p>
      )}

      {submitMsg && (
        <p style={{ fontSize: 12, color: "#16a34a", textAlign: "center", marginBottom: 12 }}>{submitMsg}</p>
      )}

      {showReviewForm && !reviewIsApproved && (
        <form onSubmit={handleSubmitReview} style={{ border: "1px solid #eee", padding: 20, borderRadius: 4, marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 8 }}>Your Rating</label>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} type="button" onClick={() => setReviewRating(s)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                >
                  <Star size={20} fill={s <= reviewRating ? "#111" : "none"} color="#111" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Comment</label>
            <textarea required value={reviewComment} onChange={e => setReviewComment(e.target.value)}
              rows={3} placeholder="Tell us about fit, fabric, quality…"
              style={{ width: "100%", border: "1px solid #ddd", padding: "9px 12px", fontSize: 13, borderRadius: 2, resize: "none", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {attachedPhotos.map((url, i) => (
              <div key={i} style={{ position: "relative", width: 52, height: 52 }}>
                <Image src={url} alt="" fill sizes="52px" style={{ objectFit: "cover", borderRadius: 4 }} />
                <button type="button" onClick={() => setAttachedPhotos(p => p.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, background: "#e11d48", color: "#fff", border: "none", borderRadius: "50%", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >×</button>
              </div>
            ))}
            {attachedPhotos.length < 3 && (
              <label style={{ width: 52, height: 52, border: "1.5px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 4, color: "#999" }}>
                <Camera size={18} />
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploading} style={{ display: "none" }} />
              </label>
            )}
          </div>
          <button type="submit" style={{ background: "#111", color: "#fff", border: "none", padding: "12px 0", fontSize: 13, cursor: "pointer", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Send size={13} /> {hasReviewed ? "Update Review" : "Submit Review"}
          </button>
        </form>
      )}

      {reviews.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {reviews.map((rev) => {
            const thumb = rev.images?.[0] || null;
            return (
              <div
                key={rev.id}
                style={{ position: "relative", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", display: "flex", flexDirection: "column" }}
              >
                {thumb && (
                  <div
                    style={{ width: "100%", aspectRatio: "3/4", position: "relative", cursor: "zoom-in" }}
                    onClick={() => setLightboxUrl(thumb)}
                  >
                    <Image src={thumb} alt="Review" fill sizes="(max-width: 768px) 50vw, 20vw" style={{ objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <div style={{ display: "flex", gap: 2, color: "var(--text-main)" }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={11} fill={s <= rev.rating ? "currentColor" : "none"} color={s <= rev.rating ? "var(--text-main)" : "var(--text-muted)"} strokeWidth={1.5} />
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, margin: 0, flex: 1 }}>
                    {rev.comment}
                  </p>
                  <h3 style={{ fontSize: 12, fontWeight: 900, color: "var(--text-main)", textTransform: "uppercase", margin: 0 }}>
                    {rev.username}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>
          No reviews yet — be the first!
        </p>
      )}
    </div>
  );
}
