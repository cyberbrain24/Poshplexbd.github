import React, { useState, useEffect } from "react";
import { Card, Row, Col, Table, Tag, Typography, Progress, Badge, Space, Button, Input } from "antd";
import { DesktopOutlined, DatabaseOutlined, SyncOutlined, BugOutlined, WarningOutlined } from "@ant-design/icons";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";

const { Title, Text } = Typography;

interface SystemMetrics {
  cpu: { percent: number; cores: number };
  memory: { percent: number; used_mb: number; total_mb: number };
  disk: { percent: number; free_gb: number; total_gb: number };
}

interface DockerContainer {
  name: string;
  status: string;
  image: string;
  id: string;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  stack_trace: string;
  source: string;
  path: string;
  user_agent?: string;
}

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1";

export const SystemMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, dockerRes, logsRes] = await Promise.all([
        axios.get(API_URL + "/monitor/metrics"),
        axios.get(API_URL + "/monitor/docker"),
        axios.get(API_URL + "/monitor/logs")
      ]);
      setMetrics(metricsRes.data);
      if (dockerRes.data.success) {
        setContainers(dockerRes.data.containers);
      }
      setLogs(logsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch monitor data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const getLevelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case "ERROR":
      case "CRITICAL":
        return "red";
      case "WARNING":
        return "orange";
      default:
        return "blue";
    }
  };

  const getSourceIcon = (source: string) => {
    if (source === "frontend") return <DesktopOutlined />;
    if (source === "backend") return <DatabaseOutlined />;
    return <BugOutlined />;
  };

  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(searchText.toLowerCase()) ||
    log.logger.toLowerCase().includes(searchText.toLowerCase()) ||
    log.source.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 120,
      render: (text: string) => (
        <Text style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {formatDistanceToNow(new Date(text), { addSuffix: true })}
        </Text>
      ),
    },
    {
      title: "Level",
      dataIndex: "level",
      key: "level",
      width: 100,
      render: (text: string) => (
        <Tag color={getLevelColor(text)}>{text?.toUpperCase()}</Tag>
      ),
    },
    {
      title: "Source",
      dataIndex: "source",
      key: "source",
      width: 120,
      render: (text: string, record: ErrorLog) => (
        <Space>
          {getSourceIcon(text)}
          <Text style={{ textTransform: "capitalize", fontSize: 13 }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: "Message",
      dataIndex: "message",
      key: "message",
      render: (text: string, record: ErrorLog) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
            {text}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 12 }}>
            <span>Logger: {record.logger}</span>
            {record.path && <span>Path: {record.path}</span>}
          </div>
        </div>
      ),
    }
  ];

  return (
    <div style={{ padding: "0 12px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.5px" }}>
          System Monitor
        </Title>
        <Button 
          type="primary" 
          icon={<SyncOutlined spin={loading} />} 
          onClick={fetchData}
          style={{ background: "var(--accent-purple)", borderColor: "var(--accent-purple)" }}
        >
          Refresh Now
        </Button>
      </div>

      {metrics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={8}>
            <Card style={{ background: "var(--bg-secondary)", borderColor: "var(--border-glass)", borderRadius: 12 }}>
              <Title level={5} style={{ color: "var(--text-muted)", marginTop: 0 }}>CPU USAGE</Title>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <Progress type="dashboard" percent={metrics.cpu.percent} strokeColor="var(--accent-purple)" size={80} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.cpu.percent}%</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{metrics.cpu.cores} Logical Cores</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ background: "var(--bg-secondary)", borderColor: "var(--border-glass)", borderRadius: 12 }}>
              <Title level={5} style={{ color: "var(--text-muted)", marginTop: 0 }}>MEMORY ALLOCATION</Title>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <Progress type="dashboard" percent={metrics.memory.percent} strokeColor="var(--accent-cyan)" size={80} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.memory.used_mb} MB</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>of {metrics.memory.total_mb} MB Total</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ background: "var(--bg-secondary)", borderColor: "var(--border-glass)", borderRadius: 12 }}>
              <Title level={5} style={{ color: "var(--text-muted)", marginTop: 0 }}>DISK SPACE (ROOT)</Title>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <Progress type="dashboard" percent={metrics.disk.percent} strokeColor="var(--accent-rose)" size={80} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.disk.free_gb} GB</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Free of {metrics.disk.total_gb} GB</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <Card 
            title="Docker Containers" 
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-glass)", borderRadius: 12, height: "100%" }}
            styles={{ header: { borderBottom: "1px solid var(--border-glass)" } }}
          >
            {containers.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                No containers running or Docker daemon unavailable.
              </div>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }}>
                {containers.map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.image}</div>
                    </div>
                    <Badge status={c.status.includes("Up") || c.status === "running" ? "success" : "error"} text={c.status} />
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={18}>
          <Card 
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Unified Error Log (Redis Buffer)</span>
                <Input.Search 
                  placeholder="Search logs..." 
                  allowClear 
                  onSearch={setSearchText} 
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: 250 }} 
                />
              </div>
            }
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-glass)", borderRadius: 12 }}
            styles={{ header: { borderBottom: "1px solid var(--border-glass)" }, body: { padding: 0 } }}
          >
            <Table
              columns={columns}
              dataSource={filteredLogs}
              rowKey="id"
              pagination={{ pageSize: 15 }}
              size="middle"
              loading={loading}
              expandable={{
                expandedRowRender: record => (
                  <div style={{ padding: 16, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                    {record.user_agent && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ color: "var(--accent-cyan)" }}>User Agent:</Text> <Text style={{ color: "var(--text-muted)" }}>{record.user_agent}</Text>
                      </div>
                    )}
                    {record.stack_trace && (
                      <div>
                        <Text strong style={{ color: "var(--accent-rose)", display: "block", marginBottom: 8 }}>Stack Trace:</Text>
                        <pre style={{ background: "#000", padding: 12, borderRadius: 6, overflowX: "auto", fontSize: 12, color: "#e2e8f0", margin: 0 }}>
                          {record.stack_trace}
                        </pre>
                      </div>
                    )}
                    {!record.stack_trace && !record.user_agent && (
                      <Text style={{ color: "var(--text-muted)" }}>No additional details available.</Text>
                    )}
                  </div>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SystemMonitor;
