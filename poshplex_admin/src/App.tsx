import React, { Suspense } from "react";
import { Refine, Authenticated } from "@refinedev/core";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ConfigProvider, theme, Spin, App as AntdApp } from "antd";

import { dataProvider } from "./providers/dataProvider";
import { authProvider, accessControlProvider } from "./providers/authProvider";
import CustomLayout from "./components/layout";

const Dashboard = React.lazy(() => import("./pages/dashboard"));
const Catalog = React.lazy(() => import("./pages/catalog"));
const Orders = React.lazy(() => import("./pages/orders"));
const Fulfillment = React.lazy(() => import("./pages/fulfillment"));
const PromoCodes = React.lazy(() => import("./pages/promo-codes"));
const Finance = React.lazy(() => import("./pages/finance"));
const CRM = React.lazy(() => import("./pages/crm"));
const Integrations = React.lazy(() => import("./pages/integrations"));
const MediaLibrary = React.lazy(() => import("./pages/media"));
const Login = React.lazy(() => import("./pages/login"));
const MusicLibrary = React.lazy(() => import("./pages/music"));
const SettingsPage = React.lazy(() => import("./pages/settings"));
const PrintingQueue = React.lazy(() => import("./pages/printing"));
const SystemMonitor = React.lazy(() => import("./pages/system-monitor"));
const RolesPage = React.lazy(() => import("./pages/roles"));
const StaffPage = React.lazy(() => import("./pages/staff"));
const TasksPage = React.lazy(() => import("./pages/tasks"));
const LocationsPage = React.lazy(() => import("./pages/locations"));
const ReportsPage = React.lazy(() => import("./pages/reports"));

// Meta Engine Module Pages
const MarketingDashboard = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.MarketingDashboard })));
const CampaignList = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.CampaignList })));
const CampaignCreateWizard = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.CampaignCreateWizard })));
const CampaignShow = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.CampaignShow })));
const AutomationRulesPage = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.AutomationRulesPage })));
const MetaAccountsPage = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.MetaAccountsPage })));
const MetaAgentPage = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.MetaAgentPage })));
const CompetitorSpyPage = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.CompetitorSpyPage })));
const ApiIntegrationPage = React.lazy(() => import("./pages/marketing").then(m => ({ default: m.ApiIntegrationPage })));
const FitCheckPage = React.lazy(() => import("./pages/fit-check"));



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



const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("Static function can not consume context like dynamic theme")) {
    return;
  }
  originalWarn(...args);
};

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
            resources={[
              {
                name: "campaigns",
                list: "/marketing/campaigns",
                create: "/marketing/campaigns/create",
                show: "/marketing/campaigns/:id",
                meta: { label: "Campaigns" },
              },
              {
                name: "meta-engine",
                list: "/marketing/dashboard",
                meta: { label: "Meta Engine" },
              },
              {
                name: "meta-rules",
                list: "/marketing/rules",
                meta: { label: "Automation Rules" },
              },
              {
                name: "meta-accounts",
                list: "/marketing/accounts",
                meta: { label: "Meta Accounts" },
              },
              {
                name: "meta-agent",
                list: "/marketing/agent",
                meta: { label: "AI Agent" },
              },
              {
                name: "meta-competitor",
                list: "/marketing/competitor",
                meta: { label: "Competitor Spy" },
              },
              {
                name: "meta-api-integration",
                list: "/marketing/api-integration",
                meta: { label: "API Integration" },
              },
              {
                name: "fitcheck",
                list: "/fit-check",
                meta: { label: "AI Fit Check Studio" },
              },
            ]}
          >
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#08080b' }}><Spin size="large" /></div>}>
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
                  <Route path="/fit-check" element={<FitCheckPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
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
                  <Route path="/system-monitor" element={<SystemMonitor />} />
                  <Route path="/roles" element={<RolesPage />} />
                  <Route path="/staff" element={<StaffPage />} />
                  <Route path="/locations" element={<LocationsPage />} />

                  {/* Meta Engine Routes */}
                  <Route path="/marketing/dashboard" element={<MarketingDashboard />} />
                  <Route path="/marketing/agent" element={<MetaAgentPage />} />
                  <Route path="/marketing/competitor" element={<CompetitorSpyPage />} />
                  <Route path="/marketing/api-integration" element={<ApiIntegrationPage />} />
                  <Route path="/marketing/campaigns" element={<CampaignList />} />
                  <Route path="/marketing/campaigns/create" element={<CampaignCreateWizard />} />
                  <Route path="/marketing/campaigns/:id" element={<CampaignShow />} />
                  <Route path="/marketing/rules" element={<AutomationRulesPage />} />
                  <Route path="/marketing/accounts" element={<MetaAccountsPage />} />
                </Route>

                
                {/* Fallbacks */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </Refine>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
};
export default App;
