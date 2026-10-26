import React from "react";
import { Card, Typography, Button, Space, Avatar } from "antd";
import {
  GlobalOutlined, LikeOutlined, MessageOutlined, ShareAltOutlined,
  EllipsisOutlined, ShoppingCartOutlined
} from "@ant-design/icons";

const { Text, Title, Paragraph } = Typography;

interface AdMockupPreviewProps {
  headline?: string;
  primaryText?: string;
  description?: string;
  callToAction?: string;
  imageUrl?: string;
  productName?: string;
}

export const AdMockupPreview: React.FC<AdMockupPreviewProps> = ({
  headline = "Heavyweight 240+ GSM Oversized Tee",
  primaryText = "Built for the culture. Anti-shrink, heavy drop shoulder streetwear cut. Cash on delivery available nationwide.",
  description = "STORE.POSHPLEXBD.COM",
  callToAction = "SHOP_NOW",
  imageUrl,
  productName = "PoshPlex Official",
}) => {
  const ctaLabel = callToAction.replace(/_/g, " ");

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>
          Live Meta Feed Mockup
        </Text>
        <span style={{ fontSize: 11, color: "#6b7280", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 12 }}>
          Facebook / Instagram Feed
        </span>
      </div>

      <Card
        style={{
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#18181b",
          borderColor: "#27272a",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Post Header */}
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Space>
            <Avatar
              size={40}
              src="https://store.poshplexbd.com/logo.png"
              style={{ backgroundColor: "#8b5cf6", border: "1px solid #a78bfa" }}
            >
              P
            </Avatar>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Text strong style={{ color: "#ffffff", fontSize: 13 }}>PoshPlex Streetwear</Text>
                <span style={{ color: "#8b5cf6", fontSize: 11 }}>● Verified</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#9ca3af", fontSize: 11 }}>
                <span>Sponsored</span>
                <span>·</span>
                <GlobalOutlined style={{ fontSize: 10 }} />
              </div>
            </div>
          </Space>
          <EllipsisOutlined style={{ color: "#9ca3af", fontSize: 18, cursor: "pointer" }} />
        </div>

        {/* Primary Text */}
        <div style={{ padding: "0 14px 10px 14px" }}>
          <Paragraph
            style={{
              color: "#e4e4e7",
              fontSize: 13,
              marginBottom: 0,
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
            }}
          >
            {primaryText || "Your ad primary text will appear here..."}
          </Paragraph>
        </div>

        {/* Media Asset Preview */}
        <div
          style={{
            width: "100%",
            height: 280,
            backgroundColor: "#09090b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Ad Creative"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                // Fallback on broken image
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80";
              }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "#71717a", padding: 20 }}>
              <ShoppingCartOutlined style={{ fontSize: 36, marginBottom: 8, color: "#8b5cf6" }} />
              <div>No creative asset selected yet</div>
              <div style={{ fontSize: 11, color: "#52525b" }}>Select a product or upload media</div>
            </div>
          )}
        </div>

        {/* Link / CTA Bottom Bar */}
        <div
          style={{
            padding: "10px 14px",
            backgroundColor: "#27272a",
            borderTop: "1px solid #3f3f46",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1, marginRight: 12, overflow: "hidden" }}>
            <div style={{ color: "#a1a1aa", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {description || "STORE.POSHPLEXBD.COM"}
            </div>
            <div
              style={{
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {headline || "Shop the latest streetwear drop"}
            </div>
          </div>
          <Button
            type="primary"
            size="middle"
            style={{
              backgroundColor: "#8b5cf6",
              borderColor: "#8b5cf6",
              fontWeight: 600,
              fontSize: 12,
              borderRadius: 6,
            }}
          >
            {ctaLabel}
          </Button>
        </div>

        {/* Engagement Stats Bar */}
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
            color: "#9ca3af",
            fontSize: 12,
          }}
        >
          <Space size="middle">
            <span style={{ cursor: "pointer" }}><LikeOutlined /> 1.2K</span>
            <span style={{ cursor: "pointer" }}><MessageOutlined /> 84 Comments</span>
          </Space>
          <span style={{ cursor: "pointer" }}><ShareAltOutlined /> 32 Shares</span>
        </div>
      </Card>
    </div>
  );
};
