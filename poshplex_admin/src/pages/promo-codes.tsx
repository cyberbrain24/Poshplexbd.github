import React, { useState, useEffect } from "react";
import {
  Table, Tag, Button, Space, Card, Modal, Form, Input, 
  InputNumber, Select, Switch, Divider, DatePicker, message, Row, Col, Tabs
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined, ThunderboltOutlined, CarOutlined
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_URL = `${SERVER_BASE}/api/v1/marketing/promos`;
const COMBOS_API = `${SERVER_BASE}/api/v1/marketing/admin/combos`;
const CRM_URL = `${SERVER_BASE}/api/v1/crm`;

export const PromoCodes: React.FC = () => {
  // --- Promo Codes State ---
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [form] = Form.useForm();

  // --- Combo Offers State ---
  const [combos, setCombos] = useState<any[]>([]);
  const [combosLoading, setCombosLoading] = useState(false);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [selectedCombo, setSelectedCombo] = useState<any>(null);
  const [comboForm] = Form.useForm();

  // Load active marketing campaigns
  const fetchPromos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPromos(res.data);
    } catch (err: any) { 
      if (err?.response?.status !== 403) message.error("Failed to load promo codes list."); 
    } finally {
      setLoading(false);
    }
  };

  // Load combo offers
  const fetchCombos = async () => {
    setCombosLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(COMBOS_API, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCombos(res.data);
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Failed to load combo offers.");
    } finally {
      setCombosLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
    fetchCombos();
    const fetchTiers = async () => {
      try {
        const token = localStorage.getItem("poshplex_access_token");
        const res = await axios.get(`${CRM_URL}/tiers`, { headers: { Authorization: `Bearer ${token}` } });
        setTiers(res.data);
      } catch (err) { console.error("Failed to fetch CRM tiers", err); }
    };
    fetchTiers();
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

      if (values.is_single_use) {
        payload.total_usage_limit = 1;
        payload.per_customer_limit = 1;
      }

      if (selectedPromo) {
        await axios.put(`${API_URL}/${selectedPromo.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Promo code details updated.");
      } else {
        const codes = payload.code.split(',').map((c: string) => c.trim()).filter(Boolean);
        const results = await Promise.allSettled(codes.map((code: string) => 
          axios.post(API_URL, { ...payload, code }, { headers: { Authorization: `Bearer ${token}` } })
        ));
        
        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');
        
        if (successes.length > 0) {
          message.success(`${successes.length} promo code(s) registered successfully.`);
        }
        if (failures.length > 0) {
          message.error(`${failures.length} promo code(s) failed (likely duplicates).`);
        }
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

  // --- Combo Offer Handlers ---
  const handleSaveCombo = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const perksArray = (values.perks_text || "")
        .split("\n")
        .map((p: string) => p.trim())
        .filter(Boolean);

      const payload = {
        name: values.name,
        items_count: Number(values.items_count),
        discount_percentage: Number(values.discount_percentage),
        free_delivery: Boolean(values.free_delivery),
        badge: values.badge || "",
        subtitle: values.subtitle || "",
        perks: perksArray,
        is_active: values.is_active !== undefined ? values.is_active : true,
        listing_order: Number(values.listing_order || 0)
      };

      if (selectedCombo) {
        await axios.put(`${COMBOS_API}/${selectedCombo.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Combo offer updated successfully.");
      } else {
        await axios.post(COMBOS_API, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Combo offer created successfully.");
      }

      setIsComboModalOpen(false);
      comboForm.resetFields();
      fetchCombos();
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error(err.response?.data?.message || "Failed to save combo offer.");
      }
    }
  };

  const handleToggleComboActive = async (record: any, checked: boolean) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.put(`${COMBOS_API}/${record.id}`, {
        ...record,
        is_active: checked
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Combo offer ${checked ? "Activated" : "Paused"}`);
      fetchCombos();
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Status toggle failed.");
    }
  };

  const handleDeleteCombo = async (id: number) => {
    Modal.confirm({
      title: "Delete Combo Offer",
      content: "Are you sure you want to delete this combo tier? Customers will no longer see it on product pages.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const token = localStorage.getItem("poshplex_access_token");
          await axios.delete(`${COMBOS_API}/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          message.success("Combo offer removed successfully.");
          fetchCombos();
        } catch (err: any) {
          if (err?.response?.status !== 403) message.error("Failed to delete combo offer.");
        }
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

  const tabItems = [
    {
      key: "combos",
      label: (
        <span style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <ThunderboltOutlined style={{ color: "var(--accent-purple)" }} />
          Combo Offers (Buy More & Save)
        </span>
      ),
      children: (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>Multi-Item Bundle Tiers</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                Configure bundle tiers displayed on single product pages (Duo, Trio, 4 Pack, 5 Pack).
              </p>
            </div>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => {
                setSelectedCombo(null);
                comboForm.resetFields();
                comboForm.setFieldsValue({
                  items_count: 2,
                  discount_percentage: 5,
                  free_delivery: false,
                  is_active: true,
                  listing_order: combos.length + 1
                });
                setIsComboModalOpen(true);
              }}
              style={{ borderRadius: 4 }}
            >
              Create Combo Offer
            </Button>
          </div>

          <Table 
            scroll={{ x: 'max-content' }}
            loading={combosLoading}
            dataSource={combos}
            rowKey="id"
            columns={[
              { 
                title: "Order", 
                dataIndex: "listing_order", 
                width: 70,
                render: (val) => <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>#{val}</span> 
              },
              { 
                title: "Combo Name", 
                dataIndex: "name",
                render: (text, record) => (
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)" }}>{text}</span>
                    {record.badge && (
                      <Tag color="purple" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                        {record.badge}
                      </Tag>
                    )}
                    {record.subtitle && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{record.subtitle}</div>
                    )}
                  </div>
                )
              },
              { 
                title: "Bundle Size", 
                dataIndex: "items_count", 
                render: (count) => (
                  <Tag color="cyan" style={{ fontWeight: 600 }}>{count} Products</Tag>
                )
              },
              { 
                title: "Discount", 
                dataIndex: "discount_percentage", 
                render: (pct) => (
                  <Tag color="green" style={{ fontWeight: 700, fontSize: 13 }}>
                    {parseFloat(pct)}% OFF
                  </Tag>
                )
              },
              { 
                title: "Delivery Benefit", 
                dataIndex: "free_delivery", 
                render: (free) => free ? (
                  <Tag color="gold" icon={<CarOutlined />} style={{ fontWeight: 600 }}>
                    FREE DELIVERY
                  </Tag>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Standard Delivery</span>
                )
              },
              {
                title: "Perk Bullets",
                dataIndex: "perks",
                render: (perks: string[]) => (
                  <div style={{ maxWidth: 280, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(perks || []).map((p, idx) => (
                      <Tag key={idx} style={{ fontSize: 11, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)" }}>
                        {p}
                      </Tag>
                    ))}
                  </div>
                )
              },
              { 
                title: "Active Status", 
                dataIndex: "is_active", 
                render: (active, record) => (
                  <Switch checked={active} onChange={(checked) => handleToggleComboActive(record, checked)} />
                )
              },
              {
                title: "Actions",
                key: "actions",
                render: (record: any) => (
                  <Space>
                    <Button 
                      size="small" 
                      icon={<EditOutlined />} 
                      onClick={() => {
                        setSelectedCombo(record);
                        comboForm.setFieldsValue({
                          ...record,
                          discount_percentage: parseFloat(record.discount_percentage),
                          perks_text: (record.perks || []).join("\n")
                        });
                        setIsComboModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="small" 
                      danger 
                      icon={<DeleteOutlined />} 
                      onClick={() => handleDeleteCombo(record.id)}
                    >
                      Remove
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </Card>
      )
    },
    {
      key: "promos",
      label: (
        <span style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <GiftOutlined style={{ color: "var(--accent-purple)" }} />
          Promo Coupon Codes
        </span>
      ),
      children: (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>Campaign Coupon Codes</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                Generate single-use or customer-specific voucher discount codes.
              </p>
            </div>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => { setSelectedPromo(null); setIsModalOpen(true); form.resetFields(); }} 
              style={{ borderRadius: 4 }}
            >
              Create Promo Code
            </Button>
          </div>

          <Table scroll={{ x: 'max-content' }}
            loading={loading}
            dataSource={promos}
            rowKey="id"
            columns={[
              { title: "Campaign Code", dataIndex: "code", render: (c) => <code style={{ color: "var(--accent-purple)", fontWeight: 700 }}>{c}</code> },
              { title: "Reward Type", dataIndex: "reward_type", render: (t) => getRewardTypeTag(t) },
              { title: "Value", dataIndex: "discount_value", render: (val, record) => record.reward_type === "percent" ? `${val}%` : `৳${Math.round(val)}` },
              { title: "Min Spend", dataIndex: "min_order_amount", render: (val) => `৳${Math.round(val)}` },
              { title: "Total Redemptions", dataIndex: "usage_count", render: (count, record) => `${count} / ${record.total_usage_limit || "∞"}` },
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
                        expires_at: record.expires_at ? dayjs(record.expires_at) : null,
                        is_single_use: record.total_usage_limit === 1 && record.per_customer_limit === 1
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
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>Discount Engine</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
            Manage store bundle discount tiers, combo triggers, promotional coupon codes, and customer incentives.
          </p>
        </div>
      </div>

      <Tabs defaultActiveKey="combos" items={tabItems} size="large" />

      {/* --- Combo Offer Modal --- */}
      <Modal
        title={selectedCombo ? "Edit Combo Offer" : "Create New Combo Offer"}
        open={isComboModalOpen}
        onCancel={() => setIsComboModalOpen(false)}
        onOk={() => comboForm.submit()}
        width="min(650px, 96vw)"
      >
        <Form form={comboForm} layout="vertical" onFinish={handleSaveCombo}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="name" label="Combo Tier Name" rules={[{ required: true, message: "Name is required (e.g. Duo, Trio)" }]}>
                <Input placeholder="e.g. Duo, Trio, 4 Pack, 5 Pack" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="items_count" label="Required Items Count" rules={[{ required: true }]}>
                <InputNumber min={2} max={20} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="discount_percentage" label="Discount Percentage (%)" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} style={{ width: "100%" }} placeholder="e.g. 10 for 10% off" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="badge" label="Header Badge (Optional)">
                <Input placeholder="e.g. POPULAR, BEST VALUE" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="subtitle" label="Subtitle Description">
            <Input placeholder="e.g. Mix & Match Any 3 Products From Our Collection" />
          </Form.Item>

          <Form.Item 
            name="perks_text" 
            label="Benefit Bullet Points (One perk per line)"
            extra="These appear with icons on the product page (e.g. 'SAVE Tk 320', 'FREE DELIVERY ALL OVER BANGLADESH', 'Fan Favorite Bundle')"
          >
            <Input.TextArea rows={3} placeholder="SAVE Tk 320&#10;FREE DELIVERY ALL OVER BANGLADESH&#10;Fan Favorite Bundle" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="free_delivery" label="Free Delivery?" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_active" label="Active on Store?" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="listing_order" label="Display Order" initialValue={1}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* --- Promo Code Modal --- */}
      <Modal
        title={selectedPromo ? "Edit Promo Code campaign" : "Create marketing Promo Code"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width="min(650px, 96vw)"
      >
        <Form form={form} name="promo-codesForm" onFinish={handleSave} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="Promo Coupon Code(s) - Use comma for bulk" rules={[{ required: true }]}>
                <Input.TextArea rows={2} style={{ borderRadius: 0 }} placeholder="e.g. SUMMER500, SUMMER501, WINTER10" />
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
                  {tiers.map(t => <Select.Option key={t.id} value={t.name}>{t.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Redemption Constraints</Divider>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="is_single_use" valuePropName="checked">
                <Switch /> <span style={{ marginLeft: 8, fontWeight: 600 }}>Strict Single-Use globally</span>
              </Form.Item>
              <div style={{ fontSize: 12, color: '#888', marginTop: -15, marginBottom: 15 }}>
                If enabled, this code is permanently expired after 1 single order, regardless of customer phone number.
              </div>
            </Col>
          </Row>

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
