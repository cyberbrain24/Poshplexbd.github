"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ImpersonateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No impersonation token provided.");
      return;
    }

    const authenticateImpersonation = async () => {
      try {
        const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/me`, {
          headers: {
            "Authorization": `Bearer ${token}`
          },
          credentials: "include"
        });

        if (res.ok) {
          const user = await res.json();
          localStorage.setItem("poshplex_access_token", token);
          localStorage.setItem("poshplex_user", JSON.stringify(user));
          window.dispatchEvent(new Event("storage"));
          
          router.push("/profile");
        } else {
          setError("Failed to authenticate impersonation session.");
        }
      } catch (err) {
        setError("Error connecting to the authentication server.");
      }
    };

    authenticateImpersonation();
  }, [token, router]);

  return (
    <div className="container" style={{ 
      paddingTop: 150, 
      paddingBottom: 150, 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center",
      textAlign: "center",
      minHeight: "60vh"
    }}>
      {error ? (
        <div style={{ color: "#ef4444", fontSize: 16, fontWeight: 500 }}>
          {error}
        </div>
      ) : (
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          Initializing impersonation session...
        </div>
      )}
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <React.Suspense fallback={<div className="container" style={{paddingTop: 100, textAlign: 'center'}}>Loading...</div>}>
      <ImpersonateContent />
    </React.Suspense>
  );
}
