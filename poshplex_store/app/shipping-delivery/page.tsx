import React from "react";
import { Truck, MapPin, Clock, ShieldCheck, HelpCircle, Phone, Mail } from "lucide-react";

export default function ShippingDeliveryPage() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 120, maxWidth: 800 }}>
      
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 60 }}>
        <div style={{ 
          background: "rgba(225, 29, 72, 0.1)", 
          color: "#e11d48", 
          width: 64, 
          height: 64, 
          borderRadius: 20, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          margin: "0 auto 24px auto"
        }}>
          <Truck size={32} />
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1.5px", textTransform: "uppercase" }}>
          Shipping & Delivery
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginTop: 12 }}>
          At Poshplex, we believe in clear, hassle-free delivery. Here's everything you need to know about how your orders reach you.
        </p>
      </div>

      {/* Intro */}
      <div style={{ 
        background: "var(--bg-secondary)", 
        border: "1px solid var(--border-glass)", 
        borderRadius: 24, 
        padding: 32,
        marginBottom: 48,
        fontSize: 16,
        color: "var(--text-main)",
        lineHeight: 1.8,
        textAlign: "center"
      }}>
        No hidden talk — just premium streetwear delivered straight to your door. Mapped deliveries and reliable schedules.
      </div>

      {/* Zones Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 32, marginBottom: 48 }}>
        
        {/* Inside Dhaka */}
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 20, 
          padding: 32 
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={22} color="#e11d48" /> Inside Dhaka City
            </h3>
            <span style={{ background: "rgba(225, 29, 72, 0.15)", color: "#e11d48", padding: "6px 16px", borderRadius: 30, fontSize: 14, fontWeight: 700 }}>
              ৳70 Delivery
            </span>
          </div>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong style={{ color: "var(--text-main)" }}>Delivery Time:</strong> 2–3 working days</li>
            <li><strong style={{ color: "var(--text-main)" }}>Payment:</strong> Cash on Delivery (COD) available</li>
            <li>Our delivery partner will call you before arrival to confirm.</li>
          </ul>
        </div>

        {/* Sub-Urban */}
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 20, 
          padding: 32 
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={22} color="#e11d48" /> Sub-Urban Areas (Near Dhaka)
            </h3>
            <span style={{ background: "rgba(225, 29, 72, 0.15)", color: "#e11d48", padding: "6px 16px", borderRadius: 30, fontSize: 14, fontWeight: 700 }}>
              ৳100 Delivery
            </span>
          </div>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong style={{ color: "var(--text-main)" }}>Delivery Time:</strong> 2–4 working days</li>
            <li><strong style={{ color: "var(--text-main)" }}>Payment:</strong> Cash on Delivery (COD) available</li>
            <li>You'll get a confirmation call from the rider/courier before delivery.</li>
          </ul>
        </div>

        {/* Outside Dhaka */}
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 20, 
          padding: 32 
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={22} color="#10b981" /> Outside Dhaka
            </h3>
            <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "6px 16px", borderRadius: 30, fontSize: 14, fontWeight: 700 }}>
              ৳120 Delivery
            </span>
          </div>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong style={{ color: "var(--text-main)" }}>Delivery Time:</strong> 3–5 working days</li>
            <li><strong style={{ color: "var(--text-main)" }}>Payment Policy:</strong> Advance payment required for delivery charge. Product price can be paid upon delivery (COD for product price only).</li>
            <li>Our courier partner will call you before delivering.</li>
          </ul>
        </div>

      </div>

      {/* Important Notes */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32, marginBottom: 48 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <Clock size={20} color="#f59e0b" /> Important Notes
        </h3>
        <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 10 }}>
          <li>Delivery times are estimated and may vary due to courier delays, traffic, or weather conditions.</li>
          <li>If any unexpected delay occurs, our team will notify you.</li>
          <li>For smooth delivery, please ensure your phone number is active and reachable during working hours.</li>
          <li>If you are unavailable at the time of delivery, the courier may reschedule at their convenience.</li>
          <li>Delivery is handled by our own riders (inside Dhaka) or trusted third-party courier services (outside Dhaka).</li>
        </ul>
      </div>

      {/* Tracking & Support */}
      <div style={{ 
        background: "var(--bg-secondary)", 
        border: "1px solid var(--border-glass)", 
        borderRadius: 24, 
        padding: 32,
        textAlign: "center"
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 12 }}>Tracking & Support</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>For order updates or delivery issues, you can always reach us:</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", fontWeight: 600 }}>
            <Phone size={16} /> 01887362831
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", fontWeight: 600 }}>
            <Mail size={16} /> poshplexbd@gmail.com
          </span>
        </div>
        <div style={{ marginTop: 24, fontSize: 14, fontStyle: "italic", color: "var(--text-muted)", fontWeight: 500 }}>
          "We always aim to deliver your order fast, safe, and on point 🖤"
        </div>
      </div>

    </div>
  );
}
