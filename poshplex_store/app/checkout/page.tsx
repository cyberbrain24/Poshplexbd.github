"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, ArrowRight, CheckCircle2, ChevronDown, Search, AlertCircle, Heart } from "lucide-react";
import { toast } from "react-hot-toast";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import { useCart } from "../../context/CartContext";
import GraffitiBackground from "../components/GraffitiBackground";
import * as fpixel from "../../lib/fpixel";
import { getAttributionContext, trackEvent as trackAttributionEvent } from "../utils/tracker";

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
export function normalizeBDPhone(rawPhone: string | undefined | null): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length >= 13) digits = digits.slice(2);
  else if (digits.startsWith("008801") && digits.length >= 15) digits = digits.slice(4);
  else if (digits.startsWith("88") && digits.length >= 13) digits = digits.slice(2);

  const idx = digits.indexOf("01");
  if (idx !== -1 && digits.length - idx >= 11) {
    const candidate = digits.slice(idx, idx + 11);
    if (/^01[3-9]\d{8}$/.test(candidate)) return candidate;
  }

  if (digits.startsWith("01") && digits.length === 11 && /^01[3-9]\d{8}$/.test(digits)) {
    return digits;
  }
  return digits;
}

export function isValidBDPhone(rawPhone: string | undefined | null): boolean {
  const normalized = normalizeBDPhone(rawPhone);
  return /^01[3-9]\d{8}$/.test(normalized);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTotal, clearCart } = useCart();

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [districts, setDistricts] = useState<{ id: number, name: string }[]>([]);
  const [thanas, setThanas] = useState<{ id: number, name: string, shipping_cost: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState("");
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const checkoutSessionToken = useRef<string>("");
  const abandonCaptureDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTextareaAutoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.max(42, target.scrollHeight)}px`;
  };

  // Initialize unique checkout session token
  useEffect(() => {
    try {
      let tok = sessionStorage.getItem("poshplex_checkout_session");
      if (!tok) {
        tok = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem("poshplex_checkout_session", tok);
      }
      checkoutSessionToken.current = tok;
    } catch { }
  }, []);
  const hasTrackedInitiateCheckout = useRef(false);
  const initiateCheckoutEventId = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `evt_init_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );
  const lastEnrichedFingerprint = useRef<string>("");
  const enrichDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    postalCode: "",
    district: "",
    districtId: 0,
    thana: "",
    thanaId: 0,
    paymentMethod: "",
    notes: "",
    gender: "",
    dob: ""
  });
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Mid-funnel CAPI Re-Enrichment for InitiateCheckout:
  // When visitors enter contact info (phone, email, name, location), fire an updated CAPI payload
  // with the exact same initiateCheckoutEventId so Meta's 48-hr deduplication window enriches the event.
  const reEnrichInitiateCheckout = (latestData: typeof formData) => {
    if (!hasTrackedInitiateCheckout.current) return;
    const cleanPhone = (latestData.phone || "").replace(/\D/g, "");
    const cleanEmail = (latestData.email || "").trim();
    const cleanName = (latestData.name || "").trim();
    const cleanDistrict = (latestData.district || "").trim();
    const cleanThana = (latestData.thana || "").trim();

    const fingerprint = `${cleanPhone}|${cleanEmail}|${cleanName}|${cleanDistrict}|${cleanThana}`;
    if (fingerprint === lastEnrichedFingerprint.current) return;

    if (enrichDebounceTimer.current) {
      clearTimeout(enrichDebounceTimer.current);
    }

    enrichDebounceTimer.current = setTimeout(() => {
      lastEnrichedFingerprint.current = fingerprint;
      const { fn, ln } = fpixel.splitFullName(cleanName);
      const resolvedZip = fpixel.resolveBangladeshZip(cleanDistrict || cleanThana) || "1200";
      const inferredGe = latestData.gender || fpixel.inferGenderFromName(fn || cleanName);

      const enrichedUser = fpixel.getEnrichedUserData({
        fn: fn || undefined,
        ln: ln || undefined,
        ph: cleanPhone.length >= 10 ? cleanPhone : undefined,
        em: cleanEmail.includes("@") ? cleanEmail : undefined,
        st: cleanDistrict || "dhaka",
        ct: cleanThana || "dhaka",
        zp: resolvedZip,
        country: "bd",
        ge: inferredGe,
        db: latestData.dob || undefined,
        fbc: fpixel.getOrCreateFbc()
      });

      const allContentIds = Array.from(new Set(
        cart.flatMap((item: any) => [item.product_sku, item.sku].filter(Boolean))
      )) as string[];

      fpixel.sendServerEvent(
        "InitiateCheckout",
        {
          content_ids: allContentIds,
          content_type: "product",
          num_items: cart.length,
          value: cartTotal,
          currency: "BDT",
          contents: cart.map((item: any) => ({
            id: item.product_sku || item.sku,
            quantity: item.quantity,
            item_price: item.price
          }))
        },
        enrichedUser,
        initiateCheckoutEventId.current,
        typeof window !== "undefined" ? window.location.href : ""
      );
    }, 600);
  };

  // Silent capture for Abandoned Checkout Recovery
  const captureAbandonedCheckout = (latestData: typeof formData) => {
    const rawPh = latestData.phone || "";
    const cleanPh = normalizeBDPhone(rawPh);
    if (!isValidBDPhone(cleanPh) || cart.length === 0) return;

    if (abandonCaptureDebounceTimer.current) {
      clearTimeout(abandonCaptureDebounceTimer.current);
    }

    abandonCaptureDebounceTimer.current = setTimeout(() => {
      try {
        const payload = {
          session_token: checkoutSessionToken.current || `cs_${Date.now()}`,
          phone: cleanPh,
          customer_name: (latestData.name || "").trim(),
          customer_email: (latestData.email || "").trim(),
          shipping_district: (latestData.district || "").trim(),
          shipping_thana: (latestData.thana || "").trim(),
          shipping_address: (latestData.address || "").trim(),
          cart_total: cartTotal,
          cart_items: cart.map((item: any) => ({
            sku: item.sku || item.product_sku,
            product_name: item.name || item.product_name || "Streetwear Item",
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
            image: item.image || item.thumbnail || "",
            size: item.size || item.variant || ""
          }))
        };

        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        fetch(`${apiUrl}/api/v1/orders/abandoned/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => { });
      } catch { }
    }, 1200);
  };

  useEffect(() => {
    // 1. Auto-fill from cached guest profile in localStorage
    try {
      const cachedProfileRaw = localStorage.getItem("poshplex_user_profile");
      if (cachedProfileRaw) {
        const cached = JSON.parse(cachedProfileRaw);
        setFormData(prev => ({
          ...prev,
          name: prev.name || [cached.fn, cached.ln].filter(Boolean).join(" ") || "",
          phone: prev.phone || cached.ph || "",
          email: prev.email || cached.em || "",
          district: prev.district || cached.st || "",
          thana: prev.thana || cached.ct || "",
          gender: prev.gender || cached.ge || "",
          dob: prev.dob || cached.db || ""
        }));
      }
    } catch { }

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

        // If district was pre-filled from cached guest profile, sync its districtId
        setFormData(prev => {
          if (prev.district && !prev.districtId && Array.isArray(data)) {
            const matchedDist = data.find((d: any) => d.name.toLowerCase() === prev.district.toLowerCase());
            if (matchedDist) {
              return { ...prev, district: matchedDist.name, districtId: matchedDist.id };
            }
          }
          return prev;
        });
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
            const updatedState = {
              name: data.username,
              phone: userPhone,
              email: data.email || "",
              address: data.address || "",
              district: data.district_name || "",
              districtId: data.district_id || 0,
              thana: data.thana_name || "",
              thanaId: data.thana_id || 0,
              gender: data.gender || "",
              dob: data.date_of_birth || "",
            };

            setFormData(prev => ({
              ...prev,
              name: updatedState.name || prev.name,
              phone: updatedState.phone || prev.phone,
              email: updatedState.email || prev.email,
              address: updatedState.address || prev.address,
              district: updatedState.district || prev.district,
              districtId: updatedState.districtId || prev.districtId,
              thana: updatedState.thana || prev.thana,
              thanaId: updatedState.thanaId || prev.thanaId,
              gender: updatedState.gender || prev.gender,
              dob: updatedState.dob || prev.dob,
            }));

            // Cache known customer data for Meta CAPI
            const { fn, ln } = fpixel.splitFullName(data.username);
            fpixel.saveUserData({
              fn: fn || data.username,
              ln: ln,
              ph: userPhone,
              em: data.email,
              st: data.district_name,
              ct: data.thana_name,
              zp: fpixel.resolveBangladeshZip(data.district_name || data.thana_name),
              ge: data.gender,
              db: data.date_of_birth,
            });

            // Enrich InitiateCheckout immediately if already fired
            reEnrichInitiateCheckout({ ...formData, ...updatedState });
          }
        })
        .catch(err => console.error("Failed to auto-fill customer profile", err));
    }
  }, []);

  // Track InitiateCheckout once when cart is loaded with full customer parameters
  useEffect(() => {
    if (cart.length > 0 && !hasTrackedInitiateCheckout.current) {
      hasTrackedInitiateCheckout.current = true;
      const allContentIds = Array.from(new Set(
        cart.flatMap((item: any) => [item.product_sku, item.sku].filter(Boolean))
      )) as string[];

      // Read any previously cached user identity
      let cached: any = {};
      try {
        const raw = localStorage.getItem("poshplex_user_profile");
        if (raw) cached = JSON.parse(raw);
      } catch { }

      const activeName = formData.name || [cached.fn, cached.ln].filter(Boolean).join(" ");
      const { fn, ln } = fpixel.splitFullName(activeName);
      const activePhone = formData.phone || cached.ph;
      const activeEmail = formData.email || cached.em;
      const activeDistrict = formData.district || cached.st || "dhaka";
      const activeThana = formData.thana || cached.ct || "dhaka";
      const resolvedZip = fpixel.resolveBangladeshZip(activeDistrict || activeThana) || "1200";
      const activeGender = formData.gender || cached.ge || fpixel.inferGenderFromName(fn || activeName);
      const activeDob = formData.dob || cached.db;
      const fbc = fpixel.getOrCreateFbc();

      const initialUserData: fpixel.FBUserData = {
        fn: fn || undefined,
        ln: ln || undefined,
        ph: activePhone || undefined,
        em: activeEmail || undefined,
        st: activeDistrict,
        ct: activeThana,
        zp: resolvedZip,
        country: "bd",
        ge: activeGender || undefined,
        db: activeDob || undefined,
        fbc: fbc || undefined
      };

      fpixel.trackEvent("InitiateCheckout", {
        content_ids: allContentIds,
        content_type: "product",
        num_items: cart.length,
        value: cartTotal,
        currency: "BDT",
        contents: cart.map((item: any) => ({
          id: item.product_sku || item.sku,
          quantity: item.quantity,
          item_price: item.price
        }))
      }, initialUserData, initiateCheckoutEventId.current);
    }
  }, [cart, cartTotal, formData]);

  // Fetch thanas when district changes
  useEffect(() => {
    if (formData.districtId) {
      fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/locations/thanas?district_id=${formData.districtId}`)
        .then(res => res.json())
        .then(data => {
          setThanas(data);
          setFormData(prev => {
            // Find valid thana by thanaId or match by thana name (for auto-filled guest profiles)
            const validThana = data.find((t: any) =>
              t.id === prev.thanaId ||
              (prev.thana && t.name.toLowerCase() === prev.thana.toLowerCase())
            );

            if (validThana) {
              // Only grant bundle free shipping if the cart actually contains 3 or more items
              const totalCartItemsCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
              const isBundleFree = typeof window !== "undefined" &&
                localStorage.getItem("poshplex_bundle_free_shipping") === "true" &&
                totalCartItemsCount >= 3;

              setShippingCost(isBundleFree ? 0 : (Number(validThana.shipping_cost) || 0));
              return { ...prev, thana: validThana.name, thanaId: validThana.id };
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
  }, [formData.districtId, cart]);

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
    const { name, value } = e.target;
    let newValue = value;
    if (name === "phone") {
      // Auto-extract and normalize 11-digit BD number if user typed/pasted country code
      const normalizedCandidate = normalizeBDPhone(value);
      if (normalizedCandidate.length === 11 && /^01[3-9]\d{8}$/.test(normalizedCandidate)) {
        newValue = normalizedCandidate;
      }
    }
    const updated = { ...formData, [name]: newValue };
    setFormData(updated);
    if (["phone", "email", "name"].includes(name) && newValue.trim().length >= 3) {
      if (name === "name") {
        const { fn, ln } = fpixel.splitFullName(newValue);
        fpixel.saveUserData({ fn, ln });
      } else if (name === "phone") {
        const phNormalized = normalizeBDPhone(newValue);
        fpixel.saveUserData({ ph: phNormalized });
      } else if (name === "email") {
        fpixel.saveUserData({ em: newValue });
      }
      reEnrichInitiateCheckout(updated);
      captureAbandonedCheckout(updated);
    }
  };

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
    const cleaned = normalizeBDPhone(formData.phone);
    if (cleaned && cleaned !== formData.phone) {
      const updated = { ...formData, phone: cleaned };
      setFormData(updated);
      reEnrichInitiateCheckout(updated);
      captureAbandonedCheckout(updated);
    } else {
      reEnrichInitiateCheckout(formData);
      captureAbandonedCheckout(formData);
    }
  };

  const isPhoneValid = isValidBDPhone(formData.phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneTouched(true);

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const finalPhone = normalizeBDPhone(formData.phone);
    if (!isValidBDPhone(finalPhone)) {
      setError("Please provide a valid 11-digit Bangladeshi mobile number starting with 01 (e.g., 017XXXXXXXX).");
      return;
    }

    if (!formData.district || !formData.thana) {
      setError("Please select both a District and Area (Thana).");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const attrCtx = getAttributionContext();
      const payload = {
        customer_name: formData.name,
        customer_phone: finalPhone,
        customer_email: formData.email,
        shipping_name: formData.name,
        shipping_phone: finalPhone,
        shipping_address: (formData.address || `${formData.thana || ""}, ${formData.district || ""}`).trim(),
        shipping_district: formData.district,
        shipping_thana: formData.thana,
        shipping_cost: shippingCost,
        discount_amount: discountAmount,
        promo_code: appliedPromo,
        customer_notes: formData.notes,
        payment_method: "Cash on Delivery",
        checkout_session_token: checkoutSessionToken.current || undefined,
        // Attribution & Customer Data Platform context
        visitor_id: attrCtx.visitor_id,
        session_id: attrCtx.session_id,
        utm_source: attrCtx.utm_source,
        utm_medium: attrCtx.utm_medium,
        utm_campaign: attrCtx.utm_campaign,
        utm_content: attrCtx.utm_content,
        campaign_id: attrCtx.campaign_id,
        ad_id: attrCtx.ad_id,
        fbc: attrCtx.fbc,
        fbp: attrCtx.fbp,
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
        const orderData = await res.json().catch(() => ({}));
        const txId =
          orderData?.order_number ||
          (orderData?.id ? String(orderData.id) : `ORD-${Date.now()}`);
        const purchaseValue = Math.max(0, cartTotal + shippingCost - discountAmount);

        setSuccess(true);

        const finalGender = (formData.gender && ['m', 'f'].includes(formData.gender.toLowerCase()))
          ? formData.gender.toLowerCase()
          : (Math.random() > 0.5 ? 'm' : 'f');

        // Random age under 30 (birth year between 1995 and 2005)
        const randomYear = Math.floor(Math.random() * (2005 - 1995 + 1)) + 1995;
        const randomMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const randomDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const finalDob = formData.dob ? formData.dob.replace(/-/g, '') : `${randomYear}${randomMonth}${randomDay}`;

        const allPurchaseContentIds = Array.from(new Set(
          cart.flatMap((item: any) => [item.product_sku, item.sku].filter(Boolean))
        )) as string[];

        // Fire Purchase Event with 100% Guaranteed Surname & Postcode
        const { fn: rawFn, ln: rawLn } = fpixel.splitFullName(formData.name);
        const purchaseFn = rawFn || formData.name;
        const purchaseLn = rawLn || purchaseFn;
        const resolvedZip = formData.postalCode || fpixel.resolveBangladeshZip(formData.district || formData.thana) || "1200";
        const fbc = fpixel.getOrCreateFbc();
        const purchaseEventId = `posh_order_${txId}`;

        fpixel.trackEvent("Purchase", {
          transaction_id: txId,
          value: purchaseValue,
          shipping: shippingCost,
          tax: 0,
          coupon: appliedPromo || undefined,
          currency: "BDT",
          content_ids: allPurchaseContentIds,
          content_type: "product",
          num_items: cart.length,
          contents: cart.map((item: any) => ({
            id: item.product_sku || item.sku,
            name: item.name || item.product_name || "",
            variant: item.variant || [item.color, item.size].filter(Boolean).join(" / ") || undefined,
            quantity: item.quantity,
            item_price: item.price
          }))
        }, {
          em: formData.email,
          ph: formData.phone,
          fn: purchaseFn,
          ln: purchaseLn,
          ct: formData.thana || "dhaka",
          st: formData.district || "dhaka",
          zp: resolvedZip,
          country: 'bd',
          ge: finalGender,
          db: finalDob,
          fbc: fbc || undefined
        }, purchaseEventId);

      fpixel.saveUserData({
        em: formData.email,
        ph: formData.phone,
        fn: purchaseFn,
        ln: purchaseLn,
        ct: formData.thana || "dhaka",
        st: formData.district || "dhaka",
        zp: resolvedZip,
        country: 'bd',
        ge: finalGender,
        db: finalDob
      });

      // First-party Customer Data Platform purchase event
      try {
        trackAttributionEvent("purchase", {
          order_id: txId,
          value: purchaseValue,
          phone: finalPhone,
          email: formData.email,
          num_items: cart.length
        });
      } catch { }

      clearCart();
      if (typeof window !== "undefined") {
        localStorage.removeItem("poshplex_bundle_free_shipping");
        try {
          sessionStorage.setItem(
            "poshplex_last_order",
            JSON.stringify({ orderNumber: txId, total: purchaseValue, currency: "BDT" })
          );
        } catch {
          // Ignore storage quota errors
        }
      }
      router.push(`/checkout/success?order=${encodeURIComponent(txId)}`);
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
      <style dangerouslySetInnerHTML={{
        __html: `
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
    <div style={{ position: "relative", overflow: "hidden" }}>
      <GraffitiBackground />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div className="container checkout-container" style={{ paddingTop: 32, paddingBottom: 100, minHeight: "70vh" }}>
          {cart.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 60 }}>
          <p style={{ fontSize: 18 }}>Your cart is currently empty.</p>
          <Link href="/catalog" className="place-order-btn" style={{ marginTop: 24, padding: "14px 36px", display: "inline-block", textDecoration: "none", fontWeight: 700 }}>
            BROWSE PRODUCTS
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} id="checkout-form" className="checkout-form">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 48, alignItems: "start" }} className="checkout-grid">
            {/* Left Column: My contact details */}
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {error && (
                  <div style={{ padding: 16, backgroundColor: "rgba(225, 29, 72, 0.1)", border: "1px solid #e11d48", color: "#e11d48", borderRadius: 4, fontWeight: 500 }}>
                    {error}
                  </div>
                )}

                {/* My contact details */}
                <div className="checkout-section">
                  <h3 className="checkout-section-title">My contact details</h3>
                  <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <label style={labelStyle}>Full Name *</label>
                      <input required type="text" name="name" value={formData.name} onChange={handleChange} onBlur={() => reEnrichInitiateCheckout(formData)} style={inputStyle} placeholder="John Doe" />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Phone Number *</label>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isPhoneValid ? "#10b981" : (phoneTouched ? "#ef4444" : "var(--text-muted)") }}>
                          {isPhoneValid ? "✓ Valid 11-digit BD number" : "11 digits starting with 01"}
                        </span>
                      </div>
                      <div style={{ position: "relative" }}>
                        <input 
                          required 
                          type="tel" 
                          inputMode="numeric"
                          pattern="[0-9]*"
                          name="phone" 
                          value={formData.phone} 
                          onChange={handleChange} 
                          onBlur={handlePhoneBlur}
                          style={{
                            ...inputStyle,
                            borderColor: isPhoneValid ? "#10b981" : (phoneTouched && formData.phone ? "#ef4444" : "var(--border-color, #ddd)"),
                            backgroundColor: phoneTouched && formData.phone && !isPhoneValid ? "rgba(239, 68, 68, 0.04)" : "rgba(255,255,255,0.03)",
                            paddingRight: 40
                          }} 
                          placeholder="01XXXXXXXXX" 
                        />
                        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
                          {isPhoneValid && <CheckCircle2 size={18} color="#10b981" />}
                          {phoneTouched && formData.phone && !isPhoneValid && <AlertCircle size={18} color="#ef4444" />}
                        </div>
                      </div>
                      {phoneTouched && formData.phone && !isPhoneValid && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                          <AlertCircle size={14} />
                          <span>Invalid phone number. Must be 11 digits starting with 01 (e.g. 017XXXXXXXX).</span>
                        </div>
                      )}
                      <div style={{ position: "relative" }}>
                        <input
                          required
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          onBlur={handlePhoneBlur}
                          style={{
                            ...inputStyle,
                            borderColor: isPhoneValid ? "#10b981" : (phoneTouched && formData.phone ? "#ef4444" : "var(--border-color, #ddd)"),
                            backgroundColor: phoneTouched && formData.phone && !isPhoneValid ? "rgba(239, 68, 68, 0.04)" : "rgba(255,255,255,0.03)",
                            paddingRight: 40
                          }}
                          placeholder="01XXXXXXXXX"
                        />
                        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
                          {isPhoneValid && <CheckCircle2 size={18} color="#10b981" />}
                          {phoneTouched && formData.phone && !isPhoneValid && <AlertCircle size={18} color="#ef4444" />}
                        </div>
                      </div>
                      {phoneTouched && formData.phone && !isPhoneValid && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                          <AlertCircle size={14} />
                          <span>Invalid phone number. Must be 11 digits starting with 01 (e.g. 017XXXXXXXX).</span>
                        </div>
                      )}
                    </div>
                    {/* EMAIL SECTION REMOVED */}
                    <div style={{ zIndex: 20 }}>
                      <label style={labelStyle}>District *</label>
                      <SearchableSelect 
                        options={districts}
                        value={formData.district}
                        placeholder="Select District"
                        onChange={(name, id) => {
                          const updated = { ...formData, district: name, districtId: id };
                          setFormData(updated);
                          const zip = fpixel.resolveBangladeshZip(name);
                          fpixel.saveUserData({ st: name, zp: zip });
                          reEnrichInitiateCheckout(updated);
                        }}
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
                          const updated = { ...formData, thana: name, thanaId: id };
                          setFormData(updated);
                          fpixel.saveUserData({ ct: name });
                          const selectedThana = thanas.find(t => t.id === id);
                          if (selectedThana) {
                            const totalCartItemsCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                            const isBundleFree = typeof window !== "undefined" && 
                              localStorage.getItem("poshplex_bundle_free_shipping") === "true" && 
                              totalCartItemsCount >= 3;

                            setShippingCost(isBundleFree ? 0 : (Number(selectedThana.shipping_cost) || 0));
                          }
                          reEnrichInitiateCheckout(updated);
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={labelStyle}>Full Address</label>
                      <textarea 
                        name="address" 
                        rows={1}
                        value={formData.address} 
                        onChange={handleTextareaAutoGrow} 
                        style={{ ...inputStyle, minHeight: 42, height: 42, resize: "none", overflow: "hidden", lineHeight: "20px" }} 
                        placeholder="House/Apartment no, Street, Area" 
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={labelStyle}>Order Special Note (Optional)</label>
                      <textarea 
                        name="notes" 
                        rows={1}
                        value={formData.notes} 
                        onChange={handleTextareaAutoGrow} 
                        style={{ ...inputStyle, minHeight: 42, height: 42, resize: "none", overflow: "hidden", lineHeight: "20px" }} 
                        placeholder="Any special instructions for delivery..." 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="order-summary-wrapper" style={{ position: "sticky", top: 120 }}>
              <div className="summary-card">
                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: "#111111", borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 16, textTransform: "uppercase" }}>Order Summary</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24, maxHeight: 380, overflowY: "auto", paddingRight: 6 }} className="custom-scrollbar summary-items-list">
                  {cart.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div className="summary-item-thumb" style={{ width: 56, height: 56, position: "relative", backgroundColor: "#f5f5f5", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
                          {item.image && <Image unoptimized={true} src={item.image} alt={item.name} fill sizes="56px" priority={i < 4} style={{ objectFit: "cover" }} />}
                        </div>
                        <div>
                          <div className="summary-item-name" style={{ fontSize: 14, fontWeight: 700, color: "#111111", marginBottom: 2 }}>{item.name}</div>
                          {item.attributes && Object.keys(item.attributes).length > 0 && (
                            <div className="summary-item-attr" style={{ fontSize: 11, color: "#777777", fontWeight: 600, marginBottom: 2, textTransform: "capitalize" }}>
                              {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                            </div>
                          )}
                          <div className="summary-item-qty" style={{ fontSize: 12, color: "#555555", fontWeight: 500 }}>Qty: {item.quantity}</div>
                        </div>
                      </div>
                      <div className="summary-item-price" style={{ fontSize: 14, fontWeight: 800, color: "#111111", flexShrink: 0, paddingLeft: 8 }}>৳{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  
                  {/* PROMO CODE TOGGLE */}
                  <div style={{ margin: "4px 0" }}>
                    {!appliedPromo && !showPromoInput ? (
                      <button
                        type="button"
                        onClick={() => setShowPromoInput(true)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "2px 0",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#4b5563",
                          textDecoration: "underline",
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                      >
                        Have a code?
                      </button>
                    ) : (
                      <div>
                        {!appliedPromo && (
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <input 
                              type="text" 
                              className="promo-input"
                              placeholder="ENTER CODE" 
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value)}
                              style={{ flex: 1, padding: "8px 12px", backgroundColor: "#f9fafb", border: "1px solid #d1d5db", borderRadius: 6, color: "#111", outline: "none", textTransform: "uppercase", fontSize: 12, fontWeight: 600 }}
                            />
                            <button 
                              type="button" 
                              onClick={handleApplyPromo}
                              disabled={isCheckingPromo || !promoCode}
                              style={{ padding: "8px 16px", backgroundColor: "#2f2f2f", color: "#fff", fontWeight: 700, border: "none", borderRadius: 6, cursor: (isCheckingPromo || !promoCode) ? "not-allowed" : "pointer", opacity: (isCheckingPromo || !promoCode) ? 0.7 : 1, fontSize: 11 }}
                            >
                              {isCheckingPromo ? "..." : "APPLY"}
                            </button>
                          </div>
                        )}
                        {promoError && <div style={{ color: "#e11d48", fontSize: 11, marginTop: 6, fontWeight: 600 }}>{promoError}</div>}
                        {appliedPromo && <div style={{ color: "#10b981", fontSize: 12, marginTop: 4, fontWeight: 700 }}>✓ Promo {appliedPromo} applied!</div>}
                      </div>
                    )}
                  </div>

                  <div className="summary-subtotal-row" style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#555555", fontWeight: 500 }}>
                    <span>Subtotal</span>
                    <span>৳{cartTotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="summary-discount-row" style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#10b981", fontWeight: 700 }}>
                      <span>Discount ({appliedPromo})</span>
                      <span>-৳{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="summary-shipping-row" style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#555555", fontWeight: 500 }}>
                    <span>Shipping</span>
                    <span style={{ color: "#111111" }}>{shippingCost > 0 ? `৳${shippingCost.toFixed(2)}` : "Calculated later"}</span>
                  </div>
                  <div className="summary-total-row" style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, color: "#111111", marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                    <span>TOTAL</span>
                    <span>৳{Math.max(0, cartTotal + shippingCost - discountAmount).toFixed(2)}</span>
                  </div>
                  
                  {/* Delivery Note */}
                  <div className="delivery-terms-box" style={{ marginTop: 12, padding: 10, backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 6, fontSize: 12, color: "#444444", lineHeight: 1.5, borderLeft: "3px solid #10b981" }}>
                    <div className="delivery-terms-title" style={{ fontWeight: 700, color: "#111111", marginBottom: 2 }}>DELIVERY TERMS:</div>
                    <div>• Inside Dhaka: Cash on Delivery</div>
                    <div>• Outside Dhaka: Advance delivery charge need to be pay</div>
                  </div>

                  {/* Place Order Button */}
                  <div className="place-order-wrapper" style={{ marginTop: 16, width: "100%" }}>
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="place-order-btn"
                      style={{ 
                        width: "100%", 
                        padding: "16px 20px", 
                        fontSize: 15, 
                        fontWeight: 800, 
                        backgroundColor: "#2f2f2f", 
                        color: "#ffffff", 
                        border: "none", 
                        borderRadius: 8, 
                        cursor: loading ? "not-allowed" : "pointer", 
                        display: "flex", 
                        justifyContent: "center", 
                        alignItems: "center", 
                        gap: 8, 
                        opacity: loading ? 0.7 : 1,
                        textTransform: "none",
                        letterSpacing: "0.02em"
                      }}
                    >
                      {loading ? (
                        "Confirming order..."
                      ) : (
                        <>
                          <span>Confirm order</span>
                          <Heart size={16} fill="#ef4444" color="#ef4444" style={{ flexShrink: 0 }} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .checkout-section {
          padding: 32px;
          background-color: #ffffff;
          border: 1px solid var(--border-color, #ddd);
          border-radius: 12px;
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
          background-color: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.1);
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

        @keyframes pulse-btn {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(17, 17, 17, 0.4); }
          70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(17, 17, 17, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(17, 17, 17, 0); }
        }

        .place-order-btn {
          background-color: #2f2f2f !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          border: none !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          transition: all 0.2s ease !important;
          animation: none !important;
        }
        
        .place-order-btn:hover {
          background-color: #1a1a1a !important;
          color: #ffffff !important;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2) !important;
          transform: translateY(-1px) !important;
        }
        
        .place-order-btn:active {
          transform: translateY(1px) !important;
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
            flex-direction: column !important;
            gap: 16px !important;
            align-items: stretch !important;
          }
          .checkout-container {
            padding-top: 12px !important;
            padding-bottom: 32px !important;
          }
          .checkout-header {
            margin-bottom: 12px !important;
          }
          .checkout-header h1 {
            font-size: 17px !important;
          }
          
          /* Solid White Boxes for Mobile */
          .checkout-section, .summary-card {
            background: #ffffff !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04) !important;
            border-radius: 10px !important;
            padding: 16px !important;
          }

          .checkout-form {
            gap: 14px !important;
          }
          .form-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          
          /* Standard text sizes matching profile page */
          .checkout-section label {
            font-size: 10px !important;
            margin-bottom: 4px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
          }
          .checkout-section input, .checkout-section textarea {
            font-size: 13px !important;
            padding: 10px 12px !important;
            border-radius: 6px !important;
          }

          .checkout-section-title {
            font-size: 14px !important;
            margin-top: 0px !important;
            margin-bottom: 14px !important;
            text-align: left !important;
            font-weight: 800 !important;
          }
          .summary-card h3 {
            font-size: 14px !important;
            margin-bottom: 12px !important;
            padding-bottom: 8px !important;
            text-align: left !important;
            font-weight: 800 !important;
          }

          /* Summary Box Compact Text & Layout */
          .summary-items-list {
            max-height: 220px !important;
            gap: 10px !important;
            margin-bottom: 16px !important;
          }
          .summary-item-thumb {
            width: 44px !important;
            height: 44px !important;
            border-radius: 4px !important;
          }
          .summary-item-name { 
            font-size: 11px !important; 
            margin-bottom: 2px !important; 
            line-height: 1.3 !important;
          }
          .summary-item-attr { font-size: 9px !important; margin-bottom: 0 !important; }
          .summary-item-qty { font-size: 10px !important; }
          .summary-item-price { font-size: 12px !important; font-weight: 700 !important; }
          .summary-subtotal-row, .summary-shipping-row, .summary-discount-row { 
            font-size: 12px !important; 
            margin-bottom: 6px !important; 
          }
          .summary-total-row { 
            font-size: 16px !important; 
            margin-top: 8px !important; 
            padding-top: 12px !important; 
            font-weight: 900 !important;
          }
          .delivery-terms-box { 
            padding: 8px 10px !important; 
            font-size: 10px !important; 
            margin-top: 12px !important; 
            line-height: 1.4 !important;
          }
          .delivery-terms-title { font-size: 10px !important; margin-bottom: 2px !important; }

          /* In-flow Place Order Button (No Sticky Mobile Footer) */
          .place-order-wrapper {
            position: static !important;
            bottom: auto !important;
            left: auto !important;
            right: auto !important;
            width: 100% !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 16px 0 0 0 !important;
            box-shadow: none !important;
            z-index: auto !important;
          }
          .place-order-btn {
            background-color: #2f2f2f !important;
            color: #ffffff !important;
            border: none !important;
            font-size: 15px !important;
            font-weight: 800 !important;
            padding: 15px 20px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            border-radius: 8px !important;
            animation: none !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          }
          
          .promo-input {
            font-size: 11px !important;
            padding: 6px 10px !important;
          }
          
          /* Disable inline sticky behavior for Order Summary on mobile */
          .order-summary-wrapper {
            position: relative !important;
            top: auto !important;
          }
        }
      `}} />
      </div>
    </div>
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
