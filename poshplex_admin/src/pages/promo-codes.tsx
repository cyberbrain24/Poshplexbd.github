import React, { useState, useEffect } from "react";
import {
  Table, Tag, Button, Space, Card, Modal, Form, Input, 
  InputNumber, Select, Switch, Divider, DatePicker, message, Row, Col
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const API_URL = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://store.poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/marketing/promos";

export const PromoCodes: React.FC = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<any>(null);
  const [form] = Form.useForm();

  // Load active marketing campaigns
  const fetchPromos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPromos(res.data);
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to load promo codes list."); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  // Save / Edit campaign promo
  const handleSave = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      
      const payload = {
        ...values,
        starts_at: values.starts_at ? values.starts_at.toISOString() : null,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null
      };

      if (selectedPromo) {
        await axios.put(`${API_URL}/${selectedPromo.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Promo code details updated.");
      } else {
        await axios.post(API_URL, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("New promo code registered.");
      }

      setIsModalOpen(false);
      form.resetFields();
      fetchPromos();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to save campaign promo code."); }
  };

  // Toggle promo status
  const handleToggleActive = async (record: any, checked: boolean) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const payload = {
        ...record,
        is_active: checked
      };
      await axios.put(`${API_URL}/${record.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Promo campaign ${checked ? "Activated" : "Paused"}`);
      fetchPromos();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Status toggle failed."); }
  };

  // Delete promo campaign
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: "Confirm Deletion",
      content: "Are you sure you want to delete this campaign code? Deletion is blocked if customers have already redeemed this code.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const token = localStorage.getItem("poshplex_access_token");
          await axios.delete(`${API_URL}/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          message.success("Promo code campaign removed.");
          fetchPromos();
        } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.message || "Failed to remove campaign code."); }
      }
    });
  };

  const getRewardTypeTag = (type: string) => {
    const mapping: Record<string, { color: string; label: string }> = {
      percent: { color: "blue", label: "Percentage" },
      fixed: { color: "green", label: "Fixed Discount" },
      freeship: { color: "gold", label: "Free Delivery" },
      membership: { color: "purple", label: "VIP Tier Grant" }
    };
    const det = mapping[type] || { color: "default", label: type };
    return <Tag color={det.color}>{det.label.toUpperCase()}</Tag>;
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>Campaign Discount Engine</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>Create and manage store discount codes, free shipping triggers, and membership rewards.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedPromo(null); setIsModalOpen(true); form.resetFields(); }} style={{ borderRadius: 0 }}>
          Create Promo Code
        </Button>
      </div>

      <Card>
        <Table scroll={{ x: 'max-content' }}
          loading={loading}
          dataSource={promos}
          rowKey="id"
          columns={[
            { title: "Campaign Code", dataIndex: "code", render: (c) => <code style={{ color: "var(--accent-purple)", fontWeight: 700 }}>{c}</code> },
            { title: "Reward Type", dataIndex: "reward_type", render: (t) => getRewardTypeTag(t) },
            { title: "Value", dataIndex: "discount_value", render: (val, record) => record.reward_type === "percent" ? `${val}%` : `৳${Math.round(val)}` },
            { title: "Min Spend", dataIndex: "min_order_amount", render: (val) => `৳${Math.round(val)}` },
            { title: "Total Redemptions", dataIndex: "usage_count", render: (count, record) => `${count} / ${record.total_usage_limit || "âˆž"}` },
            { title: "Validity Dates", render: (_, record) => (
              <span style={{ fontSize: 12 }}>
                {record.starts_at ? new Date(record.starts_at).toLocaleDateString() : "Immediate"} - {record.expires_at ? new Date(record.expires_at).toLocaleDateString() : "Open"}
              </span>
            )},
            { title: "Active status", dataIndex: "is_active", render: (active, record) => <Switch checked={active} onChange={(checked) => handleToggleActive(record, checked)} /> },
            {
              title: "Operations",
              key: "operations",
              render: (record: any) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => {
                    setSelectedPromo(record);
                    form.setFieldsValue({
                      ...record,
                      starts_at: record.starts_at ? dayjs(record.starts_at) : null,
                      expires_at: record.expires_at ? dayjs(record.expires_at) : null
                    });
                    setIsModalOpen(true);
                  }}>
                    Edit
                  </Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
                    Remove
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={selectedPromo ? "Edit Promo Code campaign" : "Create marketing Promo Code"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width="min(650px, 96vw)"
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="Promo Coupon Code (alphanumeric)" rules={[{ required: true }]}>
                <Input style={{ borderRadius: 0 }} placeholder="e.g. SUMMER500" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reward_type" label="Discount Class Type" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="percent">Percentage Discount (%)</Select.Option>
                  <Select.Option value="fixed">Fixed Money Discount (৳)</Select.Option>
                  <Select.Option value="freeship">Free Delivery</Select.Option>
                  <Select.Option value="membership">Membership VIP Upgrade</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Internal Campaign Description">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} placeholder="SUMMER500 flash sale 2026..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="discount_value" label="Discount Value (e.g. 10 for 10% or ৳10)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_discount_amount" label="Max Cap Discount (৳ value)">
                <InputNumber min={0} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="min_order_amount" label="Min Order Value trigger (৳)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="membership_tier" label="Membership Tier Grant (optional)">
                <Select placeholder="Choose membership tier" allowClear>
                  <Select.Option value="Silver">Silver Tier</Select.Option>
                  <Select.Option value="Gold">Gold Tier</Select.Option>
                  <Select.Option value="VIP">VIP Tier</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Redemption Constraints</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="total_usage_limit" label="Total Campaign Usage Limit (across all customers)">
                <InputNumber min={1} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="per_customer_limit" label="Usage Limit per customer phone number" initialValue={1}>
                <InputNumber min={1} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="starts_at" label="Starts At Date">
                <DatePicker showTime style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expires_at" label="Expires At Date">
                <DatePicker showTime style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Checkout Banner Highlight</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="banner_url" label="Promo Banner Image URL link">
                <Input style={{ borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="banner_active" label="Display banner active?" valuePropName="checked" initialValue={false}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>
    </Space>
  );
};

export default PromoCodes;


