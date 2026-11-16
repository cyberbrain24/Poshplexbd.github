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

  // Full list of granular admin panel modules & features available for role assignment
  const MODULE_DEFINITIONS = [
    // 1. Executive Analytics
    { key: "report", category: "Analytics & Executive", label: "Sales Reports", description: "Executive revenue metrics, sales charts, and performance reports" },
    { key: "order_analytics", category: "Analytics & Executive", label: "Order Analytics", description: "Hourly traffic breakdown, repeat-customer insights, and geo-density" },

    // 2. Orders & Operations
    { key: "orders", category: "Operations & Queues", label: "Orders Queue", description: "Order listing, order creation, order detail drawer, and status transitions" },
    { key: "abandoned_checkouts", category: "Operations & Queues", label: "Abandoned Queue", description: "Abandoned cart checkout recovery, customer tele-sales calling logs" },
    { key: "printing", category: "Operations & Queues", label: "Printing Queue", description: "Production print batches, print sheet PDFs, and garment design artwork files" },
    { key: "fulfillment", category: "Operations & Queues", label: "Fulfillment Queue", description: "Dispatch manifests, Steadfast API parcel booking, and courier tracking" },

    // 3. Customers & Catalog
    { key: "crm", category: "Customer & Catalog", label: "CRM Profiles", description: "Customer relationship directory, order histories, call logs, and blacklist control" },
    { key: "catalog", category: "Customer & Catalog", label: "Catalog Manager", description: "Products, categories, color/size variants, pricing, and stock management" },
    { key: "media", category: "Customer & Catalog", label: "Media Library", description: "Central R2 asset manager, image CDN uploads, and product galleries" },

    // 4. Marketing & Growth
    { key: "promo_codes", category: "Marketing & Growth", label: "Discount Engine", description: "Coupon codes, percentage/fixed discounts, and usage limits" },
    { key: "marketing", category: "Marketing & Growth", label: "Meta Engine", description: "Meta ads optimization, AI marketing agent, competitor spy, and ad automations" },

    // 5. Finance & Workflow
    { key: "finance", category: "Finance & Collaboration", label: "Financial Ledger", description: "Double-entry accounting, bank reconciliation, expense and revenue accounts" },
    { key: "tasks", category: "Finance & Collaboration", label: "Task Management", description: "Internal staff to-do cards, team assignments, and task priorities" },
    { key: "music", category: "Finance & Collaboration", label: "Music Library", description: "Storefront ambient music player tracklist, uploads, and master audio switch" },

    // 6. Settings & Administration
    { key: "settings", category: "System Administration", label: "Site Settings", description: "Storefront banners, contact details, announcement bars, and general config" },
    { key: "locations", category: "System Administration", label: "Locations & Zones", description: "Districts, thanas, shipping delivery fees, and inside/outside Dhaka zones" },
    { key: "staff", category: "System Administration", label: "Staff Profiles", description: "Internal staff user accounts, team member logins, and profile credentials" },
    { key: "roles", category: "System Administration", label: "Roles & Permissions", description: "Role matrix definitions, staff privilege assignment, and access control" },
    { key: "integrations", category: "System Administration", label: "Integration Setup", description: "Courier APIs (Steadfast, Pathao), SMS gateways, payment gateways, and webhooks" },
    { key: "system_monitor", category: "System Administration", label: "System Monitor", description: "Server CPU/RAM/Disk stats, container statuses, and unified error logs" },
    { key: "core", category: "System Administration", label: "Core System Admin", description: "Superuser fallback and fundamental administrative privileges" },
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
      // Ensure all granular module keys are initialized in form values
      const initialPerms = { ...record.permissions };
      MODULE_DEFINITIONS.forEach(m => {
        if (!initialPerms[m.key]) {
          // If parent module permission exists, inherit it for the granular feature
          const parentKey = 
            ["abandoned_checkouts", "printing", "fulfillment", "order_analytics", "locations"].includes(m.key) ? "orders" :
            ["promo_codes"].includes(m.key) ? "marketing" :
            ["settings", "staff", "roles", "integrations", "system_monitor"].includes(m.key) ? "core" : null;
          
          if (parentKey && initialPerms[parentKey]) {
            initialPerms[m.key] = { ...initialPerms[parentKey] };
          } else {
            initialPerms[m.key] = { view: false, create: false, edit: false, delete: false };
          }
        }
      });
      form.setFieldsValue({ ...record, permissions: initialPerms });
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
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Title level={5} style={{ margin: 0 }}>Permissions Matrix</Title>
            <Space>
              <Button
                size="small"
                onClick={() => {
                  const currentVals = form.getFieldsValue();
                  const perms = { ...currentVals.permissions };
                  MODULE_DEFINITIONS.forEach(m => {
                    perms[m.key] = { view: true, create: true, edit: true, delete: true };
                  });
                  form.setFieldsValue({ permissions: perms });
                }}
              >
                Select All
              </Button>
              <Button
                size="small"
                onClick={() => {
                  const currentVals = form.getFieldsValue();
                  const perms = { ...currentVals.permissions };
                  MODULE_DEFINITIONS.forEach(m => {
                    perms[m.key] = { view: false, create: false, edit: false, delete: false };
                  });
                  form.setFieldsValue({ permissions: perms });
                }}
              >
                Clear All
              </Button>
            </Space>
          </div>
          <Table 
            dataSource={MODULE_DEFINITIONS}
            rowKey="key"
            pagination={false}
            scroll={{ y: 440 }}
            columns={[
              {
                title: "Module / Feature",
                dataIndex: "label",
                render: (_, r) => (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <strong style={{ fontSize: 13, color: "var(--text-main)" }}>{r.label}</strong>
                      <span style={{ fontSize: 10, color: "var(--accent-purple)", backgroundColor: "rgba(139, 92, 246, 0.1)", padding: "1px 6px", borderRadius: 4 }}>
                        {r.category}
                      </span>
                    </div>
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
