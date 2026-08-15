"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Phone, Key, Eye, EyeOff, ArrowRight } from "lucide-react";

function ForgotPasswordContent() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const requestOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) return;
    
    let formattedIdentifier = identifier.trim();
    const isEmail = formattedIdentifier.includes("@");

    if (!isEmail) {
      if (formattedIdentifier.startsWith("+88")) {
        formattedIdentifier = formattedIdentifier.substring(3);
      }
      const phoneRegex = /^01\d{9}$/;
      if (!phoneRegex.test(formattedIdentifier)) {
        setError("Please enter a valid email or an 11-digit phone number.");
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formattedIdentifier)) {
        setError("Please enter a valid email or phone number.");
        return;
      }
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-forgot-password/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: formattedIdentifier }),
      });

      if (res.ok) {
        setStep(2);
        setCountdown(120); // 2 minutes
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.detail || errorData.message || "Account not found or limit reached.");
      }
    } catch (err) {
      setError("Could not connect to server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim()) {
      setError("Please enter OTP and new password.");
      return;
    }

    let formattedIdentifier = identifier.trim();
    if (!formattedIdentifier.includes("@") && formattedIdentifier.startsWith("+88")) {
      formattedIdentifier = formattedIdentifier.substring(3);
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          identifier: formattedIdentifier, 
          otp,
          new_password: newPassword
        }),
      });

      if (res.ok) {
        // Redirect to login after successful reset
        router.push("/login?reset=success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.detail || errorData.message || "Reset failed. Invalid OTP.");
      }
    } catch (err) {
      setError("Could not connect to server.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
            <ShieldCheck size={24} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1px", textTransform: "uppercase" }}>
            {step === 1 ? "FORGOT PASSWORD" : "RESET PASSWORD"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
            {step === 1 ? "Enter your email or phone number to receive an OTP." : `We sent a code to ${identifier}`}
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

        {step === 1 ? (
          <form onSubmit={requestOTP} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Email or Phone Number</label>
              <div style={{ position: "relative" }}>
                <Phone size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 01700000000 or hello@example.com"
                  style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", color: "var(--text-main)", padding: "12px 16px 12px 44px", fontSize: 14, outline: "none" }}
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} style={{ background: "var(--text-main)", color: "var(--bg-primary)", border: "none", padding: "14px 28px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              {isLoading ? "SENDING OTP..." : <>SEND OTP <ArrowRight size={16} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>6-Digit OTP</label>
              <div style={{ position: "relative" }}>
                <Key size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="XXXXXX"
                  style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", color: "var(--text-main)", padding: "12px 16px 12px 44px", fontSize: 14, outline: "none", letterSpacing: "2px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>New Password</label>
              <div style={{ position: "relative" }}>
                <Key size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", color: "var(--text-main)", padding: "12px 44px 12px 44px", fontSize: 14, outline: "none" }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 16, top: 15, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
              >
                Change Email / Phone
              </button>
              
              {countdown > 0 ? (
                <span style={{ color: "var(--text-muted)" }}>Resend in {formatTime(countdown)}</span>
              ) : (
                <button 
                  type="button" 
                  onClick={() => requestOTP()}
                  disabled={isLoading}
                  style={{ background: "none", border: "none", color: "var(--text-main)", fontWeight: "bold", cursor: "pointer", padding: 0 }}
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button type="submit" disabled={isLoading} style={{ background: "var(--text-main)", color: "var(--bg-primary)", border: "none", padding: "14px 28px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              {isLoading ? "RESETTING..." : <>RESET PASSWORD <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid var(--border-glass)", paddingTop: 24 }}>
          <a href="/login" style={{ color: "var(--text-main)", fontWeight: 800, fontSize: 14, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            BACK TO LOGIN
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <React.Suspense fallback={<div className="container" style={{paddingTop: 100, textAlign: 'center'}}>Loading...</div>}>
      <ForgotPasswordContent />
    </React.Suspense>
  );
}
