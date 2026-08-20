import React, { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, Select, message, Typography, Card, Space } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import axios from "axios";
import { useCan } from "@refinedev/core";
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

const { Title } = Typography;

export const StaffPage: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: canCreate } = useCan({ resource: "core", action: "create" });
  const { data: canDelete } = useCan({ resource: "core", action: "delete" });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}/core/staff`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(res.data);
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to load staff"); } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}/core/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoles(res.data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchStaff();
    fetchRoles();
  }, []);

  const handleOpen = (record?: any) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue({ ...record, password: "" });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.delete(`${API_URL}/core/staff/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Staff member deleted");
      fetchStaff();
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.detail || "Failed to delete"); }
  };

  const handleSave = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const url = `${API_URL}/core/staff` + (editingId ? `/${editingId}` : "");
      const method = editingId ? "put" : "post";
      
      await axios[method](url, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Staff saved");
      setIsModalVisible(false);
      fetchStaff();
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.detail || "Failed to save"); }
  };

  const columns = [
    { title: "Username", dataIndex: "username", key: "username" },
    { title: "Role", dataIndex: "role_name", key: "role_name" },
    { title: "Notes", dataIndex: "internal_notes", key: "internal_notes" },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: any) => (
        <Space>
          {canCreate?.can && <Button icon={<EditOutlined />} onClick={() => handleOpen(record)} />}
          {canDelete?.can && <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />}
        </Space>
      )
    }
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Staff Profiles</Title>
        {canCreate?.can && <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Create Staff</Button>}
      </div>
      <Table dataSource={staff} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editingId ? "Edit Staff" : "Create Staff"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label={editingId ? "New Password (Optional)" : "Password"} rules={[{ required: !editingId }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role_id" label="Role" rules={[{ required: true }]}>
            <Select>
              {roles.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="internal_notes" label="Internal Notes">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
export default StaffPage;
