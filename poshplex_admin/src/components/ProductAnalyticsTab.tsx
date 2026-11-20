import React, { useState, useEffect } from "react";
import {
  Card, Row, Col, Statistic, Table, Tag, Typography,
  Spin, Empty, Progress, Space, Button, message, Tooltip, Input, Select, Badge
} from "antd";
import {
  FireOutlined,
  ShopOutlined,
  DollarOutlined,
  TagOutlined,
  SearchOutlined,
  ReloadOutlined,
  WarningOutlined,
  TrophyOutlined,
  ArrowUpOutlined,
  LineChartOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  Cell, PieChart, Pie
} from "recharts";
import axios from "axios";

const { Title, Text } = Typography;

const PIE_COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#14b8a6", "#f43f5e"];

interface ProductAnalyticsTabProps {
  apiUrl: string;
}

export const ProductAnalyticsTab: React.FC<ProductAnalyticsTabProps> = ({ apiUrl }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [preset, setPreset] = useState<string>("lifetime");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("units");

  const fetchProductAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${apiUrl}/analytics/products?preset=${preset}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch product analytics", err);
      if (err?.response?.status !== 403) {
        message.error("Could not load product analytics data.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductAnalytics();
  }, [preset]);

  const kpi = data?.kpi || {};
  const allProducts: any[] = data?.all_products || [];

  // Filter and sort products
  const filteredProducts = allProducts.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortBy === "revenue") return b.revenue - a.revenue;
    if (sortBy === "units") return b.total_units_ordered - a.total_units_ordered;
    if (sortBy === "orders") return b.order_count - a.order_count;
    if (sortBy === "returns") return b.return_rate - a.return_rate;
    return 0;
  });

  const columns = [
    {
      title: "Product Item",
      key: "product",
      render: (_: any, r: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {r.image ? (
            <img
              src={r.image.startsWith("http") ? r.image : `${window.location.origin}${r.image}`}
              alt={r.name}
              style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border-glass, #333)" }}
              onError={(e: any) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 6, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShopOutlined style={{ color: "#a1a1aa" }} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-main, #fff)", fontSize: 13 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #71717a)" }}>
              {r.category} · ৳{r.base_price.toLocaleString()}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Units Sold",
      dataIndex: "total_units_ordered",
      key: "units",
      sorter: (a: any, b: any) => a.total_units_ordered - b.total_units_ordered,
      render: (v: number) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: "#38bdf8" }}>
          {v} pcs
        </span>
      )
    },
    {
      title: "Orders Count",
      dataIndex: "order_count",
      key: "orders",
      sorter: (a: any, b: any) => a.order_count - b.order_count,
      render: (v: number) => <Tag color="blue">{v} orders</Tag>
    },
    {
      title: "Gross Revenue",
      dataIndex: "revenue",
      key: "revenue",
      sorter: (a: any, b: any) => a.revenue - b.revenue,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: "#10b981", fontSize: 13 }}>
          ৳{v.toLocaleString()}
        </span>
      )
    },
    {
      title: "Top Size Preferred",
      dataIndex: "top_size",
      key: "top_size",
      render: (v: string) => <Tag color="purple" style={{ fontWeight: 600 }}>{v}</Tag>
    },
    {
      title: "Return / Cancel Rate",
      key: "health",
      render: (_: any, r: any) => {
        const isHighReturn = r.return_rate > 15;
        return (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: isHighReturn ? "#f43f5e" : "#a1a1aa", fontWeight: isHighReturn ? 700 : 500 }}>
              Ret: {r.return_rate}% ({r.returned_units})
            </span>
            <span style={{ marginLeft: 8, color: r.cancellation_rate > 20 ? "#f59e0b" : "#71717a" }}>
              Can: {r.cancellation_rate}%
            </span>
          </div>
        );
      }
    },
    {
      title: "Customer Demand Insight",
      key: "demand",
      render: (_: any, r: any, index: number) => {
        if (index < 3 && r.total_units_ordered >= 2) {
          return <Tag color="gold" icon={<TrophyOutlined />}>Top Seller</Tag>;
        }
        if (r.return_rate > 20) {
          return <Tag color="error" icon={<WarningOutlined />}>Check Sizing Spec</Tag>;
        }
        if (r.total_units_ordered >= 1) {
          return <Tag color="green">Steady Demand</Tag>;
        }
        return <Tag color="default">Low Activity</Tag>;
      }
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filter and Presets Header */}
      <Card style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0, color: "var(--text-main, #fff)", display: "flex", alignItems: "center", gap: 8 }}>
              <FireOutlined style={{ color: "#f43f5e" }} /> Products Intelligence &amp; Demand Research
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Make data-driven production, restocking, and design decisions based on customer ordering volume, size preferences, and return velocity.
            </Text>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Select
              value={preset}
              onChange={setPreset}
              style={{ width: 150 }}
              options={[
                { label: "Lifetime (All Time)", value: "lifetime" },
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "Last 7 Days", value: "7d" },
                { label: "Last 30 Days", value: "30d" },
                { label: "This Month", value: "this_month" },
                { label: "Last Month", value: "last_month" },
              ]}
            />
            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchProductAnalytics}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))" }}>
            <Statistic
              title={<span style={{ color: "#a1a1aa", fontSize: 12 }}>Total Products Tracked</span>}
              value={kpi.total_products_tracked || 0}
              prefix={<ShopOutlined style={{ color: "#38bdf8" }} />}
              valueStyle={{ color: "#fff", fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))" }}>
            <Statistic
              title={<span style={{ color: "#a1a1aa", fontSize: 12 }}>Total Units Ordered</span>}
              value={kpi.total_units_sold || 0}
              prefix={<FireOutlined style={{ color: "#f43f5e" }} />}
              valueStyle={{ color: "#38bdf8", fontWeight: 700 }}
              suffix="pcs"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))" }}>
            <Statistic
              title={<span style={{ color: "#a1a1aa", fontSize: 12 }}>Product Revenue</span>}
              value={kpi.total_product_revenue || 0}
              prefix={<DollarOutlined style={{ color: "#10b981" }} />}
              precision={2}
              valueStyle={{ color: "#10b981", fontWeight: 700 }}
              suffix="৳"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))" }}>
            <Statistic
              title={<span style={{ color: "#a1a1aa", fontSize: 12 }}>Most Loved Size (Demand)</span>}
              value={kpi.most_popular_size || "N/A"}
              prefix={<TagOutlined style={{ color: "#a855f7" }} />}
              valueStyle={{ color: "#a855f7", fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Visual Analytics Grids */}
      <Row gutter={[16, 16]}>
        {/* Most Ordered Products Bar Chart */}
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ color: "#fff", fontSize: 14 }}><TrophyOutlined style={{ color: "#eab308", marginRight: 8 }} /> Top 5 Most Ordered Products</span>}
            style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))", height: "100%" }}
          >
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
            ) : (data?.most_ordered || []).length > 0 ? (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={(data?.most_ordered || []).slice(0, 5)} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" stroke="#71717a" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={110} stroke="#71717a" tick={{ fill: '#e4e4e7', fontSize: 11 }} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", color: "#fff" }}
                      formatter={(val: any) => [`${val} units ordered`, "Volume"]}
                    />
                    <Bar dataKey="total_units_ordered" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                      {(data?.most_ordered || []).slice(0, 5).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="No product order records for this time window." />
            )}
          </Card>
        </Col>

        {/* Size Preference Breakdown */}
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ color: "#fff", fontSize: 14 }}><TagOutlined style={{ color: "#38bdf8", marginRight: 8 }} /> Size Demand Distribution</span>}
            style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))", height: "100%" }}
          >
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
            ) : (data?.size_distribution || []).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(data?.size_distribution || []).map((s: any, idx: number) => (
                  <div key={s.size}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: "#fff" }}>Size {s.size}</span>
                      <span style={{ color: "#a1a1aa" }}>{s.units} units ({s.share}%)</span>
                    </div>
                    <Progress
                      percent={s.share}
                      strokeColor={PIE_COLORS[idx % PIE_COLORS.length]}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No size distribution data available." />
            )}
          </Card>
        </Col>
      </Row>

      {/* Comprehensive Product Table */}
      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>
              All Products Sales &amp; Performance Ledger
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Input
                placeholder="Search product name..."
                prefix={<SearchOutlined style={{ color: "#71717a" }} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                value={sortBy}
                onChange={setSortBy}
                style={{ width: 140 }}
                options={[
                  { label: "Sort by Units", value: "units" },
                  { label: "Sort by Revenue", value: "revenue" },
                  { label: "Sort by Orders", value: "orders" },
                  { label: "Sort by Returns", value: "returns" },
                ]}
              />
            </div>
          </div>
        }
        style={{ background: "var(--bg-secondary, #111116)", borderColor: "var(--border-glass, rgba(255,255,255,0.08))" }}
      >
        <Table
          dataSource={filteredProducts}
          columns={columns}
          rowKey="product_id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};
