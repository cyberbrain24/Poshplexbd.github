import React from "react";
import { Refine, Authenticated } from "@refinedev/core";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ConfigProvider, theme } from "antd";

import { dataProvider } from "./providers/dataProvider";
import { authProvider, accessControlProvider } from "./providers/authProvider";
import CustomLayout from "./components/layout";
import Dashboard from "./pages/dashboard";
import Catalog from "./pages/catalog";
import Orders from "./pages/orders";
import Fulfillment from "./pages/fulfillment";
import PromoCodes from "./pages/promo-codes";
import Finance from "./pages/finance";
import CRM from "./pages/crm";
import Integrations from "./pages/integrations";
import MediaLibrary from "./pages/media";
import Login from "./pages/login";
import MusicLibrary from "./pages/music";
import SettingsPage from "./pages/settings";
import PrintingQueue from "./pages/printing";
import ImageOptimizer from "./pages/imageOptimizer";
import SystemMonitor from "./pages/system-monitor";
import RolesPage from "./pages/roles";
import StaffPage from "./pages/staff";
import TasksPage from "./pages/tasks";

// Curated administrative dark-theme tokens matching streetwear aesthetics
const customTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    fontFamily: "'Outfit', sans-serif",
    colorPrimary: "#8b5cf6",
    colorBgBase: "#08080b",
    colorBgContainer: "#111116",
    borderRadius: 8,
  },
};

import { App as AntdApp } from "antd";

export const App: React.FC = () => {
  return (
    <ConfigProvider theme={customTheme}>
      <AntdApp>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            options={{ syncWithLocation: true }}
          >
            <Routes>
              {/* Non-authorized page */}
              <Route path="/login" element={<Login />} />
              
              {/* Authorized ERP core routes */}
              <Route
                element={
                  <Authenticated key="authenticated-routes" fallback={<Navigate to="/login" />}>
                    <CustomLayout>
                      <Outlet />
                    </CustomLayout>
                  </Authenticated>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/fulfillment" element={<Fulfillment />} />
                <Route path="/promo-codes" element={<PromoCodes />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/media" element={<MediaLibrary />} />
                <Route path="/music" element={<MusicLibrary />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/printing" element={<PrintingQueue />} />
                <Route path="/image-optimizer" element={<ImageOptimizer />} />
                <Route path="/system-monitor" element={<SystemMonitor />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/staff" element={<StaffPage />} />
              </Route>
              
              {/* Fallbacks */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Refine>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
};
export default App;
