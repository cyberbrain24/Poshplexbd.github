import React, { useState, useEffect } from "react";
import { Spin, Tooltip, Tag, Space, Alert, Popover } from "antd";
import {
  InboxOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  CopyOutlined
} from "@ant-design/icons";
import axios from "axios";

export interface SteadfastRiskCardProps {
  phone: string;
  apiUrl?: string;
  compact?: boolean;
  initialData?: any;
}

export const SteadfastRiskCard: React.FC<SteadfastRiskCardProps> = ({
  phone,
  apiUrl,
  compact = false,
  initialData = null
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [riskData, setRiskData] = useState<any>(initialData || null);
  const [unmasked, setUnmasked] = useState<boolean>(false);

  const baseUrl = apiUrl || ((import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/orders");

  const fetchRiskScore = async (force: boolean = false) => {
    if (!phone) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token") || localStorage.getItem("poshplex_token") || "admin_imran";
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await axios.get(`${baseUrl}/delivery-risk/${cleanPhone}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRiskData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch Steadfast delivery risk score", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      setRiskData(initialData);
    } else {
      fetchRiskScore();
    }
  }, [phone, initialData]);

  if (!phone) {
    return (
      <div style={{ padding: "12px", color: "#9ca3af", fontSize: 12 }}>
        No phone number available for Delivery Risk Check.
      </div>
    );
  }

  if (loading && !riskData) {
    return (
      <div style={{ padding: "24px", textAlign: "center", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <Spin size="small" />
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>Checking Steadfast Delivery Risk for {phone}...</div>
      </div>
    );
  }

  const deliveryRatio = riskData?.delivery_ratio ?? 100;
  const cancellationRatio = riskData?.cancellation_ratio ?? 0;
  const deliveredCount = riskData?.delivered_count ?? 0;
  const cancelledCount = riskData?.cancelled_count ?? 0;
  const totalParcels = riskData?.total_parcels ?? (deliveredCount + cancelledCount);
  const totalReports = riskData?.total_reports ?? 0;
  const fraudCategories = riskData?.fraud_categories || {};
  const maskedPhone = riskData?.masked_phone || (phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone);

  // Dynamic Arc Gauge Calculation (180 degree semi-circle)
  // Radius = 44, Center = (55, 55). Circumference of semi-circle = PI * R ≈ 138.23
  const radius = 44;
  const semiCircumference = Math.PI * radius; // ~138.23
  const strokeDashoffset = semiCircumference - (deliveryRatio / 100) * semiCircumference;

  // Gauge Color logic
  const gaugeColor = deliveryRatio >= 80 ? "#10b981" : (deliveryRatio >= 60 ? "#f59e0b" : "#ef4444");

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        padding: compact ? "14px 16px" : "20px 24px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#111827",
        maxWidth: 540,
        position: "relative"
      }}
    >
      {/* Top Phone Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{unmasked ? phone : maskedPhone}</span>
          <Tooltip title={unmasked ? "Hide full phone" : "View full phone"}>
            <span
              onClick={() => setUnmasked(!unmasked)}
              style={{ cursor: "pointer", fontSize: 12, color: "#6b7280", fontWeight: 600 }}
            >
              {unmasked ? "Hide" : "Show"}
            </span>
          </Tooltip>
        </div>
        <Tooltip title="Refresh Delivery Risk from Steadfast">
          <ReloadOutlined
            spin={loading}
            onClick={() => fetchRiskScore(true)}
            style={{ cursor: "pointer", color: "#9ca3af", fontSize: 13 }}
          />
        </Tooltip>
      </div>

      {/* Middle Gauge & Parcels Ratio Section */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
        
        {/* Semi-Circular SVG Speedo Gauge */}
        <div style={{ position: "relative", width: 110, height: 65, display: "flex", justifyContent: "center" }}>
          <svg width="110" height="65" viewBox="0 0 110 65" style={{ overflow: "visible" }}>
            {/* Background Track Arc */}
            <path
              d="M 11 55 A 44 44 0 0 1 99 55"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="11"
              strokeLinecap="round"
            />
            {/* Colored Active Progress Arc */}
            <path
              d="M 11 55 A 44 44 0 0 1 99 55"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={semiCircumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
            />
          </svg>
          
          {/* Inner Gauge Text */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end"
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: "20px" }}>
              {deliveryRatio}%
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "capitalize", marginTop: 1 }}>
              Delivered
            </span>
          </div>
        </div>

        {/* Detailed Stats Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Delivered Line */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 14 }}>
            <span style={{ fontWeight: 800, color: "#10b981", fontSize: 16 }}>{deliveryRatio}%</span>
            <span style={{ fontWeight: 600, color: "#059669" }}>
              Delivered <span style={{ color: "#6b7280", fontWeight: 400 }}>·</span> {deliveredCount} {deliveredCount === 1 ? "parcel" : "parcels"}
            </span>
          </div>

          {/* Cancelled Line */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 14 }}>
            <span style={{ fontWeight: 800, color: "#ef4444", fontSize: 16 }}>{cancellationRatio}%</span>
            <span style={{ fontWeight: 600, color: "#dc2626" }}>
              Cancelled <span style={{ color: "#6b7280", fontWeight: 400 }}>·</span> {cancelledCount} {cancelledCount === 1 ? "parcel" : "parcels"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Information Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        
        {/* PARCEL VOLUME Card */}
        <div
          style={{
            background: "#FEF9E7",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid rgba(245, 158, 11, 0.15)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#92400e", fontSize: 11, fontWeight: 800, letterSpacing: "0.5px" }}>
            <InboxOutlined style={{ fontSize: 13 }} />
            <span>PARCEL VOLUME</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#78350f", marginTop: 4 }}>
            {totalParcels}
          </div>
        </div>

        {/* MERCHANT REPORTS Card */}
        <div
          style={{
            background: totalReports > 0 ? "#FEE2E2" : "#F3F4F6",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: totalReports > 0 ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid #e5e7eb"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: totalReports > 0 ? "#991b1b" : "#4b5563", fontSize: 11, fontWeight: 800, letterSpacing: "0.5px" }}>
            <SafetyCertificateOutlined style={{ fontSize: 13 }} />
            <span>MERCHANT REPORTS</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: totalReports > 0 ? "#dc2626" : "#1f2937", marginTop: 4 }}>
            {totalReports}
          </div>
        </div>
      </div>

      {/* Fraud Category Warnings (if any merchant complaints exist) */}
      {totalReports > 0 && Object.keys(fraudCategories).length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #e5e7eb" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <WarningOutlined />
            <span>Merchant Flagged Categories:</span>
          </div>
          <Space wrap size={[4, 6]}>
            {Object.entries(fraudCategories).map(([category, count]: [string, any]) => (
              <Tag key={category} color="error" style={{ fontSize: 11, padding: "1px 6px" }}>
                {category.replace(/_/g, " ").toUpperCase()}: <b>{count}</b>
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
};

export interface OrderCardRiskBadgeProps {
  phone: string;
  data?: any;
  loading?: boolean;
}

export const OrderCardRiskBadge: React.FC<OrderCardRiskBadgeProps> = ({
  phone,
  data,
  loading = false
}) => {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  const isValid = cleanPhone.length >= 10;

  if (!isValid) {
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px dashed rgba(255, 255, 255, 0.1)",
          borderRadius: 6,
          padding: "4px 8px",
          marginBottom: 8,
          fontSize: 10,
          color: "#6b7280",
          display: "flex",
          alignItems: "center",
          gap: 5,
          lineHeight: "14px"
        }}
      >
        <WarningOutlined style={{ fontSize: 10, color: "#9ca3af" }} />
        <span>No / Invalid Phone</span>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px dashed rgba(255, 255, 255, 0.12)",
          borderRadius: 6,
          padding: "5px 8px",
          marginBottom: 8,
          fontSize: 10,
          color: "#9ca3af",
          display: "flex",
          alignItems: "center",
          gap: 6,
          lineHeight: "14px"
        }}
      >
        <Spin size="small" />
        <span>Checking delivery risk...</span>
      </div>
    );
  }

  const deliveryRatio = data?.delivery_ratio ?? 100;
  const cancellationRatio = data?.cancellation_ratio ?? 0;
  const deliveredCount = data?.delivered_count ?? 0;
  const cancelledCount = data?.cancelled_count ?? 0;
  const totalParcels = data?.total_parcels ?? (deliveredCount + cancelledCount);
  const totalReports = data?.total_reports ?? 0;
  const isNewCustomer = totalParcels === 0;

  // Status Color Logic
  const statusColor = isNewCustomer
    ? "#38bdf8"
    : (deliveryRatio >= 80 ? "#10b981" : (deliveryRatio >= 60 ? "#f59e0b" : "#ef4444"));

  const borderColor = totalReports > 0
    ? "rgba(239, 68, 68, 0.55)"
    : (isNewCustomer
        ? "rgba(56, 189, 248, 0.25)"
        : (deliveryRatio >= 80
            ? "rgba(16, 185, 129, 0.3)"
            : (deliveryRatio >= 60 ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.4)")));

  const bgGlow = totalReports > 0
    ? "rgba(239, 68, 68, 0.08)"
    : (isNewCustomer
        ? "rgba(56, 189, 248, 0.04)"
        : (deliveryRatio >= 80 ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.06)"));

  return (
    <Popover
      trigger={["hover", "click"]}
      placement="rightTop"
      mouseEnterDelay={0.15}
      mouseLeaveDelay={0.2}
      overlayInnerStyle={{
        background: "#121212",
        border: "1px solid #2e2e2e",
        borderRadius: 16,
        padding: "12px 14px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.6)"
      }}
      content={
        <div style={{ width: "min(420px, 86vw)" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#9ca3af",
              letterSpacing: "0.8px",
              marginBottom: 8,
              textTransform: "uppercase"
            }}
          >
            STEADFAST DELIVERY RISK & MERCHANT REPORTS
          </div>
          <SteadfastRiskCard phone={phone} initialData={data} compact />
        </div>
      }
    >
      <div
        className="posh-risk-badge-mini"
        style={{
          background: bgGlow,
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          padding: "5px 7px",
          marginBottom: 8,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.2s ease",
          userSelect: "none",
          boxShadow: totalReports > 0 ? "0 0 10px rgba(239, 68, 68, 0.2)" : "none"
        }}
      >
        {/* Semi-circular Gauge Arc (matching Steadfast official design) */}
        <div
          className="posh-risk-badge-mini-gauge"
          style={{
            position: "relative",
            width: 44,
            height: 28,
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          <svg width="44" height="28" viewBox="0 0 44 28">
            {/* Background semi-circle arc */}
            <path
              d="M 6 25 A 16 16 0 0 1 38 25"
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Active colored arc */}
            <path
              d="M 6 25 A 16 16 0 0 1 38 25"
              fill="none"
              stroke={statusColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="50.27"
              strokeDashoffset={50.27 * (1 - (isNewCustomer ? 100 : deliveryRatio) / 100)}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            <text
              x="22"
              y="18"
              textAnchor="middle"
              fill={statusColor}
              fontSize="9.5"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {isNewCustomer ? "NEW" : `${deliveryRatio}%`}
            </text>
            <text
              x="22"
              y="25"
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="6"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {isNewCustomer ? "Client" : "Delivered"}
            </text>
          </svg>
        </div>

        {/* Right Info: Delivery rate line */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, justifyContent: "center" }}>
          {/* Delivery & Cancelled metrics */}
          <div
            className="posh-risk-badge-mini-metrics"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 10,
              lineHeight: "14px"
            }}
          >
            {isNewCustomer ? (
              <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: 10 }}>New Customer</span>
            ) : (
              <>
                <span style={{ color: "#10b981", fontWeight: 800 }}>
                  {deliveryRatio}% <span style={{ color: "#34d399", fontWeight: 600 }}>({deliveredCount})</span>
                </span>
                <span
                  style={{
                    color: cancelledCount > 0 ? "#ef4444" : "#9ca3af",
                    fontWeight: cancelledCount > 0 ? 800 : 500,
                    fontSize: 9.5
                  }}
                >
                  {cancellationRatio}% Can ({cancelledCount})
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Popover>
  );
};


