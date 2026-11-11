import React, { useState, useEffect } from "react";
import { Layout, Menu, Button, Avatar, Drawer, Tooltip } from "antd";
import {
  DashboardOutlined, ShoppingCartOutlined, AppstoreOutlined, AuditOutlined,
  TeamOutlined, ApiOutlined, FolderOpenOutlined, LogoutOutlined, UserOutlined,
  CarOutlined, GiftOutlined, SoundOutlined, SettingOutlined, PrinterOutlined,
  EllipsisOutlined, PictureOutlined, DesktopOutlined, CheckSquareOutlined, GlobalOutlined, BarChartOutlined,
  RocketOutlined, ThunderboltOutlined, RobotOutlined, EyeOutlined, SkinOutlined
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

const { Sider, Content } = Layout;

export const CustomLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<any>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem("poshplex_access_token");
    if (token) {
      axios.get(`${API_URL}/core/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          const old = localStorage.getItem("poshplex_user");
          const oldObj = old ? JSON.parse(old) : null;
          
          // Simple deep comparison for permissions
          const oldPerms = oldObj?.permissions ? JSON.stringify(oldObj.permissions) : "";
          const newPerms = data?.permissions ? JSON.stringify(data.permissions) : "";
          
          if (oldPerms !== newPerms || oldObj?.role_name !== data?.role_name) {
            localStorage.setItem("poshplex_user", JSON.stringify(data));
            window.location.reload();
          }
        })
        .catch(() => {});
    }
  }, []);

  const checkAccess = (module: string | null) => {
    if (!module) return true;
    if (!identity) return false;
    if (identity.permissions?.superuser) return true;
    if (!identity.permissions && identity.role === 'admin') return true;
    return !!identity.permissions?.[module]?.view;
  };

  const rawMenuItems = [
    { key: "/", icon: <DashboardOutlined />, label: "Dashboard", module: null },
    { key: "/reports", icon: <BarChartOutlined />, label: "Sales Reports", module: "report" },
    { key: "/orders", icon: <ShoppingCartOutlined />, label: "Orders Queue", module: "orders" },
    { key: "/order-analytics", icon: <ThunderboltOutlined style={{ color: "#a855f7" }} />, label: "Order Analytics", module: "orders" },
    { key: "/printing", icon: <PrinterOutlined />, label: "Printing Queue", module: "orders" },
    { key: "/fulfillment", icon: <CarOutlined />, label: "Fulfillment Queue", module: "orders" },
    { key: "/crm", icon: <TeamOutlined />, label: "CRM Profiles", module: "crm" },
    { key: "/catalog", icon: <AppstoreOutlined />, label: "Catalog Manager", module: "catalog" },
    { key: "/promo-codes", icon: <GiftOutlined />, label: "Discount Engine", module: "marketing" },
    { key: "/fit-check", icon: <SkinOutlined />, label: "AI Fit Check Studio", module: "fitcheck" },
    {
      key: "sub-meta-engine",
      icon: <ThunderboltOutlined />,
      label: "Meta Engine",
      module: "marketing",
      children: [
        { key: "/marketing/dashboard", icon: <DashboardOutlined />, label: "Meta Ads Optimization Engine", module: "marketing" },
        { key: "/marketing/agent", icon: <RobotOutlined />, label: "AI Agent", module: "marketing" },
        { key: "/marketing/competitor", icon: <EyeOutlined />, label: "Competitor Spy", module: "marketing" },
        { key: "/marketing/api-integration", icon: <ApiOutlined />, label: "API Integration", module: "marketing" },
        { key: "/marketing/campaigns", icon: <RocketOutlined />, label: "Meta Campaigns", module: "marketing" },
        { key: "/marketing/rules", icon: <CheckSquareOutlined />, label: "Ad Automation Rules", module: "marketing" },
        { key: "/marketing/accounts", icon: <SettingOutlined />, label: "Meta Ad Accounts", module: "marketing" },
      ],

    },
    { key: "/finance", icon: <AuditOutlined />, label: "Financial Ledger", module: "finance" },
    { key: "/tasks", icon: <CheckSquareOutlined />, label: "Task Management", module: "tasks" },
    {
      key: "sub-settings",
      icon: <SettingOutlined />,
      label: "Settings",
      module: null,
      children: [
        { key: "/settings", icon: <SettingOutlined />, label: "Site Settings", module: "core" },
        { key: "/locations", icon: <GlobalOutlined />, label: "Locations & Zones", module: "orders" },
        { key: "/staff", icon: <UserOutlined />, label: "Staff Profiles", module: "core" },
        { key: "/roles", icon: <TeamOutlined />, label: "Roles & Permissions", module: "core" },
        { key: "/integrations", icon: <ApiOutlined />, label: "Integration Setup", module: "core" },
        { key: "/media", icon: <FolderOpenOutlined />, label: "Media Library", module: "media" },
        { key: "/music", icon: <SoundOutlined />, label: "Music Library", module: "music" },
        { key: "/system-monitor", icon: <DesktopOutlined />, label: "System Monitor", module: "core" },
      ],
    },
  ];

  const rawBottomNavItems = [
    { key: "/", icon: <DashboardOutlined />, label: "Dashboard", module: null },
    { key: "/orders", icon: <ShoppingCartOutlined />, label: "Orders", module: "orders" },
    { key: "/fulfillment", icon: <CarOutlined />, label: "Fulfill", module: "orders" },
    { key: "/crm", icon: <TeamOutlined />, label: "CRM", module: "crm" },
    { key: "/catalog", icon: <AppstoreOutlined />, label: "Catalog", module: "catalog" },
  ];

  const formatMenuItem = (item: any): any => {
    if (!checkAccess(item.module)) return null;
    if (item.children && Array.isArray(item.children)) {
      const validChildren = item.children
        .map((child: any) => formatMenuItem(child))
        .filter(Boolean);
      if (validChildren.length === 0) return null;
      return {
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: validChildren,
      };
    }
    return {
      key: item.key,
      icon: item.icon,
      label: item.label,
    };
  };

  const menuItems = rawMenuItems.map(formatMenuItem).filter(Boolean);
  const bottomNavItems = rawBottomNavItems.filter(item => checkAccess(item.module)).map(item => ({ key: item.key, icon: item.icon, label: item.label }));

  const isActive = (key: string) => location.pathname === key;
  const isMetaActive = location.pathname.startsWith("/marketing");
  const isSettingsActive = ["/settings", "/locations", "/staff", "/roles", "/integrations", "/media", "/music", "/system-monitor"].includes(location.pathname);
  const defaultOpenKeys = [
    ...(isMetaActive ? ["sub-meta-engine"] : []),
    ...(isSettingsActive ? ["sub-settings"] : []),
  ];

  const sidebarFooter = (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid var(--border-glass)",
        padding: "12px 14px",
        background: "var(--bg-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          flex: 1,
        }}
      >
        <Avatar
          size="default"
          icon={<UserOutlined />}
          style={{
            backgroundColor: "var(--accent-purple)",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-main)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={identity?.username || "Admin"}
          >
            {identity?.username || "Admin"}
          </div>
          {identity?.role && (
            <div
              style={{
                fontSize: 11,
                color: "var(--accent-cyan)",
                textTransform: "capitalize",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {identity.role}
            </div>
          )}
        </div>
      </div>

      <Tooltip title="Sign Out" placement="right">
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={() => logout()}
          aria-label="Sign Out"
          style={{
            color: "var(--accent-rose)",
            fontSize: 16,
            minHeight: 36,
            width: 36,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            flexShrink: 0,
          }}
          className="sider-logout-btn"
        />
      </Tooltip>
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={260}
        breakpoint="md"
        collapsedWidth="0"
        className="desktop-sider"
        style={{
          height: "100vh",
          position: "sticky",
          top: 0,
          left: 0,
          zIndex: 101,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Top Brand Header */}
          <div
            style={{
              height: 64,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: "1px solid var(--border-glass)",
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--accent-purple)",
                letterSpacing: "1px",
              }}
            >
              POSHPLEX ERP
            </span>
          </div>

          {/* Scrollable Navigation Menu */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              paddingTop: 8,
              paddingBottom: 8,
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              defaultOpenKeys={defaultOpenKeys}
              onClick={({ key }) => {
                if (key && key.startsWith("/")) {
                  navigate(key);
                }
              }}
              items={menuItems}
            />
          </div>

          {/* Bottom Fixed User Profile & Logout Section */}
          {sidebarFooter}
        </div>
      </Sider>

      <Drawer
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        styles={{
          body: {
            padding: 0,
            background: "var(--bg-secondary)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
          header: {
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-glass)",
          },
        }}
        title={<span style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-purple)" }}>POSHPLEX ERP</span>}
        width={260}
      >
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 8, paddingBottom: 8 }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={defaultOpenKeys}
            onClick={({ key }) => {
              if (key && key.startsWith("/")) {
                navigate(key);
                setMobileMenuOpen(false);
              }
            }}
            items={menuItems}
          />
        </div>
        {sidebarFooter}
      </Drawer>

      <Layout style={{ minWidth: 0, overflowX: "hidden" }}>
        <Content style={{ padding: "16px 20px", overflowX: "hidden", minWidth: 0 }}>
          {children}
        </Content>
      </Layout>

      <nav className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          {bottomNavItems.map(item => (
            <button key={item.key} className={`mobile-bottom-nav-item${isActive(item.key) ? " active" : ""}`} onClick={() => navigate(item.key)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <button className="mobile-bottom-nav-item" onClick={() => setMobileMenuOpen(true)}>
            <span className="nav-icon"><EllipsisOutlined /></span>
            <span>More</span>
          </button>
        </div>
      </nav>
    </Layout>
  );
};
export default CustomLayout;
