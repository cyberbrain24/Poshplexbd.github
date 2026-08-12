import { DataProvider } from "@refinedev/core";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1";

// The global axios instance is configured with interceptors in authProvider.ts
// so we don't need a separate instance here. We just use the global one.

export const dataProvider: any = {
  getList: async ({ resource, pagination, filters, sorters }: any) => {
    let url = `${API_URL}/${resource}`;
    
    // Resolve resource paths to correct Django Ninja API modules
    if (resource === "settings" || resource === "audit-logs" || resource === "media") {
      url = `${API_URL}/core/${resource}`;
    } else if (resource === "accounts" || resource === "summary" || resource === "transactions") {
      url = `${API_URL}/finance/${resource}`;
    } else if (resource === "categories") {
      url = `${API_URL}/catalog/categories/tree`;
    } else if (resource === "products" || resource === "attributes" || resource === "variants") {
      url = `${API_URL}/catalog/${resource}`;
    } else if (resource === "orders") {
      url = `${API_URL}/orders`;
    }

    const { current = 1, pageSize = 10 } = pagination || {};
    
    const response = await axios.get(url, {
      params: {
        page: current,
        limit: pageSize,
      }
    });
    
    if (response.data && response.data.results !== undefined) {
      return {
        data: response.data.results,
        total: response.data.count !== undefined ? response.data.count : response.data.results.length,
      };
    }
    
    return {
      data: response.data,
      total: response.data.length || 0,
    };
  },

  getOne: async ({ resource, id }: any) => {
    let url = `${API_URL}/${resource}/${id}`;
    if (resource === "settings") {
      url = `${API_URL}/core/settings/${id}`;
    } else if (resource === "products") {
      url = `${API_URL}/catalog/products/${id}`;
    } else if (resource === "orders") {
      url = `${API_URL}/orders/${id}`;
    }

    const response = await axios.get(url);
    return {
      data: response.data,
    };
  },

  create: async ({ resource, variables }: any) => {
    let url = `${API_URL}/${resource}`;
    if (resource === "settings") {
      url = `${API_URL}/core/settings`;
    } else if (resource === "accounts" || resource === "transactions") {
      url = `${API_URL}/finance/${resource}`;
    } else if (resource === "products" || resource === "variants" || resource === "attributes") {
      url = `${API_URL}/catalog/${resource}`;
    } else if (resource === "orders") {
      url = `${API_URL}/orders`;
    }

    const response = await axios.post(url, variables);
    return {
      data: response.data,
    };
  },

  update: async ({ resource, id, variables }: any) => {
    let url = `${API_URL}/${resource}/${id}`;
    if (resource === "orders") {
      // In Refine updates, handle action extensions like /pay or /ship if passed in variables
      const action = (variables as any).action;
      if (action) {
        url = `${API_URL}/orders/${id}/${action}`;
      }
    }
    const response = await axios.post(url, variables);
    return {
      data: response.data,
    };
  },

  deleteOne: async ({ resource, id, variables }: any) => {
    let url = `${API_URL}/${resource}/${id}`;
    if (resource === "media" || resource === "settings") {
      url = `${API_URL}/core/${resource}/${id}`;
    } else if (resource === "products") {
      url = `${API_URL}/catalog/products/${id}`;
    } else if (resource === "orders") {
      url = `${API_URL}/orders/${id}`;
    }
    const response = await axios.delete(url, { data: variables });
    return {
      data: response.data,
    };
  },

  getCustomRequest: async ({ url, method, headers, payload }: { url: string; method: string; headers?: any; payload?: any }) => {
    const response = await axios({
      url,
      method,
      headers,
      data: payload
    });
    return response.data;
  },

  getApiUrl: () => API_URL,
};
export default dataProvider as any;
