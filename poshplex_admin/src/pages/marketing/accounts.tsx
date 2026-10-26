import React, { useState, useEffect } from "react";
import {
  Card, Table, Tag, Button, Space, Typography, Modal, Form,
  Input, InputNumber, message, Alert, Row, Col, Statistic
} from "antd";
import {
  ApiOutlined, PlusOutlined, ReloadOutlined, CheckCircleOutlined,
  SyncOutlined, KeyOutlined, SafetyCertificateOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const MetaAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_BASE}/ad-accounts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(res.data);
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
        <Button
          size="small"
          icon={<SyncOutlined spin={syncingId === record.id} />}
          loading={syncingId === record.id}
          onClick={() => handleSync(record.id)}
        >
          Sync Now
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: "#ffffff" }}>Meta Ad Accounts & Credentials</Title>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>Manage connected Meta Business Marketing accounts and API tokens</Text>
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

      <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
        <Table
          dataSource={accounts}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
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
            <Input.Password prefix={<KeyOutlined />} placeholder="EAAK..." />
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
    </div>
  );
};
