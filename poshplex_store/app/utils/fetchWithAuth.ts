export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  let accessToken = localStorage.getItem("poshplex_access_token");

  const headers = new Headers(options.headers || {});
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  // Allow sending cookies cross-origin
  const finalOptions: RequestInit = { ...options, headers, credentials: "include" };

  let response = await fetch(url, finalOptions);

  if (response.status === 401) {
    const refreshUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/core/refresh` 
      : "http://localhost:8000/api/v1/core/refresh";

    try {
      // The browser will automatically send the HttpOnly 'refresh_token' cookie
      const refreshResponse = await fetch(refreshUrl, {
        method: "POST",
        credentials: "include"
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        localStorage.setItem("poshplex_access_token", data.access_token);
        
        headers.set("Authorization", `Bearer ${data.access_token}`);
        response = await fetch(url, { ...finalOptions, headers });
      } else {
        localStorage.removeItem("poshplex_access_token");
        localStorage.removeItem("poshplex_user");
      }
    } catch (error) {
      console.error("Refresh token error:", error);
      localStorage.removeItem("poshplex_access_token");
      localStorage.removeItem("poshplex_user");
    }
  }

  return response;
};

