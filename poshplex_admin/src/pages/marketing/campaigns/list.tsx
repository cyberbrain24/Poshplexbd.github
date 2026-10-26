import React, { useState, useEffect } from "react";
import {
  Table, Tag, Button, Space, Card, Input, Select, Typography,
  Modal, message, Dropdown, Menu, Tooltip, Avatar
} from "antd";
import {
  PlusOutlined, SearchOutlined, PlayCircleOutlined, PauseCircleOutlined,
  CloudUploadOutlined, RiseOutlined, EyeOutlined, MoreOutlined,
  ReloadOutlined, StopOutlined
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

  const columns = [
    {
      title: "Campaign & Linked Product",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: any) => (
        <Space align="start">
          <Avatar
            shape="square"
            size={44}
            src={record.linked_product_image}
            style={{ backgroundColor: "#27272a", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {name.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ color: "#ffffff", fontSize: 13, cursor: "pointer" }} onClick={() => navigate(`/marketing/campaigns/${record.id}`)}>
              {name}
            </Text>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {record.linked_product_name ? `Product: ${record.linked_product_name}` : "Generic Storefront"} · Objective: {record.objective}
            </div>
            {record.meta_campaign_id && (
              <div style={{ fontSize: 10, color: "#8b5cf6" }}>Meta ID: {record.meta_campaign_id}</div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        let color = "default";
        if (status === "ACTIVE") color = "success";
        else if (status === "DEPLOYING") color = "processing";
        else if (status === "PAUSED") color = "warning";
        else if (status === "ERROR") color = "error";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Budget",
      dataIndex: "budget_amount",
      key: "budget_amount",
      render: (amount: number, record: any) => (
        <div>
          <Text strong>${Number(amount).toLocaleString()}</Text>
          <div style={{ fontSize: 10, color: "#9ca3af" }}>{record.budget_type}</div>
        </div>
      ),
    },
    {
      title: "Spend",
      dataIndex: "total_spend",
      key: "total_spend",
      render: (spend: number) => <Text style={{ color: "#f87171" }}>${Number(spend).toLocaleString()}</Text>,
    },
    {
      title: "Revenue",
      dataIndex: "total_revenue",
      key: "total_revenue",
      render: (rev: number) => <Text strong style={{ color: "#10b981" }}>${Number(rev).toLocaleString()}</Text>,
    },
    {
      title: "ROAS",
      dataIndex: "roas",
      key: "roas",
      render: (roas: number) => {
        const color = roas >= 2.5 ? "green" : roas >= 1.5 ? "orange" : "red";
        return <Tag color={color} style={{ fontWeight: 700 }}>{roas}x</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_: any, record: any) => {
        const isDraft = record.status === "DRAFT" || record.status === "ERROR";
        const isActive = record.status === "ACTIVE";

        return (
          <Space>
            {isDraft ? (
              <Button
                type="primary"
                size="small"
                icon={<CloudUploadOutlined />}
                onClick={() => handleDeploy(record.id)}
                style={{ backgroundColor: "#8b5cf6" }}
              >
                Deploy
              </Button>
            ) : isActive ? (
              <Tooltip title="Pause delivery on Meta">
                <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handlePause(record.id)} />
              </Tooltip>
            ) : (
              <Tooltip title="Resume delivery on Meta">
                <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleResume(record.id)} />
              </Tooltip>
            )}

            {isActive && (
              <Tooltip title="Scale Budget +20%">
                <Button size="small" icon={<RiseOutlined />} onClick={() => handleScale(record.id)} />
              </Tooltip>
            )}

            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/marketing/campaigns/${record.id}`)} />
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: "#ffffff" }}>Meta Campaigns</Title>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>Deploy, automate, and optimize ads on Facebook & Instagram</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCampaigns}>Refresh</Button>
          <Button
            danger
            type="primary"
            icon={<StopOutlined />}
            onClick={handleStopAllAds}
            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
          >
            STOP ALL ADS
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/marketing/campaigns/create")}
            style={{ backgroundColor: "#8b5cf6" }}
          >
            Create Campaign
          </Button>
        </Space>
      </div>

      <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
        {/* Filters bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Input
            placeholder="Search campaigns by name..."
            prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchCampaigns}
            style={{ width: 280 }}
          />
          <Select
            placeholder="Filter by Status"
            allowClear
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 180 }}
            options={[
              { label: "Active", value: "ACTIVE" },
              { label: "Draft", value: "DRAFT" },
              { label: "Paused", value: "PAUSED" },
              { label: "Deploying", value: "DEPLOYING" },
              { label: "Error", value: "ERROR" },
            ]}
          />
          <Button onClick={fetchCampaigns}>Filter</Button>
        </div>

        <Table
          dataSource={campaigns}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};
