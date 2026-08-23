"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, ArrowRight, CheckCircle2, ChevronDown, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import { useCart } from "../../context/CartContext";

// --- CUSTOM SEARCHABLE SELECT COMPONENT ---
function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder,
  disabled = false
}: { 
  options: { id: number, name: string }[], 
  value: string, 
  onChange: (val: string, id: number) => void,
  placeholder: string,
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "14px 16px",
          backgroundColor: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)",
          border: isOpen ? "1px solid var(--text-main)" : "1px solid var(--border-color, #ddd)",
          borderRadius: 4,
          color: value ? "var(--text-main)" : "var(--text-muted)",
          fontSize: 15,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition: "all 0.2s"
        }}
      >
        {value || placeholder}
        <ChevronDown size={18} style={{ opacity: 0.5, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 8,
          backgroundColor: "#ffffff",
          border: "1px solid #dddddd",
          borderRadius: 6,
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
          zIndex: 50,
          overflow: "hidden",
          animation: "fadeIn 0.15s ease-out"
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #eeeeee", display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={16} color="var(--text-muted)" />
            <input 
              autoFocus
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-main)",
                fontSize: 14
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <div 
                key={opt.id}
                onClick={() => {
                  onChange(opt.name, opt.id);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                className="select-option"
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--text-main)",
                  borderBottom: "1px solid #f0f0f0"
                }}
              >
                {opt.name}
              </div>
            )) : (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// ------------------------------------------

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTotal, clearCart } = useCart();
  
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [districts, setDistricts] = useState<{id: number, name: string}[]>([]);
  const [thanas, setThanas] = useState<{id: number, name: string, shipping_cost: string}[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState("");
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    district: "",
    districtId: 0,
    thana: "",
    thanaId: 0,
    paymentMethod: "",
    notes: ""
  });

  useEffect(() => {
    // Fetch payment methods
    fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/payments/methods`)
      .then(res => res.json())
      .then(data => {
        setPaymentMethods(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, paymentMethod: data[0].name }));
        }
      })
      .catch(err => console.error("Failed to load payment methods", err));

    // Fetch districts
    fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/locations/districts`)
      .then(res => res.json())
      .then(data => {
        setDistricts(data);
      })
      .catch(err => console.error("Failed to load districts", err));

    // Auto-fill if user is logged in
    const token = localStorage.getItem("poshplex_access_token");
    if (token) {
      fetchWithAuth(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/customers/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.username) {
          const userPhone = data.phone && data.phone.startsWith("email_") ? "" : data.phone;
          setFormData(prev => ({
            ...prev,
            name: data.username || prev.name,
            phone: userPhone || prev.phone,
            email: data.email || prev.email,
            address: data.address || prev.address,
            district: data.district_name || prev.district,
            districtId: data.district_id || prev.districtId,
            thana: data.thana_name || prev.thana,
            thanaId: data.thana_id || prev.thanaId,
          }));
        }
      })
      .catch(err => console.error("Failed to auto-fill customer profile", err));
    }
  }, []);

  // Fetch thanas when district changes
  useEffect(() => {
    if (formData.districtId) {
      fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/locations/thanas?district_id=${formData.districtId}`)
        .then(res => res.json())
        .then(data => {
          setThanas(data);
          setFormData(prev => {
            const validThana = data.find((t: any) => t.id === prev.thanaId);
            if (validThana) {
              setShippingCost(Number(validThana.shipping_cost) || 0);
              return prev;
            }
            setShippingCost(0);
            return { ...prev, thana: "", thanaId: 0 };
          });
        })
        .catch(err => console.error("Failed to load thanas", err));
    } else {
      setThanas([]);
      setShippingCost(0);
    }
  }, [formData.districtId]);

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    setIsCheckingPromo(true);
    setPromoError("");
    try {
      const url = new URL(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/marketing/validate`);
      url.searchParams.append("code", promoCode);
      url.searchParams.append("subtotal", cartTotal.toString());
      if (formData.phone) url.searchParams.append("phone", formData.phone);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      
      if (data.valid) {
        let discount = 0;
        if (data.reward_type === "percent") {
          discount = (cartTotal * Number(data.discount_value)) / 100;
          if (data.max_discount_amount && discount > Number(data.max_discount_amount)) {
            discount = Number(data.max_discount_amount);
          }
        } else if (data.reward_type === "fixed") {
          discount = Number(data.discount_value);
        } else if (data.reward_type === "freeship") {
          discount = shippingCost;
        }
        setDiscountAmount(discount);
        setAppliedPromo(promoCode.toUpperCase());
        setPromoCode("");
      } else {
        setPromoError(data.error_message || "Invalid promo code.");
        setDiscountAmount(0);
        setAppliedPromo("");
      }
    } catch (err) {
      setPromoError("Error validating promo code.");
    } finally {
      setIsCheckingPromo(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (!formData.district || !formData.thana) {
      setError("Please select both a District and Area (Thana).");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const payload = {
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_email: formData.email,
        shipping_name: formData.name,
        shipping_phone: formData.phone,
        shipping_address: formData.address,
        shipping_district: formData.district,
        shipping_thana: formData.thana,
        shipping_cost: shippingCost,
        discount_amount: discountAmount,
        promo_code: appliedPromo,
        customer_notes: formData.notes,
        payment_method: "Cash on Delivery",
        items: cart.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          price: item.price
        }))
      };

      const token = localStorage.getItem("poshplex_access_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetchWithAuth(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setSuccess(true);
        clearCart();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to place order. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container" style={{ paddingTop: 100, paddingBottom: 100, minHeight: "60vh", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, color: "#e11d48" }}>
          <CheckCircle2 size={80} />
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 900, color: "var(--text-main)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
          Order Confirmed
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, maxWidth: 500, margin: "0 auto 40px auto", lineHeight: 1.6 }}>
          Thank you for shopping with POSHPLEX. Your order has been securely placed. We will contact you shortly to confirm delivery.
        </p>
        <Link href="/" style={{ padding: "16px 48px", fontSize: 15, textDecoration: "none", display: "inline-block", fontWeight: 800, textTransform: "uppercase", backgroundColor: "#000000", color: "#ffffff", border: "1px solid #000000", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e11d48"; e.currentTarget.style.borderColor = "#e11d48"; e.currentTarget.style.boxShadow = "0 0 20px rgba(225, 29, 72, 0.4)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#000000"; e.currentTarget.style.borderColor = "#000000"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
        >
          RETURN TO HOME
        </Link>
        <style dangerouslySetInnerHTML={{__html: `
          .place-order-btn {
            background-color: var(--text-main);
            color: var(--bg-main);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid var(--text-main);
          }
          .place-order-btn:hover {
            background-color: #e11d48;
            color: #fff;
            border-color: #e11d48;
            box-shadow: 0 0 20px rgba(225, 29, 72, 0.4);
            transform: translateY(-2px);
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="container checkout-container" style={{ paddingTop: 32, paddingBottom: 100, minHeight: "70vh" }}>
      {cart.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 60 }}>
          <p style={{ fontSize: 18 }}>Your cart is currently empty.</p>
          <Link href="/catalog" className="place-order-btn" style={{ marginTop: 24, padding: "14px 36px", display: "inline-block", textDecoration: "none", fontWeight: 700 }}>
            BROWSE PRODUCTS
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 48, alignItems: "start" }} className="checkout-grid">
          {/* Left Column: Form */}
          <div>
            <form onSubmit={handleSubmit} className="checkout-form" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              
              {error && (
                <div style={{ padding: 16, backgroundColor: "rgba(225, 29, 72, 0.1)", border: "1px solid #e11d48", color: "#e11d48", borderRadius: 4, fontWeight: 500 }}>
                  {error}
                </div>
              )}

              {/* Shipping & Contact Info */}
              <div className="checkout-section">
                <h3 className="checkout-section-title">1. Shipping & Contact Information</h3>
                <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleChange} style={inputStyle} placeholder="John Doe" />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number *</label>
                    <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} style={inputStyle} placeholder="017XXXXXXXX" />
                  </div>
                  <div style={{ zIndex: 20 }}>
                    <label style={labelStyle}>District *</label>
                    <SearchableSelect 
                      options={districts}
                      value={formData.district}
                      placeholder="Select District"
                      onChange={(name, id) => setFormData(prev => ({ ...prev, district: name, districtId: id }))}
                    />
                  </div>
                  <div style={{ zIndex: 10 }}>
                    <label style={labelStyle}>Area / Thana *</label>
                    <SearchableSelect 
                      options={thanas}
                      value={formData.thana}
                      placeholder={formData.districtId ? "Select Area" : "Select District First"}
                      disabled={!formData.districtId}
                      onChange={(name, id) => {
                        setFormData(prev => ({ ...prev, thana: name, thanaId: id }));
                        const selectedThana = thanas.find(t => t.id === id);
                        if (selectedThana) {
                          setShippingCost(Number(selectedThana.shipping_cost) || 0);
                        }
                      }}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Full Address *</label>
                    <textarea required name="address" value={formData.address} onChange={handleChange} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="House/Apartment no, Street, Area" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Order Special Note (Optional)</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="Any special instructions for delivery..." />
                  </div>
                </div>
              </div>


              <div style={{ marginTop: 24 }}>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="place-order-btn"
                  style={{ 
                    width: "100%", 
                    padding: "20px", 
                    fontSize: 16, 
                    fontWeight: 900, 
                    border: "none", 
                    cursor: loading ? "not-allowed" : "pointer", 
                    display: "flex", 
                    justifyContent: "center", 
                    alignItems: "center", 
                    gap: 12, 
                    opacity: loading ? 0.7 : 1,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}
                >
                  {loading ? "PROCESSING SECURE PAYMENT..." : (
                    <>PLACE ORDER (৳{Math.max(0, cartTotal + shippingCost - discountAmount).toFixed(2)}) <ArrowRight size={22} /></>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Right Column: Order Summary */}
          <div style={{ position: "sticky", top: 120 }}>
            <div className="summary-card">
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, color: "#111111", borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 20, textTransform: "uppercase" }}>Order Summary</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32, maxHeight: 400, overflowY: "auto", paddingRight: 8 }} className="custom-scrollbar">
                {cart.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <div style={{ width: 64, height: 64, position: "relative", backgroundColor: "#f5f5f5", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(0,0,0,0.05)" }}>
                        {item.image && <Image unoptimized={true} src={item.image} alt={item.name} fill sizes="64px" priority={i < 4} style={{ objectFit: "cover" }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#111111", marginBottom: 4 }}>{item.name}</div>
                        <div style={{ fontSize: 13, color: "#555555", fontWeight: 500 }}>Qty: {item.quantity}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#111111" }}>৳{(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* PROMO CODE FIELD */}
                <div style={{ marginBottom: 8, padding: 16, backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 8, border: "1px dashed rgba(0,0,0,0.2)" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444444", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Have a Promo Code?</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input 
                      type="text" 
                      className="promo-input"
                      placeholder="ENTER CODE" 
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      style={{ flex: 1, padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 4, color: "#111", outline: "none", textTransform: "uppercase", fontSize: 14, fontWeight: 600 }}
                    />
                    <button 
                      type="button" 
                      onClick={handleApplyPromo}
                      disabled={isCheckingPromo || !promoCode}
                      style={{ padding: "0 24px", backgroundColor: "#111", color: "#fff", fontWeight: 800, border: "none", borderRadius: 4, cursor: (isCheckingPromo || !promoCode) ? "not-allowed" : "pointer", opacity: (isCheckingPromo || !promoCode) ? 0.7 : 1, transition: "all 0.2s" }}
                    >
                      {isCheckingPromo ? "..." : "APPLY"}
                    </button>
                  </div>
                  {promoError && <div style={{ color: "#e11d48", fontSize: 13, marginTop: 10, fontWeight: 600 }}>{promoError}</div>}
                  {appliedPromo && <div style={{ color: "#10b981", fontSize: 13, marginTop: 10, fontWeight: 700 }}>Promo {appliedPromo} applied successfully!</div>}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#555555", fontWeight: 500 }}>
                  <span>Subtotal</span>
                  <span>৳{cartTotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#10b981", fontWeight: 700 }}>
                    <span>Discount ({appliedPromo})</span>
                    <span>-৳{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#555555", fontWeight: 500 }}>
                  <span>Shipping</span>
                  <span style={{ color: "#111111" }}>{shippingCost > 0 ? `৳${shippingCost.toFixed(2)}` : "Calculated later"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 900, color: "#111111", marginTop: 12, paddingTop: 24, borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                  <span>TOTAL</span>
                  <span>৳{Math.max(0, cartTotal + shippingCost - discountAmount).toFixed(2)}</span>
                </div>
                
                {/* Delivery Note */}
                <div style={{ marginTop: 16, padding: 12, backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 6, fontSize: 13, color: "#444444", lineHeight: 1.6, borderLeft: "3px solid #10b981" }}>
                  <div style={{ fontWeight: 700, color: "#111111", marginBottom: 4 }}>DELIVERY TERMS:</div>
                  <div>• Inside Dhaka: Cash on Delivery</div>
                  <div>• Outside Dhaka: Advance delivery charge need to be pay</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .checkout-section {
          padding: 32px;
          background-color: rgba(255,255,255,0.01);
          border: 1px solid var(--border-color, #ddd);
          borderRadius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .checkout-section-title {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 24px;
          color: var(--text-main);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .payment-method-card {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          border: 1px solid var(--border-color, #ddd);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s ease;
          background-color: rgba(255,255,255,0.02);
        }
        
        .payment-method-card:hover {
          border-color: #555;
          background-color: rgba(255,255,255,0.04);
        }

        .payment-method-card.active {
          border-color: var(--text-main);
          background-color: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 1px var(--text-main);
        }
        
        .summary-card {
          padding: 32px;
          background-color: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        .promo-input::placeholder {
          color: #888888;
          opacity: 1;
        }

        .select-option:hover {
          background-color: rgba(0,0,0,0.05);
        }

        .place-order-btn {
          background-color: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          color: #111111;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.1);
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .place-order-btn:hover {
          background-color: #ffffff;
          color: #000000;
          border-color: rgba(0,0,0,0.2);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }
        
        .place-order-btn:active {
          transform: translateY(1px);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }

        @media (max-width: 900px) {
          .checkout-grid {
            display: flex !important;
            flex-direction: column-reverse !important;
            gap: 16px !important;
          }
          .checkout-container {
            padding-top: 16px !important;
            padding-bottom: 24px !important;
          }
          .checkout-header {
            margin-bottom: 20px !important;
          }
          .checkout-header h1 {
            font-size: 22px !important;
          }
          .checkout-section {
            padding: 16px !important;
          }
          .checkout-form {
            gap: 16px !important;
          }
          .form-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .checkout-section-title {
            font-size: 14px !important;
            margin-bottom: 12px !important;
          }
          .summary-card h3 {
            font-size: 14px !important;
            margin-bottom: 12px !important;
            padding-bottom: 8px !important;
          }
          .place-order-btn {
            background-color: #888888 !important;
            color: #ffffff !important;
            font-size: 14px !important;
            padding: 16px !important;
          }
          .promo-input {
            font-size: 12px !important;
            padding: 10px 12px !important;
          }

        }
      `}} />
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-muted)",
  marginBottom: 8,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em"
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  backgroundColor: "rgba(255,255,255,0.03)",
  border: "1px solid var(--border-color, #ddd)",
  borderRadius: 4,
  color: "var(--text-main)",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  transition: "all 0.2s ease",
};
