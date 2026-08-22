"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function SocialLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/profile";
  
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  
  const [authConfig, setAuthConfig] = useState({ 
    google: true, 
    facebook: true, 
    loaded: false 
  });

  React.useEffect(() => {
    let mounted = true;
    const fetchConfig = async () => {
      try {
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/v1/core/settings/social_auth`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setAuthConfig({
              google: data?.value?.enable_google_login !== false,
              facebook: data?.value?.enable_facebook_login !== false,
              loaded: true
            });
          }
        }
      } catch (err) {
        if (mounted) setAuthConfig(prev => ({ ...prev, loaded: true }));
      }
    };
    fetchConfig();
    return () => { mounted = false; };
  }, []);

  const handleSocialCallback = async (provider: string, token: string) => {
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/social-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token }),
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("poshplex_access_token", data.access_token);
        localStorage.setItem("poshplex_user", JSON.stringify(data.user));
        window.dispatchEvent(new Event("storage"));
        router.push(nextUrl);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.detail || `Failed to authenticate with ${provider}.`);
      }
    } catch (err) {
      setError("Could not connect to authentication server.");
    } finally {
      setIsLoading(null);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading("google");
    setError("");
    
    try {
      const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const settingsRes = await fetch(`${apiUrl}/api/v1/core/settings/social_auth`);
      const settingsData = await settingsRes.json();
      const clientId = settingsData?.value?.google_client_id || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      if (!clientId) {
        setError("Google Login is not fully configured (missing Client ID).");
        setIsLoading(null);
        return;
      }

      const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/login` : '';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=email profile&nonce=12345`;
      window.location.href = authUrl;
    } catch (err) {
      setError("Failed to initialize Google Login. Check connection.");
      setIsLoading(null);
    }
  };

  const loginWithFacebook = () => {
    setIsLoading("facebook");
    setError("");
    
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
      setError("Facebook Login is not fully configured (missing App ID).");
      setIsLoading(null);
      return;
    }
    
    const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/login` : '';
    const authUrl = `https://www.facebook.com/v11.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=token&scope=email,public_profile`;
    window.location.href = authUrl;
  };

  // Check URL hash for OAuth redirect tokens on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const idToken = params.get('id_token'); // Google
      const accessToken = params.get('access_token'); // Facebook
      
      if (idToken) {
        setIsLoading("google");
        handleSocialCallback("google", idToken);
      } else if (accessToken) {
        setIsLoading("facebook");
        handleSocialCallback("facebook", accessToken);
      }
      
      // Clean hash from URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // If config is loaded and both are disabled, don't render anything
  if (authConfig.loaded && !authConfig.google && !authConfig.facebook) {
    return null;
  }

  // Determine grid layout based on active buttons
  const activeCount = (authConfig.google ? 1 : 0) + (authConfig.facebook ? 1 : 0);
  const gridTemplateColumns = activeCount === 1 ? "1fr" : "1fr 1fr";

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      
      {error && (
        <div style={{ 
          background: "rgba(239, 68, 68, 0.1)", 
          border: "1px solid rgba(239, 68, 68, 0.2)", 
          color: "#ef4444", 
          padding: "8px", 
          borderRadius: 8, 
          fontSize: 12, 
          textAlign: "center"
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border-glass)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
          Or continue with
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border-glass)" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns, gap: 12 }}>
        {authConfig.google && (
          <button 
          type="button" 
          onClick={loginWithGoogle}
          disabled={isLoading !== null}
          style={{ 
            background: "white", 
            color: "#000", 
            border: "1px solid #ddd", 
            borderRadius: 12, 
            padding: "10px", 
            fontWeight: 600, 
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.3s ease",
            fontSize: 14
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {isLoading === "google" ? "..." : "Google"}
        </button>
        )}

        {authConfig.facebook && (
        <button 
          type="button" 
          onClick={loginWithFacebook}
          disabled={isLoading !== null}
          style={{ 
            background: "#1877F2", 
            color: "white", 
            border: "none", 
            borderRadius: 12, 
            padding: "10px", 
            fontWeight: 600, 
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.3s ease",
            fontSize: 14
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="white"/>
          </svg>
          {isLoading === "facebook" ? "..." : "Facebook"}
        </button>
        )}
      </div>
    </div>
  );
}
