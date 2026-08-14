"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, User, Phone, Key, Eye, EyeOff, ArrowRight } from "lucide-react";
import SocialLogin from "../components/SocialLogin";

function RegisterContent() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneOrEmail.trim() || !password.trim()) return;
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    let formattedInput = phoneOrEmail.trim();
    const isEmail = formattedInput.includes("@");
    
    if (!isEmail) {
      if (formattedInput.startsWith("+88")) {
        formattedInput = formattedInput.substring(3);
      }
      
      const phoneRegex = /^01\d{9}$/;
      if (!phoneRegex.test(formattedInput)) {
        setError("Phone number must be exactly 11 digits and start with 01. Or enter a valid email address.");
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formattedInput)) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          full_name: fullName, 
          phone_or_email: formattedInput, 
          password
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("poshplex_access_token", data.access_token);
        localStorage.setItem("poshplex_user", JSON.stringify(data.user));
        window.dispatchEvent(new Event("storage"));
        router.push("/profile");
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.detail || errorData.message || "Registration failed. Please check your details.");
      }
    } catch (err) {
      setError("Could not connect to authentication server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ 
      paddingTop: 100, 
      paddingBottom: 150, 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center" 
    }}>
      <div style={{ 
        background: "var(--bg-primary)", 
        border: "1px solid var(--border-glass)", 
        padding: "48px 40px", 
        maxWidth: 500, 
        width: "100%",
        boxShadow: "0 20px 40px rgba(0,0,0,0.05)"
      }}>
        
        {/* Logo/Icon */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            background: "var(--text-main)", 
            color: "var(--bg-primary)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            margin: "0 auto 16px auto" 
          }}>
            <UserPlus size={24} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1px", textTransform: "uppercase" }}>
            CREATE ACCOUNT
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
            Join the movement. Elevate your wardrobe.
          </p>
        </div>

        {error && (
          <div style={{ 
            background: "rgba(225, 29, 72, 0.1)", 
            border: "1px solid rgba(225, 29, 72, 0.2)", 
            color: "#e11d48", 
            padding: "12px 16px", 
            fontSize: 13, 
            marginBottom: 24,
            textAlign: "center"
          }}>
            {error}
          </div>
        )}

        <div suppressHydrationWarning>
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Full Name</label>
            <div style={{ position: "relative" }}>
              <User size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
              <input 
                type="text" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", color: "var(--text-main)", padding: "12px 16px 12px 44px", fontSize: 14, outline: "none" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Phone Number or Email</label>
            <div style={{ position: "relative" }}>
              <Phone size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
              <input 
                type="text" 
                required
                value={phoneOrEmail}
                onChange={(e) => setPhoneOrEmail(e.target.value)}
                placeholder="e.g. 01700000000 or email@domain.com"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", color: "var(--text-main)", padding: "12px 16px 12px 44px", fontSize: 14, outline: "none" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Password</label>
            <div style={{ position: "relative" }}>
              <Key size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", color: "var(--text-main)", padding: "12px 44px 12px 44px", fontSize: 14, outline: "none" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 16, top: 15, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <Key size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", color: "var(--text-main)", padding: "12px 44px 12px 44px", fontSize: 14, outline: "none" }}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: "absolute", right: 16, top: 15, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isLoading} style={{ background: "var(--text-main)", color: "var(--bg-primary)", border: "none", padding: "14px 28px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
            {isLoading ? "CREATING ACCOUNT..." : <>CREATE ACCOUNT <ArrowRight size={16} /></>}
          </button>
        </form>
        <SocialLogin />
        </div>

        <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid var(--border-glass)", paddingTop: 24 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>Already have an account?</p>
          <a href="/login" style={{ color: "var(--text-main)", fontWeight: 800, fontSize: 14, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            SIGN IN <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={<div className="container" style={{paddingTop: 100, textAlign: 'center'}}>Loading...</div>}>
      <RegisterContent />
    </React.Suspense>
  );
}
