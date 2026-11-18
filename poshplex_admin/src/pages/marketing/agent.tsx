import React, { useState, useEffect } from "react";
import {
  Row, Col, Card, Typography, Space, Button, Table, Tag, Switch,
  Progress, Input, Avatar, Alert, message, Modal, Tooltip, Divider,
  Spin, Badge, Popconfirm
} from "antd";
import {
  RobotOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, SendOutlined, BulbOutlined, HistoryOutlined,
  SafetyCertificateOutlined, DollarOutlined, PlayCircleOutlined,
  CheckOutlined, StopOutlined, UserOutlined, ClockCircleOutlined,
  DeleteOutlined, InfoCircleOutlined, EyeOutlined
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000');
const API_BASE = `${SERVER_BASE}/api/v1/marketing`;

export const MetaAgentPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [statusData, setStatusData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);

  // Chat Box state
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<{ sender: "user" | "agent"; text: string; time: string }[]>([
    {
      sender: "agent",
      text: "Assalamu Alaikum! Ami PoshPlex Meta Media Buyer AI Agent. Daily budget, low-ROAS campaign pause, scaling, ebong trending catalog drops monitor korsi. Konu proshno thakle bolun!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Action execution state
  const [togglingMode, setTogglingMode] = useState<boolean>(false);
  const [runningCycle, setRunningCycle] = useState<boolean>(false);
  const [clearingLogs, setClearingLogs] = useState<boolean>(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);

  const fetchAgentData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const headers = { Authorization: `Bearer ${token}` };

      const [statusRes, logsRes, memoriesRes] = await Promise.all([
        axios.get(`${API_BASE}/agent/status/`, { headers }),
        axios.get(`${API_BASE}/agent/logs/`, { headers }),
        axios.get(`${API_BASE}/agent/memories/`, { headers }),
      ]);

      setStatusData(statusRes.data);
      setLogs(logsRes.data || []);
      setMemories(memoriesRes.data || []);
      setPendingActions((logsRes.data || []).filter((l: any) => l.status === "NEEDS_APPROVAL"));
    } catch (err: any) {
      console.error("Error loading agent data:", err);
      message.error("Failed to load Meta Agent status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, []);

  const handleToggleMode = async (newMode: string) => {
    setTogglingMode(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(
        `${API_BASE}/agent/toggle-mode/`,
        { mode: newMode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success(res.data.message || `Switched agent mode to ${newMode}`);
      fetchAgentData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to update agent mode.");
    } finally {
      setTogglingMode(false);
    }
  };

  const handleToggleEnable = async (enabled: boolean) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(
        `${API_BASE}/agent/toggle-mode/`,
        { is_enabled: enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success(`Agent ${enabled ? "activated" : "deactivated"}.`);
      fetchAgentData();
    } catch (err: any) {
      message.error("Failed to toggle agent state.");
    }
  };

  const handleRunCycle = async () => {
    setRunningCycle(true);
    message.loading({ content: "Meta Agent perceiving catalog and campaign metrics...", key: "cycle" });
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_BASE}/agent/run-cycle/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success({ content: `Cycle finished! Status: ${res.data.status}. Decisions: ${res.data.decisions_count}`, key: "cycle" });
      fetchAgentData();
    } catch (err: any) {
      message.error({ content: "Agent cycle failed to complete.", key: "cycle" });
    } finally {
      setRunningCycle(false);
    }
  };

  const handleApprove = async (logId: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_BASE}/agent/approve/${logId}/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success(res.data.message || "Action approved and executed!");
      fetchAgentData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to approve action.");
    }
  };

  const handleReject = async (logId: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(`${API_BASE}/agent/reject/${logId}/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.info("Suggested action rejected.");
      fetchAgentData();
    } catch (err: any) {
      message.error("Failed to reject action.");
    }
  };

  const handleClearAllLogs = async () => {
    setClearingLogs(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.delete(`${API_BASE}/agent/logs/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(res.data.message || "All agent audit trail logs deleted.");
      fetchAgentData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Failed to clear audit trail logs.");
    } finally {
      setClearingLogs(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatHistory((prev) => [...prev, { sender: "user", text: userMsg, time: timeStr }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(
        `${API_BASE}/agent/chat/`,
        { message: userMsg },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "agent",
          text: res.data.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "agent",
          text: "Dukkhito, ami context process korte pari nai. Please check backend connection.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const logColumns = [
    {
      title: "Time",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (val: string) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12, color: "#ffffff" }}>{new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={{ fontSize: 11, color: "#9ca3af" }}>{new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
        </Space>
      ),
    },
    {
      title: "Strategic Analysis & Algorithmic Rationale",
      dataIndex: "reasoning_text",
      key: "reasoning_text",
      render: (text: string, record: any) => (
        <div>
          <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'View Full Analysis' }} style={{ margin: 0, color: "#e4e4e7", fontSize: 13, lineHeight: 1.6 }}>
            {text}
          </Paragraph>
          <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
            <span>Tool Target: <code style={{ color: "#38bdf8" }}>{record.tool_name}</code></span>
            {record.campaign_name && <span>Campaign: <strong style={{ color: "#facc15" }}>{record.campaign_name}</strong></span>}
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setSelectedLogDetail(record)}
              style={{ padding: 0, height: "auto", color: "#c084fc", fontSize: 12 }}
            >
              Full Deep Dive
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: "Strategic Proposal",
      dataIndex: "action_taken",
      key: "action_taken",
      width: 220,
      render: (text: string) => (
        <Tag color="purple" style={{ whiteSpace: "normal", padding: "4px 8px", lineHeight: 1.4 }}>
          {text}
        </Tag>
      ),
    },
    {
      title: "Cost Impact",
      dataIndex: "cost_impact",
      key: "cost_impact",
      width: 120,
      render: (val: number) => (
        <Text style={{ color: Number(val) > 0 ? "#fbbf24" : "#9ca3af", fontWeight: 600 }}>
          {Number(val) > 0 ? `+$ ${Number(val).toLocaleString()}` : "$ 0.00"}
        </Text>
      ),
    },
    {
      title: "Proposal State",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (st: string) => {
        let color = "default";
        let label = st;
        if (st === "SUCCESS" || st === "EXECUTED") { color = "success"; label = "Executed"; }
        else if (st === "NEEDS_APPROVAL") { color = "processing"; label = "Pending Review"; }
        else if (st === "FAILED" || st === "REJECTED") { color = "error"; label = "Dismissed"; }
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 110,
      render: (_: any, record: any) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setSelectedLogDetail(record)}
          style={{ backgroundColor: "#7c3aed", borderColor: "#7c3aed" }}
        >
          Details
        </Button>
      ),
    },
  ];

  const budgetSpent = statusData?.spent_today_usd ?? statusData?.spent_today_bdt ?? 0;
  const budgetCap = statusData?.agent_daily_budget || 50;
  const budgetPercent = Math.min(100, Math.round((budgetSpent / budgetCap) * 100));

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <Space align="center" size="middle">
          <div style={{ backgroundColor: "#8b5cf6", width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RobotOutlined style={{ fontSize: 24, color: "#ffffff" }} />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: "#ffffff" }}>Meta AI Agent</Title>
            <Text style={{ color: "#9ca3af", fontSize: 13 }}>
              Autonomous 24/7 media buyer for PoshPlex streetwear ads
            </Text>
          </div>
        </Space>

        <Space size="middle">
          <Button icon={<SyncOutlined />} onClick={fetchAgentData} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={runningCycle}
            onClick={handleRunCycle}
            style={{ backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }}
          >
            Run Agent Cycle Now
          </Button>
        </Space>
      </div>

      {/* SECTION 1: STATUS, MODE TOGGLE & BUDGET */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Agent Operational Status */}
        <Col xs={24} md={8}>
          <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <Text style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Agent Status</Text>
                <div style={{ marginTop: 4 }}>
                  <Space align="center">
                    <Badge status={statusData?.is_enabled ? "success" : "default"} />
                    <Title level={4} style={{ margin: 0, color: statusData?.is_enabled ? "#10b981" : "#9ca3af" }}>
                      {statusData?.is_enabled ? "Agent Active" : "Agent Standby"}
                    </Title>
                  </Space>
                </div>
              </div>
              <Switch
                checked={statusData?.is_enabled}
                onChange={handleToggleEnable}
                style={{ backgroundColor: statusData?.is_enabled ? "#10b981" : undefined }}
              />
            </div>
            <Text style={{ color: "#71717a", fontSize: 12 }}>
              Runs cognitive perception cycle every 6 hours (00:00, 06:00, 12:00, 18:00 Asia/Dhaka) via Celery.
            </Text>
          </Card>
        </Col>

        {/* Advisory Mode Indicator (Decision Mode permanently disabled) */}
        <Col xs={24} md={8}>
          <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <Text style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Operating Mode</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color="purple" style={{ fontSize: 13, padding: "2px 8px" }}>
                    🛡️ SUGGESTION & RESEARCH ONLY
                  </Tag>
                </div>
              </div>
              <Tooltip title="Auto-decision execution is permanently turned off to protect your ad accounts. The agent only provides research-backed strategic suggestions.">
                <Tag color="cyan">Zero Risk Mode</Tag>
              </Tooltip>
            </div>
            <Text style={{ color: "#71717a", fontSize: 12 }}>
              Auto-apply is completely disabled. Agent conducts deep Meta algorithm & catalog research, generating actionable suggestions for owner review.
            </Text>
          </Card>
        </Col>

        {/* Daily Agent Budget Cap */}
        <Col xs={24} md={8}>
          <Card style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Daily Spend Budget</Text>
              <Tag color={budgetPercent >= 90 ? "red" : "blue"}>
                {budgetPercent}% Used
              </Tag>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0" }}>
              <Title level={4} style={{ margin: 0, color: "#ffffff" }}>$ {Number(budgetSpent).toLocaleString()}</Title>
              <Text style={{ color: "#9ca3af", fontSize: 13 }}>/ $ {Number(budgetCap).toLocaleString()} USD</Text>
            </div>
            <Progress
              percent={budgetPercent}
              showInfo={false}
              strokeColor={budgetPercent >= 90 ? "#ef4444" : "#8b5cf6"}
              trailColor="rgba(255,255,255,0.08)"
            />
            <Text style={{ color: "#71717a", fontSize: 11, marginTop: 4, display: "block" }}>
              Remaining: $ {Number(statusData?.remaining_budget_usd ?? statusData?.remaining_budget_bdt ?? 0).toLocaleString()} USD today
            </Text>
          </Card>
        </Col>
      </Row>

      {/* SECTION 2: PENDING APPROVAL SUGGESTIONS (Only in SUGGEST mode or when pending items exist) */}
      {pendingActions.length > 0 && (
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined style={{ color: "#fbbf24" }} />
              <span style={{ color: "#ffffff" }}>Suggestions Pending Approval ({pendingActions.length})</span>
            </Space>
          }
          style={{ backgroundColor: "#111116", borderColor: "rgba(251, 191, 36, 0.3)", borderRadius: 10, marginBottom: 20 }}
        >
          <Row gutter={[16, 16]}>
            {pendingActions.map((item) => (
              <Col xs={24} md={12} key={item.id}>
                <Card
                  size="small"
                  style={{ backgroundColor: "rgba(251, 191, 36, 0.05)", borderColor: "rgba(251, 191, 36, 0.2)", borderRadius: 8 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Tag color="gold">{item.tool_name}</Tag>
                    <Text style={{ fontSize: 11, color: "#9ca3af" }}>{new Date(item.created_at).toLocaleTimeString()}</Text>
                  </div>
                  <Paragraph style={{ color: "#e4e4e7", fontSize: 13, margin: "8px 0" }}>
                    {item.reasoning_text}
                  </Paragraph>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <Text style={{ color: "#fbbf24", fontWeight: 600, fontSize: 12 }}>
                      Cost Impact: $ {Number(item.cost_impact).toLocaleString()}
                    </Text>
                    <Space>
                      <Button size="small" danger onClick={() => handleReject(item.id)}>
                        Reject
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleApprove(item.id)}
                        style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                      >
                        Approve & Execute
                      </Button>
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* SECTION 3: CHAT BOX & MEMORY INSIGHTS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Left 60%: Interactive Agent Chat Box */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <RobotOutlined style={{ color: "#a78bfa" }} />
                <span style={{ color: "#ffffff" }}>Ask Meta Agent</span>
                <Tag color="cyan">Banglish Reasoning</Tag>
              </Space>
            }
            style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, display: "flex", flexDirection: "column", height: 460 }}
            bodyStyle={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px", overflow: "hidden" }}
          >
            {/* Messages scroll box */}
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 6, marginBottom: 12 }}>
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                    marginBottom: 12
                  }}
                >
                  <Space align="start" direction="horizontal" style={{ flexDirection: msg.sender === "user" ? "row-reverse" : "row" }}>
                    <Avatar
                      icon={msg.sender === "user" ? <UserOutlined /> : <RobotOutlined />}
                      style={{ backgroundColor: msg.sender === "user" ? "#8b5cf6" : "#10b981" }}
                    />
                    <div
                      style={{
                        maxWidth: 480,
                        backgroundColor: msg.sender === "user" ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        border: msg.sender === "user" ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                        padding: "8px 12px",
                        borderRadius: 8
                      }}
                    >
                      <Paragraph style={{ margin: 0, color: "#ffffff", fontSize: 13 }}>
                        {msg.text}
                      </Paragraph>
                      <div style={{ fontSize: 10, color: "#71717a", textAlign: "right", marginTop: 4 }}>
                        {msg.time}
                      </div>
                    </div>
                  </Space>
                </div>
              ))}
              {chatLoading && (
                <div style={{ textAlign: "left", paddingLeft: 42 }}>
                  <Spin size="small" /> <Text style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8 }}>Agent thinking...</Text>
                </div>
              )}
            </div>

            {/* Input row */}
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Ask e.g. Why did you pause Acid Wash Tee? Or: What is our top trending drop?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={handleSendChat}
                disabled={chatLoading}
                style={{ backgroundColor: "#18181b", borderColor: "rgba(255,255,255,0.12)", color: "#ffffff" }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={chatLoading}
                onClick={handleSendChat}
                style={{ backgroundColor: "#8b5cf6" }}
              >
                Send
              </Button>
            </Space.Compact>
          </Card>
        </Col>

        {/* Right 40%: Memory Insights Knowledge Base */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <Space>
                <BulbOutlined style={{ color: "#fbbf24" }} />
                <span style={{ color: "#ffffff" }}>Agent Long-Term Memory</span>
                <Tag color="purple">Postgres + Redis</Tag>
              </Space>
            }
            style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10, height: 460 }}
            bodyStyle={{ overflowY: "auto", height: 380, padding: 16 }}
          >
            {memories.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
                <BulbOutlined style={{ fontSize: 28, marginBottom: 8 }} />
                <Paragraph style={{ color: "#71717a" }}>
                  No learned insights stored yet. Agent will synthesize learnings during each 6-hour cycle.
                </Paragraph>
              </div>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                {memories.map((m: any, idx: number) => {
                  const insightText = m.value?.insight || m.value?.data || JSON.stringify(m.value);
                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "rgba(139, 92, 246, 0.06)",
                        border: "1px solid rgba(139, 92, 246, 0.2)",
                        borderRadius: 8,
                        padding: "10px 12px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text strong style={{ color: "#c4b5fd", fontSize: 12 }}>
                          {m.key}
                        </Text>
                        <Tag color="cyan" style={{ fontSize: 10 }}>Score: {m.importance}</Tag>
                      </div>
                      <Text style={{ color: "#e4e4e7", fontSize: 12 }}>
                        {insightText}
                      </Text>
                    </div>
                  );
                })}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* SECTION 4: STRATEGIC AUDIT TRAIL & LOGS */}
      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 12 }}>
            <Space>
              <HistoryOutlined style={{ color: "#10b981" }} />
              <span style={{ color: "#ffffff" }}>Decisions & Action Audit Trail</span>
              <Tag color="blue">{logs.length} logged</Tag>
            </Space>
            {logs.length > 0 && (
              <Popconfirm
                title="Delete all audit trail logs?"
                description="This will permanently delete all logged decisions and strategic audit entries. This action cannot be undone."
                onConfirm={handleClearAllLogs}
                okText="Yes, Delete All"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={clearingLogs}
                  size="small"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                >
                  Delete All Logs
                </Button>
              </Popconfirm>
            )}
          </div>
        }
        style={{ backgroundColor: "#111116", borderColor: "rgba(255,255,255,0.08)", borderRadius: 10 }}
      >
        <Table
          dataSource={logs}
          columns={logColumns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          loading={loading}
          size="middle"
          style={{ backgroundColor: "transparent" }}
        />
      </Card>

      {/* IN-DEPTH STRATEGIC LOG DETAILS MODAL */}
      <Modal
        title={
          <Space>
            <InfoCircleOutlined style={{ color: "#38bdf8" }} />
            <span style={{ color: "#ffffff" }}>Meta Strategic Analysis & Rationale Deep Dive</span>
          </Space>
        }
        open={!!selectedLogDetail}
        onCancel={() => setSelectedLogDetail(null)}
        footer={[
          selectedLogDetail?.status === "NEEDS_APPROVAL" && (
            <Button
              key="reject"
              danger
              onClick={() => {
                handleReject(selectedLogDetail.id);
                setSelectedLogDetail(null);
              }}
            >
              Dismiss Suggestion
            </Button>
          ),
          selectedLogDetail?.status === "NEEDS_APPROVAL" && (
            <Button
              key="approve"
              type="primary"
              style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
              onClick={() => {
                handleApprove(selectedLogDetail.id);
                setSelectedLogDetail(null);
              }}
            >
              Apply & Deploy
            </Button>
          ),
          <Button key="close" onClick={() => setSelectedLogDetail(null)}>
            Close
          </Button>
        ]}
        width={720}
        styles={{
          content: { backgroundColor: "#18181b", borderColor: "#27272a", color: "#ffffff" },
          header: { backgroundColor: "#18181b", borderBottom: "1px solid #27272a" },
          body: { padding: "20px 0" }
        }}
      >
        {selectedLogDetail && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>Strategic Proposal</Text>
              <div style={{ marginTop: 4 }}>
                <Title level={4} style={{ color: "#ffffff", margin: 0 }}>
                  {selectedLogDetail.action_taken}
                </Title>
              </div>
            </div>

            <Row gutter={[16, 16]}>
              <Col span={8}>
                <div style={{ backgroundColor: "#111116", padding: 12, borderRadius: 8, border: "1px solid #27272a" }}>
                  <Text type="secondary" style={{ fontSize: 11, display: "block" }}>TARGET TOOL</Text>
                  <Text strong style={{ color: "#38bdf8", fontSize: 13 }}>{selectedLogDetail.tool_name}</Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ backgroundColor: "#111116", padding: 12, borderRadius: 8, border: "1px solid #27272a" }}>
                  <Text type="secondary" style={{ fontSize: 11, display: "block" }}>COST IMPACT</Text>
                  <Text strong style={{ color: Number(selectedLogDetail.cost_impact) > 0 ? "#fbbf24" : "#9ca3af", fontSize: 13 }}>
                    ${Number(selectedLogDetail.cost_impact).toFixed(2)} USD
                  </Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ backgroundColor: "#111116", padding: 12, borderRadius: 8, border: "1px solid #27272a" }}>
                  <Text type="secondary" style={{ fontSize: 11, display: "block" }}>CURRENT STATE</Text>
                  <Tag color={selectedLogDetail.status === "NEEDS_APPROVAL" ? "processing" : "default"}>
                    {selectedLogDetail.status}
                  </Tag>
                </div>
              </Col>
            </Row>

            <div style={{ backgroundColor: "rgba(139, 92, 246, 0.08)", padding: 16, borderRadius: 8, border: "1px solid rgba(139, 92, 246, 0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <BulbOutlined style={{ color: "#facc15" }} />
                <Text strong style={{ color: "#facc15", fontSize: 14 }}>In-Depth Meta Algorithm Analysis & Research</Text>
              </div>
              <Paragraph style={{ color: "#f4f4f5", fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                {selectedLogDetail.reasoning_text}
              </Paragraph>
            </div>

            {selectedLogDetail.tool_params && Object.keys(selectedLogDetail.tool_params).length > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Execution Parameters & Payload
                </Text>
                <pre style={{
                  backgroundColor: "#09090b",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #27272a",
                  color: "#a1a1aa",
                  fontSize: 12,
                  overflowX: "auto"
                }}>
                  {JSON.stringify(selectedLogDetail.tool_params, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #27272a", paddingTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Logged at: {new Date(selectedLogDetail.created_at).toLocaleString()}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Cycle ID: <code>{selectedLogDetail.agent_cycle_id}</code>
              </Text>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};
