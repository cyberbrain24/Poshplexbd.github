import React, { useState, useEffect, useMemo } from "react";
import {
  Table, Tag, Button, Space, Card, Input, Select, Typography,
  Modal, message, Tooltip, Avatar, Statistic, Row, Col, DatePicker, Checkbox, Divider
} from "antd";
import {
  PlusOutlined, SearchOutlined, PlayCircleOutlined, PauseCircleOutlined,
  CloudUploadOutlined, RiseOutlined, EyeOutlined, ReloadOutlined, StopOutlined,
  InfoCircleOutlined, SafetyCertificateOutlined, CheckCircleOutlined, WarningOutlined,
  ThunderboltOutlined, AimOutlined, AppstoreOutlined, SettingOutlined, SwapOutlined,
  CalendarOutlined, FilterOutlined, ArrowUpOutlined, ArrowDownOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

// All available Meta columns definition
const ALL_COLUMN_KEYS = [
  { key: "status", label: "Status", group: "core", default: true },
  { key: "budget_amount", label: "Budget", group: "core", default: true, fixed: true },
  { key: "total_spend", label: "Amount Spent", group: "core", default: true, fixed: true },
  { key: "results", label: "Results (Purchases)", group: "core", default: true, fixed: true },
  { key: "cost_per_result", label: "Cost Per Result", group: "core", default: true, fixed: true },
  { key: "delivered_rate", label: "Delivered Rate", group: "attribution", default: true },
  { key: "net_ad_profit", label: "Net Ad Profit", group: "attribution", default: true },
  { key: "roas_delivered", label: "Delivered ROAS", group: "attribution", default: true },
  { key: "impressions", label: "Impressions", group: "performance", default: true },
  { key: "reach", label: "Reach", group: "performance", default: true },
  { key: "frequency", label: "Frequency", group: "performance", default: true },
  { key: "cpm", label: "CPM Cost", group: "performance", default: true },
  { key: "shop_clicks", label: "Shop Clicks", group: "clicks", default: true },
  { key: "link_clicks", label: "Link Clicks", group: "clicks", default: true },
  { key: "cpc", label: "CPC (Cost/Link Click)", group: "clicks", default: true },
  { key: "total_clicks", label: "Total Clicks (All)", group: "clicks", default: true },
  { key: "ctr_all", label: "CTR All (%)", group: "clicks", default: true },
  { key: "cpc_all", label: "CPC All", group: "clicks", default: true },
  { key: "landing_page_views", label: "Landing Page Views", group: "funnel", default: true },
  { key: "cost_per_landing_page", label: "Cost / Landing Page", group: "funnel", default: true },
];

const DEFAULT_VISIBLE_KEYS = ALL_COLUMN_KEYS.filter(c => c.default).map(c => c.key);

export const CampaignList: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  // Status Filter: "ACTIVE" by default as requested
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");

  // Date Filter: "today" by default as requested
  const [datePreset, setDatePreset] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Column Rearrange and Customization State
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("poshplex_meta_campaign_columns");
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_KEYS;
    } catch {
      return DEFAULT_VISIBLE_KEYS;
    }
  });
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Customer Data & Attribution Platform State
  const [attributionModel, setAttributionModel] = useState<string>("last_paid");
  const [attributionMap, setAttributionMap] = useState<Record<number, any>>({});
  const [attributionOverview, setAttributionOverview] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [rebuilding, setRebuilding] = useState<boolean>(false);

  const fetchAttributionSummary = async (modelToFetch = attributionModel) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE}/attribution/summary/`, {
        headers,
        params: { model: modelToFetch }
      });
      if (res.data) {
        setAttributionOverview(res.data.overview || null);
        const map: Record<number, any> = {};
        (res.data.campaigns || []).forEach((c: any) => {
          map[c.id] = c;
        });
        setAttributionMap(map);
      }
    } catch (err) {
      console.error("Failed to load attribution summary", err);
    }
  };

  const fetchReconciliation = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE}/attribution/reconciliation/`, { headers });
      setReconciliation(res.data || null);
    } catch (err) {
      console.error("Failed to load reconciliation", err);
    }
  };

  const handleRebuildSummaries = async () => {
    setRebuilding(true);
    message.loading({ content: "Rebuilding attribution metrics & net profit...", key: "rebuildAttr" });
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_BASE}/attribution/rebuild/`, {}, { headers });
      message.success({ content: "Attribution daily rollups refreshed successfully!", key: "rebuildAttr" });
      await fetchAttributionSummary();
      await fetchReconciliation();
    } catch (err: any) {
      message.error({ content: err?.response?.data?.message || "Failed to rebuild summaries (Super Admin required).", key: "rebuildAttr" });
    } finally {
      setRebuilding(false);
    }
  };

  const fetchAdAccounts = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_BASE}/ad-accounts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdAccounts(res.data || []);
    } catch (err) {
      console.error("Failed to load Meta ad accounts", err);
    }
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter && statusFilter !== "ALL") params.status = statusFilter;
      if (selectedAccountId) params.ad_account_id = selectedAccountId;

      if (datePreset === "custom" && customDateRange) {
        params.start_date = customDateRange[0].format("YYYY-MM-DD");
        params.end_date = customDateRange[1].format("YYYY-MM-DD");
      } else if (datePreset && datePreset !== "all") {
        params.date_preset = datePreset;
      }

      const res = await axios.get(`${API_BASE}/campaigns/`, { headers, params });
      setCampaigns(res.data || []);
    } catch (err: any) {
      message.error("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromMeta = async () => {
    if (adAccounts.length === 0) {
      message.warning("No connected Meta Ad Accounts found. Connect an ad account in Settings.");
      return;
    }
    setSyncing(true);
    message.loading({ content: "Syncing campaigns & analytics from Meta Ads Manager...", key: "syncMeta" });
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const accountsToSync = selectedAccountId 
        ? adAccounts.filter(a => a.id === selectedAccountId)
        : adAccounts.filter(a => a.is_active);

      let totalSynced = 0;
      for (const acc of accountsToSync) {
        try {
          const res = await axios.post(`${API_BASE}/ad-accounts/${acc.id}/sync/`, {}, { headers });
          totalSynced += res.data?.insights_synced || 0;
        } catch (accErr) {
          console.error(`Error syncing account ${acc.name}`, accErr);
        }
      }

      message.success({ content: `Successfully synced performance from Meta Marketing API!`, key: "syncMeta" });
      await fetchCampaigns();
    } catch (err: any) {
      message.error({ content: "Failed to complete Meta sync.", key: "syncMeta" });
    } finally {
      setSyncing(false);
    }
  };

  const handleStopAllAds = () => {
    Modal.confirm({
      title: "STOP ALL META ADS IMMEDIATELY?",
      icon: <StopOutlined style={{ color: "#ef4444" }} />,
      content: (
        <div>
          <p>This will send emergency pause commands to the Meta Marketing API for <strong>every active campaign</strong> across all connected ad accounts.</p>
          <p style={{ color: "#ef4444", fontWeight: 600 }}>Are you sure you want to pause all live ads?</p>
        </div>
      ),
      okText: "Yes, STOP ALL ADS",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const token = localStorage.getItem("poshplex_access_token");
          const headers = { Authorization: `Bearer ${token}` };
          const activeCampaigns = campaigns.filter(c => c.status === "ACTIVE");
          let pausedCount = 0;
          for (const c of activeCampaigns) {
            try {
              await axios.post(`${API_BASE}/campaigns/${c.id}/pause/`, {}, { headers });
              pausedCount++;
            } catch (err) {
              console.error(`Failed to pause campaign ${c.id}`, err);
            }
          }
          message.success(`Successfully paused ${pausedCount} active campaigns.`);
          fetchCampaigns();
        } catch (err) {
          message.error("Failed to execute emergency stop.");
        }
      }
    });
  };

  useEffect(() => {
    fetchAdAccounts();
    fetchAttributionSummary();
    fetchReconciliation();
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter, datePreset, customDateRange, selectedAccountId]);

  const fmtCurrency = (val: any, record?: any) => {
    const num = Number(val || 0);
    const curr = (record?.currency || "USD").toUpperCase();
    if (curr === "BDT") {
      return `৳${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtNumber = (val: any) => {
    const num = Number(val || 0);
    return num.toLocaleString();
  };

  // Re-ordering logic for columns
  const moveColumn = (index: number, direction: "up" | "down") => {
    const newKeys = [...visibleColumnKeys];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newKeys.length) return;
    const temp = newKeys[index];
    newKeys[index] = newKeys[targetIndex];
    newKeys[targetIndex] = temp;
    setVisibleColumnKeys(newKeys);
    localStorage.setItem("poshplex_meta_campaign_columns", JSON.stringify(newKeys));
  };

  const toggleColumnKey = (key: string) => {
    let next: string[];
    if (visibleColumnKeys.includes(key)) {
      next = visibleColumnKeys.filter(k => k !== key);
    } else {
      next = [...visibleColumnKeys, key];
    }
    setVisibleColumnKeys(next);
    localStorage.setItem("poshplex_meta_campaign_columns", JSON.stringify(next));
  };

  // Summary rollups for top KPI bar and bottom summary row
  const summary = useMemo(() => {
    const totalBudget = campaigns.reduce((acc, c) => acc + Number(c.budget_amount || 0), 0);
    const totalSpend = campaigns.reduce((acc, c) => acc + Number(c.total_spend || 0), 0);
    const totalResults = campaigns.reduce((acc, c) => acc + Number(c.results || 0), 0);
    const totalImpressions = campaigns.reduce((acc, c) => acc + Number(c.impressions || 0), 0);
    const totalReach = campaigns.reduce((acc, c) => acc + Number(c.reach || c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + Number(c.total_clicks || c.clicks || 0), 0);
    const totalLinkClicks = campaigns.reduce((acc, c) => acc + Number(c.link_clicks || 0), 0);
    const totalShopClicks = campaigns.reduce((acc, c) => acc + Number(c.shop_clicks || 0), 0);
    const totalLpv = campaigns.reduce((acc, c) => acc + Number(c.landing_page_views || 0), 0);
    const avgFrequency = totalReach > 0 ? (totalImpressions / totalReach) : 1.0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpr = totalResults > 0 ? totalSpend / totalResults : 0;

    return {
      count: campaigns.length,
      budget: totalBudget,
      spend: totalSpend,
      results: totalResults,
      impressions: totalImpressions,
      reach: totalReach,
      frequency: avgFrequency,
      clicks: totalClicks,
      linkClicks: totalLinkClicks,
      shopClicks: totalShopClicks,
      lpv: totalLpv,
      ctr: avgCtr,
      cpc: avgCpc,
      cpr: avgCpr,
    };
  }, [campaigns]);

  // Master Column Definition Map with compact styling
  const columnDefinitionMap: Record<string, any> = {
    status: {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 75,
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
              fontSize: 9,
              padding: "0 4px",
              lineHeight: "16px",
              fontWeight: 700,
              textTransform: "uppercase",
              borderRadius: 2,
              margin: 0
            }}
          >
            {status}
          </Tag>
        );
      },
    },

    budget_amount: {
      title: "Budget",
      dataIndex: "budget_amount",
      key: "budget_amount",
      align: "right",
      width: 80,
      render: (amount: number, record: any) => (
        <div style={{ textAlign: "right", lineHeight: 1.1 }}>
          <Text strong style={{ fontSize: 11, color: "#f8fafc" }}>
            {fmtCurrency(amount, record)}
          </Text>
          <div style={{ fontSize: 8.5, color: "#94a3b8" }}>
            /{record.budget_type === "DAILY" ? "d" : "lt"}
          </div>
        </div>
      ),
    },

    total_spend: {
      title: "Amount Spent",
      dataIndex: "total_spend",
      key: "total_spend",
      align: "right",
      width: 90,
      render: (spend: number, record: any) => (
        <Text style={{ fontSize: 11, fontWeight: 700, color: Number(spend) > 0 ? "#fca5a5" : "#94a3b8" }}>
          {fmtCurrency(spend, record)}
        </Text>
      ),
    },

    results: {
      title: "Results",
      dataIndex: "results",
      key: "results",
      align: "right",
      width: 75,
      render: (results: number) => {
        const val = Number(results || 0);
        return (
          <Text strong style={{ fontSize: 11, color: val > 0 ? "#34d399" : "#64748b" }}>
            {val > 0 ? val.toLocaleString() : "—"}
          </Text>
        );
      },
    },

    cost_per_result: {
      title: "Cost / Result",
      dataIndex: "cost_per_result",
      key: "cost_per_result",
      align: "right",
      width: 85,
      render: (cpr: number, record: any) => {
        const val = Number(cpr || 0);
        return (
          <Text style={{ fontSize: 10.5, color: val > 0 ? "#f8fafc" : "#64748b" }}>
            {val > 0 ? fmtCurrency(val, record) : "—"}
          </Text>
        );
      },
    },

    delivered_rate: {
      title: "Delivered",
      key: "delivered_rate",
      align: "right",
      width: 85,
      render: (_: any, record: any) => {
        const attr = attributionMap[record.id];
        const deliv = attr ? attr.delivered_orders : 0;
        const rate = attr ? attr.delivery_success_rate : 0;
        const rateColor = rate >= 80 ? "#10b981" : rate >= 60 ? "#f59e0b" : rate > 0 ? "#ef4444" : "#64748b";
        return (
          <div style={{ textAlign: "right", lineHeight: 1.1 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#f8fafc" }}>{deliv}</span>
            {deliv > 0 && (
              <span style={{ marginLeft: 3, fontSize: 8.5, color: rateColor }}>
                ({rate}%)
              </span>
            )}
          </div>
        );
      }
    },

    net_ad_profit: {
      title: "Net Profit",
      key: "net_ad_profit",
      align: "right",
      width: 95,
      render: (_: any, record: any) => {
        const attr = attributionMap[record.id];
        const net = attr ? Number(attr.net_ad_profit || 0) : 0;
        return (
          <span style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: net > 0 ? "#34d399" : net < 0 ? "#f87171" : "#64748b"
          }}>
            {net !== 0 ? `৳${Math.round(net).toLocaleString()}` : "—"}
          </span>
        );
      }
    },

    roas_delivered: {
      title: "ROAS",
      key: "roas_delivered",
      align: "right",
      width: 70,
      render: (_: any, record: any) => {
        const attr = attributionMap[record.id];
        const roas = attr ? Number(attr.roas || 0) : 0;
        const roasColor = roas >= 3.0 ? "#34d399" : roas >= 1.8 ? "#38bdf8" : roas > 0 ? "#f87171" : "#64748b";
        return (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: roasColor }}>
            {roas > 0 ? `${roas.toFixed(2)}x` : "—"}
          </span>
        );
      }
    },

    impressions: {
      title: "Impr.",
      dataIndex: "impressions",
      key: "impressions",
      align: "right",
      width: 75,
      render: (val: number) => <span style={{ fontSize: 10.5, color: "#e2e8f0" }}>{fmtNumber(val)}</span>,
    },

    reach: {
      title: "Reach",
      dataIndex: "reach",
      key: "reach",
      align: "right",
      width: 75,
      render: (reach: number, record: any) => <span style={{ fontSize: 10.5, color: "#e2e8f0" }}>{fmtNumber(reach || record.impressions)}</span>,
    },

    frequency: {
      title: "Freq.",
      dataIndex: "frequency",
      key: "frequency",
      align: "right",
      width: 65,
      render: (freq: number) => <span style={{ fontSize: 10.5, color: "#cbd5e1" }}>{Number(freq || 1.0).toFixed(2)}</span>,
    },

    cpm: {
      title: "CPM",
      dataIndex: "cpm",
      key: "cpm",
      align: "right",
      width: 75,
      render: (cpm: number, record: any) => <span style={{ fontSize: 10.5, color: cpm ? "#cbd5e1" : "#64748b" }}>{cpm ? fmtCurrency(cpm, record) : "—"}</span>,
    },

    shop_clicks: {
      title: "Shop Clicks",
      dataIndex: "shop_clicks",
      key: "shop_clicks",
      align: "right",
      width: 75,
      render: (clicks: number) => <span style={{ fontSize: 10.5, color: clicks ? "#38bdf8" : "#64748b" }}>{fmtNumber(clicks)}</span>,
    },

    link_clicks: {
      title: "Link Clicks",
      dataIndex: "link_clicks",
      key: "link_clicks",
      align: "right",
      width: 75,
      render: (clicks: number) => <span style={{ fontSize: 10.5, color: "#e2e8f0" }}>{fmtNumber(clicks)}</span>,
    },

    cpc: {
      title: "CPC",
      dataIndex: "cpc",
      key: "cpc",
      align: "right",
      width: 70,
      render: (cpc: number, record: any) => <span style={{ fontSize: 10.5, color: cpc ? "#cbd5e1" : "#64748b" }}>{cpc ? fmtCurrency(cpc, record) : "—"}</span>,
    },

    total_clicks: {
      title: "Clicks",
      dataIndex: "total_clicks",
      key: "total_clicks",
      align: "right",
      width: 75,
      render: (clicks: number, record: any) => <span style={{ fontSize: 10.5, color: "#e2e8f0" }}>{fmtNumber(clicks || record.clicks)}</span>,
    },

    ctr_all: {
      title: "CTR %",
      dataIndex: "ctr_all",
      key: "ctr_all",
      align: "right",
      width: 65,
      render: (ctr: number) => <span style={{ fontSize: 10.5, color: ctr ? "#f8fafc" : "#64748b" }}>{ctr ? `${Number(ctr).toFixed(2)}%` : "0%"}</span>,
    },

    cpc_all: {
      title: "CPC All",
      dataIndex: "cpc_all",
      key: "cpc_all",
      align: "right",
      width: 70,
      render: (cpcAll: number, record: any) => <span style={{ fontSize: 10.5, color: cpcAll ? "#cbd5e1" : "#64748b" }}>{cpcAll ? fmtCurrency(cpcAll, record) : "—"}</span>,
    },

    landing_page_views: {
      title: "LP Views",
      dataIndex: "landing_page_views",
      key: "landing_page_views",
      align: "right",
      width: 75,
      render: (lpv: number) => <span style={{ fontSize: 10.5, color: lpv ? "#a78bfa" : "#64748b" }}>{fmtNumber(lpv)}</span>,
    },

    cost_per_landing_page: {
      title: "Cost/LPV",
      dataIndex: "cost_per_landing_page",
      key: "cost_per_landing_page",
      align: "right",
      width: 75,
      render: (cost: number, record: any) => <span style={{ fontSize: 10.5, color: cost ? "#cbd5e1" : "#64748b" }}>{cost ? fmtCurrency(cost, record) : "—"}</span>,
    },
  };

  // Fixed Left Column: Campaign Name
  const fixedCampaignNameColumn = {
    title: "Campaign name",
    dataIndex: "name",
    key: "name",
    fixed: "left" as const,
    width: 220,
    render: (name: string, record: any) => (
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", maxWidth: 210, minWidth: 0 }}>
        <Avatar
          shape="square"
          size={26}
          src={record.linked_product_image}
          style={{ backgroundColor: "#27272a", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, fontSize: 10 }}
        >
          {name ? name.charAt(0) : "C"}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <Tooltip title={name} placement="topLeft">
            <span
              style={{
                color: "#f8fafc",
                fontSize: 11,
                fontWeight: 700,
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
              fontSize: 8.5,
              color: "#94a3b8",
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {record.linked_product_name ? record.linked_product_name : "Generic"} · {record.objective}
          </div>
        </div>
      </div>
    ),
  };

  // Fixed Right Column: Actions
  const fixedActionsColumn = {
    title: "Actions",
    key: "actions",
    fixed: "right" as const,
    align: "center" as const,
    width: 100,
    render: (_: any, record: any) => {
      const isDraft = record.status === "DRAFT" || record.status === "ERROR";
      const isActive = record.status === "ACTIVE";

      return (
        <Space size={3}>
          {isDraft ? (
            <Tooltip title="Deploy campaign to Meta">
              <Button
                type="primary"
                size="small"
                icon={<CloudUploadOutlined style={{ fontSize: 10 }} />}
                style={{ fontSize: 10, padding: "0 6px", height: 22, backgroundColor: "#8b5cf6" }}
                onClick={() => navigate(`/marketing/campaigns/${record.id}`)}
              />
            </Tooltip>
          ) : isActive ? (
            <Tooltip title="Pause Live Campaign">
              <Button
                danger
                size="small"
                icon={<PauseCircleOutlined style={{ fontSize: 10 }} />}
                style={{ fontSize: 10, padding: "0 6px", height: 22 }}
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("poshplex_access_token");
                    await axios.post(`${API_BASE}/campaigns/${record.id}/pause/`, {}, { headers: { Authorization: `Bearer ${token}` } });
                    message.success("Campaign paused on Meta!");
                    fetchCampaigns();
                  } catch {
                    message.error("Failed to pause campaign");
                  }
                }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Resume Campaign">
              <Button
                size="small"
                icon={<PlayCircleOutlined style={{ fontSize: 10, color: "#10b981" }} />}
                style={{ fontSize: 10, padding: "0 6px", height: 22 }}
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("poshplex_access_token");
                    await axios.post(`${API_BASE}/campaigns/${record.id}/resume/`, {}, { headers: { Authorization: `Bearer ${token}` } });
                    message.success("Campaign resumed on Meta!");
                    fetchCampaigns();
                  } catch {
                    message.error("Failed to resume campaign");
                  }
                }}
              />
            </Tooltip>
          )}

          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined style={{ fontSize: 10 }} />}
              style={{ fontSize: 10, padding: "0 6px", height: 22 }}
              onClick={() => navigate(`/marketing/campaigns/${record.id}`)}
            />
          </Tooltip>
        </Space>
      );
    },
  };

  // Compile Active Columns based on User Rearrange Order
  const activeColumns = useMemo(() => {
    const dynamicCols: any[] = [];
    visibleColumnKeys.forEach((key) => {
      if (columnDefinitionMap[key]) {
        dynamicCols.push(columnDefinitionMap[key]);
      }
    });
    return [fixedCampaignNameColumn, ...dynamicCols, fixedActionsColumn];
  }, [visibleColumnKeys, attributionMap]);

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: "#ffffff", fontWeight: 700 }}>Meta Campaigns & Attribution Platform</Title>
          <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
            Customer journey attribution, delivery outcomes & true contribution profit (M1–M22)
          </Text>
        </div>
        <Space wrap size={6}>
          {/* Attribution Model Switcher */}
          <Select
            size="small"
            value={attributionModel}
            onChange={(val) => {
              setAttributionModel(val);
              fetchAttributionSummary(val);
            }}
            style={{ width: 150, fontSize: 11 }}
            options={[
              { label: "Last Paid Touch", value: "last_paid" },
              { label: "Linear Multi-Touch", value: "linear" },
              { label: "Time Decay", value: "time_decay" },
              { label: "First Touch", value: "first_touch" },
              { label: "Last Non-Direct", value: "last_non_direct" },
            ]}
          />

          {/* Reconciliation Audit Badge */}
          {reconciliation && (
            <Tooltip title={`Storefront Orders: ${reconciliation.storefront?.orders_count || 0} | Tracked Touchpoints: ${reconciliation.attribution_tracked?.orders_count || 0} | Meta CAPI Received: ${reconciliation.meta_capi?.received_purchases || 0} | Raw Intake: ${reconciliation.raw_events?.total_intake || 0}`}>
              <Tag
                icon={reconciliation.status === "HEALTHY" ? <CheckCircleOutlined /> : <WarningOutlined />}
                color={reconciliation.status === "HEALTHY" ? "success" : "warning"}
                style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, cursor: "pointer", margin: 0 }}
              >
                3-Way Audit: {reconciliation.variance_percentage}% var ({reconciliation.status})
              </Tag>
            </Tooltip>
          )}

          <Button
            size="small"
            icon={<ThunderboltOutlined style={{ fontSize: 10 }} />}
            loading={rebuilding}
            onClick={handleRebuildSummaries}
            style={{ fontSize: 11, backgroundColor: "#181824", borderColor: "rgba(255,255,255,0.12)", color: "#cbd5e1" }}
          >
            Rebuild Profit
          </Button>

          <Button
            type="primary"
            size="small"
            icon={<ReloadOutlined style={{ fontSize: 10 }} />}
            loading={syncing}
            onClick={handleSyncFromMeta}
            style={{ backgroundColor: "#8b5cf6", borderColor: "#8b5cf6", fontSize: 11 }}
          >
            Sync from Meta
          </Button>
          <Button size="small" icon={<ReloadOutlined style={{ fontSize: 10 }} />} onClick={fetchCampaigns}>
            Refresh
          </Button>
          <Button
            danger
            type="primary"
            size="small"
            icon={<StopOutlined style={{ fontSize: 10 }} />}
            onClick={handleStopAllAds}
            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", fontSize: 11 }}
          >
            STOP ALL ADS
          </Button>
        </Space>
      </div>

      {/* Quick KPI ribbon */}
      <Card
        size="small"
        style={{
          backgroundColor: "#121218",
          borderColor: "rgba(255,255,255,0.08)",
          borderRadius: 6,
          marginBottom: 10
        }}
        bodyStyle={{ padding: "8px 12px" }}
      >
        <Row gutter={[12, 6]} align="middle">
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Active Campaigns</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>{summary.count}</div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total Spent (Ad Spend)</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f87171" }}>
              ${summary.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400, marginLeft: 4 }}>
                (৳{(summary.spend * 122).toLocaleString(undefined, { maximumFractionDigits: 0 })})
              </span>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Delivered Orders</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#34d399" }}>
              {attributionOverview?.total_delivered_orders !== undefined ? attributionOverview.total_delivered_orders : summary.results}
              <Tag style={{ marginLeft: 4, fontSize: 9, padding: "0 3px", border: "none", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                {attributionOverview?.delivery_success_rate !== undefined ? `${attributionOverview.delivery_success_rate}% success` : "Meta tracked"}
              </Tag>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Delivered Revenue</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8" }}>
              ৳{(attributionOverview?.total_delivered_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>True Net Ad Profit</div>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              color: (attributionOverview?.total_net_ad_profit || 0) >= 0 ? "#10b981" : "#f87171"
            }}>
              ৳{(attributionOverview?.total_net_ad_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Delivered ROAS</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#a78bfa" }}>
              {attributionOverview?.roas_delivered ? `${attributionOverview.roas_delivered}x` : `${summary.ctr.toFixed(2)}% CTR`}
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
        bodyStyle={{ padding: "8px" }}
      >
        {/* Filters bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Select
            size="small"
            placeholder="All Meta Ad Accounts"
            allowClear
            value={selectedAccountId}
            onChange={(v) => setSelectedAccountId(v)}
            style={{ minWidth: 170, fontSize: 11 }}
            options={adAccounts.map(acc => ({
              label: `${acc.name} (${acc.currency || 'USD'})`,
              value: acc.id
            }))}
          />

          <Input
            size="small"
            placeholder="Search campaigns..."
            prefix={<SearchOutlined style={{ color: "#9ca3af", fontSize: 11 }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchCampaigns}
            style={{ width: 170, fontSize: 11 }}
          />

          {/* 1. Status Filter: Active, Inactive/Paused, All (Default: Active) */}
          <Select
            size="small"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 120, fontSize: 11 }}
            options={[
              { label: "Active Ads", value: "ACTIVE" },
              { label: "Inactive / Paused", value: "PAUSED" },
              { label: "All Statuses", value: "ALL" },
            ]}
          />

          {/* 2. Date Filter: Today, Yesterday, Today & Yesterday, Last 30 Days, This Month, Last Month, Date Range */}
          <Select
            size="small"
            value={datePreset}
            onChange={(v) => {
              setDatePreset(v);
              if (v !== "custom") setCustomDateRange(null);
            }}
            style={{ width: 150, fontSize: 11 }}
            options={[
              { label: "Today (Default)", value: "today" },
              { label: "Yesterday", value: "yesterday" },
              { label: "Today & Yesterday", value: "today_yesterday" },
              { label: "Last 30 Days", value: "last_30d" },
              { label: "This Month", value: "this_month" },
              { label: "Last Month", value: "last_month" },
              { label: "Custom Date Range", value: "custom" },
              { label: "Lifetime (All Time)", value: "all" },
            ]}
          />

          {datePreset === "custom" && (
            <RangePicker
              size="small"
              value={customDateRange}
              onChange={(dates: any) => setCustomDateRange(dates)}
              style={{ fontSize: 11, width: 210 }}
            />
          )}

          {/* Rearrange Columns Button */}
          <Button
            size="small"
            icon={<SettingOutlined style={{ color: "#8b5cf6" }} />}
            onClick={() => setIsColumnModalOpen(true)}
            style={{ fontSize: 11, borderColor: "rgba(139, 92, 246, 0.4)" }}
          >
            Rearrange Columns ({visibleColumnKeys.length})
          </Button>

          <div style={{ marginLeft: "auto", fontSize: 10.5, color: "#64748b" }}>
            Showing {campaigns.length} ads · Sorted: Active & Top Performers First
          </div>
        </div>

        {/* Dense Table with Mouse Scroll & Freezed Essential Columns */}
        <Table
          className="meta-dense-campaigns-table"
          size="small"
          dataSource={campaigns}
          columns={activeColumns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1800, y: 600 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["15", "20", "35", "50", "100"],
            size: "small"
          }}
          summary={() => (
            <Table.Summary fixed="bottom">
              <Table.Summary.Row style={{ backgroundColor: "#0c0c10", fontWeight: 800 }}>
                <Table.Summary.Cell index={0} fixed="left">
                  <div style={{ color: "#ffffff", fontSize: 11, textTransform: "uppercase" }}>
                    TOTAL ({campaigns.length} Ads)
                  </div>
                </Table.Summary.Cell>

                {visibleColumnKeys.map((colKey, idx) => {
                  let content = "—";
                  if (colKey === "budget_amount") {
                    content = `$${summary.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  } else if (colKey === "total_spend") {
                    content = `$${summary.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  } else if (colKey === "results") {
                    content = summary.results.toLocaleString();
                  } else if (colKey === "cost_per_result") {
                    content = summary.cpr > 0 ? `$${summary.cpr.toFixed(2)}` : "—";
                  } else if (colKey === "delivered_rate") {
                    content = attributionOverview?.total_delivered_orders !== undefined ? `${attributionOverview.total_delivered_orders}` : `${summary.results}`;
                  } else if (colKey === "net_ad_profit") {
                    const net = attributionOverview?.total_net_ad_profit || 0;
                    content = `৳${Math.round(net).toLocaleString()}`;
                  } else if (colKey === "roas_delivered") {
                    content = attributionOverview?.roas_delivered ? `${attributionOverview.roas_delivered}x` : "—";
                  } else if (colKey === "impressions") {
                    content = summary.impressions.toLocaleString();
                  } else if (colKey === "reach") {
                    content = summary.reach.toLocaleString();
                  } else if (colKey === "frequency") {
                    content = summary.frequency.toFixed(2);
                  } else if (colKey === "cpm") {
                    content = summary.impressions > 0 ? `$${((summary.spend / summary.impressions) * 1000).toFixed(2)}` : "—";
                  } else if (colKey === "shop_clicks") {
                    content = summary.shopClicks.toLocaleString();
                  } else if (colKey === "link_clicks") {
                    content = summary.linkClicks.toLocaleString();
                  } else if (colKey === "cpc") {
                    content = summary.linkClicks > 0 ? `$${(summary.spend / summary.linkClicks).toFixed(2)}` : "—";
                  } else if (colKey === "total_clicks") {
                    content = summary.clicks.toLocaleString();
                  } else if (colKey === "ctr_all") {
                    content = `${summary.ctr.toFixed(2)}%`;
                  } else if (colKey === "cpc_all") {
                    content = `$${summary.cpc.toFixed(2)}`;
                  } else if (colKey === "landing_page_views") {
                    content = summary.lpv.toLocaleString();
                  } else if (colKey === "cost_per_landing_page") {
                    content = summary.lpv > 0 ? `$${(summary.spend / summary.lpv).toFixed(2)}` : "—";
                  }

                  return (
                    <Table.Summary.Cell index={idx + 1} key={colKey} align="right">
                      <Text style={{ fontSize: 11, color: colKey === "total_spend" ? "#f87171" : colKey === "results" ? "#34d399" : "#ffffff", fontWeight: 800 }}>
                        {content}
                      </Text>
                    </Table.Summary.Cell>
                  );
                })}

                <Table.Summary.Cell index={visibleColumnKeys.length + 1} fixed="right" align="center">
                  <span style={{ fontSize: 10, color: "#64748b" }}>—</span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* Rearrange Columns & Visibility Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: "#8b5cf6" }} />
            <span>Customize & Rearrange Columns</span>
          </Space>
        }
        open={isColumnModalOpen}
        onCancel={() => setIsColumnModalOpen(false)}
        footer={[
          <Button
            key="reset"
            onClick={() => {
              setVisibleColumnKeys(DEFAULT_VISIBLE_KEYS);
              localStorage.setItem("poshplex_meta_campaign_columns", JSON.stringify(DEFAULT_VISIBLE_KEYS));
              message.info("Reset to default columns.");
            }}
          >
            Reset Default
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={() => {
              setIsColumnModalOpen(false);
              message.success("Columns saved!");
            }}
            style={{ backgroundColor: "#8b5cf6" }}
          >
            Done
          </Button>
        ]}
        width={580}
      >
        <Paragraph style={{ color: "#9ca3af", fontSize: 12 }}>
          Select which metrics to display on your table, and use the <strong>Up / Down</strong> buttons to reorder them based on your preference.
        </Paragraph>

        <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 8 }}>
          {visibleColumnKeys.map((key, index) => {
            const col = ALL_COLUMN_KEYS.find(c => c.key === key);
            if (!col) return null;
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 12px",
                  marginBottom: 6,
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6
                }}
              >
                <Space>
                  <Checkbox
                    checked={true}
                    onChange={() => toggleColumnKey(key)}
                  />
                  <Text style={{ color: "#f8fafc", fontSize: 12, fontWeight: 600 }}>
                    {col.label}
                  </Text>
                  {col.fixed && <Tag color="blue" style={{ fontSize: 9 }}>Fixed Metric</Tag>}
                </Space>

                <Space size={4}>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => moveColumn(index, "up")}
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === visibleColumnKeys.length - 1}
                    onClick={() => moveColumn(index, "down")}
                  />
                </Space>
              </div>
            );
          })}

          <Divider orientation="left" style={{ borderColor: "rgba(255,255,255,0.1)", fontSize: 11, color: "#9ca3af" }}>
            Add Inactive / Hidden Columns
          </Divider>

          {ALL_COLUMN_KEYS.filter(c => !visibleColumnKeys.includes(c.key)).map(col => (
            <div
              key={col.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 12px",
                marginBottom: 6,
                backgroundColor: "rgba(255,255,255,0.01)",
                border: "1px dashed rgba(255,255,255,0.08)",
                borderRadius: 6
              }}
            >
              <Space>
                <Checkbox
                  checked={false}
                  onChange={() => toggleColumnKey(col.key)}
                />
                <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                  {col.label}
                </Text>
              </Space>
              <Button
                size="small"
                type="dashed"
                onClick={() => toggleColumnKey(col.key)}
                style={{ fontSize: 11 }}
              >
                + Add
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
