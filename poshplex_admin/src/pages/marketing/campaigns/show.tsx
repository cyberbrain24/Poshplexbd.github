import React, { useState, useEffect } from "react";
import {
  Card, Row, Col, Typography, Space, Button, Tag, Statistic, Table,
  Spin, message, Alert, Divider, Modal, Tooltip, Avatar
} from "antd";
import {
  ArrowLeftOutlined, CloudUploadOutlined, PauseCircleOutlined,
  PlayCircleOutlined, RiseOutlined, BulbOutlined, DollarOutlined,
  ShoppingCartOutlined, ReloadOutlined
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip as RechartsTooltip, CartesianGrid, Legend
} from "recharts";
import { AdMockupPreview } from "../components/AdMockupPreview";

const { Title, Text, Paragraph } = Typography;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const CampaignShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCampaignDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };

      const [campRes, timeRes, aiRes] = await Promise.all([
        axios.get(`${API_BASE}/campaigns/${id}/`, { headers }),
        axios.get(`${API_BASE}/analytics/timeseries/?campaign_id=${id}&range=30d`, { headers }),
        axios.get(`${API_BASE}/ai/campaign-advice/${id}/`, { headers }),
      ]);

      setCampaign(campRes.data);
      setTimeseries(timeRes.data);
      setAiAdvice(aiRes.data);
    } catch (err: any) {
      message.error("Failed to load campaign details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchCampaignDetails();
  }, [id]);

  const handleDeploy = async () => {
    message.loading({ content: "Deploying to Meta Marketing API...", key: "show_deploy" });
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/campaigns/${id}/deploy/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success({ content: "Campaign successfully deployed to Meta!", key: "show_deploy" });
      fetchCampaignDetails();
    } catch (err: any) {
      message.error({ content: err?.response?.data?.message || "Deployment failed.", key: "show_deploy" });
    }
  };

  const handlePause = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/campaigns/${id}/pause/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Campaign paused.");
      fetchCampaignDetails();
    } catch (err) {
      message.error("Failed to pause campaign.");
    }
  };

  const handleResume = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/campaigns/${id}/resume/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Campaign resumed.");
      fetchCampaignDetails();
    } catch (err) {
      message.error("Failed to resume campaign.");
    }
  };

  const handleScale = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_BASE}/campaigns/${id}/scale/`, { percentage: 20 }, { headers: { Authorization: `Bearer ${token}` } });
      message.success(`Scaled daily budget +20% to $${res.data.new_budget}!`);
      fetchCampaignDetails();
    } catch (err) {
      message.error("Failed to scale budget.");
    }
  };

  if (loading || !campaign) {
    return <div style={{ textAlign: "center", padding: "100px 0" }}><Spin size="large" /></div>;
  }

  const primaryCreative = campaign.adsets?.[0]?.creatives?.[0];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 8px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/marketing/campaigns")}>
            Campaigns
          </Button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Title level={3} style={{ margin: 0, color: "#ffffff" }}>{campaign.name}</Title>
              <Tag color={campaign.status === "ACTIVE" ? "success" : campaign.status === "PAUSED" ? "warning" : "default"}>
                {campaign.status}
              </Tag>
            </div>
            <Text style={{ color: "#9ca3af", fontSize: 12 }}>
              Meta Campaign ID: {campaign.meta_campaign_id || "Unpublished Draft"} · Objective: {campaign.objective}
            </Text>
          </div>
        </Space>

        <Space>
          {campaign.status === "DRAFT" || campaign.status === "ERROR" ? (
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleDeploy} style={{ backgroundColor: "#8b5cf6" }}>
              Deploy to Meta
            </Button>
          ) : campaign.status === "ACTIVE" ? (
            <Button icon={<PauseCircleOutlined />} onClick={handlePause}>Pause Delivery</Button>
          ) : (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleResume} style={{ backgroundColor: "#8b5cf6" }}>
              Resume Delivery
            </Button>
          )}

          {campaign.status === "ACTIVE" && (
            <Button icon={<RiseOutlined />} onClick={handleScale}>
              Scale +20%
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchCampaignDetails} />
        </Space>
      </div>

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Total Spend</span>}
              value={Number(campaign.total_spend || 0)}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#f87171", fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Attributed Revenue</span>}
              value={Number(campaign.total_revenue || 0)}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#10b981", fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>ROAS</span>}
              value={campaign.roas || 0}
              suffix="x"
              valueStyle={{ color: "#8b5cf6", fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Daily Budget</span>}
              value={Number(campaign.budget_amount)}
              prefix="$"
              valueStyle={{ color: "#ffffff", fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* AI Performance Advice */}
      {aiAdvice && (
        <Alert
          message={
            <div style={{ padding: "4px 0" }}>
              <Space style={{ marginBottom: 4 }}>
                <BulbOutlined style={{ color: "#eab308" }} />
                <Text strong style={{ color: "#fef08a" }}>AI Diagnostic Advice (Health Score: {aiAdvice.health_score}/100)</Text>
              </Space>
              <div style={{ color: "#e4e4e7", fontSize: 13, marginBottom: 8 }}>{aiAdvice.summary}</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#c4b5fd", fontSize: 12 }}>
                {aiAdvice.recommendations?.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          }
          type="info"
          showIcon={false}
          style={{ marginBottom: 24, backgroundColor: "rgba(139, 92, 246, 0.08)", borderColor: "rgba(139, 92, 246, 0.25)" }}
        />
      )}

      {/* Main Content Layout */}
      <Row gutter={[24, 24]}>
        {/* Left Side: Historical Chart & AdSet Details */}
        <Col xs={24} lg={15}>
          <Card
            title={<span style={{ color: "#ffffff" }}>Campaign Performance History</span>}
            style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 24 }}
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#f87171" fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={11} tickFormatter={(v) => `${v}x`} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 8 }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="spend" name="Spend (USD)" fill="#f87171" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* AdSets & Targeting Specs */}
          <Card
            title={<span style={{ color: "#ffffff" }}>Targeting & AdSets</span>}
            style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}
          >
            {campaign.adsets?.map((adset: any) => (
              <div key={adset.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text strong style={{ color: "#ffffff" }}>{adset.name}</Text>
                  <Tag color="purple">Daily: ${adset.daily_budget || campaign.budget_amount} USD</Tag>
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", backgroundColor: "#18181b", padding: 12, borderRadius: 8 }}>
                  <div><strong>Age:</strong> {adset.targeting?.age_min || 18} - {adset.targeting?.age_max || 45}</div>
                  <div><strong>Geo:</strong> Bangladesh (Dhaka, Chittagong, Sylhet)</div>
                  <div>
                    <strong>Interests:</strong>{" "}
                    {adset.targeting?.interests?.map((i: string) => <Tag key={i} style={{ fontSize: 10 }}>{i}</Tag>) || "Open targeting"}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </Col>

        {/* Right Side: Active Creative Preview */}
        <Col xs={24} lg={9}>
          <AdMockupPreview
            headline={primaryCreative?.headline || campaign.name}
            primaryText={primaryCreative?.primary_text}
            description={primaryCreative?.description || "STORE.POSHPLEXBD.COM"}
            callToAction={primaryCreative?.call_to_action || "SHOP_NOW"}
            imageUrl={primaryCreative?.image_url || campaign.linked_product_image}
            productName={campaign.linked_product_name || "PoshPlex Streetwear"}
          />
        </Col>
      </Row>
    </div>
  );
};
