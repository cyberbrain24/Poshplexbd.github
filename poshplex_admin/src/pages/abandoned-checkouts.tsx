import React, { useState, useEffect } from "react";
import {
  Card, Table, Button, Tag, Space, Input, Select, Modal, Form,
  Typography, Row, Col, Statistic, Tooltip, message, Popconfirm, Avatar, Badge
} from "antd";
import {
  PhoneOutlined, WhatsAppOutlined, ShoppingCartOutlined, SyncOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, SearchOutlined,
  UserOutlined, DollarOutlined, ArrowUpOutlined, RocketOutlined, EditOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

interface AbandonedItem {
  id: number;
  session_token: string;
  phone: string;
  customer_name: string;
  customer_email: string;
  shipping_district: string;
  shipping_thana: string;
  shipping_address: string;
  cart_items: any[];
  cart_total: number;
  status: string;
  call_notes: string;
  last_called_at: string | null;
  followup_at: string | null;
  assigned_to_username: string | null;
  converted_order_id: number | null;
  converted_order_number: string | null;
  created_at: string;
  updated_at: string;
}

export const AbandonedCheckoutsPage: React.FC = () => {
  const [items, setItems] = useState<AbandonedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [kpi, setKpi] = useState<any>({
    total_captured: 0,
    pending_count: 0,
    followup_count: 0,
    converted_count: 0,
    declined_count: 0,
    recoverable_value: 0,
    recovered_value: 0,
    conversion_rate: 0,
  });

  // Call Notes Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AbandonedItem | null>(null);
  const [noteForm] = Form.useForm();
  const [savingNote, setSavingNote] = useState(false);

  // Edit Customer Details Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AbandonedItem | null>(null);
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit] = useState(false);
  const [locationRates, setLocationRates] = useState<any[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");

  const fetchAbandonedCheckouts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const params: any = {
        page,
        limit,
        status: activeTab !== "all" ? activeTab : undefined,
        search: searchText.trim() || undefined,
      };

      const res = await axios.get(`${API_BASE}/orders/abandoned/list`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.kpi) {
        setKpi(res.data.kpi);
      }
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error(err.response?.data?.message || "Failed to load abandoned checkouts");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAbandonedCheckouts();
  }, [page, limit, activeTab]);

  useEffect(() => {
    // Load shipping locations (districts and thanas)
    const loadLocations = async () => {
      try {
        const res = await axios.get(`${API_BASE}/orders/shipping-locations/rates`);
        if (res.data?.districts) {
          setLocationRates(res.data.districts);
        }
      } catch (err) {
        console.error("Failed to load shipping locations", err);
      }
    };
    loadLocations();
  }, []);

  const handleSearch = () => {
    setPage(1);
    fetchAbandonedCheckouts();
  };

  const openNoteModal = (record: AbandonedItem) => {
    setSelectedRecord(record);
    noteForm.setFieldsValue({
      status: record.status,
      call_notes: record.call_notes,
    });
    setIsNoteModalOpen(true);
  };

  const openEditModal = (record: AbandonedItem) => {
    setEditingRecord(record);
    setSelectedDistrict(record.shipping_district || "");
    editForm.setFieldsValue({
      customer_name: record.customer_name || "",
      phone: record.phone || "",
      customer_email: record.customer_email || "",
      shipping_district: record.shipping_district || undefined,
      shipping_thana: record.shipping_thana || undefined,
      shipping_address: record.shipping_address || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    try {
      const values = await editForm.validateFields();
      setSavingEdit(true);
      const token = localStorage.getItem("poshplex_access_token");
      await axios.patch(
        `${API_BASE}/orders/abandoned/${editingRecord.id}/details`,
        values,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success("Customer details updated successfully");
      setIsEditModalOpen(false);
      fetchAbandonedCheckouts();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to update details");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedRecord) return;
    try {
      const values = await noteForm.validateFields();
      setSavingNote(true);
      const token = localStorage.getItem("poshplex_access_token");
      await axios.patch(
        `${API_BASE}/orders/abandoned/${selectedRecord.id}/status`,
        values,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success("Call log & status updated successfully");
      setIsNoteModalOpen(false);
      fetchAbandonedCheckouts();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to update status");
    } finally {
      setSavingNote(false);
    }
  };

  const handleConvertToOrder = async (record: AbandonedItem) => {
    // Client-side quick check for missing mandatory checkout details
    const missing: string[] = [];
    if (!record.customer_name?.trim()) missing.push("Full Name");
    if (!record.phone?.trim()) missing.push("Phone Number");
    if (!record.shipping_district?.trim()) missing.push("District");
    if (!record.shipping_thana?.trim()) missing.push("Area (Thana)");
    if (!record.shipping_address?.trim()) missing.push("Delivery Address");

    if (missing.length > 0) {
      Modal.confirm({
        title: "Customer Information Missing",
        content: `Cannot place as COD yet because the following required customer details are missing: ${missing.join(", ")}. Would you like to edit and complete the customer details now?`,
        okText: "Edit Details",
        cancelText: "Close",
        onOk: () => {
          openEditModal(record);
        }
      });
      return;
    }

    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(
        `${API_BASE}/orders/abandoned/${record.id}/convert-to-order`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success(`Order created successfully: #${res.data.order_number || res.data.id}!`);
      fetchAbandonedCheckouts();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.response?.data?.detail || "Failed to convert abandoned checkout to order";
      message.error(errMsg);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Tag color="gold">Pending Call</Tag>;
      case "called_busy":
        return <Tag color="orange">Busy / No Answer</Tag>;
      case "called_followup":
        return <Tag color="blue">Follow-up Needed</Tag>;
      case "converted":
        return <Tag color="green">Converted to Order ✓</Tag>;
      case "declined":
        return <Tag color="red">Declined</Tag>;
      default:
        return <Tag>{status.toUpperCase()}</Tag>;
    }
  };

  const buildWhatsAppLink = (record: AbandonedItem) => {
    const rawPh = record.phone.replace(/\D/g, "");
    let cleanPh = rawPh;
    if (rawPh.startsWith("01")) {
      cleanPh = "88" + rawPh;
    } else if (!rawPh.startsWith("88") && rawPh.length === 11) {
      cleanPh = "88" + rawPh;
    }

    const itemsSummary = record.cart_items?.map(it => `• ${it.product_name} (${it.size || "Standard"}) x${it.quantity}`).join("\n") || "items";
    const text = encodeURIComponent(
      `Hello ${record.customer_name || "there"}, thank you for visiting Poshplex! 👋\n\n` +
      `We noticed you left these items in your bag:\n${itemsSummary}\n\n` +
      `Total: ৳${Math.round(record.cart_total)}\n\n` +
      `Would you like us to confirm and dispatch this order for you via Cash on Delivery? Just reply here and our team will get it delivered!`
    );

    return `https://wa.me/${cleanPh}?text=${text}`;
  };

  const columns = [
    {
      title: "Customer & Contact",
      key: "customer",
      render: (_: any, record: AbandonedItem) => (
        <Space direction="vertical" size={2} style={{ maxWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <Text strong style={{ fontSize: 13, color: "var(--text-main)" }}>
              {record.customer_name || "Guest Customer"}
            </Text>
            <Tooltip title="Edit Customer Details">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined style={{ color: "#a855f7" }} />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
          </div>
          <Space size={6} wrap>
            <Text style={{ fontFamily: "monospace", color: "#10b981", fontWeight: 600 }}>
              {record.phone}
            </Text>
            <a href={`tel:${record.phone}`}>
              <Button size="small" type="text" icon={<PhoneOutlined style={{ color: "#3b82f6" }} />} />
            </a>
            <a href={buildWhatsAppLink(record)} target="_blank" rel="noopener noreferrer">
              <Button size="small" type="text" icon={<WhatsAppOutlined style={{ color: "#22c55e", fontSize: 16 }} />} />
            </a>
          </Space>
          {(record.shipping_district || record.shipping_address) && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.35, marginTop: 2 }}>
              {record.shipping_address && (
                <div style={{ color: "#cbd5e1" }}>🏠 {record.shipping_address}</div>
              )}
              {record.shipping_district && (
                <div style={{ color: "#94a3b8" }}>📍 {record.shipping_district}{record.shipping_thana ? ` • ${record.shipping_thana}` : ""}</div>
              )}
            </div>
          )}
        </Space>
      ),
    },
    {
      title: "Cart Items Snapshot",
      key: "cart",
      render: (_: any, record: AbandonedItem) => (
        <div style={{ maxWidth: 260 }}>
          {record.cart_items?.map((item: any, idx: number) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {item.image && (
                <Avatar shape="square" size={32} src={item.image} style={{ flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <Text style={{ fontSize: 12 }}>{item.product_name}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item.size ? `Size: ${item.size} • ` : ""}Qty: {item.quantity} (৳{Math.round(item.price)})
                  </Text>
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 4, fontWeight: 700, color: "#fff", fontSize: 12 }}>
            Cart Total: ৳{Math.round(record.cart_total)}
          </div>
        </div>
      ),
    },
    {
      title: "Recovery Status",
      key: "status",
      render: (_: any, record: AbandonedItem) => (
        <Space orientation="vertical" size={4}>
          <div>{getStatusBadge(record.status)}</div>
          {record.converted_order_number && (
            <Tag color="cyan">Order #{record.converted_order_number}</Tag>
          )}
          {record.last_called_at && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Called: {new Date(record.last_called_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          {record.assigned_to_username && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Staff: @{record.assigned_to_username}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Call Log / Notes",
      dataIndex: "call_notes",
      key: "call_notes",
      render: (notes: string, record: AbandonedItem) => (
        <div style={{ maxWidth: 200 }}>
          {notes ? (
            <Text style={{ fontSize: 12, color: "#c084fc" }}>{notes}</Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 11, fontStyle: "italic" }}>
              No notes logged yet
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: AbandonedItem) => (
        <Space direction="vertical" size={6}>
          <Button
            size="small"
            onClick={() => openNoteModal(record)}
            style={{ width: "100%", borderRadius: 4 }}
          >
            Log Call Note
          </Button>
          {record.status !== "converted" && (
            <Popconfirm
              title="Convert to Order"
              description={`Create Cash on Delivery order for ${record.customer_name || record.phone} (৳${Math.round(record.cart_total)})?`}
              onConfirm={() => handleConvertToOrder(record)}
              okText="Yes, Create Order"
              cancelText="No"
            >
              <Button
                type="primary"
                size="small"
                icon={<ShoppingCartOutlined />}
                style={{ width: "100%", borderRadius: 4, background: "#10b981", borderColor: "#10b981" }}
              >
                Place as COD
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: "var(--text-main)" }}>
            🛒 Abandoned Checkout Recovery
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            High-intent shoppers who started checkout, entered phone contact, but dropped off before completing payment.
          </Text>
        </div>
        <Button icon={<SyncOutlined />} onClick={fetchAbandonedCheckouts} loading={loading}>
          Refresh Queue
        </Button>
      </div>

      {/* KPI Metric Cards */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card size="small" className="glass-card">
            <Statistic
              title="Recoverable Potential"
              value={`৳${Math.round(kpi.recoverable_value).toLocaleString()}`}
              styles={{ content: { color: "#f59e0b", fontWeight: 700 } }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="glass-card">
            <Statistic
              title="Pending Calls"
              value={kpi.pending_count}
              styles={{ content: { color: "#e11d48", fontWeight: 700 } }}
              prefix={<PhoneOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="glass-card">
            <Statistic
              title="Recovered Revenue"
              value={`৳${Math.round(kpi.recovered_value).toLocaleString()}`}
              styles={{ content: { color: "#10b981", fontWeight: 700 } }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="glass-card">
            <Statistic
              title="Recovery Conversion"
              value={`${kpi.conversion_rate}%`}
              styles={{ content: { color: "#8b5cf6", fontWeight: 700 } }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Status Slider Tabs */}
      <Card styles={{ body: { padding: "12px 14px" } }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Input
            placeholder="Search by phone, customer name, district or notes..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ flex: 1, minWidth: 200, borderRadius: 6 }}
            prefix={<SearchOutlined style={{ color: "#888" }} />}
          />
          <Button type="primary" onClick={handleSearch}>
            Search
          </Button>
        </div>

        {/* Sliding Status Pills */}
        <div 
          className="posh-status-slider-container"
          style={{
            width: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
            scrollbarWidth: "none",
            marginBottom: 14
          }}
        >
          <div 
            className="posh-status-slider-track"
            style={{
              display: "inline-flex",
              gap: 8,
              whiteSpace: "nowrap",
              minWidth: "max-content",
              padding: "4px 2px 8px 2px"
            }}
          >
            {[
              { key: "all", label: "Active Drops", count: kpi.pending_count + kpi.followup_count, color: "#f59e0b" },
              { key: "pending", label: "Pending Call", count: kpi.pending_count, color: "#f59e0b" },
              { key: "called_followup", label: "Follow-up Needed", count: kpi.followup_count, color: "#3b82f6" },
              { key: "declined", label: "Declined / Lost", count: kpi.declined_count, color: "#ef4444" },
            ].map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPage(1);
                  }}
                  className={`posh-status-pill ${isActive ? "posh-status-pill-active" : ""}`}
                >
                  <span>{tab.label}</span>
                  <Badge count={tab.count} overflowCount={9999} color={tab.color} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Table representation */}
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total: total,
            showSizeChanger: true,
            onChange: (p, l) => {
              setPage(p);
              setLimit(l);
            },
          }}
        />
      </Card>

      {/* Log Call Note Modal */}
      <Modal
        title={`Log Call Notes: ${selectedRecord?.customer_name || selectedRecord?.phone}`}
        open={isNoteModalOpen}
        onCancel={() => setIsNoteModalOpen(false)}
        onOk={handleSaveNote}
        confirmLoading={savingNote}
        okText="Save Call Log"
      >
        <Form form={noteForm} layout="vertical">
          <Form.Item name="status" label="Recovery Outcome / Status" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="pending">Pending Call</Select.Option>
              <Select.Option value="called_busy">Called - No Answer / Busy</Select.Option>
              <Select.Option value="called_followup">Follow-up Needed</Select.Option>
              <Select.Option value="converted">Converted to Order</Select.Option>
              <Select.Option value="declined">Declined / Lost</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="call_notes" label="Tele-sales Conversation Notes">
            <Input.TextArea
              rows={4}
              placeholder="e.g. Customer requested call at 8 PM, or hesitant about delivery charge outside Dhaka..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Customer Details Modal */}
      <Modal
        title={`Edit Customer Details (${editingRecord?.customer_name || editingRecord?.phone})`}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={handleSaveEdit}
        confirmLoading={savingEdit}
        okText="Save Details"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="customer_name"
            label="Full Name"
            rules={[{ required: true, message: "Please enter customer full name" }]}
          >
            <Input placeholder="e.g. Rahman Ahmed" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[
              { required: true, message: "Phone number is required" },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  const digits = value.replace(/\D/g, "");
                  const clean = digits.startsWith("88") ? digits.slice(2) : digits;
                  if (clean.startsWith("01") && clean.length === 11) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Please provide a valid 11-digit Bangladeshi mobile number starting with 01 (e.g., 017XXXXXXXX)."));
                }
              }
            ]}
          >
            <Input placeholder="01XXXXXXXXX" />
          </Form.Item>
          <Form.Item name="customer_email" label="Email Address">
            <Input type="email" placeholder="customer@example.com (optional)" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="shipping_district"
                label="District"
                rules={[{ required: true, message: "Please select a District" }]}
              >
                <Select
                  showSearch
                  placeholder="Select district"
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    String(option?.children ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(val) => {
                    setSelectedDistrict(val);
                    editForm.setFieldsValue({ shipping_thana: undefined });
                  }}
                >
                  {locationRates.map((d: any) => (
                    <Select.Option key={d.name} value={d.name}>
                      {d.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="shipping_thana"
                label="Thana / Police Station"
                rules={[{ required: true, message: "Please select Area (Thana)" }]}
              >
                <Select
                  showSearch
                  placeholder={selectedDistrict ? "Select thana" : "Select district first"}
                  disabled={!selectedDistrict}
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    String(option?.children ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {locationRates
                    .find((d: any) => d.name === selectedDistrict)
                    ?.thanas?.map((t: string) => (
                      <Select.Option key={t} value={t}>
                        {t}
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="shipping_address"
            label="Street / House / Delivery Address"
            rules={[{ required: true, message: "Please provide delivery address" }]}
          >
            <Input.TextArea rows={3} placeholder="House 12, Road 4, Sector 7..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AbandonedCheckoutsPage;
