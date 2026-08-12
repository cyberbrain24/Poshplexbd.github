import React, { useEffect, useState } from "react";
import {
  Card, Form, Input, Select, Button, Space, Row, Col, 
  Tabs, Divider, message, Alert, Checkbox
} from "antd";
import {
  ApiOutlined, MailOutlined, MobileOutlined, 
  GlobalOutlined, SafetyCertificateOutlined, MessageOutlined,
  NotificationOutlined
} from "@ant-design/icons";
import { useList, useCreate, useUpdate } from "@refinedev/core";

export const Integrations: React.FC = () => {
  const [form] = Form.useForm();
  const [broadcastForm] = Form.useForm();

  // Load current dynamic settings from modular backend
  const { data: settingsData, refetch } = useList<any>({ resource: "settings" });
  const { mutate: updateSettings } = useCreate(); // We use POST /settings to create/update keys

  const { mutate: triggerBroadcast } = useCreate();

  const settings = settingsData?.data || [];

  // Parse current integration providers configuration from backend
  useEffect(() => {
    const configSetting = settings.find((s) => s.key === "integration_providers");
    const pixelsSetting = settings.find((s) => s.key === "tracking_pixels");

    if (configSetting || pixelsSetting) {
      form.setFieldsValue({
        sms_provider: configSetting?.value?.sms_provider || "mock",
        twilio_sid: configSetting?.value?.twilio_credentials?.account_sid || "",
        twilio_token: configSetting?.value?.twilio_credentials?.auth_token || "",
        twilio_number: configSetting?.value?.twilio_credentials?.from_number || "",
        
        email_provider: configSetting?.value?.email_provider || "mock",
        sendgrid_key: configSetting?.value?.sendgrid_credentials?.api_key || "",
        sendgrid_from: configSetting?.value?.sendgrid_credentials?.from_email || "",

        courier_provider: configSetting?.value?.courier_provider || "mock",
        dhl_key: configSetting?.value?.dhl_credentials?.api_key || "",
        dhl_account: configSetting?.value?.dhl_credentials?.account_number || "",

        fb_pixel: pixelsSetting?.value?.fb_pixel || "",
        tiktok_pixel: pixelsSetting?.value?.tiktok_pixel || "",
        google_ga: pixelsSetting?.value?.google_ga || "",
      });
    }
  }, [settings, form]);

  const handleSaveConfig = (values: any) => {
    // 1. Compile providers configuration payload
    const providersPayload = {
      key: "integration_providers",
      value: {
        sms_provider: values.sms_provider,
        twilio_credentials: {
          account_sid: values.twilio_sid,
          auth_token: values.twilio_token,
          from_number: values.twilio_number,
        },
        email_provider: values.email_provider,
        sendgrid_credentials: {
          api_key: values.sendgrid_key,
          from_email: values.sendgrid_from,
        },
        courier_provider: values.courier_provider,
        dhl_credentials: {
          api_key: values.dhl_key,
          account_number: values.dhl_account,
        },
      },
      description: "Gateway credentials for Twilio, SendGrid, and DHL",
    };

    // 2. Compile tracking pixels payload
    const pixelsPayload = {
      key: "tracking_pixels",
      value: {
        fb_pixel: values.fb_pixel,
        tiktok_pixel: values.tiktok_pixel,
        google_ga: values.google_ga,
      },
      description: "Client/Server conversion pixels tracking configurations",
    };

    // Submit both to settings endpoint (POST /settings writes or updates keys)
    updateSettings(
      { resource: "settings", values: providersPayload },
      {
        onSuccess: () => {
          updateSettings(
            { resource: "settings", values: pixelsPayload },
            {
              onSuccess: () => {
                message.success("Operational API Keys and Tracking configurations synced.");
                refetch();
              },
            }
          );
        },
        onError: (err) => message.error(`Failed to save settings: ${err.message}`),
      }
    );
  };

  const handleSendBroadcast = (values: any) => {
    const isEmail = values.channel === "email";
    const resource = isEmail ? "integration/send-email" : "integration/send-sms";
    const payload = isEmail
      ? { to_email: values.test_target, subject: values.subject, body: values.body }
      : { to_number: values.test_target, message: values.body };

    triggerBroadcast(
      { resource, values: payload },
      {
        onSuccess: () => {
          message.success(`Broadcast message dispatched successfully via selected provider channel.`);
          broadcastForm.resetFields();
        },
        onError: (err) => message.error(`Broadcast failed: ${err.message}`),
      }
    );
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>Integrations & Broadcasters</h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>Configure external provider keys, setup analytics pixels, and issue SMS/Email marketing broadcasts.</p>
      </div>

      <Tabs type="card">
        {/* Tab 1: API Mappings */}
        <Tabs.TabPane tab={<span><ApiOutlined /> Active Provider Mappings</span>} key="1">
          <Card title="Poshplex Courier & Communication Channels">
            <Form form={form} onFinish={handleSaveConfig} layout="vertical">
              <Row gutter={24}>
                {/* SMS Channel */}
                <Col xs={24} md={8}>
                  <Divider orientation="left"><MobileOutlined /> SMS Provider</Divider>
                  <Form.Item name="sms_provider" label="Active SMS Gateway">
                    <Select>
                      <Select.Option value="mock">Local Debug Mock Logger</Select.Option>
                      <Select.Option value="twilio">Twilio SMS API</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="twilio_sid" label="Twilio Account SID">
                    <Input.Password placeholder="ACxxxxxxxxxxxxxxxxxxxx" />
                  </Form.Item>
                  <Form.Item name="twilio_token" label="Twilio Auth Token">
                    <Input.Password placeholder="Token hash" />
                  </Form.Item>
                  <Form.Item name="twilio_number" label="Twilio Sender Number">
                    <Input placeholder="+15005550006" />
                  </Form.Item>
                </Col>

                {/* Email Channel */}
                <Col xs={24} md={8}>
                  <Divider orientation="left"><MailOutlined /> Email Provider</Divider>
                  <Form.Item name="email_provider" label="Active Email Gateway">
                    <Select>
                      <Select.Option value="mock">Local Debug Mock Printer</Select.Option>
                      <Select.Option value="sendgrid">SendGrid API</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="sendgrid_key" label="SendGrid API Key">
                    <Input.Password placeholder="SG.xxxxxxxxxxxxxxxxxxxx" />
                  </Form.Item>
                  <Form.Item name="sendgrid_from" label="Sender Email address">
                    <Input placeholder="hello@poshplexbd.com" />
                  </Form.Item>
                </Col>

                {/* Courier Channel */}
                <Col xs={24} md={8}>
                  <Divider orientation="left"><GlobalOutlined /> Courier Provider</Divider>
                  <Form.Item name="courier_provider" label="Active Logistics Gateway">
                    <Select>
                      <Select.Option value="mock">Local Delivery Mock</Select.Option>
                      <Select.Option value="dhl">DHL Express API</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="dhl_key" label="DHL API Key">
                    <Input.Password placeholder="DHL auth token" />
                  </Form.Item>
                  <Form.Item name="dhl_account" label="DHL Shipper Account No.">
                    <Input placeholder="DHL acct string" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: "20px 0" }} />

              <Row gutter={24}>
                <Col xs={24}>
                  <Divider orientation="left"><SafetyCertificateOutlined /> Tracking Pixels & Analytics</Divider>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="fb_pixel" label="Facebook Pixel ID">
                    <Input placeholder="Meta Pixel number" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="tiktok_pixel" label="TikTok Pixel ID">
                    <Input placeholder="TikTok developer pixel ID" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="google_ga" label="Google Analytics ID (G-XXXX)">
                    <Input placeholder="GA Measurement ID" />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" htmlType="submit" size="large" block>
                Save Mapped Configurations
              </Button>
            </Form>
          </Card>
        </Tabs.TabPane>

        {/* Tab 2: Broadcaster Console */}
        <Tabs.TabPane tab={<span><MessageOutlined /> Broadcast Campaign Console</span>} key="2">
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Card title="Marketing / Notifications Broadcast Dispatcher">
                <Form form={broadcastForm} onFinish={handleSendBroadcast} layout="vertical">
                  <Form.Item name="channel" label="Target Broadcasting Channel" rules={[{ required: true }]} initialValue="email">
                    <Select>
                      <Select.Option value="email">Email Campaign Campaign</Select.Option>
                      <Select.Option value="sms">SMS Text Alert Alert</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="test_target" label="Target Recipient (Email or Phone Number)" rules={[{ required: true }]}>
                    <Input placeholder="e.g. customer@domain.com or +88017XXXXXXXX" />
                  </Form.Item>
                  <Form.Item name="subject" label="Subject Line (Email Only)">
                    <Input placeholder="Poshplex Brand Announcement" />
                  </Form.Item>
                  <Form.Item name="body" label="Message Body Details" rules={[{ required: true, message: "Enter payload body!" }]}>
                    <Input.TextArea rows={6} placeholder="Enter your text or HTML notification code..." />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<ApiOutlined />} block>
                    Trigger Broadcast Transmission
                  </Button>
                </Form>
              </Card>
            </Col>
            
            <Col xs={24} md={8}>
              <Card title="Channel Status Indicators">
                <Alert
                  message="Active Providers"
                  description="Verify active integrations mappings in Tab 1 before launching campaign alerts."
                  type="info"
                  showIcon
                />
              </Card>
            </Col>
          </Row>
        </Tabs.TabPane>
      </Tabs>
    </Space>
  );
};
export default Integrations;
