import React, { useState, useEffect } from "react";
import { 
  Card, Row, Col, Statistic, Table, Tag, Typography, 
  Spin, Empty, Progress, Tabs, Space, Button, message, Tooltip, Input, Select, Badge, Dropdown 
} from "antd";
import type { MenuProps } from "antd";
import { 
  ClockCircleOutlined, 
  CloseCircleOutlined, 
  SplitCellsOutlined, 
  CheckCircleOutlined, 
  SyncOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  ArrowRightOutlined
} from "@ant-design/icons";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, 
  Cell, PieChart, Pie 
} from "recharts";
import axios from "axios";
import { 
  DELAY_BLOCKER_MAP, 
  CANCELLATION_REASON_MAP, 
  SKU_RETURN_REASON_MAP,
  OrderPulseTag 
} from "../components/OrderPulseTag";
import { PartialSplitModal } from "../components/PartialSplitModal";

const { Title, Text } = Typography;

const API_BASE = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";
const ORDERS_API_URL = `${API_BASE}/orders`;

export const OrderAnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Orders table data for tabs
  const [tableOrders, setTableOrders] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableTotal, setTableTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Partial Split Modal state
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectedOrderForSplit, setSelectedOrderForSplit] = useState<any>(null);

  // Steadfast Sync states
  const [syncingCouriers, setSyncingCouriers] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const handleSyncAllCouriers = async (silent = false) => {
    setSyncingCouriers(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${ORDERS_API_URL}/sync-couriers`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(nowStr);
      if (!silent) {
        message.success(`Steadfast sync triggered for ${res.data.count || 0} active shipments.`);
      }
      setTimeout(() => {
        fetchAnalytics();
        fetchTabOrders(activeTab, currentPage);
      }, 3000);
    } catch (err: any) {
      if (!silent && err?.response?.status !== 403) {
        message.error(err.response?.data?.message || "Steadfast sync failed.");
      }
    } finally {
      setSyncingCouriers(false);
    }
  };

  // Auto-trigger Steadfast sync every 1 hour (24 times a day)
  useEffect(() => {
    const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour
    const interval = setInterval(() => {
      console.log("[OrderPulse] Executing scheduled hourly Steadfast sync (24x/day)...");
      handleSyncAllCouriers(true);
    }, ONE_HOUR_MS);

    return () => clearInterval(interval);
  }, [activeTab, currentPage]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${ORDERS_API_URL}/analytics/pulse`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalyticsData(res.data);
    } catch (err) {
      console.error("Failed to fetch OrderPulse analytics", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTabOrders = async (tabKey: string, page = 1) => {
    if (tabKey === "overview" || tabKey === "catalog_rd") return;
    setTableLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      let statusParam = "";
      if (tabKey === "delayed") statusParam = "delayed";
      else if (tabKey === "cancelled") statusParam = "cancelled";
      else if (tabKey === "manually_cancelled") statusParam = "manually_cancelled";
      else if (tabKey === "partial") statusParam = "partially_delivered";

      const res = await axios.get(ORDERS_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          status: statusParam,
          page,
          limit: pageSize,
        },
      });
      setTableOrders(res.data.results || []);
      setTableTotal(res.data.count || 0);
    } catch {
      message.error("Failed to load queue orders");
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchTabOrders(activeTab, 1);
  }, [activeTab]);

  const kpi = analyticsData?.kpi || {
    total_orders: 0,
    delayed_hub_count: 0,
    cancelled_pre_dispatch_count: 0,
    cancelled_post_dispatch_count: 0,
    partially_delivered_count: 0,
  };

  const delayAging = analyticsData?.delay_aging || {
    "24_to_48h": 0,
    "48_to_72h": 0,
    "over_72h": 0,
  };

  // Recharts data transformations
  const delayChartData = Object.entries(analyticsData?.delay_reasons || {}).map(([key, count]) => {
    const meta = DELAY_BLOCKER_MAP[key] || { label: key === "unassigned" ? "Untagged" : key, color: "#94a3b8" };
    return { name: meta.label, count: count as number, color: meta.color };
  }).sort((a, b) => b.count - a.count);

  const preCancelData = Object.entries(analyticsData?.cancellation_reasons_pre || {}).map(([key, count]) => {
    const meta = CANCELLATION_REASON_MAP[key] || { label: key === "unassigned" ? "Untagged" : key, color: "#94a3b8" };
    return { name: meta.label, count: count as number, color: meta.color };
  }).sort((a, b) => b.count - a.count);

  const partialReturnData = Object.entries(analyticsData?.partial_return_reasons || {}).map(([key, count]) => {
    const meta = SKU_RETURN_REASON_MAP[key] || { label: key === "unassigned" ? "Untagged" : key, color: "#94a3b8" };
    return { name: meta.label, value: count as number, color: meta.color };
  }).sort((a, b) => b.value - a.value);

  // Table Columns for Queue orders
  const queueColumns = [
    {
      title: "Order No",
      dataIndex: "order_number",
      key: "order_number",
      width: 130,
      render: (v: string, r: any) => (
        <div>
          <strong style={{ color: "#818cf8" }}>{v || `PO-${r.id}`}</strong>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(r.created_at).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      title: "Customer & Phone",
      dataIndex: "customer_name",
      key: "customer_name",
      width: 170,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.shipping_name || r.customer_name}</div>
          <div style={{ fontSize: 12, color: "#38bdf8" }}>{r.shipping_phone || r.customer_phone}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.shipping_district || "Bangladesh"}</div>
        </div>
      ),
    },
    {
      title: "Ordered Items",
      dataIndex: "items",
      key: "items",
      render: (items: any[]) => (
        <Space direction="vertical" size={2}>
          {(items || []).map((it, idx) => (
            <div key={idx} style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{it.quantity}x</span> {it.product_name || it.sku}
              {it.return_reason && (
                <Tag color="error" style={{ marginLeft: 6, fontSize: 10 }}>
                  Returned: {SKU_RETURN_REASON_MAP[it.return_reason]?.label || it.return_reason}
                </Tag>
              )}
            </div>
          ))}
        </Space>
      ),
    },
    {
      title: "Status & Timing",
      key: "status_timing",
      width: 160,
      render: (_: any, r: any) => (
        <div>
          <Tag color={r.status === "partially_delivered" ? "orange" : (r.status === "cancelled" || r.status === "manually_cancelled") ? "error" : "gold"}>
            {r.status.toUpperCase()}
          </Tag>
          {r.is_delayed && (
            <div style={{ marginTop: 4 }}>
              <Tag color="error" icon={<ClockCircleOutlined />}>
                ⏱ {r.delay_hours}h in Hub
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Root Cause / Blocker Tag",
      key: "pulse_action",
      width: 220,
      render: (_: any, r: any) => (
        <OrderPulseTag
          order={r}
          apiUrl={ORDERS_API_URL}
          onRefresh={() => fetchTabOrders(activeTab, currentPage)}
          onOpenSplitModal={(order) => {
            setSelectedOrderForSplit(order);
            setIsSplitModalOpen(true);
          }}
        />
      ),
    },
  ];

  const topSkuColumns = [
    {
      title: "SKU & Product Name",
      dataIndex: "product_name",
      key: "product_name",
      render: (_: any, r: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {r.image && (
            <img
              src={r.image.startsWith("http") ? r.image : `${window.location.origin}${r.image}`}
              alt="sku"
              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.product_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>SKU: {r.sku}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Total Units Returned",
      dataIndex: "returned_count",
      key: "returned_count",
      width: 170,
      render: (v: number) => <Tag color="error" style={{ fontSize: 13, fontWeight: 700 }}>{v} Units Returned</Tag>,
    },
    {
      title: "Primary Customer Complaint",
      dataIndex: "primary_reason",
      key: "primary_reason",
      width: 220,
      render: (r: string) => {
        const meta = SKU_RETURN_REASON_MAP[r] || { label: r === "unassigned" ? "Untagged" : r, color: "#94a3b8" };
        return <Tag color={meta.color} style={{ fontSize: 12, padding: "2px 8px" }}>{meta.label}</Tag>;
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThunderboltOutlined style={{ color: "#a855f7", fontSize: 26 }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text-main)" }}>
              OrderPulse Analytics &amp; Bottleneck Engine
            </h1>
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            Dedicated diagnostics module tracking Internal Hub Delays (&gt;24h), Full Cancellations, and Partially Delivered Split Items.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Tooltip title="Steadfast sync runs automatically every 1 hour (24 times a day) in the background via Celery Beat and live timers. You can also click to sync immediately.">
            <Tag
              color="cyan"
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer"
              }}
            >
              <ClockCircleOutlined /> Auto-Sync: 1h (24x/day)
              {lastSyncTime && <span style={{ opacity: 0.85 }}>· Last: {lastSyncTime}</span>}
            </Tag>
          </Tooltip>

          <Button 
            icon={<SyncOutlined spin={syncingCouriers} />} 
            onClick={() => handleSyncAllCouriers(false)} 
            loading={syncingCouriers}
            style={{ borderRadius: 6, whiteSpace: 'nowrap' }}
          >
            Sync Steadfast
          </Button>

          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={() => {
              fetchAnalytics();
              fetchTabOrders(activeTab, currentPage);
            }}
            loading={loading}
            style={{ borderRadius: 6, backgroundColor: "#6366f1", borderColor: "#4f46e5" }}
          >
            Refresh Analytics
          </Button>
        </div>
      </div>

      {/* Top 5 KPI Cards */}
      <Row gutter={[10, 10]}>
        <Col xs={12} sm={8} md={4}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#27272a" }}>
            <Statistic
              title={<span style={{ color: "#a1a1aa", fontSize: 12 }}>Total Store Orders</span>}
              value={kpi.total_orders}
              valueStyle={{ color: "#f4f4f5", fontWeight: 700, fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#ef4444" }}>
            <Statistic
              title={<span style={{ color: "#f87171", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><ClockCircleOutlined /> Delayed (&gt;24h Hub)</span>}
              value={kpi.delayed_hub_count}
              valueStyle={{ color: "#ef4444", fontWeight: 700, fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#ec4899" }}>
            <Statistic
              title={<span style={{ color: "#f472b6", fontSize: 12 }}>Pre-Dispatch Cancelled</span>}
              value={kpi.cancelled_pre_dispatch_count}
              valueStyle={{ color: "#ec4899", fontWeight: 700, fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#e11d48" }}>
            <Statistic
              title={<span style={{ color: "#fb7185", fontSize: 12 }}>Steadfast Returned</span>}
              value={kpi.cancelled_post_dispatch_count}
              valueStyle={{ color: "#e11d48", fontWeight: 700, fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#f97316" }}>
            <Statistic
              title={<span style={{ color: "#fb923c", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><SplitCellsOutlined /> Partially Delivered</span>}
              value={kpi.partially_delivered_count}
              valueStyle={{ color: "#f97316", fontWeight: 700, fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Card styles={{ body: { padding: "16px 20px" } }} style={{ backgroundColor: "#111116", borderColor: "#27272a" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          items={[
            {
              key: "overview",
              label: <span>📊 Executive Diagnostics</span>,
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%", marginTop: 8 }}>
                  {/* Pillar 1: Hub Delays */}
                  <Card
                    title={<span style={{ color: "#f87171" }}><ClockCircleOutlined /> Pillar 1: Internal Hub Delay Aging &amp; Blockers</span>}
                    styles={{ body: { padding: 16 } }}
                    style={{ backgroundColor: "#18181b", borderColor: "#27272a" }}
                  >
                    <Row gutter={[20, 20]}>
                      <Col xs={24} md={10}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ color: "#e4e4e7", fontSize: 13 }}>Warehouse Aging Breakdown</Text>
                          <p style={{ color: "#a1a1aa", fontSize: 12, margin: "2px 0 14px" }}>
                            Unshipped orders in Placed, Review, or Pending beyond 24 hours.
                          </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#facc15" }}>24h - 48h Delayed</span>
                              <strong>{delayAging["24_to_48h"]} orders</strong>
                            </div>
                            <Progress percent={kpi.delayed_hub_count > 0 ? Math.round((delayAging["24_to_48h"] / kpi.delayed_hub_count) * 100) : 0} strokeColor="#facc15" size="small" />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#fb923c" }}>48h - 72h Delayed</span>
                              <strong>{delayAging["48_to_72h"]} orders</strong>
                            </div>
                            <Progress percent={kpi.delayed_hub_count > 0 ? Math.round((delayAging["48_to_72h"] / kpi.delayed_hub_count) * 100) : 0} strokeColor="#fb923c" size="small" />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#ef4444" }}>&gt; 72h Critical SLA Breach</span>
                              <strong>{delayAging["over_72h"]} orders</strong>
                            </div>
                            <Progress percent={kpi.delayed_hub_count > 0 ? Math.round((delayAging["over_72h"] / kpi.delayed_hub_count) * 100) : 0} strokeColor="#ef4444" size="small" />
                          </div>
                        </div>
                      </Col>
                      <Col xs={24} md={14}>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong style={{ color: "#e4e4e7", fontSize: 13 }}>Operational Delay Blockers</Text>
                          <p style={{ color: "#a1a1aa", fontSize: 12, margin: "2px 0 8px" }}>
                            Why warehouse floor has not dispatched parcels to Steadfast.
                          </p>
                        </div>
                        {delayChartData.length === 0 ? (
                          <Empty description="No delayed orders logged" />
                        ) : (
                          <div style={{ width: "100%", height: 180 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={delayChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <XAxis type="number" stroke="#71717a" />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fill: "#d4d4d8", fontSize: 11 }} />
                                <RechartsTooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46" }} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                  {delayChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </Col>
                    </Row>
                  </Card>

                  {/* Pillar 2 & 3: Cancellations & Partial */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Card
                        title={<span style={{ color: "#ec4899" }}><CloseCircleOutlined /> Pillar 2: Pre-Dispatch Cancellation Root Causes</span>}
                        styles={{ body: { padding: 16 } }}
                        style={{ backgroundColor: "#18181b", borderColor: "#27272a" }}
                      >
                        {preCancelData.length === 0 ? (
                          <Empty description="No cancellations logged" />
                        ) : (
                          <div style={{ width: "100%", height: 190 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={preCancelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <XAxis type="number" stroke="#71717a" />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fill: "#d4d4d8", fontSize: 11 }} />
                                <RechartsTooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46" }} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                  {preCancelData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </Card>
                    </Col>
                    <Col xs={24} md={12}>
                      <Card
                        title={<span style={{ color: "#f97316" }}><SplitCellsOutlined /> Pillar 3: Partial Delivery Return Reasons</span>}
                        styles={{ body: { padding: 16 } }}
                        style={{ backgroundColor: "#18181b", borderColor: "#27272a" }}
                      >
                        {partialReturnData.length === 0 ? (
                          <Empty description="No partial returns logged" />
                        ) : (
                          <div style={{ width: "100%", height: 190 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={partialReturnData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={65}
                                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                  labelLine={false}
                                >
                                  {partialReturnData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46" }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </Card>
                    </Col>
                  </Row>
                </Space>
              ),
            },
            {
              key: "delayed",
              label: (
                <span>
                  ⏰ Delayed Hub Queue <Badge count={kpi.delayed_hub_count || 0} overflowCount={9999} style={{ backgroundColor: "#ff4d4f" }} />
                </span>
              ),
              children: (
                <div style={{ marginTop: 12 }}>
                  <Table
                    dataSource={tableOrders}
                    columns={queueColumns}
                    rowKey="id"
                    loading={tableLoading}
                    pagination={{
                      current: currentPage,
                      pageSize,
                      total: tableTotal,
                      onChange: (p) => {
                        setCurrentPage(p);
                        fetchTabOrders("delayed", p);
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: "partial",
              label: (
                <span>
                  ⚡ Partially Delivered <Badge count={kpi.partially_delivered_count || 0} overflowCount={9999} style={{ backgroundColor: "#fa8c16" }} />
                </span>
              ),
              children: (
                <div style={{ marginTop: 12 }}>
                  <Table
                    dataSource={tableOrders}
                    columns={queueColumns}
                    rowKey="id"
                    loading={tableLoading}
                    pagination={{
                      current: currentPage,
                      pageSize,
                      total: tableTotal,
                      onChange: (p) => {
                        setCurrentPage(p);
                        fetchTabOrders("partial", p);
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: "manually_cancelled",
              label: (
                <span>
                  ❌ Pre-Dispatch Cancelled <Badge count={kpi.cancelled_pre_dispatch_count || 0} overflowCount={9999} style={{ backgroundColor: "#eb2f96" }} />
                </span>
              ),
              children: (
                <div style={{ marginTop: 12 }}>
                  <Table
                    dataSource={tableOrders}
                    columns={queueColumns}
                    rowKey="id"
                    loading={tableLoading}
                    pagination={{
                      current: currentPage,
                      pageSize,
                      total: tableTotal,
                      onChange: (p) => {
                        setCurrentPage(p);
                        fetchTabOrders("manually_cancelled", p);
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: "cancelled",
              label: (
                <span>
                  🚚 Steadfast Returned <Badge count={kpi.cancelled_post_dispatch_count || 0} overflowCount={9999} style={{ backgroundColor: "#ef4444" }} />
                </span>
              ),
              children: (
                <div style={{ marginTop: 12 }}>
                  <Table
                    dataSource={tableOrders}
                    columns={queueColumns}
                    rowKey="id"
                    loading={tableLoading}
                    pagination={{
                      current: currentPage,
                      pageSize,
                      total: tableTotal,
                      onChange: (p) => {
                        setCurrentPage(p);
                        fetchTabOrders("cancelled", p);
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: "catalog_rd",
              label: <span>🔬 Product Catalog R&amp;D Matrix</span>,
              children: (
                <div style={{ marginTop: 12 }}>
                  <div style={{ marginBottom: 14 }}>
                    <Text strong style={{ color: "#e4e4e7", fontSize: 14 }}>High-Return Products &amp; Sizing Defects</Text>
                    <p style={{ color: "#a1a1aa", fontSize: 12, margin: "2px 0 0" }}>
                      Aggregate return rates across all orders to identify which items have pattern, fabric, or sizing chart errors.
                    </p>
                  </div>
                  <Table
                    dataSource={analyticsData?.top_returned_skus || []}
                    columns={topSkuColumns}
                    rowKey="sku"
                    pagination={false}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Partial Delivery Split Modal */}
      <PartialSplitModal
        visible={isSplitModalOpen}
        order={selectedOrderForSplit}
        apiUrl={ORDERS_API_URL}
        onClose={() => setIsSplitModalOpen(false)}
        onSuccess={() => {
          fetchAnalytics();
          fetchTabOrders(activeTab, currentPage);
        }}
      />
    </Space>
  );
};

export default OrderAnalyticsPage;

