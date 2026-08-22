import React from "react";
import { Shield, Lock, Eye, RefreshCw, FileText, Phone, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 120, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 60 }}>
        <div style={{ 
          background: "rgba(16, 185, 129, 0.1)", 
          color: "#10b981", 
          width: 64, 
          height: 64, 
          borderRadius: 20, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          margin: "0 auto 24px auto"
        }}>
          <Shield size={32} />
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1.5px", textTransform: "uppercase" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginTop: 12 }}>
          Your trust means everything to us. Learn how we handle and protect your information.
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
        At Poshplex, your trust means everything to us. When you shop with us, you're not just buying clothes — you're also sharing your information, and we're committed to protecting it.
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Section 1 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="#e11d48" /> What We Collect
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
            When you place an order, we may collect the following details:
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-main)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Name</strong></li>
            <li><strong>Phone number</strong></li>
            <li><strong>Delivery address</strong></li>
            <li><strong>Email address</strong></li>
            <li><strong>Payment details</strong> (only for online or advance payments)</li>
          </ul>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 16 }}>
            We use this information solely to process your order, arrange delivery, and keep you informed.
          </p>
        </div>

        {/* Section 1.5 - Google Login */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Lock size={20} color="#3b82f6" /> Account Creation & Google Login
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
            When you create an account or sign in using a third-party authentication provider like Google, we collect and securely store:
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-main)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Your primary email address (to uniquely identify your account).</li>
            <li>Your basic profile information, such as your full name.</li>
            <li>Your profile picture or avatar (if available).</li>
          </ul>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 16 }}>
            This data is used strictly to authenticate you securely, manage your active sessions, track your order history, and personalize your experience on our platform. We do not have access to your Google password, and we do not share your authentication data with third parties.
          </p>
        </div>

        {/* Section 2 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Eye size={20} color="#e11d48" /> How We Use Your Information
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-main)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>To confirm and deliver your order</li>
            <li>To contact you if there's any issue with delivery</li>
            <li>To share updates, offers, or promotions (only if you've opted in)</li>
          </ul>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 16 }}>
            We do not sell, trade, or rent your personal information to anyone.
          </p>
        </div>

        {/* Section 3 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Lock size={20} color="#10b981" /> Payment Security
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            For advance delivery charges or online payments, we only use secure and trusted payment gateways. Your payment details are encrypted and never stored by us.
          </p>
        </div>

        {/* Section 4 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <UsersIcon size={20} color="#f59e0b" /> Third-Party Services
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            To complete your delivery, we may share limited information (such as your name, phone number, and address) with our trusted delivery partners. We never share your data for any other purpose.
          </p>
        </div>

        {/* Section 5 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <CookieIcon size={20} color="#ef4444" /> Cookies & Website Data
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Like most websites, we may use cookies to improve your browsing experience, remember your preferences, and analyze site traffic. These cookies do not collect personal information and you can disable them anytime in your browser settings.
          </p>
        </div>

        {/* Section 6 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <SlidersIcon size={20} color="#e11d48" /> Your Privacy, Your Control
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-main)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>You can request us to update or delete your stored information at any time.</li>
            <li>If you no longer wish to receive promotional updates, let us know and we'll respect your choice.</li>
          </ul>
        </div>

        {/* Section 7 */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 20, padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <RefreshCw size={20} color="#e11d48" /> Policy Updates
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            We may update this Privacy Policy from time to time. Any changes will be posted on this page, and the updated version will take effect immediately.
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

// Simple fallback icons to ensure no import breaks
function UsersIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CookieIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
      <path d="M8.5 8.5v.01" />
      <path d="M16 15.5v.01" />
      <path d="M12 12v.01" />
      <path d="M11 17v.01" />
      <path d="M7 14v.01" />
    </svg>
  );
}

function SlidersIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}
