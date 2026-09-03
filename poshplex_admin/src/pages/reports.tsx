import React, { useState, useEffect } from "react";
import { Card, Row, Col, Typography, Spin, message, DatePicker, Select, Space, Divider, Tag } from "antd";
import { BarChartOutlined, LineChartOutlined, ClockCircleOutlined, SyncOutlined, StopOutlined, CarOutlined, UndoOutlined, PauseCircleOutlined, CheckCircleOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const API_URL = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

export const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  
  const [filterType, setFilterType] = useState<string>("today");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  useEffect(() => {
    fetchReport();
  }, [filterType, dateRange]);

  const fetchReport = async () => {
    setLoading(true);
    let fromDate = null;
    let toDate = null;
    const now = dayjs();

    if (filterType === "today") {
      fromDate = now.startOf("day").toISOString();
      toDate = now.endOf("day").toISOString();
    } else if (filterType === "yesterday") {
      fromDate = now.subtract(1, "day").startOf("day").toISOString();
      toDate = now.subtract(1, "day").endOf("day").toISOString();
    } else if (filterType === "day_before_yesterday") {
      fromDate = now.subtract(2, "day").startOf("day").toISOString();
      toDate = now.subtract(2, "day").endOf("day").toISOString();
    } else if (filterType === "7_days") {
      fromDate = now.subtract(7, "day").startOf("day").toISOString();
      toDate = now.endOf("day").toISOString();
    } else if (filterType === "1_month") {
      fromDate = now.subtract(1, "month").startOf("day").toISOString();
      toDate = now.endOf("day").toISOString();
    } else if (filterType === "custom" && dateRange[0] && dateRange[1]) {
      fromDate = dateRange[0].startOf("day").toISOString();
      toDate = dateRange[1].endOf("day").toISOString();
    }

    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}/report/sales`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { date_from: fromDate, date_to: toDate }
      });
      setData(res.data);
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error("Failed to load sales report");
      }
    } finally {
      setLoading(false);
    }
  };

  const getFilterTitle = () => {
    switch (filterType) {
      case "today": return "Today's Report";
      case "yesterday": return "Yesterday's Report";
      case "day_before_yesterday": return "Day Before Yesterday Report";
      case "7_days": return "Last 7 Days Report";
      case "1_month": return "Last 1 Month Report";
      case "custom": return "Custom Date Range Report";
      default: return "Sales Report";
    }
  };

  const statusIcons: any = {
    placed: <ClockCircleOutlined style={{ color: "#faad14" }} />,
    review: <SyncOutlined style={{ color: "#13c2c2" }} />,
    pending: <ClockCircleOutlined style={{ color: "#fa8c16" }} />,
    hold: <PauseCircleOutlined style={{ color: "#d48806" }} />,
    approval_pending: <CarOutlined style={{ color: "#1677ff" }} />,
    delivered: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
    returned: <UndoOutlined style={{ color: "#eb2f96" }} />,
    cancelled: <StopOutlined style={{ color: "#ff4d4f" }} />,
  };

  const formatStatus = (s: string) => {
    return s.replace("_", " ").toUpperCase();
  };

  return (
    <div style={{ paddingBottom: 64 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChartOutlined style={{ fontSize: 28 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-main)" }}>Sales Reports</h1>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>Independent modular analytics</p>
          </div>
        </div>
        
        <Space wrap>
          <Select value={filterType} onChange={setFilterType} style={{ width: 200 }}>
            <Option value="today">Today</Option>
            <Option value="yesterday">Yesterday</Option>
            <Option value="day_before_yesterday">Day before yesterday</Option>
            <Option value="7_days">Last 7 days</Option>
            <Option value="1_month">Last 1 month</Option>
            <Option value="custom">Custom Range</Option>
          </Select>
          {filterType === "custom" && (
            <RangePicker 
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])} 
            />
          )}
        </Space>
      </div>

      <Spin spinning={loading}>
        <Title level={4} style={{ marginTop: 0 }}>
          {getFilterTitle()} <Tag color="purple" style={{ marginLeft: 8 }}>{data?.snapshot?.orders_qty || 0} Orders</Tag>
        </Title>
        <Divider style={{ borderColor: 'var(--border-glass)' }} />

        <Title level={5} style={{ color: 'var(--text-main)' }}>Orders Snapshot</Title>
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false} style={{ background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-glass)" }}>
              <Text type="secondary">Total Orders</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{data?.snapshot?.orders_qty || 0}</div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false} style={{ background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-glass)" }}>
              <Text type="secondary">Total Products</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{data?.snapshot?.product_qty || 0}</div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false} style={{ background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-glass)" }}>
              <Text type="secondary">Total Amount</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--accent-purple)' }}>
                ৳{Math.round(data?.snapshot?.total_amount || 0)}
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false} style={{ background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-glass)" }}>
              <Text type="secondary">Avg Order Value</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                ৳{Math.round(data?.snapshot?.avg_order || 0)}
              </div>
            </Card>
          </Col>
        </Row>

        <Title level={5} style={{ color: 'var(--text-main)' }}>Order Status Breakdown</Title>
        <Row gutter={[16, 16]}>
          {data?.status_report && Object.keys(data.status_report).map(statusKey => {
            const stats = data.status_report[statusKey];
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={statusKey}>
                <Card bordered={false} style={{ background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-glass)" }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    {statusIcons[statusKey] || <LineChartOutlined />}
                    <Text strong style={{ fontSize: 16 }}>{formatStatus(statusKey)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text type="secondary">Orders:</Text>
                    <Text strong>{stats.orders_qty}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text type="secondary">Products:</Text>
                    <Text strong>{stats.product_qty}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-glass)' }}>
                    <Text type="secondary">Value:</Text>
                    <Text strong style={{ color: 'var(--accent-purple)' }}>৳{Math.round(stats.total_amount)}</Text>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Spin>
    </div>
  );
};

export default ReportsPage;
