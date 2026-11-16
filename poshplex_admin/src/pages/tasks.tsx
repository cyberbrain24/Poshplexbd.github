import React, { useState, useEffect } from "react";
import {
  Table, Button, Space, Card, Modal, Form, Input, Tabs, Select, Tag, Popconfirm, App,
  Collapse, Typography, Badge, Empty, Tooltip
} from "antd";
import {
  CheckSquareOutlined, DeleteOutlined, PlusOutlined, CheckOutlined, EditOutlined,
  FolderAddOutlined, CaretRightOutlined, TagOutlined, FolderOutlined
} from "@ant-design/icons";
import axios from "axios";
import { useCan, useGetIdentity } from "@refinedev/core";

const { Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || ((import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1");

interface TaskCategory {
  id: number;
  name: string;
  color: string;
  task_count?: number;
}

interface Task {
  id: number;
  title: string;
  description: string;
  category_id?: number | null;
  category_name?: string | null;
  category_color?: string | null;
  assignee_id: number;
  assignee_username: string;
  created_by_username: string;
  status: string;
  completion_comment: string;
  created_at: string;
  completed_at: string;
}

const TasksPage: React.FC = () => {
  const { message } = App.useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>("all");

  // Task Create/Edit Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Category Create Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm] = Form.useForm();
  const [savingCategory, setSavingCategory] = useState(false);

  // Complete Modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeForm] = Form.useForm();
  const [completingTask, setCompletingTask] = useState<Task | null>(null);

  const token = localStorage.getItem("poshplex_access_token");
  const { data: user } = useGetIdentity<{ id: number, username: string }>();

  // RBAC checks
  const { data: canCreate } = useCan({ resource: "tasks", action: "create" });
  const { data: canEdit } = useCan({ resource: "tasks", action: "edit" });
  const { data: canDelete } = useCan({ resource: "tasks", action: "delete" });

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data || []);
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        console.error("Failed to fetch task categories", err);
      }
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/tasks/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data || []);
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Failed to fetch tasks.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    if (canCreate?.can) {
      try {
        const res = await axios.get(`${API_BASE}/core/staff`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStaff(res.data);
      } catch (err: any) {
        if (err?.response?.status !== 403) message.error("Failed to load staff list.");
      }
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchTasks();
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [canCreate?.can]);

  const handleCreateOrEdit = async (values: any) => {
    try {
      if (editingTask) {
        await axios.put(`${API_BASE}/tasks/${editingTask.id}`, values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Task updated successfully!");
      } else {
        await axios.post(`${API_BASE}/tasks/`, values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Task created and assigned successfully!");
      }
      setIsCreateModalOpen(false);
      createForm.resetFields();
      setEditingTask(null);
      fetchTasks();
      fetchCategories();
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Failed to save task.");
    }
  };

  const handleCreateCategory = async (values: any) => {
    try {
      setSavingCategory(true);
      await axios.post(`${API_BASE}/tasks/categories`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Task category created successfully!");
      setIsCategoryModalOpen(false);
      categoryForm.resetFields();
      fetchCategories();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to create category.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_BASE}/tasks/categories/${catId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Category deleted.");
      if (activeCategoryKey === String(catId)) {
        setActiveCategoryKey("all");
      }
      fetchCategories();
      fetchTasks();
    } catch (err: any) {
      message.error("Failed to delete category.");
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    createForm.setFieldsValue({
      title: task.title,
      description: task.description,
      category_id: task.category_id || undefined,
      assignee_id: task.assignee_id
    });
    setIsCreateModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    createForm.resetFields();
    if (activeCategoryKey !== "all" && activeCategoryKey !== "uncategorized") {
      createForm.setFieldsValue({ category_id: Number(activeCategoryKey) });
    }
    setIsCreateModalOpen(true);
  };

  const openCompleteModal = (task: Task) => {
    setCompletingTask(task);
    completeForm.resetFields();
    setIsCompleteModalOpen(true);
  };

  const handleComplete = async (values: any) => {
    if (!completingTask) return;
    try {
      await axios.put(`${API_BASE}/tasks/${completingTask.id}/complete`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Task marked as completed!");
      setIsCompleteModalOpen(false);
      fetchTasks();
      fetchCategories();
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Failed to complete task.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Task deleted.");
      fetchTasks();
      fetchCategories();
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Failed to delete task.");
    }
  };

  // Filter tasks by active category tab
  const categoryTasks = tasks.filter(task => {
    if (activeCategoryKey === "all") return true;
    if (activeCategoryKey === "uncategorized") return !task.category_id;
    return String(task.category_id) === activeCategoryKey;
  });

  const pendingTasks = categoryTasks.filter(t => t.status === "pending");
  const completedTasks = categoryTasks.filter(t => t.status === "completed");

  const pendingColumns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: Task) => (
        <Space orientation="vertical" size={2}>
          <Text strong style={{ color: "#fff", fontSize: 13 }}>{text}</Text>
          {record.category_name && (
            <Tag color={record.category_color || "blue"} style={{ fontSize: 11, borderRadius: 3 }}>
              {record.category_name}
            </Tag>
          )}
        </Space>
      )
    },
    { title: "Description", dataIndex: "description", key: "description", ellipsis: true },
    {
      title: "Assignee",
      dataIndex: "assignee_username",
      key: "assignee_username",
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    { title: "Assigned By", dataIndex: "created_by_username", key: "created_by_username" },
    {
      title: "Date",
      key: "date",
      render: (_: any, record: Task) => (
        <span style={{ fontSize: "12px", color: "gray" }}>
          {new Date(record.created_at).toLocaleString()}
        </span>
      )
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Task) => (
        <Space>
          <Button 
            type="primary" 
            icon={<CheckOutlined />} 
            onClick={() => openCompleteModal(record)}
            size="small"
            style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}
          >
            Complete
          </Button>
          {(canEdit?.can || canCreate?.can) && (
            <Button icon={<EditOutlined />} onClick={() => openEditModal(record)} size="small" />
          )}
          {canDelete?.can && (
            <Popconfirm title="Delete task?" onConfirm={() => handleDelete(record.id)}>
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const completedColumns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: Task) => (
        <Space orientation="vertical" size={2}>
          <Text delete strong style={{ color: "#9ca3af", fontSize: 13 }}>{text}</Text>
          {record.category_name && (
            <Tag color={record.category_color || "default"} style={{ fontSize: 11, borderRadius: 3 }}>
              {record.category_name}
            </Tag>
          )}
        </Space>
      )
    },
    { title: "Description", dataIndex: "description", key: "description", ellipsis: true },
    {
      title: "Assignee",
      dataIndex: "assignee_username",
      key: "assignee_username",
      render: (text: string) => <Tag color="default">{text}</Tag>
    },
    { title: "Assigned By", dataIndex: "created_by_username", key: "created_by_username" },
    {
      title: "Completed At",
      key: "completed_at",
      render: (_: any, record: Task) => (
        <span style={{ fontSize: "12px", color: "gray" }}>
          {record.completed_at ? new Date(record.completed_at).toLocaleString() : new Date(record.created_at).toLocaleString()}
        </span>
      )
    },
    {
      title: "Completion Comment",
      dataIndex: "completion_comment",
      key: "completion_comment",
      render: (text: string) => (
        <span style={{ fontStyle: "italic", color: "#a78bfa", fontSize: 12 }}>
          {text || "No comment"}
        </span>
      )
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Task) => (
        <Space>
          {canDelete?.can && (
            <Popconfirm title="Delete completed task?" onConfirm={() => handleDelete(record.id)}>
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  // Build Category tabs
  const tabItems = [
    {
      key: "all",
      label: (
        <span>
          <FolderOutlined style={{ marginRight: 6 }} />
          All Tasks
          <Badge
            count={tasks.filter(t => t.status === "pending").length}
            style={{ marginLeft: 8, backgroundColor: "#8b5cf6" }}
          />
        </span>
      )
    },
    ...categories.map(cat => ({
      key: String(cat.id),
      label: (
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <Tag color={cat.color || "blue"} style={{ margin: "0 6px 0 0", padding: "0 4px", fontSize: 10 }}>
            ●
          </Tag>
          {cat.name}
          <Badge
            count={tasks.filter(t => t.status === "pending" && t.category_id === cat.id).length}
            style={{ marginLeft: 8, backgroundColor: cat.color || "#3b82f6" }}
          />
          {canDelete?.can && (
            <Popconfirm
              title={`Delete "${cat.name}" category?`}
              description="Tasks under this category will become Uncategorized."
              onConfirm={(e) => handleDeleteCategory(cat.id, e as any)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined style={{ fontSize: 11, color: "#9ca3af" }} />}
                style={{ marginLeft: 6, padding: 0, height: "auto" }}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          )}
        </span>
      )
    })),
    ...(tasks.some(t => !t.category_id)
      ? [{
          key: "uncategorized",
          label: (
            <span>
              Uncategorized
              <Badge
                count={tasks.filter(t => t.status === "pending" && !t.category_id).length}
                style={{ marginLeft: 8, backgroundColor: "#6b7280" }}
              />
            </span>
          )
        }]
      : [])
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2><CheckSquareOutlined /> Task Management</h2>
        <Space wrap>
          {canCreate?.can && (
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => {
                categoryForm.resetFields();
                setIsCategoryModalOpen(true);
              }}
              style={{ borderRadius: 6, background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)" }}
            >
              + Add Category
            </Button>
          )}
          {canCreate?.can && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
              style={{ borderRadius: 6, background: "#8b5cf6", borderColor: "#8b5cf6" }}
            >
              Assign Task
            </Button>
          )}
        </Space>
      </div>

      <Card className="glass-card" style={{ borderRadius: 8 }}>
        {/* Category Tabs */}
        <Tabs 
          activeKey={activeCategoryKey} 
          onChange={setActiveCategoryKey}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        {/* Section 1: Pending Tasks Table */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text strong style={{ fontSize: 14, color: "#e2e8f0" }}>
              ⏳ Pending Tasks ({pendingTasks.length})
            </Text>
          </div>
          <Table
            dataSource={pendingTasks}
            columns={pendingColumns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="No pending tasks in this category." /> }}
          />
        </div>

        {/* Section 2: Completed Tasks Collapsible Box */}
        <Collapse
          ghost
          bordered={false}
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 8,
            overflow: "hidden"
          }}
          expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} style={{ color: "#8b5cf6" }} />}
          items={[
            {
              key: "completed-tasks-collapse",
              label: (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: 8 }}>
                  <Space>
                    <CheckOutlined style={{ color: "#10b981" }} />
                    <Text strong style={{ color: "#9ca3af", fontSize: 13 }}>
                      Completed Tasks Archive
                    </Text>
                  </Space>
                  <Badge
                    count={completedTasks.length}
                    style={{ backgroundColor: completedTasks.length > 0 ? "#10b981" : "#4b5563" }}
                  />
                </div>
              ),
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Table
                    dataSource={completedTasks}
                    columns={completedColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="No completed tasks in this category yet." /> }}
                  />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* Assign / Edit Task Modal */}
      <Modal
        title={editingTask ? "Edit Task" : "Assign New Task"}
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          setEditingTask(null);
        }}
        onOk={() => createForm.submit()}
        okText={editingTask ? "Save Task" : "Assign Task"}
      >
        <Form form={createForm} name="taskCreateForm" layout="vertical" onFinish={handleCreateOrEdit}>
          <Form.Item name="title" label="Task Title" rules={[{ required: true, message: "Please enter a task title" }]}>
            <Input placeholder="e.g. Update Hero Banners, Reconcile Return Invoices..." />
          </Form.Item>
          <Form.Item name="category_id" label="Task Category (Optional)">
            <Select placeholder="Select category" allowClear>
              {categories.map(cat => (
                <Select.Option key={cat.id} value={cat.id}>
                  <Tag color={cat.color || "blue"} style={{ marginRight: 6 }}>●</Tag>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Provide details, deliverables, and instructions..." />
          </Form.Item>
          <Form.Item name="assignee_id" label="Assign To" rules={[{ required: true, message: "Please choose an assignee" }]}>
            <Select placeholder="Select staff member">
              {staff.map(s => (
                <Select.Option key={s.user_id} value={s.user_id}>
                  {s.username} {s.role_name ? `(${s.role_name})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Task Category Modal */}
      <Modal
        title="Create New Task Category"
        open={isCategoryModalOpen}
        onCancel={() => setIsCategoryModalOpen(false)}
        onOk={() => categoryForm.submit()}
        confirmLoading={savingCategory}
        okText="Create Category"
      >
        <Form form={categoryForm} layout="vertical" onFinish={handleCreateCategory}>
          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: "Please enter category name" }]}
          >
            <Input placeholder="e.g. Operations, Design, Marketing, Catalog, Tech..." />
          </Form.Item>
          <Form.Item
            name="color"
            label="Category Color Tag"
            initialValue="#8b5cf6"
          >
            <Select>
              <Select.Option value="#8b5cf6"><Tag color="#8b5cf6">Purple</Tag></Select.Option>
              <Select.Option value="#3b82f6"><Tag color="#3b82f6">Blue</Tag></Select.Option>
              <Select.Option value="#10b981"><Tag color="#10b981">Green</Tag></Select.Option>
              <Select.Option value="#f59e0b"><Tag color="#f59e0b">Amber / Orange</Tag></Select.Option>
              <Select.Option value="#ef4444"><Tag color="#ef4444">Red</Tag></Select.Option>
              <Select.Option value="#ec4899"><Tag color="#ec4899">Pink</Tag></Select.Option>
              <Select.Option value="#06b6d4"><Tag color="#06b6d4">Cyan</Tag></Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Complete Task Modal */}
      <Modal
        title="Complete Task"
        open={isCompleteModalOpen}
        onCancel={() => setIsCompleteModalOpen(false)}
        onOk={() => completeForm.submit()}
        okText="Confirm Completed"
      >
        <Form form={completeForm} name="taskCompleteForm" layout="vertical" onFinish={handleComplete}>
          <p>Mark <strong>{completingTask?.title}</strong> as completed?</p>
          <Form.Item name="comment" label="Completion Comment (Optional)">
            <Input.TextArea rows={3} placeholder="Add a comment about the completion..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TasksPage;
