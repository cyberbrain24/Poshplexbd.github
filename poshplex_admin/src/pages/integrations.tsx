import React, { useEffect, useState } from "react";
import {
  Card, Form, Input, Select, Button, Space, Row, Col, 
  Tabs, Divider, message, Alert, Checkbox, Modal
} from "antd";
import axios from "axios";
import {
  ApiOutlined, MailOutlined, MobileOutlined, 
  GlobalOutlined, SafetyCertificateOutlined, MessageOutlined,
  NotificationOutlined, ShoppingCartOutlined
} from "@ant-design/icons";
import { useList, useCreate, useUpdate } from "@refinedev/core";

export const Integrations: React.FC = () => {
  const [form] = Form.useForm();
  const [autoForm] = Form.useForm();

  const [isTestModalVisible, setIsTestModalVisible] = useState(false);
  const [testModalType, setTestModalType] = useState<"sms" | "email">("sms");
  const [testTarget, setTestTarget] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  // Load current dynamic settings from modular backend
  const { data: settingsData, refetch } = useList<any>({ resource: "settings" });
  const { mutate: updateSettings } = useCreate(); // We use POST /settings to create/update keys

  const { mutate: triggerBroadcast } = useCreate();

  const settings = settingsData?.data || [];

  // Parse current integration providers configuration from backend
  useEffect(() => {
    const configSetting = settings.find((s) => s.key === "integration_providers");
    const pixelsSetting = settings.find((s) => s.key === "tracking_pixels");
    const autoSetting = settings.find((s) => s.key === "automated_notifications");
    const socialSetting = settings.find((s) => s.key === "social_auth");

    if (configSetting || pixelsSetting || autoSetting || socialSetting) {
      form.setFieldsValue({
        sms_provider: configSetting?.value?.sms_provider || "mock",
        bulksmsbd_key: configSetting?.value?.bulksmsbd_credentials?.api_key || "",
        bulksmsbd_sender: configSetting?.value?.bulksmsbd_credentials?.sender_id || "",
        
        email_provider: configSetting?.value?.email_provider || "mock",
        smtp_host: configSetting?.value?.smtp_credentials?.host || "",
        smtp_port: configSetting?.value?.smtp_credentials?.port || 465,
        smtp_username: configSetting?.value?.smtp_credentials?.username || "",
        smtp_password: configSetting?.value?.smtp_credentials?.password || "",

        courier_provider: configSetting?.value?.courier_provider || "mock",
        steadfast_api_key: configSetting?.value?.steadfast_credentials?.api_key || "",
        steadfast_secret_key: configSetting?.value?.steadfast_credentials?.secret_key || "",

        fb_pixel: pixelsSetting?.value?.fb_pixel || "",
        fb_capi_token: pixelsSetting?.value?.fb_capi_token || "",
        tiktok_pixel: pixelsSetting?.value?.tiktok_pixel || "",
        google_ga: pixelsSetting?.value?.google_ga || "",

        google_client_id: socialSetting?.value?.google_client_id || "",
        google_client_secret: socialSetting?.value?.google_client_secret || "",
        enable_google_login: socialSetting?.value?.enable_google_login ?? true,
        facebook_app_id: socialSetting?.value?.facebook_app_id || "",
        enable_facebook_login: socialSetting?.value?.enable_facebook_login ?? true,
      });

      autoForm.setFieldsValue({
        account_email_enabled: autoSetting?.value?.account?.email?.enabled ?? false,
        account_email_subject: autoSetting?.value?.account?.email?.subject || "Welcome to Poshplex!",
        account_email_body: autoSetting?.value?.account?.email?.body || "Hi {username},\n\nWelcome to Poshplex!",
        account_sms_enabled: autoSetting?.value?.account?.sms?.enabled ?? false,
        account_sms_body: autoSetting?.value?.account?.sms?.body || "Your Poshplex OTP is {otp}",
        
        order_email_enabled: autoSetting?.value?.order?.email?.enabled ?? false,
        order_email_subject: autoSetting?.value?.order?.email?.subject || "Order Confirmation #{order_id}",
        order_email_body: autoSetting?.value?.order?.email?.body || "Hi {username},\n\nThanks for your order #{order_id} for {total_amount}.",
        order_sms_enabled: autoSetting?.value?.order?.sms?.enabled ?? false,
        order_sms_body: autoSetting?.value?.order?.sms?.body || "Poshplex: Order #{order_id} confirmed for {total_amount}.",
      });
    }
  }, [settings, form, autoForm]);

  const handleSaveConfig = (values: any) => {
    // 1. Compile providers configuration payload
    const providersPayload = {
      key: "integration_providers",
      value: {
        sms_provider: values.sms_provider,
        bulksmsbd_credentials: {
          api_key: values.bulksmsbd_key,
          sender_id: values.bulksmsbd_sender,
        },
        email_provider: values.email_provider,
        smtp_credentials: {
          host: values.smtp_host,
          port: values.smtp_port,
          username: values.smtp_username,
          password: values.smtp_password,
        },
        courier_provider: values.courier_provider,
        steadfast_credentials: {
          api_key: values.steadfast_api_key,
          secret_key: values.steadfast_secret_key,
        },
      },
      description: "Gateway credentials for BulkSMSBD, Custom SMTP, and Steadfast Courier",
    };

    // 2. Compile tracking pixels & social auth payload
    const pixelsPayload = {
      key: "tracking_pixels",
      value: {
        fb_pixel: values.fb_pixel,
        fb_capi_token: values.fb_capi_token,
        tiktok_pixel: values.tiktok_pixel,
        google_ga: values.google_ga,
      },
      description: "Client/Server conversion pixels tracking configurations",
    };

    const socialPayload = {
      key: "social_auth",
      value: {
        enable_google_login: values.enable_google_login,
        google_client_id: values.google_client_id,
        google_client_secret: values.google_client_secret,
        enable_facebook_login: values.enable_facebook_login,
        facebook_app_id: values.facebook_app_id,
      },
      description: "OAuth App Client IDs",
    };

    // Submit all to settings endpoint (POST /settings writes or updates keys)
    updateSettings(
      { resource: "settings", values: providersPayload },
      {
        onSuccess: () => {
          updateSettings(
            { resource: "settings", values: pixelsPayload },
            {
              onSuccess: () => {
                updateSettings(
                  { resource: "settings", values: socialPayload },
                  {
                    onSuccess: () => {
                      message.success("Operational API Keys, Tracking, and Social Auth configurations synced.");
                      refetch();
                    }
                  }
                )
              },
            }
          );
        },
        onError: (err) => message.error(`Failed to save settings: ${err.message}`),
      }
    );
  };

  const handleSaveAutoConfig = (values: any) => {
    const payload = {
      key: "automated_notifications",
      value: {
        account: {
          email: {
            enabled: values.account_email_enabled,
            subject: values.account_email_subject,
            body: values.account_email_body,
          },
          sms: {
            enabled: values.account_sms_enabled,
            body: values.account_sms_body,
          }
        },
        order: {
          email: {
            enabled: values.order_email_enabled,
            subject: values.order_email_subject,
            body: values.order_email_body,
          },
          sms: {
            enabled: values.order_sms_enabled,
            body: values.order_sms_body,
          }
        }
      },
      description: "Automated System Notifications Templates",
    };

    updateSettings(
      { resource: "settings", values: payload },
      {
        onSuccess: () => {
          message.success("Automated notifications settings saved successfully.");
          refetch();
        },
        onError: (err) => message.error(`Failed to save settings: ${err.message}`),
      }
    );
  };

  const openTestModal = (type: "sms" | "email") => {
    setTestModalType(type);
    setTestTarget("");
    setIsTestModalVisible(true);
  };

  const handleSendTest = async () => {
    if (!testTarget) {
      message.error("Please enter a target address or number.");
      return;
    }
    
    setIsTesting(true);
    
    const token = localStorage.getItem("poshplex_access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1";
    
    try {
      if (testModalType === "sms") {
        await axios.post(`${API_URL}/integration/send-sms`, {
          to_number: testTarget,
          message: "This is a test SMS from Poshplex Admin."
        }, { headers });
        message.success("Test SMS dispatched successfully.");
      } else {
        await axios.post(`${API_URL}/integration/send-email`, {
          to_email: testTarget,
          subject: "Test Email from Poshplex",
          body: "This is a test email sent from the Poshplex Admin integrations panel."
        }, { headers });
        message.success("Test Email dispatched successfully.");
      }
      setIsTestModalVisible(false);
    } catch (err: any) {
      message.error(`Test dispatch failed: ${err.response?.data?.detail || err.response?.data?.message || err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>Integrations & Broadcasters</h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>Configure external provider keys, setup analytics pixels, and issue SMS/Email marketing broadcasts.</p>
      </div>

      <Tabs type="card" items={[
        {
          key: "1",
          label: <span><ApiOutlined /> Active Provider Mappings</span>,
          children: (
          <Card title="Poshplex Courier & Communication Channels">
            <Form form={form} name="integrationsForm" onFinish={handleSaveConfig} layout="vertical">
              <Row gutter={24}>
                {/* SMS Channel */}
                <Col xs={24} md={8}>
                  <Divider orientation="left">
                    <MobileOutlined /> SMS Provider 
                    <Button type="link" size="small" onClick={() => openTestModal("sms")}>Test</Button>
                  </Divider>
                  <Form.Item name="sms_provider" label="Active SMS Gateway">
                    <Select>
                      <Select.Option value="mock">Local Debug Mock Logger</Select.Option>
                      <Select.Option value="bulksmsbd">BulkSMSBD API</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="bulksmsbd_key" label="BulkSMSBD API Key">
                    <Input.Password placeholder="Enter API Key" />
                  </Form.Item>
                  <Form.Item name="bulksmsbd_sender" label="BulkSMSBD Sender ID">
                    <Input placeholder="e.g. 09617" />
                  </Form.Item>
                </Col>

                {/* Email Channel */}
                <Col xs={24} md={8}>
                  <Divider orientation="left">
                    <MailOutlined /> Email Provider
                    <Button type="link" size="small" onClick={() => openTestModal("email")}>Test</Button>
                  </Divider>
                  <Form.Item name="email_provider" label="Active Email Gateway">
                    <Select>
                      <Select.Option value="mock">Local Debug Mock Printer</Select.Option>
                      <Select.Option value="smtp">Poshplex Webmail SMTP</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="smtp_host" label="SMTP Host">
                    <Input placeholder="mail.poshplexbd.com" />
                  </Form.Item>
                  <Form.Item name="smtp_port" label="SMTP Port">
                    <Input placeholder="465" />
                  </Form.Item>
                  <Form.Item name="smtp_username" label="SMTP Username">
                    <Input placeholder="support@poshplexbd.com" />
                  </Form.Item>
                  <Form.Item name="smtp_password" label="SMTP Password">
                    <Input.Password placeholder="Enter password" />
                  </Form.Item>
                </Col>

                {/* Courier Channel */}
                <Col xs={24} md={8}>
                  <Divider orientation="left"><GlobalOutlined /> Courier Provider</Divider>
                  <Form.Item name="courier_provider" label="Active Logistics Gateway">
                    <Select>
                      <Select.Option value="mock">Local Delivery Mock</Select.Option>
                      <Select.Option value="steadfast">Steadfast Courier API</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="steadfast_api_key" label="Steadfast API Key">
                    <Input.Password placeholder="Enter Steadfast API Key" />
                  </Form.Item>
                  <Form.Item name="steadfast_secret_key" label="Steadfast Secret Key">
                    <Input.Password placeholder="Enter Steadfast Secret Key" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: "20px 0" }} />

              <Row gutter={24}>
                <Col xs={24}>
                  <Divider orientation="left"><SafetyCertificateOutlined /> Tracking Pixels & Analytics</Divider>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="fb_pixel" label="Facebook Pixel ID">
                    <Input placeholder="Meta Pixel number" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="fb_capi_token" label="FB Conversions API Access Token">
                    <Input.Password placeholder="EAAR... token" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="tiktok_pixel" label="TikTok Pixel ID">
                    <Input placeholder="TikTok developer pixel ID" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="google_ga" label="Google Analytics ID (G-XXXX)">
                    <Input placeholder="GA Measurement ID" />
                  </Form.Item>
                </Col>
              </Row>
              
              <Divider style={{ margin: "20px 0" }} />
              
              <Row gutter={24}>
                <Col xs={24}>
                  <Divider orientation="left"><ApiOutlined /> Social Login Integrations</Divider>
                </Col>
                <Col xs={24} md={24}>
                  <Form.Item name="enable_google_login" valuePropName="checked">
                    <Checkbox><strong>Enable Google Login on Storefront</strong></Checkbox>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="google_client_id" label="Google OAuth Client ID">
                    <Input placeholder="xxxxxx-yyyyyy.apps.googleusercontent.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="google_client_secret" label="Google OAuth Client Secret">
                    <Input.Password placeholder="GOCSPX-..." />
                  </Form.Item>
                </Col>
                <Col xs={24} md={24}>
                  <Divider dashed style={{ margin: "12px 0" }} />
                  <Form.Item name="enable_facebook_login" valuePropName="checked">
                    <Checkbox><strong>Enable Facebook Login on Storefront</strong></Checkbox>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="facebook_app_id" label="Facebook App ID">
                    <Input placeholder="Facebook App ID number" />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" htmlType="submit" size="large" block>
                Save Mapped Configurations
              </Button>
            </Form>
          </Card>
          )
        },
        {
          key: "2",
          label: <span><MessageOutlined /> Automated Notifications</span>,
          forceRender: true,
          children: (
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Card title="Automated System Notifications (Triggers & Templates)">
                <Form form={autoForm} name="automationForm" onFinish={handleSaveAutoConfig} layout="vertical">
                  
                  <Divider orientation="left"><MessageOutlined /> Account Registration Event</Divider>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Variables allowed: <code>{`{username}`}</code>, <code>{`{email}`}</code>, <code>{`{otp}`}</code></p>
                  
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="account_email_enabled" valuePropName="checked">
                        <Checkbox>Enable Registration Email</Checkbox>
                      </Form.Item>
                      <Form.Item name="account_email_subject" label="Email Subject">
                        <Input />
                      </Form.Item>
                      <Form.Item name="account_email_body" label="Email Body Template">
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="account_sms_enabled" valuePropName="checked">
                        <Checkbox>Enable Registration SMS (OTP/Welcome)</Checkbox>
                      </Form.Item>
                      <Form.Item name="account_sms_body" label="SMS Body Template">
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider orientation="left"><ShoppingCartOutlined /> New Order Event</Divider>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Variables allowed: <code>{`{username}`}</code>, <code>{`{order_id}`}</code>, <code>{`{total_amount}`}</code></p>
                  
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="order_email_enabled" valuePropName="checked">
                        <Checkbox>Enable Order Confirmation Email</Checkbox>
                      </Form.Item>
                      <Form.Item name="order_email_subject" label="Email Subject">
                        <Input />
                      </Form.Item>
                      <Form.Item name="order_email_body" label="Email Body Template">
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="order_sms_enabled" valuePropName="checked">
                        <Checkbox>Enable Order Confirmation SMS</Checkbox>
                      </Form.Item>
                      <Form.Item name="order_sms_body" label="SMS Body Template">
                        <Input.TextArea rows={4} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Button type="primary" htmlType="submit" icon={<ApiOutlined />} block size="large">
                    Save Notification Templates
                  </Button>
                </Form>
              </Card>
            </Col>
            
            <Col xs={24} md={8}>
              <Card title="Channel Status Indicators">
                <Alert
                  message="Active Providers"
                  description="Verify active integrations mappings in Tab 1 before relying on these triggers. SMS messages use the BulkSMSBD provider as specified."
                  type="info"
                  showIcon
                />
              </Card>
            </Col>
          </Row>
          )
        }
      ]} />
      
      <Modal
        title={`Test ${testModalType === "sms" ? "SMS Gateway" : "Email Gateway"}`}
        open={isTestModalVisible}
        onCancel={() => !isTesting && setIsTestModalVisible(false)}
        footer={null}
      >
        <div style={{ padding: "20px 0" }}>
          <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
            Enter a destination {testModalType === "sms" ? "phone number" : "email address"} to dispatch a test payload using the active integration.
          </p>
          <Form name="testMessageForm" layout="vertical" onFinish={handleSendTest}>
            <Form.Item label={`Destination ${testModalType === "sms" ? "Phone Number" : "Email"}`} required>
              <Input 
                value={testTarget} 
                onChange={(e) => setTestTarget(e.target.value)} 
                placeholder={testModalType === "sms" ? "e.g. 01700000000" : "hello@example.com"} 
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={isTesting} block>
              Send Test Payload
            </Button>
          </Form>
        </div>
      </Modal>
    </Space>
  );
};
export default Integrations;
