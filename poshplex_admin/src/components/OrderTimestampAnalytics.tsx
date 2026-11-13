import React, { useState, useEffect } from "react";
import { 
  Card, Row, Col, Statistic, Tag, Typography, Spin, Empty, 
  Progress, Button, DatePicker, Select, Radio, Table, Space, Tooltip, message 
} from "antd";
import { 
  ClockCircleOutlined, 
  CalendarOutlined, 
  FireOutlined, 
  DollarCircleOutlined, 
  ThunderboltOutlined, 
  RiseOutlined, 
  SyncOutlined,
  BarChartOutlined,
  AppstoreOutlined
} from "@ant-design/icons";
import { 
  ResponsiveContainer, BarChart, Bar, Line, ComposedChart, 
  XAxis, YAxis, Tooltip as RechartsTooltip, Cell, Legend 
} from "recharts";
import axios from "axios";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface OrderTimestampAnalyticsProps {
  apiUrl: string;
}

export const OrderTimestampAnalytics: React.FC<OrderTimestampAnalyticsProps> = ({ apiUrl }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [preset, setPreset] = useState<string>("lifetime");
  const [customDates, setCustomDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchTimestampAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const params: any = { preset };

      if (statusFilter && statusFilter !== "all") {
        params.status = statusFilter;
      }

      if (preset === "custom" && customDates && customDates[0] && customDates[1]) {
        params.start_date = customDates[0].format("YYYY-MM-DD");
        params.end_date = customDates[1].format("YYYY-MM-DD");
      }

      const res = await axios.get(`${apiUrl}/analytics/timestamps`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch timestamp analytics", err);
      message.error(err?.response?.data?.message || "Failed to load timestamp analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (preset !== "custom" || (customDates && customDates[0] && customDates[1])) {
      fetchTimestampAnalytics();
    }
  }, [preset, customDates, statusFilter]);

  const kpi = data?.kpi || {
    total_orders: 0,
    total_revenue: 0,
    avg_order_value: 0,
    peak_hour: null,
    busiest_day: null,
    peak_3h_window: { label: "N/A", orders: 0, percentage: 0 },
  };

  const hourlyData = data?.hourly_distribution || [];
  const dayOfWeekData = data?.day_of_week_distribution || [];
  const dayparts = data?.dayparts || [];
  const heatmap = data?.heatmap || [];

  // Table columns for detailed 24h breakdown
  const hourlyColumns = [
    {
      title: "Hour Window (Dhaka)",
      dataIndex: "full_label",
      key: "full_label",
      width: 170,
      render: (v: string, r: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <strong style={{ color: r.is_peak ? "#c084fc" : "#e4e4e7" }}>{v}</strong>
          {r.is_peak && (
            <Tag color="#a855f7" style={{ margin: 0, fontSize: 10, padding: "0 4px", fontWeight: 700 }}>
              ⚡ PEAK
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Daypart",
      dataIndex: "daypart",
      key: "daypart",
      width: 130,
      render: (v: string) => {
        let color = "#818cf8";
        if (v === "Morning") color = "#38bdf8";
        if (v === "Afternoon") color = "#f59e0b";
        if (v === "Prime Evening") color = "#ec4899";
        return <Tag color={color} style={{ fontSize: 11 }}>{v}</Tag>;
      },
    },
    {
      title: "Orders Placed",
      dataIndex: "orders",
      key: "orders",
      width: 120,
      sorter: (a: any, b: any) => a.orders - b.orders,
      render: (v: number, r: any) => (
        <div>
          <strong style={{ fontSize: 13, color: r.is_peak ? "#38bdf8" : "#fff" }}>{v}</strong>
          <span style={{ fontSize: 11, color: "#a1a1aa", marginLeft: 6 }}>({r.share_percent}%)</span>
        </div>
      ),
    },
    {
      title: "Order Share %",
      dataIndex: "share_percent",
      key: "share_percent",
      width: 160,
      render: (v: number) => (
        <Progress 
          percent={v} 
          size="small" 
          strokeColor={{ from: "#6366f1", to: "#a855f7" }} 
          format={() => `${v}%`} 
        />
      ),
    },
    {
      title: "Gross Revenue (৳)",
      dataIndex: "revenue",
      key: "revenue",
      width: 150,
      sorter: (a: any, b: any) => a.revenue - b.revenue,
      render: (v: number) => <strong style={{ color: "#10b981" }}>৳{Math.round(v).toLocaleString()}</strong>,
    },
    {
      title: "Avg Order Value (AOV)",
      dataIndex: "aov",
      key: "aov",
      width: 140,
      render: (v: number) => <span style={{ color: "#fbbf24" }}>৳{Math.round(v).toLocaleString()}</span>,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Controls / Filters */}
      <Card 
        styles={{ body: { padding: "12px 16px" } }} 
        style={{ backgroundColor: "#111116", borderColor: "#27272a", borderRadius: 10 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 600 }}>Timeframe:</span>
            <Radio.Group 
              value={preset} 
              onChange={(e) => setPreset(e.target.value)} 
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="lifetime">Lifetime</Radio.Button>
              <Radio.Button value="today">Today</Radio.Button>
              <Radio.Button value="yesterday">Yesterday</Radio.Button>
              <Radio.Button value="7d">Last 7D</Radio.Button>
              <Radio.Button value="30d">Last 30D</Radio.Button>
              <Radio.Button value="this_month">This Month</Radio.Button>
              <Radio.Button value="last_month">Last Month</Radio.Button>
              <Radio.Button value="custom">Custom Range</Radio.Button>
            </Radio.Group>

            {preset === "custom" && (
              <RangePicker
                size="small"
                value={customDates}
                onChange={(dates) => setCustomDates(dates as any)}
                style={{ backgroundColor: "#18181b", borderColor: "#3f3f46" }}
              />
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 600 }}>Status:</span>
            <Select
              size="small"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 140 }}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "placed", label: "Placed" },
                { value: "review", label: "Review" },
                { value: "pending", label: "Pending" },
                { value: "delivered", label: "Delivered" },
                { value: "partially_delivered", label: "Partially Delivered" },
                { value: "cancelled", label: "Cancelled" },
                { value: "manually_cancelled", label: "Manually Cancelled" },
              ]}
            />
            <Button 
              size="small" 
              icon={<SyncOutlined spin={loading} />} 
              onClick={fetchTimestampAnalytics}
              style={{ borderRadius: 6 }}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Active Filter Period Badge */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#71717a" }}>
          <span>Current Range:</span>
          <Tag color="purple" style={{ fontSize: 11, margin: 0, padding: "0 6px" }}>
            {data?.period?.label || "Lifetime"} ({data?.period?.timezone || "Asia/Dhaka"})
          </Tag>
          <span>· Total Sample: <strong style={{ color: "#e4e4e7" }}>{kpi.total_orders} orders</strong> (৳{Math.round(kpi.total_revenue).toLocaleString()})</span>
        </div>
      </Card>

      {/* Top 4 Metric KPI Cards */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#a855f7", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#c084fc", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><FireOutlined /> Peak Ordering Hour</span>}
              value={kpi.peak_hour?.full_label || "N/A"}
              valueStyle={{ color: "#f4f4f5", fontWeight: 700, fontSize: 18 }}
            />
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
              <span style={{ color: "#a1a1aa" }}>{kpi.peak_hour?.orders || 0} orders (৳{Math.round(kpi.peak_hour?.revenue || 0).toLocaleString()})</span>
              <Tag color="purple" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                {kpi.peak_hour?.share_percent || 0}% Vol
              </Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#38bdf8", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#38bdf8", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><CalendarOutlined /> Busiest Day of Week</span>}
              value={kpi.busiest_day?.day_name || "N/A"}
              valueStyle={{ color: "#f4f4f5", fontWeight: 700, fontSize: 18 }}
            />
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
              <span style={{ color: "#a1a1aa" }}>{kpi.busiest_day?.orders || 0} orders (৳{Math.round(kpi.busiest_day?.revenue || 0).toLocaleString()})</span>
              <Tag color="cyan" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                {kpi.busiest_day?.share_percent || 0}% Vol
              </Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#ec4899", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#f472b6", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><ThunderboltOutlined /> Prime 3-Hour Surge</span>}
              value={kpi.peak_3h_window?.label || "N/A"}
              valueStyle={{ color: "#f4f4f5", fontWeight: 700, fontSize: 18 }}
            />
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
              <span style={{ color: "#a1a1aa" }}>{kpi.peak_3h_window?.orders || 0} orders clustered</span>
              <Tag color="magenta" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                {kpi.peak_3h_window?.percentage || 0}% Share
              </Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: 14 } }} style={{ backgroundColor: "#111116", borderColor: "#10b981", borderRadius: 10 }}>
            <Statistic
              title={<span style={{ color: "#34d399", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><DollarCircleOutlined /> Revenue &amp; Avg Value</span>}
              value={`৳${Math.round(kpi.total_revenue).toLocaleString()}`}
              valueStyle={{ color: "#10b981", fontWeight: 700, fontSize: 18 }}
            />
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
              <span style={{ color: "#a1a1aa" }}>Avg Basket: ৳{Math.round(kpi.avg_order_value).toLocaleString()}</span>
              <Tag color="green" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                {kpi.total_orders} Orders
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Visual Histogram: 24-Hour Orders & Revenue Distribution */}
      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ color: "#e4e4e7", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <ClockCircleOutlined style={{ color: "#a855f7" }} /> 
              24-Hour Order Volume &amp; Revenue Velocity (Dhaka Local Time)
            </span>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#60a5fa" }}>
                <span style={{ width: 10, height: 10, backgroundColor: "#3b82f6", borderRadius: 2 }} /> Orders Placed
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#c084fc" }}>
                <span style={{ width: 10, height: 10, backgroundColor: "#a855f7", borderRadius: 2 }} /> Peak Hour
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#10b981" }}>
                <span style={{ width: 10, height: 3, backgroundColor: "#10b981", borderRadius: 1 }} /> Revenue Trend (৳)
              </span>
            </div>
          </div>
        }
        styles={{ body: { padding: "16px 14px" } }}
        style={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 10 }}
      >
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}><Spin size="large" /></div>
        ) : hourlyData.length === 0 ? (
          <Empty description="No order timestamp data found for selected timeframe" />
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourlyData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis 
                  dataKey="label_12h" 
                  stroke="#71717a" 
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  interval={0}
                />
                <YAxis 
                  yAxisId="left" 
                  stroke="#71717a" 
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#10b981" 
                  tick={{ fill: "#34d399", fontSize: 10 }}
                  tickFormatter={(v) => `৳${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: "#121216", borderColor: "#3f3f46", borderRadius: 8 }}
                  formatter={(value: any, name: string) => {
                    if (name === "revenue") return [`৳${Math.round(value).toLocaleString()}`, "Gross Revenue"];
                    if (name === "orders") return [`${value} Orders`, "Order Volume"];
                    return [value, name];
                  }}
                  labelFormatter={(_: any, payload: any[]) => {
                    const item = payload?.[0]?.payload;
                    return item ? `${item.full_label} (${item.daypart})` : "";
                  }}
                />
                <Bar yAxisId="left" dataKey="orders" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.is_peak ? "#a855f7" : "#3b82f6"} 
                    />
                  ))}
                </Bar>
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10b981" }}
                  activeDot={{ r: 5, fill: "#34d399" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Section 2: Day of Week & 4-Bucket Daypart Distribution */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card
            title={
              <span style={{ color: "#e4e4e7", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <CalendarOutlined style={{ color: "#38bdf8" }} />
                Day of Week Ordering Volume
              </span>
            }
            styles={{ body: { padding: 16 } }}
            style={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 10 }}
          >
            {dayOfWeekData.length === 0 ? (
              <Empty description="No data available" />
            ) : (
              <div style={{ width: "100%", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <XAxis dataKey="day_short" stroke="#71717a" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <YAxis stroke="#71717a" tick={{ fill: "#a1a1aa", fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: "#121216", borderColor: "#3f3f46", borderRadius: 8 }}
                      formatter={(val: any, name: string, item: any) => [
                        `${val} Orders (${item.payload.share_percent}%) · ৳${Math.round(item.payload.revenue).toLocaleString()}`,
                        "Volume"
                      ]}
                      labelFormatter={(_: any, p: any[]) => p?.[0]?.payload?.day_name || ""}
                    />
                    <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                      {dayOfWeekData.map((entry: any, index: number) => (
                        <Cell 
                          key={`day-${index}`} 
                          fill={entry.is_busiest ? "#38bdf8" : "#6366f1"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card
            title={
              <span style={{ color: "#e4e4e7", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <RiseOutlined style={{ color: "#ec4899" }} />
                Daypart Time Window Breakdown
              </span>
            }
            styles={{ body: { padding: "16px 18px" } }}
            style={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 10 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {dayparts.map((dp: any) => (
                <div key={dp.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#e4e4e7", fontWeight: 600 }}>{dp.name}</span>
                    <span style={{ color: "#a1a1aa" }}>
                      <strong style={{ color: dp.color }}>{dp.orders}</strong> orders ({dp.share_percent}%)
                    </span>
                  </div>
                  <Progress 
                    percent={dp.share_percent} 
                    strokeColor={dp.color} 
                    size="small" 
                    format={() => `৳${Math.round(dp.revenue).toLocaleString()}`} 
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Section 3: 7x24 Day x Hour Heatmap Matrix */}
      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ color: "#e4e4e7", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <AppstoreOutlined style={{ color: "#a855f7" }} />
              7x24 Shopping Heatmap Matrix (Day of Week vs. Hour of Day)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#a1a1aa" }}>
              <span>Low Activity</span>
              <div style={{ display: "flex", gap: 3 }}>
                <span style={{ width: 14, height: 14, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 14, backgroundColor: "rgba(99, 102, 241, 0.25)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 14, backgroundColor: "rgba(168, 85, 247, 0.55)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 14, backgroundColor: "rgba(236, 72, 153, 0.85)", borderRadius: 2 }} />
              </div>
              <span>Peak Shopping</span>
            </div>
          </div>
        }
        styles={{ body: { padding: 14, overflowX: "auto" } }}
        style={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 10 }}
      >
        <div style={{ minWidth: 780 }}>
          {/* Header row with 24 hours */}
          <div style={{ display: "grid", gridTemplateColumns: "70px repeat(24, 1fr)", gap: 4, marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: "#71717a", fontWeight: 700, textAlign: "center" }}>DAY</div>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} style={{ fontSize: 9.5, color: "#a1a1aa", textAlign: "center", overflow: "hidden" }}>
                {h === 0 ? "12A" : h < 12 ? `${h}A` : h === 12 ? "12P" : `${h - 12}P`}
              </div>
            ))}
          </div>

          {/* 7 Days Matrix Rows */}
          {heatmap.map((dayRow: any) => (
            <div key={dayRow.day_index} style={{ display: "grid", gridTemplateColumns: "70px repeat(24, 1fr)", gap: 4, marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#d4d4d8", display: "flex", alignItems: "center" }}>
                {dayRow.day_short}
              </div>
              {dayRow.hours.map((cell: any) => {
                const count = cell.orders;
                const intensity = cell.intensity; // 0 to 100
                let bg = "rgba(255,255,255,0.02)";
                let textColor = "#52525b";
                let borderColor = "rgba(255,255,255,0.04)";

                if (count > 0) {
                  if (intensity >= 75) {
                    bg = "rgba(236, 72, 153, 0.85)";
                    textColor = "#fff";
                    borderColor = "#ec4899";
                  } else if (intensity >= 45) {
                    bg = "rgba(168, 85, 247, 0.65)";
                    textColor = "#fff";
                    borderColor = "#a855f7";
                  } else if (intensity >= 20) {
                    bg = "rgba(99, 102, 241, 0.4)";
                    textColor = "#e0e7ff";
                    borderColor = "#6366f1";
                  } else {
                    bg = "rgba(99, 102, 241, 0.15)";
                    textColor = "#a5b4fc";
                    borderColor = "rgba(99, 102, 241, 0.25)";
                  }
                }

                return (
                  <Tooltip
                    key={cell.hour}
                    title={
                      <div>
                        <strong>{dayRow.day_name} @ {cell.hour_label}</strong>
                        <div>Orders: <strong>{count}</strong></div>
                        <div>Revenue: <strong>৳{Math.round(cell.revenue).toLocaleString()}</strong></div>
                      </div>
                    }
                  >
                    <div
                      style={{
                        height: 28,
                        backgroundColor: bg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: count > 0 ? 700 : 400,
                        color: textColor,
                        cursor: "pointer",
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Section 4: Detailed Hourly Performance Table */}
      <Card
        title={
          <span style={{ color: "#e4e4e7", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <BarChartOutlined style={{ color: "#60a5fa" }} />
            24-Hour Detailed Order &amp; Revenue Breakdown
          </span>
        }
        styles={{ body: { padding: 0 } }}
        style={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: 10, overflow: "hidden" }}
      >
        <Table
          dataSource={hourlyData}
          columns={hourlyColumns}
          rowKey="hour"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default OrderTimestampAnalytics;

