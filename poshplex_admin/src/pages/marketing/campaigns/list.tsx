import React, { useState, useEffect, useMemo } from "react";
import {
  Table, Tag, Button, Space, Card, Input, Select, Typography,
  Modal, message, Tooltip, Avatar, Statistic, Row, Col
} from "antd";
import {
  PlusOutlined, SearchOutlined, PlayCircleOutlined, PauseCircleOutlined,
  CloudUploadOutlined, RiseOutlined, EyeOutlined, ReloadOutlined, StopOutlined,
  InfoCircleOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const { Title, Text } = Typography;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const CampaignList: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await axios.get(`${API_BASE}/campaigns/`, { headers, params });
      setCampaigns(res.data);
    } catch (err: any) {
      message.error("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter]);

  const handleDeploy = async (id: number) => {
    message.loading({ content: "Deploying campaign to Meta Marketing API...", key: "deploy" });
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/campaigns/${id}/deploy/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success({ content: "Campaign successfully deployed to Meta!", key: "deploy" });
      fetchCampaigns();
    } catch (err: any) {
      message.error({ content: err?.response?.data?.message || "Failed to deploy campaign.", key: "deploy" });
    }
  };

  const handlePause = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/campaigns/${id}/pause/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Campaign paused.");
      fetchCampaigns();
    } catch (err) {
      message.error("Failed to pause campaign.");
    }
  };

  const handleResume = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/campaigns/${id}/resume/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Campaign resumed.");
      fetchCampaigns();
    } catch (err) {
      message.error("Failed to resume campaign.");
    }
  };

  const handleScale = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_BASE}/campaigns/${id}/scale/`, { percentage: 20 }, { headers: { Authorization: `Bearer ${token}` } });
      message.success(`Scaled daily budget +20% to $${res.data.new_budget}!`);
      fetchCampaigns();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to scale budget.");
    }
  };

  const handleStopAllAds = () => {
    Modal.confirm({
      title: "EMERGENCY: Pause All Active Meta Ads?",
      icon: <StopOutlined style={{ color: "#ef4444" }} />,
      content: "This will immediately send pause requests to Meta API for all active campaigns across all connected ad accounts. Do you want to proceed?",
      okText: "STOP ALL ADS NOW",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const token = localStorage.getItem("poshplex_access_token");
          const res = await axios.post(`${API_BASE}/campaigns/stop-all/`, {}, { headers: { Authorization: `Bearer ${token}` } });
          message.warning(res.data.message || "All campaigns have been paused.");
          fetchCampaigns();
        } catch (err: any) {
          message.error("Failed to stop campaigns: " + (err?.response?.data?.message || err.message));
        }
      }
    });
  };

  // Helper formatting utilities
  const getCurrency = (record: any) => (record?.currency === "BDT" ? "৳" : "$");

  const fmtCurrency = (val: any, record?: any) => {
    const num = Number(val || 0);
    const curr = record ? getCurrency(record) : "$";
    return `${curr}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtNumber = (val: any) => {
    const num = Number(val || 0);
    return num > 0 ? num.toLocaleString() : "—";
  };

  // Summary rollups for top KPI bar
  const summary = useMemo(() => {
    const totalSpend = campaigns.reduce((acc, c) => acc + Number(c.total_spend || 0), 0);
    const totalResults = campaigns.reduce((acc, c) => acc + Number(c.results || 0), 0);
    const totalImpressions = campaigns.reduce((acc, c) => acc + Number(c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + Number(c.total_clicks || c.clicks || 0), 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    return {
      count: campaigns.length,
      spend: totalSpend,
      results: totalResults,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: avgCtr,
      cpc: avgCpc,
    };
  }, [campaigns]);

  // Exact 18 columns in the sequence requested by user + fixed actions
  const columns: any[] = [
    // 1. Campaign name
    {
      title: "Campaign name",
      dataIndex: "name",
      key: "name",
      fixed: "left",
      width: 260,
      render: (name: string, record: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 245, minWidth: 0 }}>
          <Avatar
            shape="square"
            size={32}
            src={record.linked_product_image}
            style={{ backgroundColor: "#27272a", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}
          >
            {name ? name.charAt(0) : "C"}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <Tooltip title={name} placement="topLeft">
              <span
                style={{
                  color: "#f8fafc",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
                onClick={() => navigate(`/marketing/campaigns/${record.id}`)}
              >
                {name}
              </span>
            </Tooltip>
            <div
              style={{
                fontSize: 9.5,
                color: "#94a3b8",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {record.linked_product_name ? record.linked_product_name : "Generic"} · {record.objective}
            </div>
            {record.meta_campaign_id && (
              <div
                style={{
                  fontSize: 9,
                  color: "#a78bfa",
                  fontFamily: "monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                ID: {record.meta_campaign_id}
              </div>
            )}
          </div>
        </div>
      ),
    },

    // 2. Status
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 95,
      align: "center",
      render: (status: string) => {
        let color = "default";
        if (status === "ACTIVE") color = "success";
        else if (status === "DEPLOYING") color = "processing";
        else if (status === "PAUSED") color = "warning";
        else if (status === "ERROR") color = "error";
        return (
          <Tag
            color={color}
            style={{
              fontSize: 9.5,
              padding: "0 5px",
              lineHeight: "18px",
              fontWeight: 600,
              textTransform: "uppercase",
              borderRadius: 3
            }}
          >
            {status}
          </Tag>
        );
      },
    },

    // 3. Budget
    {
      title: "Budget",
      dataIndex: "budget_amount",
      key: "budget_amount",
      align: "right",
      width: 100,
      render: (amount: number, record: any) => (
        <div style={{ textAlign: "right" }}>
          <Text strong style={{ fontSize: 11.5, color: "#f8fafc" }}>
            {fmtCurrency(amount, record)}
          </Text>
          <div style={{ fontSize: 9, color: "#94a3b8" }}>
            /{record.budget_type === "DAILY" ? "day" : "lifetime"}
          </div>
        </div>
      ),
    },

    // 4. Amount Spent
    {
      title: "Amount Spent",
      dataIndex: "total_spend",
      key: "total_spend",
      align: "right",
      width: 105,
      render: (spend: number, record: any) => (
        <Text style={{ fontSize: 11.5, fontWeight: 600, color: Number(spend) > 0 ? "#fca5a5" : "#94a3b8" }}>
          {fmtCurrency(spend, record)}
        </Text>
      ),
    },

    // 5. Results
    {
      title: (
        <Tooltip title="Total conversions / purchases achieved">
          <span>Results <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "results",
      key: "results",
      align: "right",
      width: 85,
      render: (results: number) => {
        const val = Number(results || 0);
        return (
          <Text strong style={{ fontSize: 11.5, color: val > 0 ? "#34d399" : "#64748b" }}>
            {val > 0 ? val.toLocaleString() : "—"}
          </Text>
        );
      },
    },

    // 6. Cost Per result
    {
      title: (
        <Tooltip title="Cost Per Result = Amount Spent / Results">
          <span>Cost Per result <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "cost_per_result",
      key: "cost_per_result",
      align: "right",
      width: 115,
      render: (cpr: number, record: any) => {
        const val = Number(cpr || 0);
        return (
          <Text style={{ fontSize: 11, color: val > 0 ? "#f8fafc" : "#64748b" }}>
            {val > 0 ? fmtCurrency(val, record) : "—"}
          </Text>
        );
      },
    },

    // 7. Impression
    {
      title: "Impression",
      dataIndex: "impressions",
      key: "impressions",
      align: "right",
      width: 95,
      render: (impressions: number) => (
        <span style={{ fontSize: 11, color: "#e2e8f0" }}>{fmtNumber(impressions)}</span>
      ),
    },

    // 8. Reach
    {
      title: (
        <Tooltip title="Estimated total unique people who saw your ads">
          <span>Reach <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "reach",
      key: "reach",
      align: "right",
      width: 90,
      render: (reach: number, record: any) => {
        const val = Number(reach || record.impressions || 0);
        return <span style={{ fontSize: 11, color: "#e2e8f0" }}>{fmtNumber(val)}</span>;
      },
    },

    // 9. Frequency
    {
      title: (
        <Tooltip title="Average number of times each person saw your ad (Impressions / Reach)">
          <span>Frequency <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "frequency",
      key: "frequency",
      align: "right",
      width: 85,
      render: (freq: number) => {
        const val = Number(freq || 1.0);
        return <span style={{ fontSize: 11, color: "#cbd5e1" }}>{val.toFixed(2)}</span>;
      },
    },

    // 10. CPM Cost
    {
      title: (
        <Tooltip title="Cost Per 1,000 Impressions">
          <span>CPM Cost <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "cpm",
      key: "cpm",
      align: "right",
      width: 95,
      render: (cpm: number, record: any) => {
        const val = Number(cpm || 0);
        return (
          <span style={{ fontSize: 11, color: val > 0 ? "#cbd5e1" : "#64748b" }}>
            {val > 0 ? fmtCurrency(val, record) : "—"}
          </span>
        );
      },
    },

    // 11. Shop Clicks
    {
      title: (
        <Tooltip title="Clicks on shop tags, product cards, or commerce catalog items">
          <span>Shop Clicks <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "shop_clicks",
      key: "shop_clicks",
      align: "right",
      width: 90,
      render: (clicks: number) => (
        <span style={{ fontSize: 11, color: clicks ? "#38bdf8" : "#64748b" }}>
          {fmtNumber(clicks)}
        </span>
      ),
    },

    // 12. Link Clicks
    {
      title: (
        <Tooltip title="Inline link clicks leading to your storefront">
          <span>Link Clicks <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "link_clicks",
      key: "link_clicks",
      align: "right",
      width: 90,
      render: (clicks: number) => (
        <span style={{ fontSize: 11, color: "#e2e8f0" }}>{fmtNumber(clicks)}</span>
      ),
    },

    // 13. CPC (Cost per link click)
    {
      title: (
        <Tooltip title="Cost Per Link Click = Amount Spent / Link Clicks">
          <span>CPC <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "cpc",
      key: "cpc",
      align: "right",
      width: 85,
      render: (cpc: number, record: any) => {
        const val = Number(cpc || 0);
        return (
          <span style={{ fontSize: 11, color: val > 0 ? "#cbd5e1" : "#64748b" }}>
            {val > 0 ? fmtCurrency(val, record) : "—"}
          </span>
        );
      },
    },

    // 14. total click
    {
      title: (
        <Tooltip title="Total clicks across all ad elements (links, photos, reactions, comments)">
          <span>total click <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "total_clicks",
      key: "total_clicks",
      align: "right",
      width: 90,
      render: (clicks: number, record: any) => {
        const val = Number(clicks || record.clicks || 0);
        return <span style={{ fontSize: 11, color: "#e2e8f0" }}>{fmtNumber(val)}</span>;
      },
    },

    // 15. CTR ALL
    {
      title: (
        <Tooltip title="Click-Through Rate (All Clicks / Impressions * 100%)">
          <span>CTR ALL <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "ctr_all",
      key: "ctr_all",
      align: "right",
      width: 85,
      render: (ctr: number) => {
        const val = Number(ctr || 0);
        return (
          <span style={{ fontSize: 11, color: val > 0 ? "#f8fafc" : "#64748b" }}>
            {val > 0 ? `${val.toFixed(2)}%` : "0.00%"}
          </span>
        );
      },
    },

    // 16. CPC all
    {
      title: (
        <Tooltip title="Cost Per Click (All) = Amount Spent / Total Clicks">
          <span>CPC all <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "cpc_all",
      key: "cpc_all",
      align: "right",
      width: 85,
      render: (cpcAll: number, record: any) => {
        const val = Number(cpcAll || 0);
        return (
          <span style={{ fontSize: 11, color: val > 0 ? "#cbd5e1" : "#64748b" }}>
            {val > 0 ? fmtCurrency(val, record) : "—"}
          </span>
        );
      },
    },

    // 17. Landing Page Views
    {
      title: (
        <Tooltip title="Confirmed landing page views recorded by Meta Pixel / CAPI">
          <span>Landing Page Views <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "landing_page_views",
      key: "landing_page_views",
      align: "right",
      width: 130,
      render: (lpv: number) => (
        <span style={{ fontSize: 11, color: lpv ? "#a78bfa" : "#64748b" }}>
          {fmtNumber(lpv)}
        </span>
      ),
    },

    // 18. Cost per landing page
    {
      title: (
        <Tooltip title="Cost Per Landing Page View = Amount Spent / Landing Page Views">
          <span>Cost per landing page <InfoCircleOutlined style={{ fontSize: 9, color: "#64748b" }} /></span>
        </Tooltip>
      ),
      dataIndex: "cost_per_landing_page",
      key: "cost_per_landing_page",
      align: "right",
      width: 140,
      render: (cost: number, record: any) => {
        const val = Number(cost || 0);
        return (
          <span style={{ fontSize: 11, color: val > 0 ? "#cbd5e1" : "#64748b" }}>
            {val > 0 ? fmtCurrency(val, record) : "—"}
          </span>
        );
      },
    },

    // Pinned Actions
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      align: "center",
      width: 125,
      render: (_: any, record: any) => {
        const isDraft = record.status === "DRAFT" || record.status === "ERROR";
        const isActive = record.status === "ACTIVE";

        return (
          <Space size={4}>
            {isDraft ? (
              <Tooltip title="Deploy campaign to Meta">
                <Button
                  type="primary"
                  size="small"
                  icon={<CloudUploadOutlined style={{ fontSize: 11 }} />}
                  onClick={() => handleDeploy(record.id)}
                  style={{ backgroundColor: "#8b5cf6", height: 22, padding: "0 6px", fontSize: 10.5 }}
                >
                  Deploy
                </Button>
              </Tooltip>
            ) : isActive ? (
              <Tooltip title="Pause delivery on Meta">
                <Button
                  size="small"
                  icon={<PauseCircleOutlined style={{ fontSize: 11 }} />}
                  onClick={() => handlePause(record.id)}
                  style={{ height: 22, width: 22, padding: 0 }}
                />
              </Tooltip>
            ) : (
              <Tooltip title="Resume delivery on Meta">
                <Button
                  size="small"
                  icon={<PlayCircleOutlined style={{ fontSize: 11 }} />}
                  onClick={() => handleResume(record.id)}
                  style={{ height: 22, width: 22, padding: 0 }}
                />
              </Tooltip>
            )}

            {isActive && (
              <Tooltip title="Scale Budget +20%">
                <Button
                  size="small"
                  icon={<RiseOutlined style={{ fontSize: 11 }} />}
                  onClick={() => handleScale(record.id)}
                  style={{ height: 22, width: 22, padding: 0 }}
                />
              </Tooltip>
            )}

            <Tooltip title="View Campaign Details">
              <Button
                size="small"
                icon={<EyeOutlined style={{ fontSize: 11 }} />}
                onClick={() => navigate(`/marketing/campaigns/${record.id}`)}
                style={{ height: 22, width: 22, padding: 0 }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {/* Dense styling overrides to cleanly fit all 18 Meta metrics */}
      <style>{`
        .meta-dense-campaigns-table .ant-table {
          background: #0d0d12 !important;
          color: #e2e8f0;
          font-family: inherit;
        }
        .meta-dense-campaigns-table .ant-table-thead > tr > th {
          font-size: 10px !important;
          font-weight: 700 !important;
          letter-spacing: 0.35px !important;
          text-transform: uppercase !important;
          color: #94a3b8 !important;
          background: #15151e !important;
          padding: 6px 7px !important;
          white-space: nowrap !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-right: 1px solid rgba(255, 255, 255, 0.03) !important;
        }
        .meta-dense-campaigns-table .ant-table-tbody > tr > td {
          font-size: 11px !important;
          padding: 5px 7px !important;
          white-space: nowrap !important;
          font-variant-numeric: tabular-nums !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
          border-right: 1px solid rgba(255, 255, 255, 0.02) !important;
          background: #0f0f15 !important;
        }
        .meta-dense-campaigns-table .ant-table-tbody > tr:hover > td {
          background: #1a1a24 !important;
        }
        .meta-dense-campaigns-table .ant-table-cell-fix-left {
          background: #121218 !important;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.4) !important;
        }
        .meta-dense-campaigns-table .ant-table-cell-fix-right {
          background: #121218 !important;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.4) !important;
        }
        .meta-dense-campaigns-table .ant-table-tbody > tr:hover > .ant-table-cell-fix-left,
        .meta-dense-campaigns-table .ant-table-tbody > tr:hover > .ant-table-cell-fix-right {
          background: #1e1e2c !important;
        }
        .meta-dense-campaigns-table .ant-pagination {
          margin: 10px 0 0 0 !important;
        }
      `}</style>

      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: "#ffffff", fontWeight: 700 }}>Meta Campaigns</Title>
          <Text style={{ color: "#94a3b8", fontSize: 11.5 }}>
            Automated media buyer management & real-time Ads Manager performance tracking
          </Text>
        </div>
        <Space size={8}>
          <Button size="small" icon={<ReloadOutlined style={{ fontSize: 11 }} />} onClick={fetchCampaigns}>
            Refresh
          </Button>
          <Button
            danger
            type="primary"
            size="small"
            icon={<StopOutlined style={{ fontSize: 11 }} />}
            onClick={handleStopAllAds}
            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", fontSize: 11 }}
          >
            STOP ALL ADS
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined style={{ fontSize: 11 }} />}
            onClick={() => navigate("/marketing/campaigns/create")}
            style={{ backgroundColor: "#8b5cf6", borderColor: "#8b5cf6", fontSize: 11 }}
          >
            Create Campaign
          </Button>
        </Space>
      </div>

      {/* Quick KPI ribbon */}
      <Card
        size="small"
        style={{
          backgroundColor: "#121218",
          borderColor: "rgba(255,255,255,0.08)",
          borderRadius: 8,
          marginBottom: 12
        }}
        bodyStyle={{ padding: "10px 14px" }}
      >
        <Row gutter={[12, 8]} align="middle">
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Active Campaigns</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{summary.count}</div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Total Spent</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>${summary.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Total Results</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#34d399" }}>{summary.results.toLocaleString()}</div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Impressions</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#38bdf8" }}>{summary.impressions.toLocaleString()}</div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Total Clicks</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{summary.clicks.toLocaleString()}</div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Avg CTR / CPC</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>
              {summary.ctr.toFixed(2)}% · ${summary.cpc.toFixed(2)}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Main Table Card */}
      <Card
        size="small"
        style={{
          backgroundColor: "#111116",
          borderColor: "rgba(255,255,255,0.08)",
          borderRadius: 8
        }}
        bodyStyle={{ padding: "10px" }}
      >
        {/* Filters bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Input
            size="small"
            placeholder="Search campaigns by name..."
            prefix={<SearchOutlined style={{ color: "#9ca3af", fontSize: 11 }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchCampaigns}
            style={{ width: 240, fontSize: 11.5 }}
          />
          <Select
            size="small"
            placeholder="Filter by Status"
            allowClear
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 150, fontSize: 11.5 }}
            options={[
              { label: "Active", value: "ACTIVE" },
              { label: "Draft", value: "DRAFT" },
              { label: "Paused", value: "PAUSED" },
              { label: "Deploying", value: "DEPLOYING" },
              { label: "Error", value: "ERROR" },
            ]}
          />
          <Button size="small" onClick={fetchCampaigns} style={{ fontSize: 11.5 }}>
            Filter
          </Button>
          <div style={{ marginLeft: "auto", fontSize: 10.5, color: "#64748b" }}>
            Showing {campaigns.length} campaigns · Horizontal scroll enabled
          </div>
        </div>

        {/* 18-Column Dense Table */}
        <Table
          className="meta-dense-campaigns-table"
          size="small"
          dataSource={campaigns}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 2000 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            size: "small"
          }}
        />
      </Card>
    </div>
  );
};
