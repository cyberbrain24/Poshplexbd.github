import React, { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, Checkbox, message, Typography, Card, Space } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import axios from "axios";
import { useCan } from "@refinedev/core";
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";

const { Title } = Typography;

export const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: canCreate } = useCan({ resource: "core", action: "create" });
  const { data: canDelete } = useCan({ resource: "core", action: "delete" });

  // [TEMPORARY DISCONNECT] "music" temporarily removed from active UI list while module is disconnected
  const MODULE_DEFINITIONS = [
    { key: "report", label: "Sales Reports", description: "Executive sales KPIs, revenue analytics, and performance reports" },
    { key: "orders", label: "Orders & Queues", description: "Orders queue, abandoned checkouts recovery, printing & fulfillment queues" },
    { key: "crm", label: "CRM Profiles", description: "Customer relationship directory, call logs, and customer profiles" },
    { key: "catalog", label: "Catalog Manager", description: "Products, categories, variants, inventory, and printing files" },
    { key: "marketing", label: "Marketing & Discounts", description: "Discount coupons, Meta ads optimization engine, AI marketing agent & rules" },
    { key: "tasks", label: "Task Management", description: "Team task boards, internal staff to-dos, and assignment queues" },
    { key: "finance", label: "Financial Ledger", description: "Double-entry bookkeeping, revenue/expense accounts, and cash flow" },
    { key: "media", label: "Media Library", description: "Central R2 asset manager, image CDN uploads, and product galleries" },
    { key: "core", label: "System & Settings", description: "General settings, staff accounts, roles & permissions, zones, and integrations" },
  ];

  const modules = MODULE_DEFINITIONS.map(m => m.key);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}/core/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoles(res.data);
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to load roles"); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleOpen = (record?: any) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue(record);
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.delete(`${API_URL}/core/roles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Role deleted");
      fetchRoles();
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.detail || "Failed to delete"); }
  };

    const handleSave = async (values: any) => {
      try {
        const token = localStorage.getItem("poshplex_access_token");
        const url = `${API_URL}/core/roles` + (editingId ? `/${editingId}` : "");
        const method = editingId ? "put" : "post";
        
        // Ensure permissions is a complete boolean matrix
        const fullPermissions: any = {};
        modules.forEach(m => {
          fullPermissions[m] = {
            view: !!values.permissions?.[m]?.view,
            create: !!values.permissions?.[m]?.create,
            edit: !!values.permissions?.[m]?.edit,
            delete: !!values.permissions?.[m]?.delete,
          };
        });
        const payload = { ...values, permissions: fullPermissions };
        
        await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Role saved");
      setIsModalVisible(false);
      fetchRoles();
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.detail || "Failed to save"); }
  };

  const columns = [
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Description", dataIndex: "description", key: "description" },
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
        <Title level={4}>Roles & Permissions</Title>
        {canCreate?.can && <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Create Role</Button>}
      </div>
      <Table dataSource={roles} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editingId ? "Edit Role" : "Create Role"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width="min(800px, 96vw)"
      >
        <Form form={form} name="rolesForm" layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Role Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
          
          <Title level={5}>Permissions Matrix</Title>
          <Table 
            dataSource={MODULE_DEFINITIONS}
            rowKey="key"
            pagination={false}
            columns={[
              {
                title: "Module",
                dataIndex: "label",
                render: (_, r) => (
                  <div>
                    <strong style={{ fontSize: 13, color: "var(--text-main)" }}>{r.label}</strong>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{r.description}</div>
                  </div>
                )
              },
              { title: "View", key: "view", width: 70, align: "center", render: (_, r) => (
                <Form.Item name={["permissions", r.key, "view"]} valuePropName="checked" noStyle>
                  <Checkbox />
                </Form.Item>
              )},
              { title: "Create", key: "create", width: 70, align: "center", render: (_, r) => (
                <Form.Item name={["permissions", r.key, "create"]} valuePropName="checked" noStyle>
                  <Checkbox />
                </Form.Item>
              )},
              { title: "Edit", key: "edit", width: 70, align: "center", render: (_, r) => (
                <Form.Item name={["permissions", r.key, "edit"]} valuePropName="checked" noStyle>
                  <Checkbox />
                </Form.Item>
              )},
              { title: "Delete", key: "delete", width: 70, align: "center", render: (_, r) => (
                <Form.Item name={["permissions", r.key, "delete"]} valuePropName="checked" noStyle>
                  <Checkbox />
                </Form.Item>
              )}
            ]}
          />
        </Form>
      </Modal>
    </Card>
  );
};
export default RolesPage;
