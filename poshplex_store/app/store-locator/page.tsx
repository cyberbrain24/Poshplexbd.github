"use client";

import React, { useState } from "react";
import { MapPin, Mail, Phone, Send, Sparkles } from "lucide-react";

export default function StoreLocatorPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API submission
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 3000);
  };

  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 120, display: "flex", flexDirection: "column", gap: 60 }}>
      
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1.5px", textTransform: "uppercase" }}>
          Store Locator
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginTop: 12 }}>
          Find our headquarters or get in touch with the POSHPLEX team.
        </p>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
        gap: 48, 
        alignItems: "stretch" 
      }}>
        
        {/* Contact Info Card */}
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 24, 
          padding: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 40
        }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#e11d48", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={24} /> Flagship Studio
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
              We're located in the heart of Dhaka. Stop by our head office or reach out directly via mail or phone.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Office */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ 
                background: "rgba(225, 29, 72, 0.1)", 
                color: "#e11d48", 
                padding: 12, 
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <MapPin size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>Visit Our Office</h4>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Dhaka, Bangladesh</p>
              </div>
            </div>

            {/* Email */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ 
                background: "rgba(225, 29, 72, 0.1)", 
                color: "#e11d48", 
                padding: 12, 
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Mail size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>Mail Us</h4>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>poshplexbd@gmail.com</p>
              </div>
            </div>

            {/* Phone */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ 
                background: "rgba(16, 185, 129, 0.1)", 
                color: "#10b981", 
                padding: 12, 
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Phone size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>Call Us</h4>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>+88 01887 362831</p>
              </div>
            </div>
          </div>

          <div style={{ 
            borderTop: "1px solid var(--border-glass)", 
            paddingTop: 24, 
            fontSize: 12, 
            color: "var(--text-muted)", 
            letterSpacing: "1px", 
            textTransform: "uppercase" 
          }}>
            BE POSH WITH POSHPLEX
          </div>
        </div>

        {/* Contact Form Card */}
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 24, 
          padding: 40 
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", marginBottom: 12 }}>
            Get In Touch
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
            Have a question or need assistance? Drop us a message and we'll get back to you as soon as possible.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your Name"
                  style={{ 
                    background: "rgba(0, 0, 0, 0.2)", 
                    border: "1px solid var(--border-glass)", 
                    borderRadius: 12, 
                    color: "var(--text-main)", 
                    padding: "12px 16px",
                    fontSize: 14 
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Email</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Your Email"
                  style={{ 
                    background: "rgba(0, 0, 0, 0.2)", 
                    border: "1px solid var(--border-glass)", 
                    borderRadius: 12, 
                    color: "var(--text-main)", 
                    padding: "12px 16px",
                    fontSize: 14 
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Subject</label>
              <input 
                type="text" 
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Message Subject"
                style={{ 
                  background: "rgba(0, 0, 0, 0.2)", 
                  border: "1px solid var(--border-glass)", 
                  borderRadius: 12, 
                  color: "var(--text-main)", 
                  padding: "12px 16px",
                  fontSize: 14 
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Message</label>
              <textarea 
                rows={5}
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="How can we help you?"
                style={{ 
                  background: "rgba(0, 0, 0, 0.2)", 
                  border: "1px solid var(--border-glass)", 
                  borderRadius: 12, 
                  color: "var(--text-main)", 
                  padding: "12px 16px",
                  fontSize: 14,
                  resize: "vertical"
                }}
              />
            </div>

            <button 
              type="submit" 
              style={{ 
                background: submitted ? "#10b981" : "var(--text-main)", 
                color: "var(--bg-primary)", 
                border: "none", 
                borderRadius: 12, 
                padding: "14px 28px", 
                fontWeight: 700, 
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.3s ease",
                marginTop: 8
              }}
            >
              {submitted ? (
                <>Message Sent!</>
              ) : (
                <>
                  <Send size={16} /> Send Message
                </>
              )}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
