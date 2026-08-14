import React, { useState } from "react";
import { Layout, Menu, Button, Avatar, Space, Drawer } from "antd";
import {
  DashboardOutlined, ShoppingCartOutlined, AppstoreOutlined, AuditOutlined,
  TeamOutlined, ApiOutlined, FolderOpenOutlined, LogoutOutlined, UserOutlined,
  CarOutlined, GiftOutlined, SoundOutlined, SettingOutlined, PrinterOutlined,
  MenuOutlined, EllipsisOutlined, PictureOutlined, DesktopOutlined
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";

const { Header, Sider, Content } = Layout;

export const CustomLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<any>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
    { key: "/orders", icon: <ShoppingCartOutlined />, label: "Orders Queue" },
    { key: "/printing", icon: <PrinterOutlined />, label: "Printing Queue" },
    { key: "/fulfillment", icon: <CarOutlined />, label: "Fulfillment Queue" },
    { key: "/crm", icon: <TeamOutlined />, label: "CRM Profiles" },
    { key: "/catalog", icon: <AppstoreOutlined />, label: "Catalog Manager" },
    { key: "/promo-codes", icon: <GiftOutlined />, label: "Promo Codes" },
    { key: "/finance", icon: <AuditOutlined />, label: "Financial Ledger" },
    { key: "/integrations", icon: <ApiOutlined />, label: "Integration Setup" },
    { key: "/media", icon: <FolderOpenOutlined />, label: "Media Library" },
    { key: "/music", icon: <SoundOutlined />, label: "Music Library" },
    { key: "/image-optimizer", icon: <PictureOutlined />, label: "Image Optimizer" },
    { key: "/settings", icon: <SettingOutlined />, label: "Site Settings" },
    { key: "/system-monitor", icon: <DesktopOutlined />, label: "System Monitor" },
  ];

  const bottomNavItems = [
    { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
    { key: "/orders", icon: <ShoppingCartOutlined />, label: "Orders" },
    { key: "/fulfillment", icon: <CarOutlined />, label: "Fulfill" },
    { key: "/crm", icon: <TeamOutlined />, label: "CRM" },
    { key: "/catalog", icon: <AppstoreOutlined />, label: "Catalog" },
  ];

  const isActive = (key: string) => location.pathname === key;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={260} breakpoint="lg" collapsedWidth="0" className="desktop-sider">
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border-glass)" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-purple)", letterSpacing: "1px" }}>POSHPLEX ERP</span>
        </div>
        <Menu mode="inline" selectedKeys={[location.pathname]} onClick={({ key }) => navigate(key)} items={menuItems} style={{ marginTop: 8 }} />
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
        <Menu mode="inline" selectedKeys={[location.pathname]} onClick={({ key }) => { navigate(key); setMobileMenuOpen(false); }} items={menuItems} />
      </Drawer>

      <Layout>
        <Header style={{ height: "auto", minHeight: 56, background: "var(--bg-secondary)", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-glass)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} style={{ color: "var(--text-main)", fontSize: 18, padding: "4px 8px", minHeight: 40, display: "none" }} className="mobile-menu-btn-header" />
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)" }}>Streetwear Admin</span>
          </div>
          <Space size="small">
            {identity && (
              <Space size="small">
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
