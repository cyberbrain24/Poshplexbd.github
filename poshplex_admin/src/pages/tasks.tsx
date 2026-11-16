import React, { useState, useEffect } from "react";
import {
  Button, Space, Card, Modal, Form, Input, Tabs, Select, Tag, Popconfirm, App,
  Collapse, Typography, Badge, Empty, Tooltip, Dropdown
} from "antd";
import {
  CheckSquareOutlined, DeleteOutlined, PlusOutlined, CheckOutlined, EditOutlined,
  UserAddOutlined, CaretRightOutlined, TagOutlined, TeamOutlined, UserOutlined,
  CloseCircleOutlined, EyeOutlined, ClockCircleOutlined, UserSwitchOutlined
} from "@ant-design/icons";
import axios from "axios";
import { useCan, useGetIdentity } from "@refinedev/core";

const { Text, Paragraph } = Typography;

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
  const [activeAssigneeKey, setActiveAssigneeKey] = useState<string>("");

  // Custom added assignee IDs tracked in state & localStorage
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("poshplex_task_assignee_tabs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Task Create/Edit Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Task View Details Modal
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Add Assignee Tab Modal
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
  const [assigneeForm] = Form.useForm();

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
        setStaff(res.data || []);
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

  // Compile list of unique assignees:
  const assigneeMap = new Map<number, { id: number; name: string; role?: string }>();

  // 1. From staff list
  staff.forEach(s => {
    assigneeMap.set(s.user_id, {
      id: s.user_id,
      name: s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : s.username,
      role: s.role_name
    });
  });

  // 2. From tasks
  tasks.forEach(t => {
    if (t.assignee_id && !assigneeMap.has(t.assignee_id)) {
      assigneeMap.set(t.assignee_id, {
        id: t.assignee_id,
        name: t.assignee_username
      });
    }
  });

  // Unique assignee IDs to show as tabs:
  const activeStaffIds = new Set<number>();
  tasks.forEach(t => {
    if (t.assignee_id) activeStaffIds.add(t.assignee_id);
  });
  selectedAssigneeIds.forEach(id => activeStaffIds.add(id));

  // Determine and set default activeAssigneeKey to specific assignee tab by default (not "all")
  useEffect(() => {
    if (!activeAssigneeKey && activeStaffIds.size > 0) {
      // Priority 1: Check if current logged-in user is one of the active assignees
      if (user?.id && activeStaffIds.has(user.id)) {
        setActiveAssigneeKey(String(user.id));
      } else {
        // Priority 2: Pick the first available assignee
        const firstId = Array.from(activeStaffIds)[0];
        setActiveAssigneeKey(String(firstId));
      }
    }
  }, [activeStaffIds.size, user?.id]);

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

        if (values.assignee_id && !selectedAssigneeIds.includes(values.assignee_id)) {
          const updated = [...selectedAssigneeIds, values.assignee_id];
          setSelectedAssigneeIds(updated);
          localStorage.setItem("poshplex_task_assignee_tabs", JSON.stringify(updated));
        }
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

  const handleAddAssigneeTab = (values: { staff_id: number }) => {
    const staffId = values.staff_id;
    if (!selectedAssigneeIds.includes(staffId)) {
      const updated = [...selectedAssigneeIds, staffId];
      setSelectedAssigneeIds(updated);
      localStorage.setItem("poshplex_task_assignee_tabs", JSON.stringify(updated));
    }
    setActiveAssigneeKey(String(staffId));
    setIsAssigneeModalOpen(false);
    assigneeForm.resetFields();
    message.success("Assignee tab added!");
  };

  const handleRemoveAssigneeTab = (staffId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = selectedAssigneeIds.filter(id => id !== staffId);
    setSelectedAssigneeIds(updated);
    localStorage.setItem("poshplex_task_assignee_tabs", JSON.stringify(updated));
    if (activeAssigneeKey === String(staffId)) {
      const remaining = Array.from(activeStaffIds).filter(id => id !== staffId);
      setActiveAssigneeKey(remaining.length > 0 ? String(remaining[0]) : "all");
    }
    message.info("Assignee tab removed from view.");
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
    if (activeAssigneeKey && activeAssigneeKey !== "all") {
      createForm.setFieldsValue({ assignee_id: Number(activeAssigneeKey) });
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

  // Filter tasks by active assignee tab
  const filteredTasks = tasks.filter(task => {
    if (!activeAssigneeKey || activeAssigneeKey === "all") return true;
    return String(task.assignee_id) === activeAssigneeKey;
  });

  const pendingTasks = filteredTasks.filter(t => t.status === "pending");
  const completedTasks = filteredTasks.filter(t => t.status === "completed");

  // Build Assignee tabs: Each individual assignee tab first, and optionally "All Assignees" at the end
  const tabItems = [
    ...Array.from(activeStaffIds).map(staffId => {
      const staffInfo = assigneeMap.get(staffId);
      const name = staffInfo ? staffInfo.name : `Staff #${staffId}`;
      const pendingCount = tasks.filter(t => t.status === "pending" && t.assignee_id === staffId).length;

      return {
        key: String(staffId),
        label: (
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <UserOutlined style={{ marginRight: 6, color: "#a78bfa" }} />
            {name}
            <Badge
              count={pendingCount}
              style={{ marginLeft: 8, backgroundColor: pendingCount > 0 ? "#8b5cf6" : "#4b5563" }}
            />
            {canCreate?.can && (
              <Tooltip title="Remove tab from view">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseCircleOutlined style={{ fontSize: 11, color: "#9ca3af" }} />}
                  style={{ marginLeft: 6, padding: 0, height: "auto" }}
                  onClick={(e) => handleRemoveAssigneeTab(staffId, e)}
                />
              </Tooltip>
            )}
          </span>
        )
      };
    }),
    {
      key: "all",
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 6 }} />
          All Assignees
          <Badge
            count={tasks.filter(t => t.status === "pending").length}
            style={{ marginLeft: 8, backgroundColor: "#64748b" }}
          />
        </span>
      )
    }
  ];

  // Helper render for single Task Grid Card
  const renderTaskCard = (task: Task, isCompleted: boolean = false) => {
    return (
      <div
        key={task.id}
        className="posh-task-grid-card"
        style={{
          background: isCompleted ? "rgba(18, 18, 26, 0.45)" : "rgba(18, 18, 26, 0.8)",
          border: isCompleted ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.09)",
          borderRadius: 8,
          padding: "10px 11px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 148,
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Top: Category Tag & Assignee Info */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 4 }}>
            {task.category_name ? (
              <Tag
                color={task.category_color || "blue"}
                style={{
                  fontSize: 9.5,
                  padding: "0 5px",
                  lineHeight: "17px",
                  borderRadius: 3,
                  margin: 0,
                  maxWidth: "65%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                ● {task.category_name}
              </Tag>
            ) : (
              <span style={{ fontSize: 9.5, color: "#64748b" }}>General</span>
            )}
            <span style={{ fontSize: 9.5, color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <UserOutlined style={{ fontSize: 9 }} />
              {task.assignee_username}
            </span>
          </div>

          {/* Task Title */}
          <Tooltip title={task.title} placement="topLeft">
            <h4
              onClick={() => setViewingTask(task)}
              style={{
                margin: "0 0 4px 0",
                fontSize: 12.5,
                fontWeight: 600,
                color: isCompleted ? "#9ca3af" : "#f8fafc",
                lineHeight: "17px",
                height: 34,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                cursor: "pointer",
                textDecoration: isCompleted ? "line-through" : "none"
              }}
            >
              {task.title}
            </h4>
          </Tooltip>

          {/* Task Description Short Form */}
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: 10.5,
              color: isCompleted ? "#64748b" : "#94a3b8",
              lineHeight: "14px",
              height: 28,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical"
            }}
          >
            {task.description || "No description provided."}
          </p>
        </div>

        {/* Bottom Section: Date & Action Icons */}
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: 7, marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            {/* Date & Time */}
            <Tooltip title={`Created: ${new Date(task.created_at).toLocaleString()}${task.completed_at ? ` · Completed: ${new Date(task.completed_at).toLocaleString()}` : ''}`}>
              <span style={{ fontSize: 9.5, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <ClockCircleOutlined style={{ fontSize: 9 }} />
                {new Date(task.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </Tooltip>

            {/* Actions: Complete, View, Edit, Delete */}
            <Space size={4}>
              {!isCompleted && (
                <Tooltip title="Complete task">
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined style={{ fontSize: 10 }} />}
                    onClick={() => openCompleteModal(task)}
                    style={{
                      height: 22,
                      width: 22,
                      padding: 0,
                      background: "#8b5cf6",
                      borderColor: "#8b5cf6",
                      borderRadius: 4
                    }}
                  />
                </Tooltip>
              )}

              <Tooltip title="View Details">
                <Button
                  size="small"
                  icon={<EyeOutlined style={{ fontSize: 10, color: "#cbd5e1" }} />}
                  onClick={() => setViewingTask(task)}
                  style={{
                    height: 22,
                    width: 22,
                    padding: 0,
                    background: "rgba(255, 255, 255, 0.05)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 4
                  }}
                />
              </Tooltip>

              {!isCompleted && (canEdit?.can || canCreate?.can) && (
                <Tooltip title="Edit task">
                  <Button
                    size="small"
                    icon={<EditOutlined style={{ fontSize: 10, color: "#cbd5e1" }} />}
                    onClick={() => openEditModal(task)}
                    style={{
                      height: 22,
                      width: 22,
                      padding: 0,
                      background: "rgba(255, 255, 255, 0.05)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 4
                    }}
                  />
                </Tooltip>
              )}

              {canDelete?.can && (
                <Popconfirm title="Delete task?" onConfirm={() => handleDelete(task.id)} okText="Delete" okType="danger">
                  <Tooltip title="Delete task">
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                      style={{
                        height: 22,
                        width: 22,
                        padding: 0,
                        borderRadius: 4
                      }}
                    />
                  </Tooltip>
                </Popconfirm>
              )}
            </Space>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* 6-Column Responsive Grid Styles matching Catalog Grid */}
      <style>{`
        .posh-task-6col-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (max-width: 1600px) {
          .posh-task-6col-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 1300px) {
          .posh-task-6col-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 1000px) {
          .posh-task-6col-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 700px) {
          .posh-task-6col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }
        }
        @media (max-width: 480px) {
          .posh-task-6col-grid {
            grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
          }
        }
        .posh-task-grid-card:hover {
          border-color: rgba(139, 92, 246, 0.5) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
      `}</style>

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-main)" }}>
            <CheckSquareOutlined style={{ marginRight: 8, color: "#8b5cf6" }} /> Task Management
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            Internal operations task tracking, staff delegations, and execution board.
          </p>
        </div>
        <Space wrap>
          {canCreate?.can && (
            <Button
              icon={<UserAddOutlined />}
              onClick={() => {
                assigneeForm.resetFields();
                setIsAssigneeModalOpen(true);
              }}
              style={{ borderRadius: 6, background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)" }}
            >
              + Add Assignee
            </Button>
          )}
          {canCreate?.can && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
              style={{ borderRadius: 6, background: "#8b5cf6", borderColor: "#8b5cf6" }}
            >
              + Assign Task
            </Button>
          )}
        </Space>
      </div>

      <Card className="glass-card" styles={{ body: { padding: '14px 16px' } }}>
        {/* Assignee Tabs */}
        <Tabs 
          activeKey={activeAssigneeKey} 
          onChange={setActiveAssigneeKey}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        {/* Section 1: Pending Tasks 6-Column Grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text strong style={{ fontSize: 13.5, color: "#e2e8f0" }}>
              ⏳ Pending Tasks ({pendingTasks.length})
            </Text>
          </div>

          {pendingTasks.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <Empty description="No pending tasks for this assignee." />
            </div>
          ) : (
            <div className="posh-task-6col-grid">
              {pendingTasks.map(t => renderTaskCard(t, false))}
            </div>
          )}
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
                <div style={{ paddingTop: 10 }}>
                  {completedTasks.length === 0 ? (
                    <Empty description="No completed tasks for this assignee yet." />
                  ) : (
                    <div className="posh-task-6col-grid">
                      {completedTasks.map(t => renderTaskCard(t, true))}
                    </div>
                  )}
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

      {/* View Task Details Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckSquareOutlined style={{ color: "#8b5cf6" }} />
            <span>Task Details</span>
          </div>
        }
        open={!!viewingTask}
        onCancel={() => setViewingTask(null)}
        footer={[
          viewingTask && viewingTask.status === "pending" && (
            <Button
              key="complete"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => {
                const t = viewingTask;
                setViewingTask(null);
                openCompleteModal(t);
              }}
              style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}
            >
              Complete Task
            </Button>
          ),
          <Button key="close" onClick={() => setViewingTask(null)}>
            Close
          </Button>
        ]}
      >
        {viewingTask && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Tag color={viewingTask.status === "completed" ? "green" : "purple"}>
                  {viewingTask.status.toUpperCase()}
                </Tag>
                {viewingTask.category_name && (
                  <Tag color={viewingTask.category_color || "blue"}>
                    {viewingTask.category_name}
                  </Tag>
                )}
              </div>
              <h3 style={{ margin: "4px 0 0", color: "#f8fafc", fontSize: 16 }}>
                {viewingTask.title}
              </h3>
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>DESCRIPTION</Text>
              <Paragraph style={{ margin: 0, color: "#cbd5e1", whiteSpace: "pre-wrap", fontSize: 13 }}>
                {viewingTask.description || "No description provided."}
              </Paragraph>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>ASSIGNEE</Text>
                <div style={{ color: "#f8fafc", fontWeight: 500 }}>{viewingTask.assignee_username}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>ASSIGNED BY</Text>
                <div style={{ color: "#f8fafc", fontWeight: 500 }}>{viewingTask.created_by_username}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>CREATED DATE</Text>
                <div style={{ color: "#cbd5e1" }}>{new Date(viewingTask.created_at).toLocaleString()}</div>
              </div>
              {viewingTask.completed_at && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>COMPLETED DATE</Text>
                  <div style={{ color: "#10b981" }}>{new Date(viewingTask.completed_at).toLocaleString()}</div>
                </div>
              )}
            </div>

            {viewingTask.completion_comment && (
              <div style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: 10, borderRadius: 6 }}>
                <Text strong style={{ color: "#10b981", fontSize: 11, display: "block", marginBottom: 2 }}>COMPLETION NOTE</Text>
                <p style={{ margin: 0, color: "#d1fae5", fontStyle: "italic", fontSize: 12 }}>
                  "{viewingTask.completion_comment}"
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Assignee Tab Modal */}
      <Modal
        title="Add Assignee Tab"
        open={isAssigneeModalOpen}
        onCancel={() => setIsAssigneeModalOpen(false)}
        onOk={() => assigneeForm.submit()}
        okText="Add Assignee Tab"
      >
        <Form form={assigneeForm} layout="vertical" onFinish={handleAddAssigneeTab}>
          <p style={{ color: "#9ca3af", marginBottom: 16 }}>
            Select a staff member to add their personal task tab to the Task Management board.
          </p>
          <Form.Item
            name="staff_id"
            label="Select Staff Member"
            rules={[{ required: true, message: "Please select a staff member" }]}
          >
            <Select placeholder="Choose staff member" showSearch optionFilterProp="children">
              {staff.map(s => {
                const displayName = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : s.username;
                return (
                  <Select.Option key={s.user_id} value={s.user_id}>
                    {displayName} ({s.username}) {s.role_name ? `- ${s.role_name}` : ''}
                  </Select.Option>
                );
              })}
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
    </Space>
  );
};

export default TasksPage;
