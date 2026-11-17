import React, { useState, useEffect } from "react";
import {
  Row, Col, Card, Statistic, Select, Table, Tag, Typography,
  Space, Button, Spin, Alert, Tooltip, message, Tabs, Badge,
  DatePicker, Input
} from "antd";
import {
  AimOutlined, ThunderboltOutlined, DollarOutlined, CheckCircleOutlined,
  ReloadOutlined, SyncOutlined, SafetyCertificateOutlined, AlertOutlined,
  EyeOutlined, SearchOutlined, AuditOutlined, CloudUploadOutlined,
  PartitionOutlined, RocketOutlined
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const AttributionPlatformPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [rebuilding, setRebuilding] = useState<boolean>(false);
  const [attributionModel, setAttributionModel] = useState<string>("last_paid");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs()
  ]);
  const [search, setSearch] = useState<string>("");

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("campaigns");

  const fetchAttributionData = async (modelToFetch = attributionModel) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };

      const date_from = dateRange ? dateRange[0].format("YYYY-MM-DD") : undefined;
      const date_to = dateRange ? dateRange[1].format("YYYY-MM-DD") : undefined;

      const [summaryRes, reconRes, diagRes] = await Promise.all([
        axios.get(`${API_BASE}/attribution/summary/`, {
          headers,
          params: { model: modelToFetch, date_from, date_to }
        }),
        axios.get(`${API_BASE}/attribution/reconciliation/`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_BASE}/attribution/diagnostics/`, { headers }).catch(() => ({ data: null }))
      ]);

      if (summaryRes.data) {
        setOverview(summaryRes.data.overview || null);
        setCampaigns(summaryRes.data.campaigns || []);
      }
      if (reconRes?.data) {
        setReconciliation(reconRes.data);
      }
      if (diagRes?.data) {
        setDiagnostics(diagRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load attribution platform data", err);
      message.error("Failed to load attribution platform metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributionData(attributionModel);
  }, [attributionModel, dateRange]);

  const handleRebuild = async () => {
    setRebuilding(true);
    message.loading({ content: "Rebuilding attribution metrics & net profit rollups...", key: "rebuildAttr" });
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_BASE}/attribution/rebuild/`, {}, { headers });
      message.success({ content: "Attribution rollups recalculated successfully!", key: "rebuildAttr" });
      await fetchAttributionData();
    } catch (err: any) {
      message.error({
        content: err?.response?.data?.message || "Failed to trigger rebuild (Super Admin required).",
        key: "rebuildAttr"
      });
    } finally {
      setRebuilding(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const campaignColumns = [
    {
      title: "Campaign",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <div>
          <Text strong style={{ color: "#ffffff", fontSize: 13 }}>{text}</Text>
          <div style={{ marginTop: 2 }}>
            <Tag color={record.status === "ACTIVE" ? "green" : "default"}>{record.status}</Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>ID: {record.id}</Text>
          </div>
        </div>
      )
    },
    {
      title: "Ad Spend",
      dataIndex: "spend",
      key: "spend",
      sorter: (a: any, b: any) => (a.spend_bdt || 0) - (b.spend_bdt || 0),
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ color: "#f87171" }}>৳{(record.spend_bdt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>${(record.spend || 0).toFixed(2)} USD</div>
        </div>
      )
    },
    {
      title: "Attributed Placed",
      dataIndex: "placed_orders",
      key: "placed_orders",
      sorter: (a: any, b: any) => (a.placed_orders || 0) - (b.placed_orders || 0),
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ color: "#38bdf8" }}>{record.placed_orders ? Number(record.placed_orders).toFixed(1) : "0"}</Text>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>৳{(record.placed_revenue || 0).toLocaleString()}</div>
        </div>
      )
    },
    {
      title: "Delivered Orders",
      dataIndex: "delivered_orders",
      key: "delivered_orders",
      sorter: (a: any, b: any) => (a.delivered_orders || 0) - (b.delivered_orders || 0),
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ color: "#10b981" }}>{record.delivered_orders ? Number(record.delivered_orders).toFixed(1) : "0"}</Text>
          <div style={{ fontSize: 11, color: "#10b981" }}>
            ৳{(record.delivered_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )
    },
    {
      title: "Delivery %",
      dataIndex: "delivery_rate",
      key: "delivery_rate",
      sorter: (a: any, b: any) => (a.delivery_rate || 0) - (b.delivery_rate || 0),
      render: (rate: number) => {
        const color = rate >= 80 ? "green" : rate >= 65 ? "gold" : "red";
        return <Tag color={color} style={{ fontWeight: 700 }}>{rate}%</Tag>;
      }
    },
    {
      title: "Net Ad Profit",
      dataIndex: "net_profit",
      key: "net_profit",
      sorter: (a: any, b: any) => (a.net_profit || 0) - (b.net_profit || 0),
      render: (val: number) => {
        const isProfitable = (val || 0) >= 0;
        return (
          <Tooltip title="Delivered Revenue minus Product COGS, delivery shipping cost, return penalty, and ad spend">
            <span style={{
              fontWeight: 800,
              fontSize: 13,
              color: isProfitable ? "#10b981" : "#f87171"
            }}>
              {isProfitable ? "+৳" : "-৳"}{Math.abs(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </Tooltip>
        );
      }
    },
    {
      title: "Real Delivered ROAS",
      dataIndex: "roas",
      key: "roas",
      sorter: (a: any, b: any) => (a.roas || 0) - (b.roas || 0),
      render: (roas: number) => {
        const color = roas >= 2.5 ? "green" : roas >= 1.5 ? "gold" : "red";
        return (
          <Tag color={color} style={{ fontWeight: 800, fontSize: 12 }}>
            {roas ? `${roas}x` : "0.00x"}
          </Tag>
        );
      }
    }
  ];

  return (
    <div style={{ padding: "20px 24px", minHeight: "100vh", backgroundColor: "#0b0c10" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Space align="center" size={10}>
            <AimOutlined style={{ fontSize: 24, color: "#10b981" }} />
            <Title level={3} style={{ margin: 0, color: "#ffffff", fontWeight: 800 }}>
              Customer Data & Attribution Platform
            </Title>
            <Tag color="#10b981" style={{ fontWeight: 700, borderRadius: 4, marginLeft: 6 }}>
              ENTERPRISE M1–M22
            </Tag>
          </Space>
          <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
            Multi-touch customer journeys, true delivered net profit, Meta CAPI signals & 3-way reconciliation
          </div>
        </div>

        <Space wrap size={12}>
          {/* Attribution Model Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#16181f", padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2e39" }}>
            <Text style={{ color: "#9ca3af", fontSize: 12 }}>Attribution Model:</Text>
            <Select
              value={attributionModel}
              onChange={(val) => setAttributionModel(val)}
              style={{ width: 175 }}
              popupMatchSelectWidth={false}
              options={[
                { value: "last_paid", label: "Last Paid Ad (Primary)" },
                { value: "first_touch", label: "First Touch" },
                { value: "linear", label: "Linear (Equal Split)" },
                { value: "position_based", label: "Position-Based (40/40/20)" }
              ]}
            />
          </div>

          {/* Date Range */}
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            style={{ backgroundColor: "#16181f", borderColor: "#2a2e39", color: "#fff" }}
          />

          <Button
            type="primary"
            icon={<ReloadOutlined spin={rebuilding} />}
            loading={rebuilding}
            onClick={handleRebuild}
            style={{ backgroundColor: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
          >
            Rebuild Rollups
          </Button>

          <Button
            icon={<SyncOutlined spin={loading} />}
            onClick={() => fetchAttributionData()}
            style={{ backgroundColor: "#16181f", borderColor: "#2a2e39", color: "#fff" }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* 3-Way Reconciliation Integrity Scorecard (M20) */}
      {reconciliation && (
        <Alert
          style={{
            marginBottom: 20,
            backgroundColor: reconciliation.status === "HEALTHY" ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
            border: `1px solid ${reconciliation.status === "HEALTHY" ? "#10b981" : "#ef4444"}`,
            borderRadius: 8
          }}
          message={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <Space>
                {reconciliation.status === "HEALTHY" ? (
                  <CheckCircleOutlined style={{ color: "#10b981", fontSize: 18 }} />
                ) : (
                  <AlertOutlined style={{ color: "#ef4444", fontSize: 18 }} />
                )}
                <Text strong style={{ color: "#ffffff", fontSize: 14 }}>
                  3-Way Reconciliation Scorecard: {reconciliation.status}
                </Text>
                <Tag color={reconciliation.status === "HEALTHY" ? "green" : "red"}>
                  Discrepancy: {reconciliation.discrepancy_rate}%
                </Tag>
              </Space>

              <Space size={20} style={{ color: "#d1d5db", fontSize: 12 }}>
                <span>Storefront Orders: <strong style={{ color: "#ffffff" }}>{reconciliation.storefront?.orders_count || 0}</strong></span>
                <span>Tracked Touchpoints: <strong style={{ color: "#38bdf8" }}>{reconciliation.attribution_tracked?.orders_count || 0}</strong></span>
                <span>Meta CAPI Purchases: <strong style={{ color: "#a855f7" }}>{reconciliation.meta_capi?.received_purchases || 0}</strong></span>
                <span>Raw Events Intake: <strong style={{ color: "#10b981" }}>{reconciliation.raw_events?.total_intake || 0}</strong></span>
                <span>Quarantined: <strong style={{ color: (reconciliation.raw_events?.quarantined || 0) > 0 ? "#ef4444" : "#9ca3af" }}>{reconciliation.raw_events?.quarantined || 0}</strong></span>
              </Space>
            </div>
          }
          type={reconciliation.status === "HEALTHY" ? "success" : "warning"}
        />
      )}

      {/* Executive KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Delivered ROAS</span>}
              value={overview?.roas_delivered ? `${overview.roas_delivered}x` : "0.00x"}
              valueStyle={{ color: (overview?.roas_delivered || 0) >= 2.0 ? "#10b981" : "#f87171", fontWeight: 800 }}
              prefix={<ThunderboltOutlined />}
            />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Courier-confirmed fulfilled
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Net Contribution Profit</span>}
              value={overview?.total_net_ad_profit || 0}
              precision={2}
              prefix="৳"
              valueStyle={{
                color: (overview?.total_net_ad_profit || 0) >= 0 ? "#10b981" : "#f87171",
                fontWeight: 800
              }}
            />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Revenue − COGS − Delivery − Spend
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Delivered Revenue</span>}
              value={overview?.total_delivered_revenue || 0}
              precision={2}
              prefix="৳"
              valueStyle={{ color: "#ffffff", fontWeight: 800 }}
            />
            <div style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>
              {overview?.total_delivered_orders || 0} delivered orders
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Meta Ad Spend</span>}
              value={overview?.total_spend || 0}
              precision={2}
              prefix="৳"
              valueStyle={{ color: "#f87171", fontWeight: 800 }}
            />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Across active ad accounts
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={5}>
          <Card style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: "#9ca3af", fontSize: 12 }}>Delivery Success Rate</span>}
              value={overview?.delivery_success_rate || 0}
              suffix="%"
              valueStyle={{
                color: (overview?.delivery_success_rate || 0) >= 75 ? "#10b981" : "#f59e0b",
                fontWeight: 800
              }}
            />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Delivered vs Returns / RTO
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: "campaigns",
            label: (
              <span>
                <RocketOutlined /> Campaign Attribution Performance
              </span>
            ),
            children: (
              <Card style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Input
                    prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
                    placeholder="Search campaigns..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 300, backgroundColor: "#1b1e2b", borderColor: "#2a2e39", color: "#fff" }}
                  />
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                    Active Model: <strong style={{ color: "#10b981" }}>{attributionModel.toUpperCase().replace("_", " ")}</strong>
                  </Text>
                </div>
                <Table
                  dataSource={filteredCampaigns}
                  columns={campaignColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                />
              </Card>
            )
          },
          {
            key: "events",
            label: (
              <span>
                <AuditOutlined /> Live Intake & Identity Stream
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={14}>
                  <Card
                    title={<span style={{ color: "#ffffff" }}>Raw Event Intake Stream (M2, M5)</span>}
                    extra={<Tag color="blue">{diagnostics?.summary?.total_events || 0} Total Events</Tag>}
                    style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}
                  >
                    <Table
                      dataSource={diagnostics?.recent_events || []}
                      rowKey="event_id"
                      pagination={{ pageSize: 8 }}
                      size="small"
                      columns={[
                        {
                          title: "Event",
                          dataIndex: "event_name",
                          key: "event_name",
                          render: (name: string, rec: any) => (
                            <div>
                              <Text strong style={{ color: "#38bdf8" }}>{name}</Text>
                              {rec.is_bot && <Tag color="volcano" style={{ marginLeft: 6 }}>BOT</Tag>}
                              <div style={{ fontSize: 10, color: "#6b7280" }}>{rec.event_id}</div>
                            </div>
                          )
                        },
                        {
                          title: "Visitor UUID",
                          dataIndex: "visitor_id",
                          key: "visitor_id",
                          render: (v: string) => <Text code style={{ fontSize: 11 }}>{v ? v.substring(0, 12) + "..." : "Anonymous"}</Text>
                        },
                        {
                          title: "Status",
                          dataIndex: "status",
                          key: "status",
                          render: (st: string) => {
                            const color = st === "PROCESSED" ? "green" : st === "QUARANTINED" ? "red" : "gold";
                            return <Tag color={color}>{st}</Tag>;
                          }
                        },
                        {
                          title: "Server Time",
                          dataIndex: "server_timestamp",
                          key: "server_timestamp",
                          render: (t: string) => <span style={{ fontSize: 11, color: "#9ca3af" }}>{dayjs(t).format("HH:mm:ss DD/MM")}</span>
                        }
                      ]}
                    />
                  </Card>
                </Col>

                <Col xs={24} lg={10}>
                  <Card
                    title={<span style={{ color: "#ffffff" }}>Resolved Identity Links (M6)</span>}
                    extra={<Tag color="green">{diagnostics?.summary?.total_identities || 0} Stitched</Tag>}
                    style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}
                  >
                    <Table
                      dataSource={diagnostics?.recent_identities || []}
                      rowKey="visitor_id"
                      pagination={{ pageSize: 8 }}
                      size="small"
                      columns={[
                        {
                          title: "Customer Phone",
                          dataIndex: "phone",
                          key: "phone",
                          render: (p: string) => <Text strong style={{ color: "#10b981" }}>{p || "N/A"}</Text>
                        },
                        {
                          title: "Source",
                          dataIndex: "source",
                          key: "source",
                          render: (s: string) => <Tag color="geekblue">{s}</Tag>
                        },
                        {
                          title: "Confidence",
                          dataIndex: "confidence_score",
                          key: "confidence_score",
                          render: (score: number) => <Tag color="green">{score}%</Tag>
                        },
                        {
                          title: "Stitched Time",
                          dataIndex: "created_at",
                          key: "created_at",
                          render: (t: string) => <span style={{ fontSize: 11, color: "#9ca3af" }}>{dayjs(t).format("HH:mm:ss DD/MM")}</span>
                        }
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: "capi",
            label: (
              <span>
                <CloudUploadOutlined /> Meta CAPI Outgoing Audit (M12)
              </span>
            ),
            children: (
              <Card
                title={<span style={{ color: "#ffffff" }}>Meta Conversions API (CAPI) Dispatch Log</span>}
                extra={<Tag color="purple">{diagnostics?.summary?.total_capi_logs || 0} Logs Tracked</Tag>}
                style={{ backgroundColor: "#14161f", border: "1px solid #232733", borderRadius: 8 }}
              >
                <Table
                  dataSource={diagnostics?.recent_capi_logs || []}
                  rowKey="event_id"
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: "Order ID",
                      dataIndex: "order_id",
                      key: "order_id",
                      render: (oid: number) => <Text strong style={{ color: "#ffffff" }}>#{oid}</Text>
                    },
                    {
                      title: "Event Name",
                      dataIndex: "event_name",
                      key: "event_name",
                      render: (en: string) => <Tag color="purple">{en}</Tag>
                    },
                    {
                      title: "Event ID (Deduplication)",
                      dataIndex: "event_id",
                      key: "event_id",
                      render: (eid: string) => <Text code style={{ fontSize: 11 }}>{eid}</Text>
                    },
                    {
                      title: "Status",
                      dataIndex: "status",
                      key: "status",
                      render: (st: string) => {
                        const color = st === "SUCCESS" ? "green" : st === "SKIPPED_AGE" ? "orange" : "red";
                        return <Tag color={color}>{st}</Tag>;
                      }
                    },
                    {
                      title: "HTTP Code",
                      dataIndex: "status_code",
                      key: "status_code",
                      render: (sc: number) => <Tag color={sc === 200 ? "green" : "red"}>{sc}</Tag>
                    },
                    {
                      title: "Age Guard",
                      dataIndex: "age_at_send_hours",
                      key: "age_at_send_hours",
                      render: (hours: number) => (
                        <Tooltip title="Meta CAPI strictly rejects conversion events older than 7 days (168 hours)">
                          <Tag color={hours <= 168 ? "green" : "red"}>{hours.toFixed(1)} hrs</Tag>
                        </Tooltip>
                      )
                    },
                    {
                      title: "Timestamp",
                      dataIndex: "created_at",
                      key: "created_at",
                      render: (t: string) => <span style={{ fontSize: 12, color: "#9ca3af" }}>{dayjs(t).format("YYYY-MM-DD HH:mm:ss")}</span>
                    }
                  ]}
                />
              </Card>
            )
          }
        ]}
      />
    </div>
  );
};
