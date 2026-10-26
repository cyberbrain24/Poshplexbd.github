import React, { useState, useEffect } from "react";
import {
  Row, Col, Card, Typography, Space, Button, Table, Tag, Input,
  Modal, Form, Select, Slider, Switch, Alert, message, Tooltip,
  Divider, Spin, Popconfirm, Badge
} from "antd";
import {
  ApiOutlined, PlusOutlined, SyncOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, KeyOutlined,
  DollarOutlined, SettingOutlined, EyeInvisibleOutlined, EyeTwoTone,
  EditOutlined, DeleteOutlined, RobotOutlined, CompassOutlined,
  FireOutlined, ShopOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing/ai-integration`;

const PROVIDER_DEFAULTS: Record<string, { model: string; baseUrl: string }> = {
  OPENAI: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  GEMINI: { model: "gemini-2.0-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/" },
  ANTHROPIC: { model: "claude-3-5-sonnet-20241022", baseUrl: "https://api.anthropic.com/v1" },
  DEEPSEEK: { model: "deepseek-chat", baseUrl: "https://api.deepseek.com" },
  GROQ: { model: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" },
  CUSTOM: { model: "gpt-4o-mini", baseUrl: "" },
};

const OPERATION_METADATA: Record<string, { title: string; desc: string; icon: any; color: string }> = {
  AD_COPY: {
    title: "Ad Copy Generation",
    desc: "Produces high-converting headlines, primary copy, and Dhaka streetwear angles for catalog items.",
    icon: <ThunderboltOutlined style={{ color: "#ec4899" }} />,
    color: "magenta",
  },
  COMPETITOR_SPY: {
    title: "Competitor Spy & Hook Radar",
    desc: "Evaluates multi-platform rival ads (Meta + Google Shopping/Search + Website Platform), parses 30-day Lindy hooks, and suggests counter-ads.",
    icon: <FireOutlined style={{ color: "#f59e0b" }} />,
    color: "gold",
  },
  AGENT_BRAIN: {
    title: "Meta Agent Brain (Reasoning)",
    desc: "Core autonomous media-buyer decision loop: low ROAS pauses, scaling, inventory sync, and budget pacing.",
    icon: <RobotOutlined style={{ color: "#8b5cf6" }} />,
    color: "purple",
  },
  PRODUCT_RESEARCH: {
    title: "Product & Catalog Trend Research",
    desc: "Synthesizes catalog sales velocity and demand trends to identify top streetwear pieces for new drops.",
    icon: <ShopOutlined style={{ color: "#06b6d4" }} />,
    color: "cyan",
  },
  DEFAULT: {
    title: "General / Fallback Operations",
    desc: "Default provider and model utilized when an unassigned or ad-hoc marketing task is triggered.",
    icon: <SettingOutlined style={{ color: "#10b981" }} />,
    color: "green",
  },
};

export const ApiIntegrationPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total_providers: 0, active_routes: 0, total_tokens_used: 0, total_cost_usd: 0 });

  // Testing status
  const [testingId, setTestingId] = useState<number | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProvider, setEditingProvider] = useState<any | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Updating route state
  const [savingRouteOp, setSavingRouteOp] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("poshplex_access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [provRes, routesRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/providers`, { headers }),
        axios.get(`${API_BASE}/routes`, { headers }),
        axios.get(`${API_BASE}/stats`, { headers }),
      ]);
      setProviders(provRes.data || []);
      setRoutes(routesRes.data || []);
      setStats(statsRes.data || {});
    } catch (err: any) {
      console.error("Failed loading AI Integration data:", err);
      message.error("Failed to load AI integrations. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTestConnection = async (providerId: number, name: string) => {
    setTestingId(providerId);
    try {
      const res = await axios.post(`${API_BASE}/providers/${providerId}/test`, {}, { headers: getAuthHeaders() });
      if (res.data?.success) {
        message.success(`Connected to ${name} in ${res.data.latency_ms}ms!`);
      } else {
        message.error(`Connection failed for ${name}: ${res.data?.error || res.data?.message}`);
      }
      await fetchData();
    } catch (err: any) {
      message.error(`Test failed: ` + (err.response?.data?.message || err.message));
    } finally {
      setTestingId(null);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProvider(null);
    form.resetFields();
    form.setFieldsValue({
      provider_type: "OPENAI",
      default_model: PROVIDER_DEFAULTS.OPENAI.model,
      base_url: PROVIDER_DEFAULTS.OPENAI.baseUrl,
      is_active: true,
      test_now: true,
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (provider: any) => {
    setEditingProvider(provider);
    form.resetFields();
    form.setFieldsValue({
      name: provider.name,
      provider_type: provider.provider_type,
      default_model: provider.default_model,
      base_url: provider.base_url,
      is_active: provider.is_active,
    });
    setModalOpen(true);
  };

  const handleProviderTypeChange = (val: string) => {
    const defaults = PROVIDER_DEFAULTS[val];
    if (defaults) {
      form.setFieldsValue({
        default_model: defaults.model,
        base_url: defaults.baseUrl,
      });
    }
  };

  const handleSaveProvider = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingProvider) {
        await axios.put(`${API_BASE}/providers/${editingProvider.id}`, values, { headers: getAuthHeaders() });
        message.success(`Updated provider '${values.name || editingProvider.name}'`);
      } else {
        await axios.post(`${API_BASE}/providers`, values, { headers: getAuthHeaders() });
        message.success(`Added AI Provider '${values.name}' successfully!`);
      }
      setModalOpen(false);
      form.resetFields();
      await fetchData();
    } catch (err: any) {
      message.error("Failed to save provider: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProvider = async (providerId: number) => {
    try {
      await axios.delete(`${API_BASE}/providers/${providerId}`, { headers: getAuthHeaders() });
      message.success("AI Provider deleted.");
      await fetchData();
    } catch (err: any) {
      message.error("Failed to delete provider: " + (err.response?.data?.message || err.message));
    }
  };

  const handleUpdateRouteField = (operation: string, field: string, value: any) => {
    setRoutes(prev => prev.map(r => r.operation === operation ? { ...r, [field]: value } : r));
  };

  const handleSaveRoute = async (route: any) => {
    setSavingRouteOp(route.operation);
    try {
      await axios.put(
        `${API_BASE}/routes/${route.operation}`,
        {
          provider_id: route.provider_id,
          model_name: route.model_name,
          temperature: route.temperature,
          max_tokens: route.max_tokens,
          is_enabled: route.is_enabled,
        },
        { headers: getAuthHeaders() }
      );
      message.success(`Updated routing for '${OPERATION_METADATA[route.operation]?.title || route.operation}'`);
      await fetchData();
    } catch (err: any) {
      message.error("Failed to save route: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingRouteOp(null);
    }
  };

  const providerColumns = [
    {
      title: "Provider Name",
      key: "name",
      render: (_: any, r: any) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Text strong style={{ color: "#fff", fontSize: 15 }}>{r.name}</Text>
            {!r.is_active && <Tag color="default">Inactive</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Default Model: <span style={{ color: "#38bdf8" }}>{r.default_model}</span>
          </Text>
        </Space>
      ),
    },
    {
      title: "Provider Engine",
      dataIndex: "provider_type",
      key: "provider_type",
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          OPENAI: "green",
          GEMINI: "blue",
          ANTHROPIC: "orange",
          DEEPSEEK: "cyan",
          GROQ: "purple",
          CUSTOM: "default",
        };
        return <Tag color={colorMap[type] || "default"}>{type}</Tag>;
      },
    },
    {
      title: "Masked API Key",
      dataIndex: "masked_key",
      key: "masked_key",
      render: (key: string) => (
        <Space>
          <KeyOutlined style={{ color: "#8c8c8c" }} />
          <Text code style={{ backgroundColor: "#27272a", color: "#e4e4e7" }}>{key}</Text>
        </Space>
      ),
    },
    {
      title: "Connection Health",
      key: "status",
      render: (_: any, r: any) => {
        if (r.last_test_status === "SUCCESS") {
          return (
            <Tooltip title={`Tested: ${r.last_tested_at || 'Recently'}`}>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                Connected ({r.last_latency_ms}ms)
              </Tag>
            </Tooltip>
          );
        }
        if (r.last_test_status === "FAILED") {
          return (
            <Tooltip title={r.last_error || "Connection error"}>
              <Tag color="error" icon={<CloseCircleOutlined />}>
                Failed
              </Tag>
            </Tooltip>
          );
        }
        return <Tag color="default">Untested</Tag>;
      },
    },
    {
      title: "Usage & Spend",
      key: "usage",
      render: (_: any, r: any) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: 13, color: "#fff" }}>
            {Number(r.total_tokens_used).toLocaleString()} tokens
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ${Number(r.total_cost_usd).toFixed(4)} ({r.total_calls} calls)
          </Text>
        </Space>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: any) => (
        <Space size={8}>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<SyncOutlined spin={testingId === r.id} />}
            loading={testingId === r.id}
            onClick={() => handleTestConnection(r.id, r.name)}
          >
            Test
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditModal(r)}
          />
          <Popconfirm
            title="Delete AI Provider?"
            description="Are you sure you want to remove this API key?"
            onConfirm={() => handleDeleteProvider(r.id)}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", backgroundColor: "#09090b" }}>
      {/* Brand Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <Space align="center" size={10}>
            <Title level={2} style={{ margin: 0, color: "#fff", fontWeight: 700, letterSpacing: "-0.5px" }}>
              Meta Engine - AI & API Integration
            </Title>
            <Tag color="#722ed1" icon={<ApiOutlined />} style={{ borderRadius: 12, padding: "2px 10px", fontSize: 12 }}>
              Multi-Provider Routing
            </Tag>
          </Space>
          <Paragraph type="secondary" style={{ margin: "4px 0 0 0", fontSize: 14, color: "#a1a1aa" }}>
            Add multiple AI API providers and map specific operations (Ad Copy, Competitor Spy, Agent Brain, Product Research) to tailored models.
          </Paragraph>
        </div>

        <Space size={12}>
          <Button
            icon={<SyncOutlined />}
            onClick={fetchData}
            loading={loading}
            style={{ borderRadius: 6, borderColor: "#3f3f46", color: "#e4e4e7" }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenAddModal}
            style={{ borderRadius: 6, backgroundColor: "#722ed1", borderColor: "#722ed1" }}
          >
            Add AI Provider
          </Button>
        </Space>
      </div>

      {/* KPI Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Configured AI Providers
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#fff" }}>{stats.total_providers || providers.length}</Title>
                <Tag color="purple">{stats.active_providers || providers.filter(p => p.is_active).length} Active</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Encrypted with Fernet cipher
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Active Operation Routes
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#38bdf8" }}>{routes.filter(r => r.is_enabled).length} / 5</Title>
                <Tag color="cyan">Dedicated Models</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Targeted reasoning per feature
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Tokens Consumed
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#eab308" }}>
                  {Number(stats.total_tokens_used || 0).toLocaleString()}
                </Title>
                <Tag color="gold">{stats.total_calls || 0} Calls</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Across all engines & operations
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total AI Spend ($ USD)
              </Text>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Title level={2} style={{ margin: 0, color: "#10b981" }}>
                  ${Number(stats.total_cost_usd || 0).toFixed(4)}
                </Title>
                <Tag color="green">Budget Guarded</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, color: "#71717a" }}>
                Strict $2.00/day safety ceiling
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Section 1: Operation-Based Routing Matrix */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: "#722ed1" }} />
            <Text strong style={{ color: "#fff", fontSize: 16 }}>
              Operation-Based AI Routing Matrix
            </Text>
            <Tag color="purple">Assign Provider & Model per Task</Tag>
          </Space>
        }
        style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8, marginBottom: 28 }}
      >
        <Alert
          message="Custom Operation Routing"
          description="Different Meta Engine operations require different capabilities. You can assign cheap, fast models (like gpt-4o-mini or gemini-2.0-flash) for Ad Copy Generation and Competitor Spy, while reserving reasoning models for the Autonomous Agent Brain."
          type="info"
          showIcon
          style={{ marginBottom: 20, backgroundColor: "#18181b", borderColor: "#3f3f46" }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {routes.map((route: any) => {
            const meta = OPERATION_METADATA[route.operation] || {
              title: route.operation_label || route.operation,
              desc: "Engine operation",
              icon: <ApiOutlined />,
              color: "blue",
            };

            return (
              <Card
                key={route.operation}
                size="small"
                style={{
                  backgroundColor: "#18181b",
                  borderColor: route.is_enabled ? "#27272a" : "#1f1f23",
                  borderRadius: 6,
                }}
              >
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={8}>
                    <Space size={12} align="start">
                      <div style={{ fontSize: 22, marginTop: 2 }}>{meta.icon}</div>
                      <div>
                        <Space>
                          <Text strong style={{ color: "#fff", fontSize: 15 }}>{meta.title}</Text>
                          <Tag color={meta.color}>{route.operation}</Tag>
                        </Space>
                        <Paragraph style={{ color: "#a1a1aa", fontSize: 12, margin: "4px 0 0 0" }}>
                          {meta.desc}
                        </Paragraph>
                      </div>
                    </Space>
                  </Col>

                  <Col xs={24} md={5}>
                    <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Assigned AI Provider:</Text>
                    <Select
                      style={{ width: "100%" }}
                      value={route.provider_id || -1}
                      onChange={(val) => handleUpdateRouteField(route.operation, "provider_id", val === -1 ? null : val)}
                    >
                      <Option value={-1}>None (Fallback to Env / Heuristic)</Option>
                      {providers.filter(p => p.is_active).map(p => (
                        <Option key={p.id} value={p.id}>
                          {p.name} ({p.provider_type})
                        </Option>
                      ))}
                    </Select>
                  </Col>

                  <Col xs={24} md={4}>
                    <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Model Name:</Text>
                    <Input
                      value={route.model_name}
                      onChange={(e) => handleUpdateRouteField(route.operation, "model_name", e.target.value)}
                      placeholder="e.g. gpt-4o-mini"
                    />
                  </Col>

                  <Col xs={24} md={4}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Temp: {route.temperature}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>Max: {route.max_tokens}</Text>
                    </div>
                    <Slider
                      min={0.0}
                      max={1.0}
                      step={0.1}
                      value={route.temperature}
                      onChange={(val) => handleUpdateRouteField(route.operation, "temperature", val)}
                      style={{ margin: "6px 0 0 0" }}
                    />
                  </Col>

                  <Col xs={24} md={3} style={{ textAlign: "right" }}>
                    <Space size={12}>
                      <Switch
                        checked={route.is_enabled}
                        onChange={(val) => handleUpdateRouteField(route.operation, "is_enabled", val)}
                      />
                      <Button
                        type="primary"
                        size="small"
                        loading={savingRouteOp === route.operation}
                        onClick={() => handleSaveRoute(route)}
                        style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
                      >
                        Save
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* Section 2: Configured AI API Providers */}
      <Card
        title={
          <Space>
            <KeyOutlined style={{ color: "#06b6d4" }} />
            <Text strong style={{ color: "#fff", fontSize: 16 }}>Configured AI API Providers & Keys</Text>
            <Tag color="cyan">{providers.length} Registered</Tag>
          </Space>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleOpenAddModal}
            style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
          >
            Add Key
          </Button>
        }
        style={{ backgroundColor: "#141418", borderColor: "#27272a", borderRadius: 8 }}
      >
        <Table
          dataSource={providers}
          columns={providerColumns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* Add / Edit Provider Modal */}
      <Modal
        title={editingProvider ? `Edit Provider: ${editingProvider.name}` : "Add AI API Provider to Meta Engine"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveProvider}
        >
          <Form.Item
            name="name"
            label="Friendly Provider Name"
            rules={[{ required: true, message: "Please enter a friendly name" }]}
          >
            <Input placeholder="e.g. OpenAI Production, Gemini Fast, DeepSeek Primary" />
          </Form.Item>

          <Form.Item
            name="provider_type"
            label="Provider Protocol"
            rules={[{ required: true, message: "Please select provider type" }]}
          >
            <Select onChange={handleProviderTypeChange}>
              <Option value="OPENAI">OpenAI (GPT-4o, GPT-4o-mini)</Option>
              <Option value="GEMINI">Google Gemini (Gemini 2.0 Flash, 1.5 Pro)</Option>
              <Option value="ANTHROPIC">Anthropic Claude (Claude 3.5 Sonnet, Haiku)</Option>
              <Option value="DEEPSEEK">DeepSeek (DeepSeek-V3, R1)</Option>
              <Option value="GROQ">Groq LPU (Llama 3.3 70B, Mixtral)</Option>
              <Option value="CUSTOM">Custom OpenAI-Compatible Endpoint</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API Key (Fernet Encrypted)"
            rules={[{ required: !editingProvider, message: "Please enter the API key" }]}
            help={editingProvider ? "Leave blank to keep existing encrypted key" : "Your API key is never exposed or logged in plain text."}
          >
            <Input.Password
              placeholder={editingProvider ? "••••••••••••••••••••" : "sk-..."}
              iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="default_model"
            label="Default Model"
            rules={[{ required: true, message: "Please enter default model" }]}
          >
            <Input placeholder="e.g. gpt-4o-mini, gemini-2.0-flash, claude-3-5-sonnet" />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="API Base URL (Optional / Custom)"
            help="Pre-configured for OpenAI, Gemini, DeepSeek, Groq. Customize for proxies or Ollama."
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item name="is_active" valuePropName="checked">
            <Space>
              <Switch defaultChecked />
              <Text>Enable this provider immediately</Text>
            </Space>
          </Form.Item>

          {!editingProvider && (
            <Form.Item name="test_now" valuePropName="checked">
              <Space>
                <Switch defaultChecked />
                <Text>Test connection live on save</Text>
              </Space>
            </Form.Item>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
            >
              {editingProvider ? "Save Changes" : "Save & Register Key"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
export default ApiIntegrationPage;
