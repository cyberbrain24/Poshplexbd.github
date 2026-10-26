import React, { useState, useEffect, useRef } from "react";
import {
  Row, Col, Card, Typography, Space, Button, Table, Tag, Input,
  Modal, Form, Select, Slider, Switch, Alert, message, Tooltip,
  Divider, Spin, Tabs, Statistic, Progress, Image, Badge,
  InputNumber, Popconfirm
} from "antd";
import {
  SkinOutlined, ApiOutlined, BarChartOutlined, HistoryOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  ThunderboltOutlined, SettingOutlined, UserOutlined, EyeOutlined,
  DollarOutlined, RocketOutlined, SafetyCertificateOutlined,
  CloudUploadOutlined, ExperimentOutlined, EditOutlined, DeleteOutlined,
  PlusOutlined, PictureOutlined, IdcardOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/fit-check`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("poshplex_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getFullImageUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${SERVER_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
};

interface BodyStructureItem {
  id: number;
  code: string;
  name: string;
  description: string;
  dummy_image_url: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const FitCheckPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("analytics");
  const [loading, setLoading] = useState(false);

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);

  // Config State
  const [config, setConfig] = useState<any>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm] = Form.useForm();

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [selectedResultImage, setSelectedResultImage] = useState<string | null>(null);

  // Test Studio State
  const [testForm] = Form.useForm();
  const [testingAi, setTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Body Structures & Character Dummy Models State
  const [structures, setStructures] = useState<BodyStructureItem[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<BodyStructureItem | null>(null);
  const [structureForm] = Form.useForm();
  const [structureImagePreview, setStructureImagePreview] = useState<string>("");
  const [structureImageBase64, setStructureImageBase64] = useState<string>("");
  const [savingStructure, setSavingStructure] = useState(false);
  const dummyFileInputRef = useRef<HTMLInputElement>(null);

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/analytics`, { headers: getAuthHeaders() });
      setAnalytics(res.data);
    } catch (err: any) {
      console.error("Failed to load fit check analytics:", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/config`, { headers: getAuthHeaders() });
      setConfig(res.data);
      configForm.setFieldsValue({
        provider: res.data.provider,
        api_key: res.data.api_key,
        api_url: res.data.api_url,
        model_id: res.data.model_id,
        mock_mode: res.data.mock_mode,
        daily_budget_cap_usd: res.data.daily_budget_cap_usd,
        guest_trial_limit: res.data.guest_trial_limit,
        user_daily_limit: res.data.user_daily_limit,
        is_active: res.data.is_active,
      });
    } catch (err: any) {
      console.error("Failed to load fit check config:", err);
    }
  };

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/logs?page=${page}&page_size=15`, { headers: getAuthHeaders() });
      setLogs(res.data.items || []);
      setLogsTotal(res.data.total || 0);
      setLogsPage(page);
    } catch (err: any) {
      console.error("Failed to load fit check logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStructures = async () => {
    setLoadingStructures(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/body-structures`, { headers: getAuthHeaders() });
      setStructures(res.data || []);
    } catch (err: any) {
      console.error("Failed to load body structures:", err);
    } finally {
      setLoadingStructures(false);
    }
  };

  const handleOpenEditStructure = (item: BodyStructureItem) => {
    setEditingStructure(item);
    setStructureImagePreview(item.dummy_image_url ? getFullImageUrl(item.dummy_image_url) : "");
    setStructureImageBase64("");
    structureForm.setFieldsValue({
      code: item.code,
      name: item.name,
      description: item.description,
      dummy_image_url: item.dummy_image_url,
      display_order: item.display_order,
      is_active: item.is_active,
    });
    setStructureModalOpen(true);
  };

  const handleOpenCreateStructure = () => {
    setEditingStructure(null);
    setStructureImagePreview("");
    setStructureImageBase64("");
    structureForm.resetFields();
    structureForm.setFieldsValue({
      display_order: (structures.length || 0) + 1,
      is_active: true,
    });
    setStructureModalOpen(true);
  };

  const handleDummyImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      message.error("Please upload a valid image file (JPG, PNG, or WebP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setStructureImageBase64(b64);
      setStructureImagePreview(b64);
      message.success("Image selected. Ready to save.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStructure = async (values: any) => {
    setSavingStructure(true);
    try {
      const payload = {
        ...values,
        dummy_image_base64: structureImageBase64 || undefined,
      };

      if (editingStructure) {
        await axios.put(`${API_BASE}/admin/body-structures/${editingStructure.id}`, payload, {
          headers: getAuthHeaders(),
        });
        message.success(`Body structure "${values.name}" updated successfully!`);
      } else {
        await axios.post(`${API_BASE}/admin/body-structures`, payload, {
          headers: getAuthHeaders(),
        });
        message.success(`New body structure "${values.name}" created!`);
      }
      setStructureModalOpen(false);
      fetchStructures();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to save body structure.");
    } finally {
      setSavingStructure(false);
    }
  };

  const handleDeleteStructure = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/admin/body-structures/${id}`, { headers: getAuthHeaders() });
      message.success("Body structure removed.");
      fetchStructures();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to delete structure.");
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchConfig();
    fetchLogs(1);
    fetchStructures();
  }, []);

  const handleSaveConfig = async (values: any) => {
    setSavingConfig(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/config`, values, { headers: getAuthHeaders() });
      message.success("Virtual Fit Check configuration updated successfully");
      setConfig(res.data);
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to update configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleMasterFitCheck = async (checked: boolean) => {
    setSavingConfig(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/config`, { is_active: checked }, { headers: getAuthHeaders() });
      setConfig(res.data);
      configForm.setFieldValue("is_active", checked);
      message.success(checked ? "Storefront AI Fit Check is now ACTIVE." : "Storefront AI Fit Check is now INACTIVE / DISABLED.");
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to update AI Fit Check status.");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunAdminTest = async (values: any) => {
    setTestingAi(true);
    setTestResult(null);
    try {
      const payload = {
        face_image_url: values.face_image_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80",
        product_image_url: values.product_image_url || "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
        height_cm: values.height_cm || 178,
        body_structure: values.body_structure || "athletic",
        gender_preference: values.gender_preference || "unisex",
        product_name: values.product_name || "PoshPlex Tokyo Cyber Oversized Tee",
        guest_fingerprint: "admin_test_studio_" + Date.now(),
      };

      const res = await axios.post(`${API_BASE}/generate`, payload, { headers: getAuthHeaders() });
      const jobId = res.data.job_id;

      if (res.data.status === "completed") {
        setTestResult(res.data);
        message.success("Test Fit Check generated successfully!");
      } else {
        // Poll for completion
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const pollRes = await axios.get(`${API_BASE}/job/${jobId}`, { headers: getAuthHeaders() });
            if (pollRes.data.status === "completed") {
              clearInterval(interval);
              setTestResult(pollRes.data);
              setTestingAi(false);
              message.success("AI Fit Check completed!");
              fetchAnalytics();
              fetchLogs(1);
            } else if (pollRes.data.status === "failed") {
              clearInterval(interval);
              setTestingAi(false);
              message.error(`Generation failed: ${pollRes.data.error || "Unknown error"}`);
            } else if (attempts > 20) {
              clearInterval(interval);
              setTestingAi(false);
              message.warning("Job is still processing in background queue.");
            }
          } catch (e) {
            clearInterval(interval);
            setTestingAi(false);
          }
        }, 1500);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to trigger generation");
      setTestingAi(false);
    }
  };

  const logColumns = [
    {
      title: "Time",
      dataIndex: "created_at",
      key: "created_at",
      render: (t: string) => <Text style={{ color: "#888", fontSize: "12px" }}>{new Date(t).toLocaleString()}</Text>,
    },
    {
      title: "Customer / Target",
      key: "user",
      render: (_: any, r: any) => (
        <Space direction="vertical" size={1}>
          {r.is_guest ? (
            <Tag color="cyan">Guest Trial ({r.guest_fingerprint ? r.guest_fingerprint.slice(0, 10) + "..." : "Anonymous"})</Tag>
          ) : (
            <Tag color="purple">@{r.user}</Tag>
          )}
          <Text style={{ fontSize: "11px", color: "#aaa" }}>
            {r.body_metrics?.body_structure || "athletic"} • {r.body_metrics?.height_cm || 175}cm
          </Text>
        </Space>
      ),
    },
    {
      title: "Garment",
      dataIndex: "product_name",
      key: "product_name",
      render: (name: string, r: any) => (
        <Space direction="vertical" size={1}>
          <Text strong style={{ color: "#fff", fontSize: "13px" }}>{name}</Text>
          {r.product_image_url && (
            <Text style={{ fontSize: "11px", color: "#666" }} ellipsis={{ tooltip: r.product_image_url }}>
              {r.product_image_url.slice(0, 35)}...
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Provider & Latency",
      key: "provider",
      render: (_: any, r: any) => (
        <Space direction="vertical" size={1}>
          <Tag color={r.provider_used === "mock_sandbox" ? "blue" : "gold"}>
            {r.provider_used?.toUpperCase() || "SANDBOX"}
          </Tag>
          <Text style={{ fontSize: "11px", color: "#888" }}>
            ⏱ {r.latency_seconds || 0}s • ${r.estimated_cost_usd?.toFixed(4) || "0.0000"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => {
        const color = s === "completed" ? "green" : s === "failed" ? "red" : "orange";
        return <Tag color={color}>{s.toUpperCase()}</Tag>;
      },
    },
    {
      title: "Result",
      key: "result",
      render: (_: any, r: any) => (
        r.result_image_url ? (
          <Button
            size="small"
            type="primary"
            icon={<EyeOutlined />}
            style={{ backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }}
            onClick={() => setSelectedResultImage(r.result_image_url)}
          >
            Preview Fit
          </Button>
        ) : (
          <Text style={{ color: "#666", fontSize: "12px" }}>None</Text>
        )
      ),
    },
  ];

  const structureColumns = [
    {
      title: "Model Preview (White Background)",
      key: "dummy_image_url",
      width: 170,
      render: (_: any, r: BodyStructureItem) => {
        const imgUrl = getFullImageUrl(r.dummy_image_url);
        return (
          <div
            style={{
              width: "80px",
              height: "100px",
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              border: "1.5px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt={r.name}
                style={{ width: "80px", height: "100px", objectFit: "contain", backgroundColor: "#ffffff" }}
              />
            ) : (
              <div style={{ textAlign: "center", padding: "6px" }}>
                <SkinOutlined style={{ fontSize: "24px", color: "#a1a1aa" }} />
                <div style={{ fontSize: "9px", color: "#71717a", marginTop: "4px", fontWeight: 700 }}>
                  Default Vector
                </div>
              </div>
            )}
            <div
              style={{
                position: "absolute",
                bottom: 2,
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: imgUrl ? "#10b981" : "#8b5cf6",
                color: "#ffffff",
                fontSize: "8px",
                fontWeight: 800,
                padding: "1px 4px",
                borderRadius: "3px",
                whiteSpace: "nowrap",
                zIndex: 2,
              }}
            >
              {imgUrl ? "CUSTOM MODEL" : "VECTOR BASE"}
            </div>
          </div>
        );
      },
    },
    {
      title: "Structure Name & Code",
      key: "name",
      render: (_: any, r: BodyStructureItem) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: "#fff", fontSize: "14px" }}>
            {r.name}
          </Text>
          <Space>
            <Tag color="purple">code: {r.code}</Tag>
            <Tag color="blue">Order: #{r.display_order}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: "Customer Fit Descriptor & Info",
      dataIndex: "description",
      key: "description",
      render: (desc: string) => (
        <Text style={{ color: "#aaa", fontSize: "12px", maxWidth: "400px", display: "inline-block" }}>
          {desc || <span style={{ color: "#555", fontStyle: "italic" }}>No description provided</span>}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>
          {active ? "ACTIVE ON STOREFRONT" : "HIDDEN"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_: any, r: BodyStructureItem) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<EditOutlined />}
            style={{ backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }}
            onClick={() => handleOpenEditStructure(r)}
          >
            Edit & Model
          </Button>
          <Popconfirm
            title="Delete this body structure?"
            description="Customers will no longer see this model option on the storefront."
            onConfirm={() => handleDeleteStructure(r.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <Space align="center" style={{ marginBottom: "8px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "20px",
            }}
          >
            <SkinOutlined />
          </div>
          <div>
            <Title level={2} style={{ margin: 0, color: "#fff", fontWeight: 700 }}>
              AI Virtual Fit Check Studio
            </Title>
            <Text style={{ color: "#888", fontSize: "14px" }}>
              Virtual clothing try-on engine: customer face models, body structure metrics, 1-trial guest gatekeeper, and 10/day quotas.
            </Text>
          </div>
        </Space>
      </div>

      {/* Master Feature Toggle Control Banner */}
      <Card
        style={{
          background: config?.is_active 
            ? "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(236, 72, 153, 0.05) 100%)" 
            : "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(185, 28, 28, 0.03) 100%)",
          border: config?.is_active ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: 12,
          marginBottom: 24
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <Space align="center" size="middle">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: config?.is_active ? "linear-gradient(135deg, #8b5cf6, #ec4899)" : "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 20,
                boxShadow: config?.is_active ? "0 4px 14px rgba(139, 92, 246, 0.4)" : "0 4px 14px rgba(239, 68, 68, 0.35)",
                transition: "all 0.3s ease"
              }}
            >
              <ThunderboltOutlined />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>
                  Storefront AI Fit Check Feature
                </span>
                <Tag color={config?.is_active ? "purple" : "error"} style={{ fontWeight: 700 }}>
                  {config?.is_active ? "● ACTIVE ON STOREFRONT" : "○ INACTIVE / HIDDEN"}
                </Tag>
              </div>
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                {config?.is_active
                  ? "AI Fit Check button and popup studio are active on the mobile bottom menu & product detail pages."
                  : "AI Fit Check buttons and popup studio are completely disabled and hidden from storefront visitors."}
              </p>
            </div>
          </Space>

          <Space align="center" size="middle">
            <span style={{ fontSize: 13, fontWeight: 600, color: config?.is_active ? "#c084fc" : "#ef4444" }}>
              {config?.is_active ? "Turn Off AI Fit Check" : "Turn On AI Fit Check"}
            </span>
            <Switch
              checked={Boolean(config?.is_active)}
              loading={savingConfig}
              onChange={handleToggleMasterFitCheck}
              checkedChildren="ON"
              unCheckedChildren="OFF"
              style={{
                backgroundColor: config?.is_active ? "#8b5cf6" : "#4b5563",
                transform: "scale(1.2)"
              }}
            />
          </Space>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: "analytics",
            label: (
              <span>
                <BarChartOutlined /> Analytics & Volume
              </span>
            ),
            children: (
              <div>
                {/* Metric Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: "#111116", border: "1px solid #222" }}>
                      <Statistic
                        title={<Text style={{ color: "#aaa" }}>Total Generations</Text>}
                        value={analytics?.total_generations || 0}
                        valueStyle={{ color: "#fff", fontWeight: 700 }}
                        prefix={<ThunderboltOutlined style={{ color: "#8b5cf6" }} />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: "#111116", border: "1px solid #222" }}>
                      <Statistic
                        title={<Text style={{ color: "#aaa" }}>Success Rate</Text>}
                        value={analytics?.success_rate || 100}
                        precision={1}
                        suffix="%"
                        valueStyle={{ color: "#10b981", fontWeight: 700 }}
                        prefix={<CheckCircleOutlined style={{ color: "#10b981" }} />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: "#111116", border: "1px solid #222" }}>
                      <Statistic
                        title={<Text style={{ color: "#aaa" }}>External AI API Spend</Text>}
                        value={analytics?.total_spend_usd || 0}
                        precision={2}
                        prefix={<DollarOutlined style={{ color: "#f59e0b" }} />}
                        valueStyle={{ color: "#fff", fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: "#111116", border: "1px solid #222" }}>
                      <Statistic
                        title={<Text style={{ color: "#aaa" }}>Avg Generation Latency</Text>}
                        value={analytics?.avg_latency_seconds || 0}
                        precision={2}
                        suffix="s"
                        valueStyle={{ color: "#38bdf8", fontWeight: 700 }}
                        prefix={<RocketOutlined style={{ color: "#38bdf8" }} />}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Breakdown Row */}
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card
                      title={<span style={{ color: "#fff" }}>Body Structure Preference Distribution</span>}
                      style={{ background: "#111116", border: "1px solid #222", height: "100%" }}
                    >
                      {analytics?.body_structure_breakdown ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <Text style={{ color: "#fff" }}>Slim Silhouette</Text>
                              <Text style={{ color: "#888" }}>{analytics.body_structure_breakdown.slim || 0} checks</Text>
                            </div>
                            <Progress
                              percent={analytics.total_generations ? Math.round(((analytics.body_structure_breakdown.slim || 0) / analytics.total_generations) * 100) : 25}
                              strokeColor="#38bdf8"
                            />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <Text style={{ color: "#fff" }}>Athletic / Average</Text>
                              <Text style={{ color: "#888" }}>{analytics.body_structure_breakdown.athletic || 0} checks</Text>
                            </div>
                            <Progress
                              percent={analytics.total_generations ? Math.round(((analytics.body_structure_breakdown.athletic || 0) / analytics.total_generations) * 100) : 45}
                              strokeColor="#8b5cf6"
                            />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <Text style={{ color: "#fff" }}>Full-Figured</Text>
                              <Text style={{ color: "#888" }}>{analytics.body_structure_breakdown.full_figured || 0} checks</Text>
                            </div>
                            <Progress
                              percent={analytics.total_generations ? Math.round(((analytics.body_structure_breakdown.full_figured || 0) / analytics.total_generations) * 100) : 20}
                              strokeColor="#ec4899"
                            />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <Text style={{ color: "#fff" }}>Plus-Size</Text>
                              <Text style={{ color: "#888" }}>{analytics.body_structure_breakdown.plus_size || 0} checks</Text>
                            </div>
                            <Progress
                              percent={analytics.total_generations ? Math.round(((analytics.body_structure_breakdown.plus_size || 0) / analytics.total_generations) * 100) : 10}
                              strokeColor="#f59e0b"
                            />
                          </div>
                        </div>
                      ) : (
                        <Spin />
                      )}
                    </Card>
                  </Col>

                  <Col xs={24} lg={12}>
                    <Card
                      title={<span style={{ color: "#fff" }}>Daily Try-On Volume (Last 7 Days)</span>}
                      style={{ background: "#111116", border: "1px solid #222", height: "100%" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", height: "180px", paddingTop: "30px" }}>
                        {analytics?.daily_volume?.map((day: any) => {
                          const maxCount = Math.max(...analytics.daily_volume.map((d: any) => d.count), 5);
                          const heightPct = Math.max(15, Math.round((day.count / maxCount) * 100));
                          return (
                            <div key={day.date} style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                              <Text style={{ color: "#8b5cf6", fontSize: "12px", marginBottom: "4px" }}>{day.count}</Text>
                              <div
                                style={{
                                  width: "100%",
                                  maxWidth: "36px",
                                  height: `${heightPct}%`,
                                  background: "linear-gradient(180deg, #8b5cf6 0%, rgba(139, 92, 246, 0.2) 100%)",
                                  borderRadius: "6px 6px 0 0",
                                }}
                              />
                              <Text style={{ color: "#666", fontSize: "10px", marginTop: "8px" }}>
                                {day.date.slice(5)}
                              </Text>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: "body_structures",
            label: (
              <span>
                <IdcardOutlined /> Body Structures & Dummy Models
              </span>
            ),
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  message="Storefront Body Structure & Character Reference Models"
                  description="Customize the body structures presented to customers in the AI Fit Check modal. Upload full-length dummy character reference images on a clean white background for each body silhouette. These images serve as the baseline avatar on the storefront before customer face blending."
                  style={{ marginBottom: "20px", background: "rgba(139, 92, 246, 0.08)", borderColor: "rgba(139, 92, 246, 0.25)" }}
                />

                <Card
                  title={
                    <Space>
                      <Text strong style={{ color: "#fff", fontSize: "16px" }}>
                        Registered Body Structures ({structures.length})
                      </Text>
                      <Tag color="purple">Live Storefront Catalog</Tag>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button
                        type="default"
                        icon={<SyncOutlined spin={loadingStructures} />}
                        onClick={fetchStructures}
                        style={{ color: "#aaa" }}
                      >
                        Refresh
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenCreateStructure}
                        style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}
                      >
                        Add New Body Structure
                      </Button>
                    </Space>
                  }
                  style={{ background: "#111116", border: "1px solid #222" }}
                >
                  <Table
                    dataSource={structures}
                    columns={structureColumns}
                    rowKey="id"
                    loading={loadingStructures}
                    pagination={false}
                    style={{ background: "#111116" }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: "configuration",
            label: (
              <span>
                <SettingOutlined /> API & Engine Configuration
              </span>
            ),
            children: (
              <Card style={{ background: "#111116", border: "1px solid #222" }}>
                <Alert
                  type="info"
                  showIcon
                  message="Zero-Cost Mock Sandbox Mode Active"
                  description="When Mock Mode is enabled, try-on renders are composited locally using high-speed PIL blending in under 1 second without spending any third-party AI API tokens or incurring VPS GPU penalties."
                  style={{ marginBottom: "24px", background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.3)" }}
                />

                <Form
                  form={configForm}
                  layout="vertical"
                  onFinish={handleSaveConfig}
                >
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="provider"
                        label={<Text style={{ color: "#fff" }}>AI Try-On Engine Provider</Text>}
                      >
                        <Select style={{ width: "100%" }}>
                          <Option value="mock_sandbox">Mock Sandbox (Zero-Cost Local Blending)</Option>
                          <Option value="fashn">Fashn.ai Try-On API (Cloud)</Option>
                          <Option value="fal">Fal.ai Virtual Try-On (IDM-VTON)</Option>
                          <Option value="replicate">Replicate (Kwai-Kolors / IDM-VTON)</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="mock_mode"
                        label={<Text style={{ color: "#fff" }}>Mock Sandbox Mode (Safe Dev Fallback)</Text>}
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="Sandbox (Free)" unCheckedChildren="External AI" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="is_active"
                        label={<Text style={{ color: "#fff" }}>Storefront Master Switch</Text>}
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="Active on Store" unCheckedChildren="Disabled / Hidden" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="api_key"
                        label={<Text style={{ color: "#fff" }}>External AI API Key</Text>}
                        help="Enter API Key from Fashn.ai, Fal.ai, or Replicate"
                      >
                        <Input.Password placeholder="Enter or paste API key" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="model_id"
                        label={<Text style={{ color: "#fff" }}>Model Identifier</Text>}
                      >
                        <Input placeholder="e.g. idm-vton-v1" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ borderColor: "#222" }} />

                  <Title level={4} style={{ color: "#fff", marginBottom: "16px" }}>
                    Gatekeeper & Quota Limits
                  </Title>

                  <Row gutter={24}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="guest_trial_limit"
                        label={<Text style={{ color: "#fff" }}>Guest Anonymous 1-Time Trial</Text>}
                        help="Number of free tries before prompting login"
                      >
                        <Input type="number" min={1} max={5} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="user_daily_limit"
                        label={<Text style={{ color: "#fff" }}>Registered User Daily Quota</Text>}
                        help="Number of checks allowed per user per day"
                      >
                        <Input type="number" min={1} max={50} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="daily_budget_cap_usd"
                        label={<Text style={{ color: "#fff" }}>Daily Spend Cap ($ USD)</Text>}
                        help="Maximum external API cost per day"
                      >
                        <Input type="number" step="0.01" prefix="$" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ marginTop: "16px" }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={savingConfig}
                      style={{ background: "#8b5cf6", borderColor: "#8b5cf6", minWidth: "150px" }}
                    >
                      Save Configuration
                    </Button>
                  </div>
                </Form>
              </Card>
            ),
          },
          {
            key: "test_studio",
            label: (
              <span>
                <ExperimentOutlined /> Interactive Test Sandbox
              </span>
            ),
            children: (
              <Row gutter={24}>
                <Col xs={24} lg={12}>
                  <Card title={<span style={{ color: "#fff" }}>Simulation Parameters</span>} style={{ background: "#111116", border: "1px solid #222" }}>
                    <Form
                      form={testForm}
                      layout="vertical"
                      onFinish={handleRunAdminTest}
                      initialValues={{
                        product_name: "PoshPlex Tokyo Cyber Oversized Tee",
                        product_image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
                        face_image_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80",
                        height_cm: 178,
                        body_structure: "athletic",
                        gender_preference: "unisex",
                      }}
                    >
                      <Form.Item name="product_name" label={<Text style={{ color: "#fff" }}>Product Garment Name</Text>}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="product_image_url" label={<Text style={{ color: "#fff" }}>Product Image URL</Text>}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="face_image_url" label={<Text style={{ color: "#fff" }}>Face Portrait Image URL</Text>}>
                        <Input />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="body_structure" label={<Text style={{ color: "#fff" }}>Body Structure</Text>}>
                            <Select>
                              <Option value="slim">Slim</Option>
                              <Option value="athletic">Athletic / Average</Option>
                              <Option value="full_figured">Full-Figured</Option>
                              <Option value="plus_size">Plus-Size</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="height_cm" label={<Text style={{ color: "#fff" }}>Height (cm)</Text>}>
                            <Input type="number" min={140} max={215} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={testingAi}
                        icon={<ThunderboltOutlined />}
                        style={{ background: "#8b5cf6", borderColor: "#8b5cf6", width: "100%", height: "40px" }}
                      >
                        Generate Test Virtual Fit Check
                      </Button>
                    </Form>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card title={<span style={{ color: "#fff" }}>Render Output Preview</span>} style={{ background: "#111116", border: "1px solid #222", textAlign: "center", minHeight: "450px" }}>
                    {testingAi ? (
                      <div style={{ padding: "60px 0" }}>
                        <Spin size="large" />
                        <div style={{ marginTop: "16px", color: "#8b5cf6" }}>Synthesizing character model & garment blending...</div>
                      </div>
                    ) : testResult ? (
                      <div>
                        <Image
                          src={testResult.result_image_url}
                          alt="AI Try-On Result"
                          style={{ maxHeight: "380px", borderRadius: "8px", border: "1px solid #333" }}
                        />
                        <div style={{ marginTop: "14px" }}>
                          <Tag color="green">SUCCESS</Tag>
                          <Tag color="purple">⏱ {testResult.latency_seconds}s</Tag>
                          <Tag color="blue">{testResult.provider}</Tag>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "100px 0", color: "#666" }}>
                        Click "Generate Test Virtual Fit Check" to render an instant preview.
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "logs",
            label: (
              <span>
                <HistoryOutlined /> Audit & Generation Logs
              </span>
            ),
            children: (
              <Card style={{ background: "#111116", border: "1px solid #222" }}>
                <Table
                  dataSource={logs}
                  columns={logColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: logsPage,
                    total: logsTotal,
                    pageSize: 15,
                    onChange: (page) => fetchLogs(page),
                  }}
                  style={{ background: "#111116" }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Result Preview Modal */}
      <Modal
        open={!!selectedResultImage}
        onCancel={() => setSelectedResultImage(null)}
        footer={null}
        width={500}
        styles={{ body: { background: "#0a0a0e", padding: "16px", textAlign: "center" } }}
      >
        {selectedResultImage && (
          <div>
            <Image
              src={selectedResultImage}
              alt="Virtual Fit Result"
              style={{ width: "100%", maxHeight: "700px", objectFit: "contain", borderRadius: "8px" }}
            />
            <div style={{ marginTop: "12px" }}>
              <Button type="primary" href={selectedResultImage} target="_blank" download>
                Download Full Resolution
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Body Structure Edit & Image Upload Modal */}
      <Modal
        open={structureModalOpen}
        onCancel={() => setStructureModalOpen(false)}
        title={
          <span style={{ color: "#fff", fontSize: "16px" }}>
            {editingStructure ? `Edit Body Structure: ${editingStructure.name}` : "Create New Body Structure"}
          </span>
        }
        width={740}
        footer={null}
        destroyOnClose
        style={{ top: 40 }}
        styles={{ body: { background: "#101017", padding: "24px" } }}
      >
        <Form
          form={structureForm}
          layout="vertical"
          onFinish={handleSaveStructure}
        >
          <Row gutter={24}>
            {/* Left: Dummy Image Upload with White Background Preview Card */}
            <Col xs={24} md={10}>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <Text strong style={{ color: "#fff", display: "block", marginBottom: "4px", fontSize: "13px" }}>
                  Dummy Model Preview
                </Text>
                <div style={{ fontSize: "11px", color: "#888", marginBottom: "12px" }}>
                  Clean pure white background required
                </div>

                {/* White Background Preview Card */}
                <div
                  style={{
                    width: "180px",
                    height: "240px",
                    margin: "0 auto 14px auto",
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    border: "2px solid #8b5cf6",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(139, 92, 246, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {structureImagePreview ? (
                    <img
                      src={structureImagePreview}
                      alt="Dummy Preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  ) : (
                    <div style={{ padding: "20px", textAlign: "center" }}>
                      <SkinOutlined style={{ fontSize: "42px", color: "#d4d4d8" }} />
                      <div style={{ fontSize: "11px", color: "#71717a", marginTop: "8px", fontWeight: 700 }}>
                        No Dummy Image
                      </div>
                      <div style={{ fontSize: "9px", color: "#a1a1aa", marginTop: "4px" }}>
                        Vector silhouette will be used as fallback
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: structureImagePreview ? "#10b981" : "#8b5cf6",
                      color: "#ffffff",
                      fontSize: "9px",
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: "4px",
                      letterSpacing: "0.5px",
                      whiteSpace: "nowrap",
                      zIndex: 2,
                    }}
                  >
                    {structureImagePreview ? "CUSTOM MODEL PHOTO" : "STOREFRONT DEFAULT"}
                  </div>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={dummyFileInputRef}
                  onChange={handleDummyImageSelect}
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: "none" }}
                />

                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button
                    type="primary"
                    icon={<CloudUploadOutlined />}
                    onClick={() => dummyFileInputRef.current?.click()}
                    style={{ backgroundColor: "#8b5cf6", borderColor: "#8b5cf6", width: "100%" }}
                  >
                    {structureImagePreview ? "Replace Model Photo" : "Upload Model Photo"}
                  </Button>

                  {structureImagePreview && (
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        setStructureImagePreview("");
                        setStructureImageBase64("");
                        structureForm.setFieldValue("dummy_image_url", "");
                      }}
                    >
                      Clear Image
                    </Button>
                  )}
                </Space>

                <div style={{ fontSize: "11px", color: "#888", marginTop: "12px", lineHeight: 1.4, textAlign: "left" }}>
                  💡 <strong>Tip:</strong> Upload a full-body mannequin or character photo on a white background. This directly replaces the vector silhouette in the storefront popup.
                </div>
              </div>
            </Col>

            {/* Right: Structure Details */}
            <Col xs={24} md={14}>
              <Form.Item
                name="name"
                label={<Text style={{ color: "#fff" }}>Display Name</Text>}
                rules={[{ required: true, message: "Please input structure display name" }]}
                extra={<Text style={{ fontSize: "11px", color: "#777" }}>e.g. Athletic / Average, Slim, Plus-Size</Text>}
              >
                <Input placeholder="e.g. Athletic / Average" style={{ background: "#1a1a24", borderColor: "#333", color: "#fff" }} />
              </Form.Item>

              <Form.Item
                name="code"
                label={<Text style={{ color: "#fff" }}>System Code (Unique identifier)</Text>}
                rules={[{ required: true, message: "Please input code" }]}
                extra={<Text style={{ fontSize: "11px", color: "#777" }}>Used in AI prompts e.g. slim, athletic, full_figured, plus_size</Text>}
              >
                <Input
                  disabled={!!editingStructure}
                  placeholder="e.g. athletic"
                  style={{ background: "#1a1a24", borderColor: "#333", color: "#fff" }}
                />
              </Form.Item>

              <Form.Item
                name="description"
                label={<Text style={{ color: "#fff" }}>Customer Description & Fit Info</Text>}
                extra={<Text style={{ fontSize: "11px", color: "#777" }}>Displayed directly to the customer when selecting this body structure</Text>}
              >
                <TextArea
                  rows={3}
                  placeholder="e.g. Balanced streetwear silhouette with broad shoulders"
                  style={{ background: "#1a1a24", borderColor: "#333", color: "#fff" }}
                />
              </Form.Item>

              <Form.Item
                name="dummy_image_url"
                label={<Text style={{ color: "#fff" }}>Direct Image URL (Optional / CDN)</Text>}
                extra={<Text style={{ fontSize: "11px", color: "#777" }}>Or paste a direct Cloudflare R2 / CDN image URL</Text>}
              >
                <Input
                  placeholder="https://..."
                  onChange={(e) => {
                    if (e.target.value && !structureImageBase64) {
                      setStructureImagePreview(e.target.value);
                    }
                  }}
                  style={{ background: "#1a1a24", borderColor: "#333", color: "#fff" }}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="display_order"
                    label={<Text style={{ color: "#fff" }}>Display Order</Text>}
                  >
                    <InputNumber min={0} max={99} style={{ width: "100%", background: "#1a1a24", borderColor: "#333", color: "#fff" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="is_active"
                    label={<Text style={{ color: "#fff" }}>Visible on Storefront</Text>}
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="Active" unCheckedChildren="Hidden" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ borderColor: "#222", margin: "16px 0" }} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button onClick={() => setStructureModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={savingStructure}
                  icon={<CloudUploadOutlined />}
                  style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}
                >
                  Save Structure & Model
                </Button>
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default FitCheckPage;
