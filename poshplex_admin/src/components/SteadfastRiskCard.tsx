import React, { useState, useEffect } from "react";
import { Spin, Tooltip, Tag, Space, Alert } from "antd";
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

interface SteadfastRiskCardProps {
  phone: string;
  apiUrl?: string;
  compact?: boolean;
}

export const SteadfastRiskCard: React.FC<SteadfastRiskCardProps> = ({
  phone,
  apiUrl,
  compact = false
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [riskData, setRiskData] = useState<any>(null);
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
    fetchRiskScore();
  }, [phone]);

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
