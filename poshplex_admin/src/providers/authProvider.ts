import { AuthProvider } from "@refinedev/core";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://store.poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

// Setup global axios interceptor for token injection and refresh
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("poshplex_access_token");
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return axios(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise(function (resolve, reject) {
        axios.post(`${API_URL}/core/refresh`, {}, { withCredentials: true })
          .then(({ data }) => {
            localStorage.setItem("poshplex_access_token", data.access_token);
            originalRequest.headers['Authorization'] = 'Bearer ' + data.access_token;
            processQueue(null, data.access_token);
            resolve(axios(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            localStorage.removeItem("poshplex_access_token");
            localStorage.removeItem("poshplex_user");
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    try {
      const response = await axios.post(`${API_URL}/core/login`, {
        username,
        password
      }, { withCredentials: true });
      if (response.status === 200 && response.data.access_token) {
        localStorage.setItem("poshplex_access_token", response.data.access_token);
        localStorage.setItem("poshplex_user", JSON.stringify(response.data.user));
        return {
          success: true,
          redirectTo: "/"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          name: "AuthError",
          message: "Invalid username or password."
        }
      };
    }
    return { success: false };
  },
  logout: async () => {
    try {
      await axios.post(`${API_URL}/core/logout`, {}, { withCredentials: true });
    } catch (err) {
      console.warn("Logout request failed", err);
    }
    localStorage.removeItem("poshplex_access_token");
    localStorage.removeItem("poshplex_user");
    return {
      success: true,
      redirectTo: "/login"
    };
  },
  check: async () => {
    const token = localStorage.getItem("poshplex_access_token");
    if (token) {
      return { authenticated: true };
    }
    return {
      authenticated: false,
      redirectTo: "/login"
    };
  },
  getPermissions: async () => {
    const userStr = localStorage.getItem("poshplex_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.role;
    }
    return null;
  },
  getIdentity: async () => {
    const userStr = localStorage.getItem("poshplex_user");
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  },
  onError: async (error) => {
    const status = error?.response?.status || error?.status;
    if (status === 401) {
      return {
        logout: true,
        redirectTo: "/login"
      };
    }
    return {};
  }
};

export const accessControlProvider = {
  can: async ({ resource, action }: { resource?: string, action: string }) => {
    if (!resource) return { can: true };
    const userStr = localStorage.getItem("poshplex_user");
    if (!userStr) return { can: false };
    
    const user = JSON.parse(userStr);
    
    // Superadmin bypass
    if (user.permissions && user.permissions.superuser) {
        return { can: true };
    }
    
    // Check JSON matrix
    const hasAccess = user?.permissions?.[resource]?.[action];
    
    // Default to true for backward compatibility if permissions matrix is completely missing (e.g. old admin login)
    if (!user.permissions && user.role === 'admin') {
      return { can: true };
    }
    
    return {
        can: !!hasAccess,
    };
  },
};
