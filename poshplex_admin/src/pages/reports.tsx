import React, { useState, useEffect } from "react";
import { Card, Row, Col, Typography, Spin, message, DatePicker, Select, Space, Divider, Tag, Checkbox, InputNumber, Button, Tooltip } from "antd";
import { 
  BarChartOutlined, LineChartOutlined, ClockCircleOutlined, SyncOutlined, StopOutlined, 
  CarOutlined, UndoOutlined, PauseCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ShoppingOutlined, DollarOutlined, RiseOutlined, FallOutlined, EditOutlined, SaveOutlined
} from "@ant-design/icons";
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
  const [activeStatuses, setActiveStatuses] = useState<string[]>([]);
  const [fixedExpenseInput, setFixedExpenseInput] = useState<number>(0);
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  // USD Rate state
  const [usdRateInput, setUsdRateInput] = useState<number>(122.0);
  const [isEditingUsdRate, setIsEditingUsdRate] = useState(false);
  const [savingUsdRate, setSavingUsdRate] = useState(false);

  const handleSaveFixedExpense = async () => {
    setSavingExpense(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_URL}/report/settings/fixed-expense`, { amount: fixedExpenseInput }, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Fixed expense updated!");
      setIsEditingExpense(false);
      fetchReport();
    } catch(err) {
      message.error("Failed to update expense");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleSaveUsdRate = async () => {
    if (!usdRateInput || usdRateInput <= 0) {
      message.error("Please enter a valid USD rate");
      return;
    }
    setSavingUsdRate(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_URL}/report/settings/usd-rate`, { rate: usdRateInput }, { headers: { Authorization: `Bearer ${token}` } });
      message.success("USD conversion rate updated!");
      setIsEditingUsdRate(false);
      fetchReport();
    } catch(err) {
      message.error("Failed to update USD rate");
    } finally {
      setSavingUsdRate(false);
    }
  };
  const fetchReport = async () => {
    setLoading(true);
    let fromDate: string | null = null;
    let toDate: string | null = null;
    let preset: string | null = null;

    if (filterType === "custom") {
      if (dateRange[0] && dateRange[1]) {
        // Send YYYY-MM-DD for clean timezone-agnostic boundaries
        fromDate = dateRange[0].format("YYYY-MM-DD");
        toDate = dateRange[1].format("YYYY-MM-DD");
      }
    } else {
      preset = filterType;
    }

    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}/report/sales`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          preset: preset || undefined,
          date_from: fromDate || undefined, 
          date_to: toDate || undefined 
        }
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

  useEffect(() => {
    fetchReport();
  }, [filterType, dateRange]);

  useEffect(() => {
    if (data?.status_report) {
      // By default, exclude 'cancelled' and 'manually_cancelled' so net sales and profit reflect non-cancelled orders
      const defaultExcluded = ["cancelled", "manually_cancelled"];
      setActiveStatuses(Object.keys(data.status_report).filter(k => !defaultExcluded.includes(k)));
    }
  }, [data]);

  const filteredSnapshot = React.useMemo(() => {
    if (!data?.status_report) return { orders_qty: 0, product_qty: 0, total_amount: 0, avg_order: 0, product_costing: 0 };
    let orders = 0;
    let products = 0;
    let amount = 0;
    let costing = 0;
    activeStatuses.forEach(key => {
      const s = data.status_report[key];
      if (s) {
        orders += s.orders_qty || 0;
        products += s.product_qty || 0;
        amount += s.total_amount || 0;
        costing += s.product_costing || 0;
      }
    });
    return {
      orders_qty: orders,
      product_qty: products,
      total_amount: amount,
      avg_order: orders > 0 ? amount / orders : 0,
      product_costing: costing
    };
  }, [data, activeStatuses]);

  useEffect(() => {
    if (data?.snapshot?.fixed_expense !== undefined) {
      setFixedExpenseInput(data.snapshot.fixed_expense);
    }
    if (data?.snapshot?.usd_to_bdt_rate !== undefined) {
      setUsdRateInput(data.snapshot.usd_to_bdt_rate);
    }
  }, [data?.snapshot?.fixed_expense, data?.snapshot?.usd_to_bdt_rate]);

  const getFilterTitle = () => {
    switch (filterType) {
      case "today": return "Today's Report";
      case "yesterday": return "Yesterday's Report";
      case "day_before_yesterday": return "Day Before Yesterday Report";
      case "today_yesterday": return "Today & Yesterday Report";
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
    manually_cancelled: <CloseCircleOutlined style={{ color: "#c41d7f" }} />,
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
            <Option value="today_yesterday">Today & Yesterday</Option>
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
          {getFilterTitle()} <Tag color="purple" style={{ marginLeft: 8 }}>{filteredSnapshot.orders_qty} Orders</Tag>
        </Title>
        <Divider style={{ borderColor: 'var(--border-glass)' }} />

        {/* Redesigned Grid Boxes: Order Grid Box & Profit/Loss Grid Box */}
        <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
          {/* 1. Order Grid Box */}
          <Col xs={24} lg={12}>
            <Card
              bordered={false}
              style={{
                background: "var(--bg-secondary, #14161f)",
                borderRadius: 12,
                border: "1px solid var(--border-glass, #232733)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
              bodyStyle={{ padding: "20px 24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12 }}>
                <Space align="center">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(56, 189, 248, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShoppingOutlined style={{ color: "#38bdf8", fontSize: 18 }} />
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 15, color: "var(--text-main, #ffffff)", letterSpacing: "0.3px" }}>
                      Order Summary
                    </Text>
                    <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>Volume, order values & item velocity</div>
                  </div>
                </Space>
                <Tag color="cyan" style={{ borderRadius: 4, fontWeight: 700, margin: 0 }}>
                  {filteredSnapshot.orders_qty} Orders
                </Tag>
              </div>

              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Total Orders</Text>
                    <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
                      {filteredSnapshot.orders_qty.toLocaleString()}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Total Products</Text>
                    <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
                      {filteredSnapshot.product_qty.toLocaleString()}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Total Orders Amount</Text>
                    <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-purple, #a855f7)", marginTop: 4 }}>
                      ৳{Math.round(filteredSnapshot.total_amount).toLocaleString()}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Average Order Value</Text>
                    <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-cyan, #06b6d4)", marginTop: 4 }}>
                      ৳{Math.round(filteredSnapshot.avg_order).toLocaleString()}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 2. Profit / Loss Grid Box */}
          <Col xs={24} lg={12}>
            {(() => {
              const currentUsdRate = data?.snapshot?.usd_to_bdt_rate || 122.0;
              const metaSpendUsd = data?.snapshot?.meta_ads_spend_usd || 0;
              // If user is editing rate in local input, auto calculate preview with usdRateInput, otherwise use synced backend rate
              const effectiveUsdRate = isEditingUsdRate ? (usdRateInput || currentUsdRate) : currentUsdRate;
              const metaSpendBdt = Math.round(metaSpendUsd * effectiveUsdRate);
              const orderAmount = filteredSnapshot.total_amount || 0;
              const productCosting = filteredSnapshot.product_costing || 0;
              const netProfit = Math.round(orderAmount - productCosting - metaSpendBdt);
              const isProfitable = netProfit >= 0;

              return (
                <Card
                  bordered={false}
                  style={{
                    background: "var(--bg-secondary, #14161f)",
                    borderRadius: 12,
                    border: "1px solid var(--border-glass, #232733)",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                  bodyStyle={{ padding: "20px 24px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <Space align="center">
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isProfitable ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isProfitable ? <RiseOutlined style={{ color: "#10b981", fontSize: 18 }} /> : <FallOutlined style={{ color: "#ef4444", fontSize: 18 }} />}
                      </div>
                      <div>
                        <Text strong style={{ fontSize: 15, color: "var(--text-main, #ffffff)", letterSpacing: "0.3px" }}>
                          Profit / Loss Statement
                        </Text>
                        <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>Orders − COGS − Meta Ad Spend</div>
                      </div>
                    </Space>

                    {/* USD to BDT Rate Edit Control */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255, 255, 255, 0.04)", padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>1 USD =</span>
                      {!isEditingUsdRate ? (
                        <>
                          <strong style={{ fontSize: 12, color: "#facc15" }}>৳{currentUsdRate.toFixed(2)}</strong>
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<EditOutlined style={{ fontSize: 12, color: "#38bdf8" }} />} 
                            onClick={() => {
                              setUsdRateInput(currentUsdRate);
                              setIsEditingUsdRate(true);
                            }}
                            style={{ padding: "0 4px", height: 22 }}
                          />
                        </>
                      ) : (
                        <Space size={4}>
                          <InputNumber
                            size="small"
                            value={usdRateInput}
                            onChange={(val) => setUsdRateInput(val || 122.0)}
                            style={{ width: 75 }}
                            precision={2}
                            step={0.5}
                          />
                          <Button
                            type="primary"
                            size="small"
                            icon={<SaveOutlined />}
                            loading={savingUsdRate}
                            onClick={handleSaveUsdRate}
                            style={{ height: 24, padding: "0 8px", backgroundColor: "#10b981", borderColor: "#10b981" }}
                          >
                            Save
                          </Button>
                        </Space>
                      )}
                    </div>
                  </div>

                  <Row gutter={[12, 12]}>
                    <Col span={12}>
                      <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Total Order Amounts</Text>
                        <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
                          ৳{Math.round(orderAmount).toLocaleString()}
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Total Product Costing</Text>
                        <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b", marginTop: 4 }}>
                          ৳{Math.round(productCosting).toLocaleString()}
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Meta Ads Costing</Text>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>(${metaSpendUsd.toFixed(2)} USD)</span>
                        </div>
                        <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: "#f87171", marginTop: 4 }}>
                          ৳{metaSpendBdt.toLocaleString()}
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ background: isProfitable ? "rgba(16, 185, 129, 0.06)" : "rgba(239, 68, 68, 0.06)", padding: "14px 16px", borderRadius: 8, border: `1px solid ${isProfitable ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}` }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Total Profit</Text>
                        <div className="posh-stat-num" style={{ fontSize: 24, fontWeight: 800, color: isProfitable ? "#10b981" : "#f87171", marginTop: 4 }}>
                          {isProfitable ? "+৳" : "-৳"}{Math.abs(netProfit).toLocaleString()}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              );
            })()}
          </Col>
        </Row>

        <Title level={5} style={{ color: 'var(--text-main)' }}>Order Status Breakdown</Title>
        <Row gutter={[10, 10]}>
          {data?.status_report && Object.keys(data.status_report).map(statusKey => {
            const stats = data.status_report[statusKey];
            return (
              <Col xs={12} sm={12} md={8} lg={6} key={statusKey}>
                <Card bordered={false} style={{ background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-glass)" }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {statusIcons[statusKey] || <LineChartOutlined />}
                      <Text strong style={{ fontSize: 13 }} ellipsis>{formatStatus(statusKey)}</Text>
                    </div>
                    <Checkbox 
                      checked={activeStatuses.includes(statusKey)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setActiveStatuses([...activeStatuses, statusKey]);
                        } else {
                          setActiveStatuses(activeStatuses.filter(k => k !== statusKey));
                        }
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text type="secondary">Orders:</Text>
                    <Text strong>{stats.orders_qty}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text type="secondary">Products:</Text>
                    <Text strong>{stats.product_qty}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text type="secondary">Percentage Rate:</Text>
                    <Text strong>{filteredSnapshot.orders_qty > 0 ? ((stats.orders_qty / filteredSnapshot.orders_qty) * 100).toFixed(1) + '%' : '0%'}</Text>
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
