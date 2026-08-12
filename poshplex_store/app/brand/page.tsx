import React from "react";
import { Sparkles, Globe, MapPin, Users, Target, ShieldCheck, Star, Award, Zap } from "lucide-react";

export default function BrandPage() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 120, display: "flex", flexDirection: "column", gap: 80 }}>
      {/* Brand Header */}
      <div style={{ textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1.5px", marginBottom: 16 }}>
          OUR STORY
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1.6, fontWeight: 500 }}>
          A journey of passion, family, and the pursuit of fashion that transcends borders.
        </p>
      </div>

      {/* Story Section */}
      <div style={{ 
        background: "var(--bg-secondary)", 
        border: "1px solid var(--border-glass)", 
        borderRadius: 24, 
        padding: "48px 40px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#e11d48", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <Sparkles size={24} /> The Journey
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, fontSize: 16, color: "var(--text-main)", lineHeight: 1.8 }}>
          <p>
            In 2021, <strong>Imran</strong> began his fashion journey by building a brand grounded in passion for premium quality and distinctive style. His focus was clear: create clothing that combined luxury with uniqueness, designed for those who seek more than just fashion — they want a statement.
          </p>
          <p>
            Inspired by his brother's vision, <strong>Sadman</strong> started his street culture fashion brand in 2024, bringing fresh creativity and a bold perspective rooted in urban lifestyle. Though their approaches differed, both brothers shared an unwavering commitment to excellence, exclusivity, and craftsmanship.
          </p>
          <p>
            In 2025, Imran and Sadman united their talents and dreams to build <strong>POSHPLEX</strong>, a premium fashion brand designed to stand out on the global stage. Every element of POSHPLEX — from the finest fabric selection to precision stitching, from sophisticated packaging to impeccable delivery — reflects a dedication to luxury and quality without compromise.
          </p>
          <p>
            POSHPLEX is more than a clothing label; it's a celebration of refined elegance, unique design, and international ambition. It's built for discerning customers worldwide who appreciate timeless style infused with modern sophistication and authenticity.
          </p>
          <p style={{ fontStyle: "italic", fontWeight: 600, color: "var(--text-muted)", marginTop: 8 }}>
            Together, the two brothers crafted POSHPLEX to embody their shared values — family, passion, and the pursuit of fashion that transcends borders.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 40, alignItems: "start" }}>
        
        {/* Mission Statement */}
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 20, 
          padding: 32,
          height: "100%"
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e11d48", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={22} /> Mission Statement
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-main)", lineHeight: 1.7, fontWeight: 500 }}>
            To craft premium, luxurious apparel that combines timeless elegance with unique design, delivering exceptional quality and sophistication to discerning customers across the world.
          </p>
        </div>

        {/* Our Team */}
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 20, 
          padding: 32,
          height: "100%"
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={22} /> Our Team
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 20 }}>
            Driven by passion and precision, the POSHPLEX team blends creativity with craftsmanship to redefine luxury fashion.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <li style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-main)", fontWeight: 600 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b20", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>I</div>
              MD. IMRAN HOSSAN <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>(Founder)</span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-main)", fontWeight: 600 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b20", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>S</div>
              MD. SADMAN ISLAM <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>(Co-Founder)</span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-main)", fontWeight: 600 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b20", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>N</div>
              MD. NIAZ KHAN <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>(Manager)</span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-main)", fontWeight: 600 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b20", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>T</div>
              MD. TORIKUL ISLAM <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>(Asst. Manager)</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Core Brand Values */}
      <div>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: "var(--text-main)", textAlign: "center", marginBottom: 40 }}>
          CORE BRAND VALUES
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
            <Award size={28} color="#ef4444" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>Premium Quality</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>Only the finest materials and meticulous craftsmanship are used in every piece.</p>
          </div>

          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
            <Zap size={28} color="#8b5cf6" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>Unique Design</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>Bold yet elegant styles that stand apart from the ordinary.</p>
          </div>

          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
            <Star size={28} color="#eab308" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>Luxury Experience</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>From product to packaging and delivery, every detail reflects refinement.</p>
          </div>

          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
            <ShieldCheck size={28} color="#10b981" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>Authenticity</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>Genuine passion and family heritage shape every creation.</p>
          </div>

          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
            <Globe size={28} color="#06b6d4" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>Global Vision</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>Committed to reaching and inspiring an international audience with our distinct fashion identity.</p>
          </div>

        </div>
      </div>

    </div>
  );
}
