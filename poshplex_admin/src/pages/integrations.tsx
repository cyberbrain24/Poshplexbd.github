import React, { useEffect, useState } from "react";
import {
  Card, Form, Input, Select, Button, Space, Row, Col, 
  Tabs, Divider, message, Alert, Checkbox
} from "antd";
import {
  ApiOutlined, MailOutlined, MobileOutlined, 
  GlobalOutlined, SafetyCertificateOutlined, MessageOutlined,
  NotificationOutlined, ShoppingCartOutlined
} from "@ant-design/icons";
import { useList, useCreate, useUpdate } from "@refinedev/core";

export const Integrations: React.FC = () => {
  const [form] = Form.useForm();
  const [autoForm] = Form.useForm();

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

        google_client_id: socialSetting?.value?.google_client_id || "",
        facebook_app_id: socialSetting?.value?.facebook_app_id || "",
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

    // 2. Compile tracking pixels & social auth payload
    const pixelsPayload = {
      key: "tracking_pixels",
      value: {
        fb_pixel: values.fb_pixel,
        tiktok_pixel: values.tiktok_pixel,
        google_ga: values.google_ga,
      },
      description: "Client/Server conversion pixels tracking configurations",
    };

    const socialPayload = {
      key: "social_auth",
      value: {
        google_client_id: values.google_client_id,
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
              
              <Divider style={{ margin: "20px 0" }} />
              
              <Row gutter={24}>
                <Col xs={24}>
                  <Divider orientation="left"><ApiOutlined /> Social Login Integrations</Divider>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="google_client_id" label="Google OAuth Client ID">
                    <Input placeholder="xxxxxx-yyyyyy.apps.googleusercontent.com" />
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
        </Tabs.TabPane>

        {/* Tab 2: Automated Notifications Console */}
        <Tabs.TabPane tab={<span><MessageOutlined /> Automated Notifications</span>} key="2">
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Card title="Automated System Notifications (Triggers & Templates)">
                <Form form={autoForm} onFinish={handleSaveAutoConfig} layout="vertical">
                  
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
        </Tabs.TabPane>
      </Tabs>
    </Space>
  );
};
export default Integrations;
