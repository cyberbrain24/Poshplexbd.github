// Next.js route-level loading skeleton for /catalog
// Rendered immediately while the page component fetches data
export default function CatalogLoading() {
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 100 }}>
      {/* Title skeleton */}
      <div style={{ marginBottom: 32, animation: "skeletonPulse 1.5s ease-in-out infinite" }}>
        <div style={{ height: 32, width: 280, background: "var(--bg-secondary)", borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 14, width: 360, background: "var(--bg-secondary)", borderRadius: 4 }} />
      </div>

      {/* Search bar skeleton */}
      <div style={{ height: 44, background: "var(--bg-secondary)", borderRadius: 2, marginBottom: 40, animation: "skeletonPulse 1.5s ease-in-out infinite" }} />

      <div className="catalog-layout">
        {/* Filter rail skeleton */}
        <aside className="filter-rail" style={{ animation: "skeletonPulse 1.5s ease-in-out infinite" }}>
          <div style={{ height: 16, width: "70%", background: "var(--border-glass)", borderRadius: 4, marginBottom: 24 }} />
          {[120, 90, 100, 80, 110].map((w, i) => (
            <div key={i} style={{ height: 12, width: w, background: "var(--border-glass)", borderRadius: 4, marginBottom: 14 }} />
          ))}
          <div style={{ height: 1, background: "var(--border-glass)", margin: "20px 0" }} />
          <div style={{ height: 16, width: "60%", background: "var(--border-glass)", borderRadius: 4, marginBottom: 14 }} />
          <div style={{ height: 8, background: "var(--border-glass)", borderRadius: 4, marginBottom: 20 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["S","M","L","XL","XXL"].map(s => (
              <div key={s} style={{ width: 38, height: 38, background: "var(--border-glass)", borderRadius: 0 }} />
            ))}
          </div>
        </aside>

        {/* Product grid skeleton */}
        <section>
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ animation: "skeletonPulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.08}s` }}>
                <div style={{ aspectRatio: "3/4", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-glass)", marginBottom: 12 }} />
                <div style={{ height: 12, width: "40%", background: "var(--border-glass)", borderRadius: 3, marginBottom: 8 }} />
                <div style={{ height: 14, width: "80%", background: "var(--border-glass)", borderRadius: 3, marginBottom: 8 }} />
                <div style={{ height: 14, width: "30%", background: "var(--border-glass)", borderRadius: 3 }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes skeletonPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}} />
    </div>
  );
}
