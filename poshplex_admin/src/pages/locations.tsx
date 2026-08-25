import React, { useState, useEffect } from "react";
import { 
  Typography, Card, Tabs, Table, Button, Space, Modal, Form, 
  Input, Switch, Select, InputNumber, Popconfirm, message 
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, GlobalOutlined } from "@ant-design/icons";
import axios from "axios";
import { useCan } from "@refinedev/core";

const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

export default function LocationsPage() {
  const { data: canAccess } = useCan({ resource: "orders", action: "edit_orders" });
  const hasAccess = canAccess?.can ?? false;

  const [activeTab, setActiveTab] = useState("districts");
  
  // Data State
  const [districts, setDistricts] = useState<any[]>([]);
  const [thanas, setThanas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State - District
  const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<any>(null);
  const [districtForm] = Form.useForm();

  // Modal State - Thana
  const [isThanaModalOpen, setIsThanaModalOpen] = useState(false);
  const [editingThana, setEditingThana] = useState<any>(null);
  const [thanaForm] = Form.useForm();

  const fetchDistricts = async () => {
    try {
      const res = await axios.get(`${API_URL}/orders/locations/districts`);
      setDistricts(res.data);
    } catch (err) {
      message.error("Failed to load districts");
    }
  };

  const fetchThanas = async () => {
    try {
      const res = await axios.get(`${API_URL}/orders/locations/thanas`);
      setThanas(res.data);
    } catch (err) {
      message.error("Failed to load thanas");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchDistricts(), fetchThanas()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getHeaders = () => {
    const token = localStorage.getItem("poshplex_access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // --- District Handlers ---
  const handleOpenDistrictModal = (record?: any) => {
    setEditingDistrict(record || null);
    if (record) {
      districtForm.setFieldsValue(record);
    } else {
      districtForm.resetFields();
      districtForm.setFieldsValue({ is_active: true });
    }
    setIsDistrictModalOpen(true);
  };

  const handleSaveDistrict = async (values: any) => {
    try {
      if (editingDistrict) {
        await axios.put(`${API_URL}/orders/locations/districts/${editingDistrict.id}`, values, { headers: getHeaders() });
        message.success("District updated successfully");
      } else {
        await axios.post(`${API_URL}/orders/locations/districts`, values, { headers: getHeaders() });
        message.success("District created successfully");
      }
      setIsDistrictModalOpen(false);
      fetchDistricts();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "Failed to save district");
    }
  };

  const handleDeleteDistrict = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/orders/locations/districts/${id}`, { headers: getHeaders() });
      message.success("District deleted successfully");
      fetchDistricts();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "Failed to delete district. It might have active thanas attached.");
    }
  };

  // --- Thana Handlers ---
  const handleOpenThanaModal = (record?: any) => {
    setEditingThana(record || null);
    if (record) {
      thanaForm.setFieldsValue(record);
    } else {
      thanaForm.resetFields();
      thanaForm.setFieldsValue({ is_active: true, shipping_cost: 120 });
    }
    setIsThanaModalOpen(true);
  };

  const handleSaveThana = async (values: any) => {
    try {
      if (editingThana) {
        await axios.put(`${API_URL}/orders/locations/thanas/${editingThana.id}`, values, { headers: getHeaders() });
        message.success("Thana updated successfully");
      } else {
        await axios.post(`${API_URL}/orders/locations/thanas`, values, { headers: getHeaders() });
        message.success("Thana created successfully");
      }
      setIsThanaModalOpen(false);
      fetchThanas();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "Failed to save thanas");
    }
  };

  const handleDeleteThana = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/orders/locations/thanas/${id}`, { headers: getHeaders() });
      message.success("Thana deleted successfully");
      fetchThanas();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "Failed to delete thana");
    }
  };

  // --- Table Columns ---
  const districtColumns = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    { title: "District Name", dataIndex: "name", key: "name" },
    { 
      title: "Status", 
      dataIndex: "is_active", 
      key: "is_active",
      render: (isActive: boolean) => (
        <span style={{ color: isActive ? "var(--accent-cyan)" : "var(--accent-rose)" }}>
          {isActive ? "Active" : "Inactive"}
        </span>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenDistrictModal(record)} disabled={!hasAccess} />
          <Popconfirm title="Delete this district?" onConfirm={() => handleDeleteDistrict(record.id)} disabled={!hasAccess}>
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!hasAccess} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const thanaColumns = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    { title: "Thana Name", dataIndex: "name", key: "name" },
    { title: "District", dataIndex: "district_name", key: "district_name" },
    { 
      title: "Shipping Cost", 
      dataIndex: "shipping_cost", 
      key: "shipping_cost",
      render: (cost: any) => `৳${parseFloat(cost).toFixed(0)}`
    },
    { 
      title: "Status", 
      dataIndex: "is_active", 
      key: "is_active",
      render: (isActive: boolean) => (
        <span style={{ color: isActive ? "var(--accent-cyan)" : "var(--accent-rose)" }}>
          {isActive ? "Active" : "Inactive"}
        </span>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenThanaModal(record)} disabled={!hasAccess} />
          <Popconfirm title="Delete this thana?" onConfirm={() => handleDeleteThana(record.id)} disabled={!hasAccess}>
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!hasAccess} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <GlobalOutlined style={{ color: "var(--accent-purple)" }} /> 
          Locations & Zones
        </Title>
      </div>

      <Card bordered={false} style={{ background: "var(--bg-secondary)", borderRadius: 12 }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: "districts",
              label: "Districts (Divisions)",
              children: (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenDistrictModal()} disabled={!hasAccess}>
                      Add District
                    </Button>
                  </div>
                  <Table 
                    columns={districtColumns} 
                    dataSource={districts} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 15 }}
                    className="custom-dark-table"
                  />
                </div>
              )
            },
            {
              key: "thanas",
              label: "Thanas (Zones)",
              children: (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenThanaModal()} disabled={!hasAccess}>
                      Add Thana
                    </Button>
                  </div>
                  <Table 
                    columns={thanaColumns} 
                    dataSource={thanas} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 15 }}
                    className="custom-dark-table"
                  />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* District Modal */}
      <Modal
        title={editingDistrict ? "Edit District" : "Add District"}
        open={isDistrictModalOpen}
        onCancel={() => setIsDistrictModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={districtForm} layout="vertical" onFinish={handleSaveDistrict}>
          <Form.Item name="name" label="District Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Dhaka" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => setIsDistrictModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Thana Modal */}
      <Modal
        title={editingThana ? "Edit Thana" : "Add Thana"}
        open={isThanaModalOpen}
        onCancel={() => setIsThanaModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={thanaForm} layout="vertical" onFinish={handleSaveThana}>
          <Form.Item name="district_id" label="District" rules={[{ required: true, message: "Please select a district" }]}>
            <Select 
              placeholder="Select District" 
              showSearch 
              optionFilterProp="children"
            >
              {districts.map(d => (
                <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Thana Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Dhanmondi" />
          </Form.Item>
          <Form.Item name="shipping_cost" label="Shipping Cost (৳)" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => setIsThanaModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
