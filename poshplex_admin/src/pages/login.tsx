import React, { useState } from "react";
import { Form, Input, Button, Card, Alert, Typography } from "antd";
import { useLogin } from "@refinedev/core";
import { useNavigate } from "react-router-dom";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export const Login: React.FC = () => {
  const { mutate: login, isLoading } = useLogin();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const onFinish = (values: any) => {
    setErrorMsg(null);
    login(values, {
      onSuccess: () => {
        navigate("/");
      },
      onError: (err: any) => {
        setErrorMsg(err?.message || "Invalid credentials.");
      }
    });
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "linear-gradient(135deg, #050508 0%, #0d0d16 100%)", position: "relative" }}>
      {/* Decorative Blur Orbs */}
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "var(--accent-purple)", filter: "blur(120px)", opacity: 0.15, top: "20%", left: "30%" }} />
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", background: "var(--accent-cyan)", filter: "blur(100px)", opacity: 0.12, bottom: "25%", right: "30%" }} />
      
      <Card className="glass-card" style={{ width: 400, border: "1px solid var(--border-glass)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2} style={{ color: "var(--text-main)", margin: 0, fontWeight: 800 }}>POSHPLEX</Title>
          <Text style={{ color: "var(--text-muted)", fontSize: 13 }}>Administrative ERP Gate</Text>
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            style={{ marginBottom: 16, backgroundColor: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.2)", color: "var(--text-main)" }}
          />
        )}

        <Form name="login" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: "Please input your administrative username!" }]}
          >
            <Input prefix={<UserOutlined style={{ color: "var(--text-muted)" }} />} placeholder="Bearer Username Token" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Please input your password!" }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: "var(--text-muted)" }} />} placeholder="Password" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              style={{ width: "100%", background: "linear-gradient(135deg, var(--accent-purple) 0%, #a855f7 100%)", border: "none" }}
            >
              Authorize Secure Connection
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <Text style={{ color: "var(--text-muted)", fontSize: 11 }}>Tip: Use developer credentials (e.g. <b>admin_imran</b>)</Text>
        </div>
      </Card>
    </div>
  );
};
export default Login;
