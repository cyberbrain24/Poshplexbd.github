import React, { useState, useEffect } from "react";
import { Table, Button, Space, Card, Modal, Form, Input, Tabs, Select, Tag, Popconfirm, App } from "antd";
import { CheckSquareOutlined, DeleteOutlined, PlusOutlined, CheckOutlined, EditOutlined } from "@ant-design/icons";
import axios from "axios";
import { useCan, useGetIdentity } from "@refinedev/core";

const API_BASE = "http://localhost:8000/api/v1";

interface Task {
  id: number;
  title: string;
  description: string;
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
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeForm] = Form.useForm();
  const [completingTask, setCompletingTask] = useState<Task | null>(null);

  const token = localStorage.getItem("poshplex_access_token");
  const { data: user } = useGetIdentity<{ id: number, username: string }>();

  // RBAC checks
  const { data: canCreate } = useCan({ resource: "tasks", action: "create" });
  const { data: canEdit } = useCan({ resource: "tasks", action: "edit" });
  const { data: canDelete } = useCan({ resource: "tasks", action: "delete" });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/tasks/?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data);
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
    fetchTasks();
  }, [activeTab]);

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
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Failed to save task.");
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    createForm.setFieldsValue({
      title: task.title,
      description: task.description,
      assignee_id: task.assignee_id
    });
    setIsCreateModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    createForm.resetFields();
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
    } catch (err: any) {
      if (err?.response?.status !== 403) message.error("Failed to delete task.");
    }
  };

  const columns = [
    { title: "Title", dataIndex: "title", key: "title" },
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
          {new Date(activeTab === 'completed' && record.completed_at ? record.completed_at : record.created_at).toLocaleString()}
        </span>
      )
    },
  ];

  if (activeTab === "completed") {
    columns.push({
      title: "Completion Comment",
      dataIndex: "completion_comment",
      key: "completion_comment",
      render: (text: string) => <i>{text || "No comment"}</i>
    } as any);
  } else {
    columns.push({
      title: "Actions",
      key: "actions",
      render: (_: any, record: Task) => (
        <Space>
          <Button 
            type="primary" 
            icon={<CheckOutlined />} 
            onClick={() => openCompleteModal(record)}
            size="small"
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
    } as any);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2><CheckSquareOutlined /> Task Management</h2>
        {canCreate?.can && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Assign Task
          </Button>
        )}
      </div>

      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            { key: "pending", label: "Pending Tasks" },
            { key: "completed", label: "Completed Tasks" }
          ]}
        />
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingTask ? "Edit Task" : "Assign New Task"}
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          setEditingTask(null);
        }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateOrEdit}>
          <Form.Item name="title" label="Task Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="assignee_id" label="Assign To" rules={[{ required: true }]}>
            <Select>
              {staff.map(s => (
                <Select.Option key={s.user_id} value={s.user_id}>
                  {s.username} {s.role_name ? `(${s.role_name})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Complete Task"
        open={isCompleteModalOpen}
        onCancel={() => setIsCompleteModalOpen(false)}
        onOk={() => completeForm.submit()}
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
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
