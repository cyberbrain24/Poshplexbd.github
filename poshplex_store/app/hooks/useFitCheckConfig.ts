"use client";

// [TEMPORARY DISCONNECT] AI Fit Check module is temporarily disconnected from backend & storefront.
// Re-enable the /api/v1/fit-check/config/public fetch below when reconnecting AI Fit Check.
export function useFitCheckConfig() {
  /*
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
  */

  return { isFitCheckActive: false, isLoading: false };
}
