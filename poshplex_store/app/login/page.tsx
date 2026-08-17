"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Phone, Key, ArrowRight, Eye, EyeOff } from "lucide-react";
import SocialLogin from "../components/SocialLogin";
import GraffitiBackground from "../components/GraffitiBackground";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";

  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOrEmail.trim() || !password.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_or_email: phoneOrEmail, password }),
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("poshplex_access_token", data.access_token);
        localStorage.setItem("poshplex_user", JSON.stringify(data.user));
        // dispatch storage event so Header/App can catch it immediately if needed
        window.dispatchEvent(new Event("storage"));
        router.push(next);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.detail || "Invalid credentials.");
      }
    } catch (err) {
      setError("Could not connect to authentication server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "calc(100vh - 70px)", overflow: "hidden", backgroundColor: "#fff" }}>
      <GraffitiBackground />

      <div style={{ 
        position: "relative",
        zIndex: 1,
        width: "100%",
        minHeight: "calc(100vh - 70px)",
        display: "flex", 
        justifyContent: "center", 
        alignItems: "flex-start",
        padding: "40px 20px 20px 20px"
      }}>
        <div style={{ 
          background: "var(--bg-secondary)", 
          border: "1px solid var(--border-glass)", 
          borderRadius: 16, 
          padding: "24px 20px", 
          maxWidth: 450, 
          width: "100%",
          boxShadow: "none"
        }}>
        
        {/* Logo/Icon */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            background: "var(--text-main)", 
            color: "var(--bg-primary)", 
            borderRadius: 12, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            margin: "0 auto 16px auto" 
          }}>
            <Lock size={16} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-1px", textTransform: "uppercase" }}>
            Welcome Back
          </h1>
        </div>

        {error && (
          <div style={{ 
            background: "rgba(239, 68, 68, 0.1)", 
            border: "1px solid rgba(239, 68, 68, 0.2)", 
            color: "#ef4444", 
            padding: "12px 16px", 
            borderRadius: 12, 
            fontSize: 13, 
            marginBottom: 24,
            textAlign: "center"
          }}>
            {error}
          </div>
        )}

        <div suppressHydrationWarning>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
              Phone Number or Email
            </label>
            <div style={{ position: "relative" }}>
              <Phone size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
              <input 
                type="text" 
                required
                value={phoneOrEmail}
                onChange={(e) => setPhoneOrEmail(e.target.value)}
                placeholder="e.g. 01700000000 or email@domain.com"
                style={{ 
                  width: "100%",
                  background: "rgba(0, 0, 0, 0.2)", 
                  border: "1px solid var(--border-glass)", 
                  borderRadius: 12, 
                  color: "var(--text-main)", 
                  padding: "10px 14px 10px 40px",
                  fontSize: 14,
                  outline: "none"
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Key size={16} style={{ position: "absolute", left: 16, top: 15, color: "var(--text-muted)" }} />
              <input 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ 
                  width: "100%",
                  background: "rgba(0, 0, 0, 0.2)", 
                  border: "1px solid var(--border-glass)", 
                  borderRadius: 12, 
                  color: "var(--text-main)", 
                  padding: "10px 14px 10px 40px",
                  fontSize: 14,
                  outline: "none"
                }}
              />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 16, top: 15, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-12px" }}>
              <a href="/forgot-password" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
                Forgot Password?
              </a>
            </div>

            <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              background: "var(--text-main)", 
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
            {isLoading ? "Verifying..." : (
              <>
                LOGIN <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
        
        <SocialLogin />
        </div>

        <div style={{ marginTop: 16, textAlign: "center", borderTop: "1px solid var(--border-glass)", paddingTop: 16 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
            Don't have an account yet?
          </p>
          <a href="/register" style={{ 
            color: "var(--text-main)", 
            fontWeight: 800, 
            fontSize: 14, 
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }}>
            CREATE ACCOUNT <ArrowRight size={14} />
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="container" style={{paddingTop: 100, textAlign: 'center'}}>Loading...</div>}>
      <LoginContent />
    </React.Suspense>
  );
}
