import React, { useState, useEffect } from "react";
import { Layout, Menu, Button, Avatar, Space, Drawer } from "antd";
import {
  DashboardOutlined, ShoppingCartOutlined, AppstoreOutlined, AuditOutlined,
  TeamOutlined, ApiOutlined, FolderOpenOutlined, LogoutOutlined, UserOutlined,
  CarOutlined, GiftOutlined, SoundOutlined, SettingOutlined, PrinterOutlined,
  MenuOutlined, EllipsisOutlined, PictureOutlined, DesktopOutlined, CheckSquareOutlined, GlobalOutlined, BarChartOutlined,
  RocketOutlined, ThunderboltOutlined, RobotOutlined, EyeOutlined, SkinOutlined
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

const { Header, Sider, Content } = Layout;

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

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={260} breakpoint="lg" collapsedWidth="0" className="desktop-sider">
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border-glass)" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-purple)", letterSpacing: "1px" }}>POSHPLEX ERP</span>
        </div>
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
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Drawer
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        styles={{ body: { padding: 0, background: "var(--bg-secondary)" }, header: { background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-glass)" } }}
        title={<span style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-purple)" }}>POSHPLEX ERP</span>}
        width={260}
        extra={<Button type="text" icon={<LogoutOutlined />} onClick={() => logout()} style={{ color: "var(--accent-rose)", fontSize: 13 }}>Sign Out</Button>}
      >
        {identity && (
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border-glass)", display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: "var(--accent-purple)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>{identity.username}</div>
              <div style={{ fontSize: 11, color: "var(--accent-cyan)", textTransform: "capitalize" }}>{identity.role}</div>
            </div>
          </div>
        )}
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
      </Drawer>

      <Layout>
        <Header style={{ height: "auto", minHeight: 56, background: "var(--bg-secondary)", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-glass)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} style={{ color: "var(--text-main)", fontSize: 18, padding: "4px 8px", minHeight: 40, display: "none" }} className="mobile-menu-btn-header" />
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)" }}>Streetwear Admin</span>
          </div>
          <Space size="small">
            {identity && (
              <Space size="small" className="desktop-only">
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: "var(--accent-purple)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>{identity.username}</span>
              </Space>
            )}
            <Button type="text" icon={<LogoutOutlined />} onClick={() => logout()} style={{ color: "var(--accent-rose)", minHeight: 36, padding: "4px 8px" }} />
          </Space>
        </Header>
        <Content style={{ padding: 20, overflow: "initial" }}>
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
