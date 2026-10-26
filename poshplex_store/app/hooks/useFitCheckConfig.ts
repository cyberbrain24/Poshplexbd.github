"use client";

import { useState, useEffect } from "react";

export function useFitCheckConfig() {
  const [isFitCheckActive, setIsFitCheckActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API}/api/v1/fit-check/config/public`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (mounted && typeof data.is_active === "boolean") {
            setIsFitCheckActive(data.is_active);
          }
        }
      } catch (e) {
        // Keep default true on network glitch
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchStatus();
    return () => {
      mounted = false;
    };
  }, []);

  return { isFitCheckActive, isLoading };
}
