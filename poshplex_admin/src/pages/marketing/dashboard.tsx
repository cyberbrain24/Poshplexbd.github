import React, { useState, useEffect } from "react";
import {
  Row, Col, Card, Statistic, Segmented, Table, Tag, Typography,
  Space, Button, Spin, Alert, Progress, Tooltip, Modal, message
} from "antd";
import {
  DollarOutlined, RiseOutlined, ShoppingCartOutlined, ThunderboltOutlined,
  ReloadOutlined, BulbOutlined, EyeOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PlusOutlined, AlertOutlined, StopOutlined, RobotOutlined, CheckCircleOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Legend
} from "recharts";

const { Title, Text, Paragraph } = Typography;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const MarketingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<string>("7d");
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<any[]>([]);
  const [productAttributions, setProductAttributions] = useState<any[]>([]);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [stoppingAll, setStoppingAll] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };

      const [overviewRes, timeseriesRes, campaignsRes, productRes, aiRes] = await Promise.all([
        axios.get(`${API_BASE}/analytics/overview/?range=${range}`, { headers }),
        axios.get(`${API_BASE}/analytics/timeseries/?range=${range}`, { headers }),
        axios.get(`${API_BASE}/campaigns/`, { headers }),
        axios.get(`${API_BASE}/analytics/by-product/`, { headers }),
        axios.get(`${API_BASE}/ai/status/`, { headers }).catch(() => ({ data: null })),
      ]);

      setOverview(overviewRes.data);
      setTimeseries(timeseriesRes.data);
      setTopCampaigns(campaignsRes.data);
      setProductAttributions(productRes.data);
      if (aiRes?.data) setAiStatus(aiRes.data);
    } catch (err: any) {
      console.error("Failed to load marketing analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopAllAds = () => {
    Modal.confirm({
      title: "EMERGENCY: Pause All Active Meta Ads?",
      icon: <StopOutlined style={{ color: "#ef4444" }} />,
      content: (
        <div style={{ marginTop: 8 }}>
          <p>This is a <strong>Burn Protection Kill Switch</strong> that immediately sends pause commands to Meta API for all active campaigns across all connected accounts.</p>
          <p style={{ color: "#f87171", fontSize: 12 }}>Use this in case of runaway ad spend or sudden catalog/system issues.</p>
        </div>
      ),
      okText: "STOP ALL ADS NOW",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        setStoppingAll(true);
        try {
          const token = localStorage.getItem("poshplex_access_token");
          const res = await axios.post(`${API_BASE}/campaigns/stop-all/`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          message.warning(res.data.message || "All campaigns have been paused on Meta.");
          fetchDashboardData();
        } catch (err: any) {
          message.error("Failed to execute emergency stop: " + (err?.response?.data?.message || err.message));
        } finally {
          setStoppingAll(false);
        }
      }
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [range]);

  const campaignColumns = [
    {
      title: "Campaign",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: "#ffffff", fontSize: 13 }}>{text}</Text>
          <Text style={{ fontSize: 11, color: "#9ca3af" }}>
            {record.linked_product_name || "Catalog Generic"} · {record.objective}
          </Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const color = status === "ACTIVE" ? "success" : status === "DEPLOYING" ? "processing" : status === "PAUSED" ? "warning" : "default";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Spend",
      dataIndex: "total_spend",
      key: "total_spend",
      render: (val: number) => <Text>${Number(val).toLocaleString()}</Text>,
    },
    {
      title: "Attributed Revenue",
      dataIndex: "total_revenue",
      key: "total_revenue",
      render: (val: number) => <Text strong style={{ color: "#10b981" }}>${Number(val).toLocaleString()}</Text>,
    },
    {
      title: "ROAS",
      dataIndex: "roas",
      key: "roas",
      render: (roas: number) => {
        const isGood = roas >= 2.5;
        return (
          <Tag color={isGood ? "#059669" : roas > 1.0 ? "#d97706" : "#dc2626"} style={{ fontWeight: 700 }}>
            {roas}x
          </Tag>
        );
      },
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: any) => (
        <Button size="small" type="link" onClick={() => navigate(`/marketing/campaigns/${record.id}`)}>
          View Stats
        </Button>
      ),
    },
  ];

  const productColumns = [
    {
      title: "Product",
      dataIndex: "product_name",
      key: "product_name",
      render: (text: string, record: any) => (
        <div>
          <Text strong style={{ color: "#ffffff" }}>{text}</Text>
          {record.product_sku && <div style={{ fontSize: 11, color: "#6b7280" }}>SKU: {record.product_sku}</div>}
        </div>
      ),
    },
    {
      title: "Spend",
      dataIndex: "spend",
      key: "spend",
      render: (val: number) => `$${Number(val).toLocaleString()}`,
    },
    {
      title: "Revenue",
      dataIndex: "revenue",
      key: "revenue",
      render: (val: number) => <Text style={{ color: "#10b981" }}>${Number(val).toLocaleString()}</Text>,
    },
    {
      title: "Conversions",
      dataIndex: "conversions",
      key: "conversions",
    },
    {
      title: "ROAS",
      dataIndex: "roas",
      key: "roas",
      render: (val: number) => <Tag color={val >= 2.5 ? "green" : "orange"}>{val}x</Tag>,
    },
  ];

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Top Header & Range Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: "#ffffff" }}>Meta Ads Optimization Engine</Title>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>Real-time attribution, ROAS tracking, and autonomous scaling</Text>
        </div>
        <Space size="middle">
          <Segmented
            options={[
              { label: "Last 7 Days", value: "7d" },
              { label: "Last 30 Days", value: "30d" },
              { label: "Last 90 Days", value: "90d" },
            ]}
            value={range}
            onChange={(v) => setRange(v as string)}
            style={{ backgroundColor: "#18181b" }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchDashboardData} loading={loading}>
            Refresh
          </Button>
          <Button
            danger
            type="primary"
            icon={<StopOutlined />}
            loading={stoppingAll}
            onClick={handleStopAllAds}
            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
          >
            STOP ALL ADS
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/marketing/campaigns/create")} style={{ backgroundColor: "#8b5cf6" }}>
            New Campaign
          </Button>
        </Space>
      </div>

      {/* AI Guard Status Banner */}
      {aiStatus && (
        <Alert
          style={{ marginBottom: 16, backgroundColor: aiStatus.is_available ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.1)", borderColor: aiStatus.is_available ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.3)" }}
          message={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Space>
                <RobotOutlined style={{ color: aiStatus.is_available ? "#10b981" : "#ef4444" }} />
                <Text strong style={{ color: aiStatus.is_available ? "#10b981" : "#ef4444" }}>
                  {aiStatus.is_available ? "AI Copy Guard: Online (Cheap Model Default)" : "AI Copy Guard: Budget Reached / Paused"}
                </Text>
                <Tag color={aiStatus.is_available ? "green" : "red"}>
                  Spend Today: ${aiStatus.spent_today_usd.toFixed(4)} / ${aiStatus.daily_budget_usd.toFixed(2)}
                </Tag>
              </Space>
              <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                Active Quota: {aiStatus.user_quota.used_today} / {aiStatus.user_quota.daily_limit} generations today (Resets midnight Asia/Dhaka)
              </Text>
            </div>
          }
          type={aiStatus.is_available ? "success" : "error"}
          showIcon={false}
        />
      )}

      {loading && !overview ? (
        <div style={{ textAlign: "center", padding: "100px 0" }}><Spin size="large" /></div>
      ) : (
        <>
          {/* KPI Cards Row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={4}>
              <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <Statistic
                  title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Total Ad Spend</span>}
                  value={Number(overview?.total_spend || 0)}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#f87171", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <Statistic
                  title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Attributed Revenue</span>}
                  value={Number(overview?.total_revenue || 0)}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#10b981", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <Statistic
                  title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Blended ROAS</span>}
                  value={overview?.blended_roas || 0}
                  suffix="x"
                  valueStyle={{ color: "#8b5cf6", fontWeight: 800, fontSize: 24 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <Statistic
                  title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Purchases (Conversions)</span>}
                  value={overview?.conversions || 0}
                  prefix={<ShoppingCartOutlined style={{ marginRight: 6 }} />}
                  valueStyle={{ color: "#60a5fa", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <Statistic
                  title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Avg. CPC / CTR</span>}
                  value={`$${overview?.average_cpc || 0} · ${overview?.average_ctr || 0}%`}
                  valueStyle={{ color: "#e5e7eb", fontSize: 18, fontWeight: 600 }}
                />
              </Card>
            </Col>
          </Row>

          {/* AI Advisor Alert Banner */}
          <Alert
            message={
              <Space>
                <BulbOutlined style={{ color: "#eab308", fontSize: 16 }} />
                <Text strong style={{ color: "#fef08a" }}>Meta Engine AI Advisor:</Text>
                <span>
                  High-converting winner detected! "FW26 Drop - Oversized Heavyweight Tee" is driving <strong>3.8x ROAS</strong> with 2.8% CTR. Recommended to scale daily budget by 20% to capture weekend Dhaka shoppers.
                </span>
              </Space>
            }
            type="warning"
            showIcon={false}
            style={{ marginBottom: 24, backgroundColor: "rgba(234, 179, 8, 0.1)", borderColor: "rgba(234, 179, 8, 0.3)" }}
            action={
              <Button size="small" type="primary" onClick={() => navigate("/marketing/rules")} style={{ backgroundColor: "#8b5cf6" }}>
                View Automation Rules
              </Button>
            }
          />

          {/* Charts Row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Dual-Axis Spend vs ROAS */}
            <Col xs={24} lg={15}>
              <Card
                title={<span style={{ color: "#ffffff" }}>Daily Spend vs. Blended ROAS</span>}
                style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}
              >
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={timeseries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                      <YAxis yAxisId="left" stroke="#f87171" fontSize={11} tickFormatter={(v) => `$${v}`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={11} tickFormatter={(v) => `${v}x`} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 8 }}
                        formatter={(val: any, name: string) => [
                          name === "Spend (USD)" ? `$${Number(val).toLocaleString()}` : `${val}x`,
                          name
                        ]}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="spend" name="Spend (USD)" fill="#f87171" radius={[4, 4, 0, 0]} opacity={0.8} />
                      <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS (Return on Ad Spend)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            {/* Conversions Trajectory Area Chart */}
            <Col xs={24} lg={9}>
              <Card
                title={<span style={{ color: "#ffffff" }}>Purchases Attributed to Meta</span>}
                style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}
              >
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeseries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#60a5fa" fontSize={11} />
                      <RechartsTooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="conversions" name="Purchases" stroke="#60a5fa" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Bottom Tables */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card
                title={<span style={{ color: "#ffffff" }}>Active Meta Campaigns</span>}
                extra={<Button type="link" onClick={() => navigate("/marketing/campaigns")}>View All</Button>}
                style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}
              >
                <Table
                  dataSource={topCampaigns}
                  columns={campaignColumns}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card
                title={<span style={{ color: "#ffffff" }}>Attribution by Catalog Product</span>}
                style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}
              >
                <Table
                  dataSource={productAttributions}
                  columns={productColumns}
                  rowKey="product_id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};
