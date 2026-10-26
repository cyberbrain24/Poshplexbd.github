import React, { useState, useEffect } from "react";
import {
  Table, Tag, Button, Space, Card, Switch, Typography, Modal,
  Form, Input, InputNumber, Select, message, Tooltip, Alert
} from "antd";
import {
  PlusOutlined, DeleteOutlined, ThunderboltOutlined, ReloadOutlined,
  HistoryOutlined, InfoCircleOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const AutomationRulesPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logModalRule, setLogModalRule] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchRules = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };
      const [rulesRes, campRes] = await Promise.all([
        axios.get(`${API_BASE}/rules/`, { headers }),
        axios.get(`${API_BASE}/campaigns/`, { headers }),
      ]);
      setRules(rulesRes.data);
      setCampaigns(campRes.data);
    } catch (err) {
      message.error("Failed to load automation rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (ruleId: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.put(`${API_BASE}/rules/${ruleId}/toggle/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Rule status updated.");
      fetchRules();
    } catch (err) {
      message.error("Failed to update rule status.");
    }
  };

  const handleDelete = async (ruleId: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.delete(`${API_BASE}/rules/${ruleId}/`, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Rule deleted.");
      fetchRules();
    } catch (err) {
      message.error("Failed to delete rule.");
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/rules/`, values, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Automation rule created!");
      setIsModalOpen(false);
      form.resetFields();
      fetchRules();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to create rule.");
    }
  };

  const columns = [
    {
      title: "Rule Name & Scope",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: any) => (
        <div>
          <Text strong style={{ color: "#ffffff", fontSize: 13 }}>{name}</Text>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            Scope: <Tag color="blue" style={{ fontSize: 10 }}>{record.campaign_name || "ALL CAMPAIGNS"}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: "Trigger Condition",
      key: "condition",
      render: (_: any, record: any) => {
        let label = record.condition_type;
        let suffix = "";
        if (record.condition_type.includes("ROAS")) suffix = "x";
        else if (record.condition_type.includes("SPEND") || record.condition_type.includes("CPC")) suffix = " USD";

        return (
          <Tag color="cyan">
            {record.condition_type.replace(/_/g, " ")}: {record.threshold_value}{suffix}
          </Tag>
        );
      },
    },
    {
      title: "Automated Action",
      dataIndex: "action",
      key: "action",
      render: (action: string) => {
        const color = action === "PAUSE" ? "volcano" : action.includes("SCALE_UP") ? "green" : "orange";
        return <Tag color={color} style={{ fontWeight: 600 }}>{action.replace(/_/g, " ")}</Tag>;
      },
    },
    {
      title: "Active",
      dataIndex: "is_active",
      key: "is_active",
      render: (isActive: boolean, record: any) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggle(record.id)}
          style={{ backgroundColor: isActive ? "#8b5cf6" : undefined }}
        />
      ),
    },
    {
      title: "Last Triggered",
      dataIndex: "last_triggered_at",
      key: "last_triggered_at",
      render: (val: string, record: any) => (
        <div>
          <Text style={{ fontSize: 12 }}>{val ? new Date(val).toLocaleDateString() : "Never"}</Text>
          {record.last_trigger_log && (
            <div>
              <Button size="small" type="link" icon={<HistoryOutlined />} onClick={() => setLogModalRule(record)}>
                View Log
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Action",
      key: "actions",
      render: (_: any, record: any) => (
        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: "#ffffff" }}>Automation & Safeguard Rules</Title>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>Autonomous 24/7 ROAS scaling, budget cutting, and bleed protection</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRules}>Refresh</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: "#8b5cf6" }}
          >
            Create Rule
          </Button>
        </Space>
      </div>

      <Alert
        message={
          <Space>
            <ThunderboltOutlined style={{ color: "#8b5cf6" }} />
            <span>
              Autonomous execution runs every <strong>30 minutes</strong> via Celery Beat. All budget adjustments honor safety cooldown periods to prevent rapid oscillation.
            </span>
          </Space>
        }
        type="info"
        showIcon={false}
        style={{ marginBottom: 16, backgroundColor: "rgba(139, 92, 246, 0.08)", borderColor: "rgba(139, 92, 246, 0.25)" }}
      />

      <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}>
        <Table
          dataSource={rules}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Rule Modal */}
      <Modal
        title="Create Automation Rule"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleCreate}
        okText="Create Rule"
        okButtonProps={{ style: { backgroundColor: "#8b5cf6" } }}
      >
        <Form form={form} layout="vertical" initialValues={{ cooldown_hours: 6, is_active: true }}>
          <Form.Item label="Rule Name" name="name" rules={[{ required: true, message: "Rule name is required" }]}>
            <Input placeholder="e.g. Cut budget if ROAS < 1.5x" />
          </Form.Item>

          <Form.Item label="Applies To Campaign" name="campaign_id" help="Leave blank to apply globally across all active campaigns">
            <Select placeholder="Global (All Campaigns)" allowClear>
              {campaigns.map((c) => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Condition" name="condition_type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "ROAS Below Threshold", value: "ROAS_BELOW" },
                { label: "ROAS Above Threshold (Scaling Winner)", value: "ROAS_ABOVE" },
                { label: "Daily Spend Above Threshold", value: "SPEND_ABOVE" },
                { label: "Cost Per Click (CPC) Above Threshold", value: "CPC_ABOVE" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Threshold Value" name="threshold_value" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.1} style={{ width: "100%" }} placeholder="e.g. 1.8 for ROAS or 25 for spend ($)" />
          </Form.Item>

          <Form.Item label="Action to Execute" name="action" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Scale Daily Budget +20%", value: "SCALE_UP_20" },
                { label: "Scale Daily Budget -20%", value: "SCALE_DOWN_20" },
                { label: "Pause Campaign on Meta", value: "PAUSE" },
                { label: "Send Notification Alert Only", value: "NOTIFY" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Cooldown Hours" name="cooldown_hours" help="Minimum hours to wait between consecutive triggers">
            <InputNumber min={1} max={72} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Trigger Log Modal */}
      <Modal
        title={`Execution Audit Log: ${logModalRule?.name}`}
        open={!!logModalRule}
        onCancel={() => setLogModalRule(null)}
        footer={<Button onClick={() => setLogModalRule(null)}>Close</Button>}
      >
        <pre style={{ backgroundColor: "#18181b", padding: 12, borderRadius: 6, fontSize: 12, color: "#a1a1aa", maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap" }}>
          {logModalRule?.last_trigger_log || "No trigger logs recorded yet."}
        </pre>
      </Modal>
    </div>
  );
};
