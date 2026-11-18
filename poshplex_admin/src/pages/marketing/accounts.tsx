import React, { useState, useEffect } from "react";
import {
  Card, Table, Tag, Button, Space, Typography, Modal, Form,
  Input, InputNumber, message, Alert, Row, Col, Popconfirm, Select, Tabs, Radio
} from "antd";
import {
  ApiOutlined, PlusOutlined, ReloadOutlined, CheckCircleOutlined,
  SyncOutlined, KeyOutlined, SafetyCertificateOutlined, EditOutlined,
  DeleteOutlined, CodeOutlined, PlayCircleOutlined, ExperimentOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const MetaAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Graph API Explorer state
  const [explorerAccountId, setExplorerAccountId] = useState<number | undefined>(undefined);
  const [explorerMethod, setExplorerMethod] = useState<string>("GET");
  const [explorerEndpoint, setExplorerEndpoint] = useState<string>("{ad_account_id}/insights?fields=spend,impressions,clicks&date_preset=last_7d");
  const [explorerParams, setExplorerParams] = useState<string>("{}");
  const [explorerLoading, setExplorerLoading] = useState<boolean>(false);
  const [explorerResult, setExplorerResult] = useState<any | null>(null);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_BASE}/ad-accounts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(res.data);
      if (res.data.length > 0 && !explorerAccountId) {
        setExplorerAccountId(res.data[0].id);
      }
    } catch (err) {
      message.error("Failed to load Meta ad accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleConnect = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/ad-accounts/connect/`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Meta Ad Account connected successfully with AES-256 encryption!");
      setIsModalOpen(false);
      form.resetFields();
      fetchAccounts();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to connect ad account.");
    }
  };

  const handleOpenEdit = (account: any) => {
    setEditingAccount(account);
    editForm.setFieldsValue({
      name: account.name,
      meta_account_id: account.meta_account_id,
      currency: account.currency,
      timezone: account.timezone,
      daily_spend_cap: Number(account.daily_spend_cap) || 0,
      is_active: account.is_active,
      access_token: "", // Leave blank if keeping existing
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingAccount) return;
    try {
      const values = await editForm.validateFields();
      const token = localStorage.getItem("poshplex_access_token");
      const payload: any = {
        name: values.name,
        currency: values.currency,
        timezone: values.timezone,
        daily_spend_cap: values.daily_spend_cap,
        is_active: values.is_active,
      };
      if (values.access_token && values.access_token.trim()) {
        payload.access_token = values.access_token.trim();
      }

      await axios.put(`${API_BASE}/ad-accounts/${editingAccount.id}/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Ad account '${values.name}' updated and saved to database!`);
      setIsEditModalOpen(false);
      setEditingAccount(null);
      editForm.resetFields();
      fetchAccounts();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to update ad account.");
    }
  };

  const handleDelete = async (accountId: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.delete(`${API_BASE}/ad-accounts/${accountId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Meta Ad Account deleted successfully from database.");
      fetchAccounts();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to delete ad account.");
    }
  };

  const handleSync = async (accountId: number) => {
    setSyncingId(accountId);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_BASE}/ad-accounts/${accountId}/sync/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Sync completed! Fetched ${res.data.insights_synced} campaign metric snapshots.`);
      fetchAccounts();
    } catch (err) {
      message.error("Failed to sync ad account.");
    } finally {
      setSyncingId(null);
    }
  };

  const handleRunGraphExplorer = async () => {
    if (!explorerEndpoint.trim()) {
      message.warning("Please provide a Graph API endpoint.");
      return;
    }
    setExplorerLoading(true);
    setExplorerResult(null);
    try {
      let parsedParams = {};
      if (explorerParams.trim()) {
        try {
          parsedParams = JSON.parse(explorerParams);
        } catch {
          // If not JSON, leave as empty
        }
      }

      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(
        `${API_BASE}/ad-accounts/test-graph-api/`,
        {
          account_id: explorerAccountId,
          endpoint: explorerEndpoint.trim(),
          method: explorerMethod,
          params: parsedParams,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExplorerResult(res.data);
      if (res.data.success) {
        message.success("Meta Graph API call executed successfully!");
      } else {
        message.error(`Meta API returned error: ${res.data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err.message || "Failed to test Graph API";
      setExplorerResult({ success: false, error: errMsg });
      message.error(errMsg);
    } finally {
      setExplorerLoading(false);
    }
  };

  const columns = [
    {
      title: "Account Name & ID",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: any) => (
        <Space>
          <div style={{ backgroundColor: "#8b5cf6", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ApiOutlined style={{ color: "#ffffff", fontSize: 18 }} />
          </div>
          <div>
            <Text strong style={{ color: "#ffffff", fontSize: 13 }}>{name}</Text>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Meta Account ID: {record.meta_account_id}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "Currency / Timezone",
      key: "currency",
      render: (_: any, record: any) => (
        <Text style={{ fontSize: 12 }}>{record.currency} ({record.timezone})</Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (isActive: boolean) => (
        <Tag color={isActive ? "success" : "default"}>
          {isActive ? "Connected & Active" : "Disconnected"}
        </Tag>
      ),
    },
    {
      title: "Security & Encryption",
      key: "security",
      render: () => (
        <Tag icon={<SafetyCertificateOutlined />} color="purple">
          AES-256 Encrypted
        </Tag>
      ),
    },
    {
      title: "Daily Spend Cap",
      dataIndex: "daily_spend_cap",
      key: "daily_spend_cap",
      render: (val: number) => Number(val) > 0 ? (
        <Tag color="gold">$ {Number(val).toLocaleString()} USD / day</Tag>
      ) : (
        <Text style={{ color: "#9ca3af", fontSize: 12 }}>No Limit</Text>
      ),
    },
    {
      title: "Last Synced",
      dataIndex: "last_synced_at",
      key: "last_synced_at",
      render: (val: string) => (
        <Text style={{ fontSize: 12 }}>{val ? new Date(val).toLocaleString() : "Pending First Sync"}</Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            size="small"
            icon={<SyncOutlined spin={syncingId === record.id} />}
            loading={syncingId === record.id}
            onClick={() => handleSync(record.id)}
          >
            Sync Now
          </Button>

          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            Edit
          </Button>

          <Popconfirm
            title="Delete Ad Account"
            description="Are you sure you want to remove this Meta Ad Account? Encrypted tokens will be wiped from the database."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: "#ffffff" }}>Meta Ad Accounts & Credentials</Title>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>Manage connected Meta Business Marketing accounts, API tokens, and live Graph API testing</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAccounts}>Refresh</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: "#8b5cf6" }}
          >
            Connect Ad Account
          </Button>
        </Space>
      </div>

      <Alert
        message={
          <Space>
            <SafetyCertificateOutlined style={{ color: "#10b981" }} />
            <span>
              All Meta Marketing API tokens are stored using enterprise <strong>AES-256 Fernet symmetric encryption</strong>. Tokens are never exposed in plain text or logged.
            </span>
          </Space>
        }
        type="success"
        showIcon={false}
        style={{ marginBottom: 20, backgroundColor: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)" }}
      />

      <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 24 }}>
        <Table
          dataSource={accounts}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* Graph API Explorer Testing Panel */}
      <Card
        title={
          <Space>
            <CodeOutlined style={{ color: "#8b5cf6", fontSize: 18 }} />
            <span style={{ color: "#ffffff", fontWeight: 700 }}>Meta Graph API Explorer Testing</span>
            <Tag color="cyan">Use Case Verification Simulator</Tag>
          </Space>
        }
        style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}
      >
        <Paragraph style={{ color: "#9ca3af", fontSize: 13 }}>
          Execute live queries against the Meta Marketing API using your stored encrypted credentials. This generates official Meta Graph API query events for your App's <strong>Use Case Testing</strong> verification.
        </Paragraph>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <label style={{ color: "#9ca3af", fontSize: 12, display: "block", marginBottom: 6 }}>TARGET AD ACCOUNT</label>
            <Select
              style={{ width: "100%" }}
              value={explorerAccountId}
              onChange={(val) => setExplorerAccountId(val)}
              options={accounts.map((acc) => ({
                label: `${acc.name} (${acc.meta_account_id})`,
                value: acc.id
              }))}
              placeholder="Select Ad Account"
            />
          </Col>

          <Col xs={24} md={4}>
            <label style={{ color: "#9ca3af", fontSize: 12, display: "block", marginBottom: 6 }}>HTTP METHOD</label>
            <Radio.Group
              value={explorerMethod}
              onChange={(e) => setExplorerMethod(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="GET">GET</Radio.Button>
              <Radio.Button value="POST">POST</Radio.Button>
            </Radio.Group>
          </Col>

          <Col xs={24} md={10}>
            <label style={{ color: "#9ca3af", fontSize: 12, display: "block", marginBottom: 6 }}>
              GRAPH API ENDPOINT <span style={{ color: "#6b7280" }}>(Use {"{ad_account_id}"} for auto-prefix)</span>
            </label>
            <Input
              value={explorerEndpoint}
              onChange={(e) => setExplorerEndpoint(e.target.value)}
              placeholder="{ad_account_id}/insights?fields=spend,impressions,clicks&date_preset=last_7d"
              style={{ fontFamily: "monospace" }}
            />
          </Col>

          <Col xs={24} md={4} style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={explorerLoading}
              onClick={handleRunGraphExplorer}
              style={{ width: "100%", backgroundColor: "#8b5cf6", height: 38, fontWeight: 700 }}
            >
              Test Query
            </Button>
          </Col>
        </Row>

        <div style={{ marginTop: 16 }}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Text style={{ color: "#9ca3af", fontSize: 12 }}>Quick Presets:</Text>
            <Button
              size="small"
              onClick={() => {
                setExplorerMethod("GET");
                setExplorerEndpoint("{ad_account_id}/insights?fields=spend,impressions,clicks&date_preset=last_7d");
              }}
            >
              Measure Ad Performance (Insights)
            </Button>
            <Button
              size="small"
              onClick={() => {
                setExplorerMethod("GET");
                setExplorerEndpoint("{ad_account_id}/campaigns?fields=id,name,status,objective&limit=5");
              }}
            >
              Manage Ads (Campaigns)
            </Button>
            <Button
              size="small"
              onClick={() => {
                setExplorerMethod("GET");
                setExplorerEndpoint("{ad_account_id}/adsets?fields=id,name,status,daily_budget&limit=5");
              }}
            >
              Ad Sets & Budgets
            </Button>
            <Button
              size="small"
              onClick={() => {
                setExplorerMethod("GET");
                setExplorerEndpoint("me/permissions");
              }}
            >
              App Token Permissions
            </Button>
          </Space>
        </div>

        {explorerResult && (
          <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Space>
                <Tag color={explorerResult.success ? "success" : "error"}>
                  {explorerResult.success ? "HTTP 200 OK — Test Passed" : "API Query Error"}
                </Tag>
                <Text style={{ fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>
                  Endpoint: {explorerResult.endpoint}
                </Text>
              </Space>
            </div>
            <pre
              style={{
                backgroundColor: "#08080a",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: 16,
                borderRadius: 8,
                color: explorerResult.success ? "#34d399" : "#f87171",
                fontSize: 12,
                maxHeight: 320,
                overflowY: "auto",
                fontFamily: "monospace"
              }}
            >
              {JSON.stringify(explorerResult.data || explorerResult.error || explorerResult, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {/* Connect Account Modal */}
      <Modal
        title="Connect Meta Ad Account"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleConnect}
        okText="Connect & Encrypt"
        okButtonProps={{ style: { backgroundColor: "#8b5cf6" } }}
      >
        <Form form={form} layout="vertical" initialValues={{ currency: "USD", timezone: "Asia/Dhaka" }}>
          <Form.Item
            label="Account Display Name"
            name="name"
            rules={[{ required: true, message: "Account name is required" }]}
          >
            <Input placeholder="e.g. PoshPlex Main BD Account" />
          </Form.Item>

          <Form.Item
            label="Meta Account ID"
            name="meta_account_id"
            help="Found in Meta Ads Manager URL (e.g. act_1234567890)"
            rules={[{ required: true, message: "Meta Account ID is required" }]}
          >
            <Input placeholder="act_..." />
          </Form.Item>

          <Form.Item
            label="Meta System User or Marketing Access Token"
            name="access_token"
            help="Will be encrypted at rest using AES-256"
            rules={[{ required: true, message: "Access token is required" }]}
          >
            <Input.Password prefix={<KeyOutlined />} placeholder="EAA..." />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Currency" name="currency">
                <Input placeholder="USD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Timezone" name="timezone">
                <Input placeholder="Asia/Dhaka" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Global Daily Spend Cap (USD)"
            name="daily_spend_cap"
            help="Safety Ceiling: If total spend across all campaigns reaches this cap in a single day, all active ads will auto-pause immediately."
          >
            <InputNumber min={0} step={50} prefix="$" style={{ width: "100%" }} placeholder="e.g. 500 (0 for no limit)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: "#8b5cf6" }} />
            <span>Edit Meta Ad Account & Credentials</span>
          </Space>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingAccount(null);
        }}
        onOk={handleUpdate}
        okText="Save Changes to Database"
        okButtonProps={{ style: { backgroundColor: "#8b5cf6" } }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="Account Display Name"
            name="name"
            rules={[{ required: true, message: "Account name is required" }]}
          >
            <Input placeholder="Account Name" />
          </Form.Item>

          <Form.Item
            label="Meta Account ID"
            name="meta_account_id"
          >
            <Input disabled style={{ color: "#9ca3af" }} />
          </Form.Item>

          <Form.Item
            label="Update Access Token (Optional)"
            name="access_token"
            help="Leave blank to keep current encrypted token. If providing a new token, it will be re-encrypted via AES-256."
          >
            <Input.Password prefix={<KeyOutlined />} placeholder="Paste new EAA... token" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Currency" name="currency">
                <Input placeholder="USD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Timezone" name="timezone">
                <Input placeholder="Asia/Dhaka" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Daily Spend Cap (USD)"
            name="daily_spend_cap"
          >
            <InputNumber min={0} step={50} prefix="$" style={{ width: "100%" }} placeholder="0 for no limit" />
          </Form.Item>

          <Form.Item
            label="Active Status"
            name="is_active"
          >
            <Select
              options={[
                { label: "Active & Connected", value: true },
                { label: "Disabled / Inactive", value: false },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
