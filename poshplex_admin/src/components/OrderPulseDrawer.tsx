import React, { useState, useEffect } from "react";
import { 
  Drawer, Card, Row, Col, Statistic, Table, Tag, Typography, 
  Spin, Empty, Progress, Alert, Divider, Space, Button 
} from "antd";
import { 
  ClockCircleOutlined, 
  CloseCircleOutlined, 
  SplitCellsOutlined, 
  CheckCircleOutlined, 
  SyncOutlined,
  WarningOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, 
  Cell, PieChart, Pie, Legend 
} from "recharts";
import axios from "axios";
import { 
  DELAY_BLOCKER_MAP, 
  CANCELLATION_REASON_MAP, 
  SKU_RETURN_REASON_MAP 
} from "./OrderPulseTag";

const { Title, Text } = Typography;

interface OrderPulseDrawerProps {
  visible: boolean;
  onClose: () => void;
  apiUrl: string;
}

export const OrderPulseDrawer: React.FC<OrderPulseDrawerProps> = ({
  visible,
  onClose,
  apiUrl,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${apiUrl}/analytics/pulse`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err) {
      console.error("Failed to load OrderPulse analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchAnalytics();
    }
  }, [visible]);

  const kpi = data?.kpi || {
    total_orders: 0,
    delayed_hub_count: 0,
    cancelled_pre_dispatch_count: 0,
    cancelled_post_dispatch_count: 0,
    partially_delivered_count: 0,
  };

  const delayAging = data?.delay_aging || {
    "24_to_48h": 0,
    "48_to_72h": 0,
    "over_72h": 0,
  };

  // Format Delay Reasons for BarChart
  const delayChartData = Object.entries(data?.delay_reasons || {}).map(([key, count]) => {
    const meta = DELAY_BLOCKER_MAP[key] || { label: key === "unassigned" ? "Untagged" : key, color: "#94a3b8" };
    return {
      name: meta.label,
      count: count as number,
      color: meta.color,
    };
  }).sort((a, b) => b.count - a.count);

  // Format Pre-Dispatch Cancellation Reasons for BarChart
  const preCancelData = Object.entries(data?.cancellation_reasons_pre || {}).map(([key, count]) => {
    const meta = CANCELLATION_REASON_MAP[key] || { label: key === "unassigned" ? "Untagged" : key, color: "#94a3b8" };
    return {
      name: meta.label,
      count: count as number,
      color: meta.color,
    };
  }).sort((a, b) => b.count - a.count);

  // Format Partial Return Reasons for PieChart
  const partialReturnData = Object.entries(data?.partial_return_reasons || {}).map(([key, count]) => {
    const meta = SKU_RETURN_REASON_MAP[key] || { label: key === "unassigned" ? "Untagged" : key, color: "#94a3b8" };
    return {
      name: meta.label,
      value: count as number,
      color: meta.color,
    };
  }).sort((a, b) => b.value - a.value);

  const topSkuColumns = [
    {
      title: "SKU & Product",
      dataIndex: "product_name",
      key: "product_name",
      render: (_: any, r: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {r.image && (
            <img
              src={r.image.startsWith("http") ? r.image : `${window.location.origin}${r.image}`}
              alt="sku"
              style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{r.product_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.sku}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Returned Qty",
      dataIndex: "returned_count",
      key: "returned_count",
      width: 110,
      render: (v: number) => <Tag color="error" style={{ fontWeight: 600 }}>{v} Units</Tag>,
    },
    {
      title: "Primary Return Root Cause",
      dataIndex: "primary_reason",
      key: "primary_reason",
      width: 170,
      render: (r: string) => {
        const meta = SKU_RETURN_REASON_MAP[r] || { label: r === "unassigned" ? "Untagged" : r, color: "#94a3b8" };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThunderboltOutlined style={{ color: "#6366f1", fontSize: 20 }} />
            <span style={{ fontSize: 18, fontWeight: 700 }}>OrderPulse Analytics & Bottleneck Engine</span>
          </div>
          <Button icon={<SyncOutlined />} onClick={fetchAnalytics} loading={loading} size="small">
            Refresh Pulse
          </Button>
        </div>
      }
      open={visible}
      onClose={onClose}
      width={980}
      styles={{ body: { backgroundColor: "#0f172a", color: "#f8fafc", padding: "16px 24px" } }}
    >
      {loading && !data ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Top 5 KPI Cards */}
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={8} md={4} style={{ flex: 1 }}>
              <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}>
                <Statistic
                  title={<span style={{ color: "#94a3b8", fontSize: 12 }}>Total Store Orders</span>}
                  value={kpi.total_orders}
                  valueStyle={{ color: "#f8fafc", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#1e293b", borderColor: "#ef4444" }}>
                <Statistic
                  title={<span style={{ color: "#f87171", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><ClockCircleOutlined /> Delayed (&gt;24h Hub)</span>}
                  value={kpi.delayed_hub_count}
                  valueStyle={{ color: "#ef4444", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#1e293b", borderColor: "#ec4899" }}>
                <Statistic
                  title={<span style={{ color: "#f472b6", fontSize: 12 }}>Pre-Dispatch Cancelled</span>}
                  value={kpi.cancelled_pre_dispatch_count}
                  valueStyle={{ color: "#ec4899", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#1e293b", borderColor: "#e11d48" }}>
                <Statistic
                  title={<span style={{ color: "#fb7185", fontSize: 12 }}>Steadfast Returned</span>}
                  value={kpi.cancelled_post_dispatch_count}
                  valueStyle={{ color: "#e11d48", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={5}>
              <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#1e293b", borderColor: "#f97316" }}>
                <Statistic
                  title={<span style={{ color: "#fb923c", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><SplitCellsOutlined /> Partially Delivered</span>}
                  value={kpi.partially_delivered_count}
                  valueStyle={{ color: "#f97316", fontWeight: 700, fontSize: 22 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Section 1: Internal Hub Fulfillment Delays */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f87171" }}>
                <ClockCircleOutlined />
                <span>Pillar 1: Internal Hub Delayed Queue Diagnostics (&gt;24 Hours Unshipped)</span>
              </div>
            }
            styles={{ body: { padding: 16 } }}
            style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ color: "#e2e8f0", fontSize: 13 }}>Warehouse Aging Breakdown</Text>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 12px" }}>
                    Orders sitting in Placed, Review, or Pending without shipping.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "#facc15" }}>24h - 48h Delayed</span>
                      <strong>{delayAging["24_to_48h"]} orders</strong>
                    </div>
                    <Progress
                      percent={kpi.delayed_hub_count > 0 ? Math.round((delayAging["24_to_48h"] / kpi.delayed_hub_count) * 100) : 0}
                      strokeColor="#facc15"
                      size="small"
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "#fb923c" }}>48h - 72h Delayed</span>
                      <strong>{delayAging["48_to_72h"]} orders</strong>
                    </div>
                    <Progress
                      percent={kpi.delayed_hub_count > 0 ? Math.round((delayAging["48_to_72h"] / kpi.delayed_hub_count) * 100) : 0}
                      strokeColor="#fb923c"
                      size="small"
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "#ef4444" }}>&gt; 72h Critical SLA Breach</span>
                      <strong>{delayAging["over_72h"]} orders</strong>
                    </div>
                    <Progress
                      percent={kpi.delayed_hub_count > 0 ? Math.round((delayAging["over_72h"] / kpi.delayed_hub_count) * 100) : 0}
                      strokeColor="#ef4444"
                      size="small"
                    />
                  </div>
                </div>
              </Col>

              <Col xs={24} md={14}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ color: "#e2e8f0", fontSize: 13 }}>Operational Delay Blockers</Text>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 8px" }}>
                    Root causes why warehouse team has not dispatched to Steadfast.
                  </p>
                </div>
                {delayChartData.length === 0 ? (
                  <Empty description={<span style={{ color: "#94a3b8" }}>No delayed orders currently in queue!</span>} />
                ) : (
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={delayChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <XAxis type="number" stroke="#64748b" />
                        <YAxis dataKey="name" type="category" width={130} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
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

          {/* Section 2: Cancellation Diagnostics */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ec4899" }}>
                <CloseCircleOutlined />
                <span>Pillar 2: Cancellation Root Cause Diagnostics</span>
              </div>
            }
            styles={{ body: { padding: 16 } }}
            style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ color: "#e2e8f0", fontSize: 13 }}>Pre-Dispatch Cancellation Reasons</Text>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 8px" }}>
                    Cancelled in-house before parcel handed to courier (e.g., Call dhore na).
                  </p>
                </div>
                {preCancelData.length === 0 ? (
                  <Empty description={<span style={{ color: "#94a3b8" }}>No pre-dispatch cancellations logged</span>} />
                ) : (
                  <div style={{ width: "100%", height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={preCancelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <XAxis type="number" stroke="#64748b" />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {preCancelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Col>

              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ color: "#e2e8f0", fontSize: 13 }}>Post-Dispatch Steadfast Return Reasons</Text>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 8px" }}>
                    Shipped parcels rejected or returned by customer at doorstep.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
                  {Object.entries(data?.cancellation_reasons_post || {}).map(([key, count]) => {
                    const meta = CANCELLATION_REASON_MAP[key] || { label: key === "unassigned" ? "Untagged" : key, color: "#94a3b8" };
                    return (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: meta.color }} />
                          <span style={{ fontSize: 12, color: "#cbd5e1" }}>{meta.label}</span>
                        </span>
                        <Tag color="volcano" style={{ fontWeight: 600 }}>{count as number} Orders</Tag>
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>
          </Card>

          {/* Section 3: Partially Delivered SKU Analysis */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f97316" }}>
                <SplitCellsOutlined />
                <span>Pillar 3: Partially Delivered SKU Returns & Product R&amp;D Matrix</span>
              </div>
            }
            styles={{ body: { padding: 16 } }}
            style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={9}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ color: "#e2e8f0", fontSize: 13 }}>Customer Return Reasons</Text>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 8px" }}>
                    Why customers refused specific items from multi-product orders.
                  </p>
                </div>
                {partialReturnData.length === 0 ? (
                  <Empty description={<span style={{ color: "#94a3b8" }}>No partially returned items logged</span>} />
                ) : (
                  <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={partialReturnData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {partialReturnData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Col>

              <Col xs={24} md={15}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ color: "#e2e8f0", fontSize: 13 }}>Top 10 High-Return Products (Catalog R&amp;D)</Text>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 8px" }}>
                    Identify SKUs with sizing defects or material mismatches to fix production patterns.
                  </p>
                </div>
                <Table
                  dataSource={data?.top_returned_skus || []}
                  columns={topSkuColumns}
                  rowKey="sku"
                  pagination={false}
                  size="small"
                />
              </Col>
            </Row>
          </Card>
        </Space>
      )}
    </Drawer>
  );
};
