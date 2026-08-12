import React from "react";
import { FileText, ClipboardList, CreditCard, Truck, RefreshCw, Lock, AlertTriangle, Phone, Mail } from "lucide-react";

export default function TermsConditionsPage() {
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
          <ClipboardList size={32} />
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1.5px", textTransform: "uppercase" }}>
          Terms & Conditions
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginTop: 12 }}>
          Welcome to Poshplex. By placing an order with us, you agree to the following terms and conditions.
        </p>
      </div>

      {/* Intro */}
      <div style={{ 
        background: "var(--bg-secondary)", 
        border: "1px solid var(--border-glass)", 
        borderRadius: 24, 
        padding: 32,
        marginBottom: 40,
        fontSize: 16,
        color: "var(--text-main)",
        lineHeight: 1.8
      }}>
        Welcome to Poshplex. By placing an order with us, you agree to the following terms and conditions. Please read them carefully before shopping.
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Section 1 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="#e11d48" /> Orders
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Once you place an order, we'll confirm it via call or text.</li>
            <li>Orders may be cancelled if incorrect details are provided or if the product is unavailable.</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <CreditCard size={20} color="#e11d48" /> Pricing & Payment
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>All listed prices are final and include VAT (if applicable).</li>
            <li>
              <strong>Delivery Charges:</strong>
              <div style={{ paddingLeft: 16, marginTop: 8, color: "var(--text-main)" }}>
                <div>• Inside Dhaka: ৳70</div>
                <div>• Sub-urban areas: ৳100</div>
                <div>• Outside Dhaka: ৳120 (advance delivery charge required; product price can be paid on delivery)</div>
              </div>
            </li>
            <li style={{ marginTop: 8 }}>For Cash on Delivery, please keep the exact amount ready at the time of delivery.</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Truck size={20} color="#10b981" /> Shipping & Delivery
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Inside Dhaka: 2–3 working days</li>
            <li>Sub-urban areas: 2–4 working days</li>
            <li>Outside Dhaka: 3–4 working days (advance delivery charge required)</li>
            <li>Delivery times may vary due to courier delays, traffic, or weather conditions.</li>
          </ul>
        </div>

        {/* Section 4 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <RefreshCw size={20} color="#f59e0b" /> Exchanges & Returns
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Exchange requests must be made within 24 hours of delivery.</li>
            <li>Exchanges are only available for defective, damaged, or wrong items.</li>
            <li>Products must be unused, in original condition, and in original packaging.</li>
            <li>Returns are only accepted instantly at the time of delivery, in front of the delivery person.</li>
            <li>Delivery charges must be paid again for exchanges.</li>
          </ul>
        </div>

        {/* Section 5 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Lock size={20} color="#ef4444" /> Use of Our Content
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            All product photos, designs, and content are the property of Poshplex. You may not copy, use, or reproduce them without prior permission.
          </p>
        </div>

        {/* Section 6 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={20} color="#e11d48" /> Limitation of Liability
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>We are not responsible for delivery delays caused by third-party couriers, traffic, or weather.</li>
            <li>We are not liable for any loss or damage once the product has been delivered and accepted.</li>
          </ul>
        </div>

        {/* Section 7 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <RefreshCw size={20} color="#e11d48" /> Changes to Terms
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            We may update or change these Terms & Conditions at any time. Any updates will be posted on our platforms and take effect immediately.
          </p>
        </div>

      </div>

      {/* Contact Details */}
      <div style={{ 
        marginTop: 60,
        background: "var(--bg-secondary)", 
        border: "1px solid var(--border-glass)", 
        borderRadius: 24, 
        padding: 32,
        textAlign: "center"
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 20 }}>Contact Us</h3>
        <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-muted)" }}>
            <Phone size={16} /> 01887362831
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-muted)" }}>
            <Mail size={16} /> poshplexbd@gmail.com
          </span>
        </div>
      </div>

    </div>
  );
}
