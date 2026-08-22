import React, { useEffect, useState } from "react";
import { Card, Form, Input, Button, Select, Space, message, Row, Col, Typography, Tabs } from "antd";
import { SaveOutlined, SettingOutlined, SearchOutlined } from "@ant-design/icons";
import { useList } from "@refinedev/core";
import axios from "axios";

const { Title, Paragraph } = Typography;

export const SettingsPage: React.FC = () => {
  const [generalForm] = Form.useForm();
  const [seoForm] = Form.useForm();
  const [storageForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Fetch media library assets for the banner/og_image select dropdown
  const { data: mediaData } = useList<any>({ resource: "media" });
  const mediaFiles = mediaData?.data || [];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem("poshplex_access_token") || localStorage.getItem("poshplex_token");
        const headers = { Authorization: `Bearer ${token}` };
        
        // Load general settings
        try {
          const resGen = await axios.get((import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/core/settings/general", { headers });
          if (resGen.data && resGen.data.value) {
            generalForm.setFieldsValue({
              ...resGen.data.value,
              banner_image_url: resGen.data.value.banner_image_url || "",
              desktop_hero_banner_url: resGen.data.value.desktop_hero_banner_url || "",
              mobile_hero_banner_url: resGen.data.value.mobile_hero_banner_url || "",
              favicon_url: resGen.data.value.favicon_url || "",
              site_tagline: resGen.data.value.site_tagline || "",
              site_description: resGen.data.value.site_description || "",
            });
          }
        } catch (err) {
          generalForm.setFieldsValue({
            desktop_hero_banner_url: "https://images.unsplash.com/photo-1509281373149-e957c6296406?q=80&w=1600&auto=format&fit=crop",
            site_tagline: "BE POSH WITH POSHPLEX",
            site_description: "Heavyweight distressed boxy street-culture brand. Mapped deliveries across Banani, Dhaka, Bangladesh.",
          });
        }

        // Load seo settings
        try {
          const resSeo = await axios.get((import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/core/settings/seo", { headers });
          if (resSeo.data && resSeo.data.value) {
            seoForm.setFieldsValue(resSeo.data.value);
          }
        } catch (err) {
          seoForm.setFieldsValue({
            meta_title: "Poshplex Storefront | Heavyweight Streetwear Brand",
            meta_description: "Heavyweight distressed boxy street-culture brand. Mapped deliveries across Banani, Dhaka, Bangladesh.",
            meta_keywords: "poshplex, streetwear, dhaka, heavyweight, t-shirts",
            og_image_url: ""
          });
        }

        // Load storage settings
        try {
          const resStorage = await axios.get((import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/core/settings/cloudflare_r2_config", { headers });
          if (resStorage.data && resStorage.data.value) {
            storageForm.setFieldsValue(resStorage.data.value);
          }
        } catch (err) {
          storageForm.setFieldsValue({
            use_r2: false,
            bucket_name: "",
            endpoint_url: "",
            custom_domain: "",
            access_key_id: "",
            secret_access_key: ""
          });
        }
      } catch (err) {
        console.error("Error loading settings", err);
      }
    };
    loadSettings();
  }, [generalForm, seoForm]);

  const onSave = async (key: string, values: any, description: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token") || localStorage.getItem("poshplex_token");
      await axios.post(
        (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/core/settings",
        { key, value: values, description },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      message.success(`${key.toUpperCase()} settings saved successfully!`);
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.message || "Failed to save settings"); } finally {
      setLoading(false);
    }
  };

  const imageSelectOptions = [
    ...mediaFiles.filter((f: any) => f.mime_type?.startsWith("image/")).map((f: any) => ({
      value: f.url || `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}/media/${f.file}`,
      label: f.file_name,
      customLabel: (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <img
            src={f.url || `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}/media/${f.file}`}
            alt=""
            style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid #333" }}
          />
          <span>{f.file_name}</span>
        </div>
      )
    }))
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>Settings Module</h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
          Manage global configs, hero banner upload, site descriptions, taglines, and overall storefront currency.
        </p>
      </div>

      <Tabs defaultActiveKey="general" items={[
        {
          key: "general",
          label: <span><SettingOutlined /> General</span>,
          children: (
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <Card title={<Space><SettingOutlined /><span>Storefront Configuration</span></Space>}>
                  <Form form={generalForm} name="settingsGeneralForm" layout="vertical" onFinish={(vals) => onSave("general", vals, "General settings")} requiredMark={false}>
                    <Form.Item name="desktop_hero_banner_url" label="Desktop Hero Banner Image">
                      <Select
                        showSearch placeholder="Select banner from Media Library or paste custom URL below"
                        options={imageSelectOptions}
                        optionRender={(option) => (option.data as any).customLabel || option.label}
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item name="desktop_hero_banner_url" label="Custom Desktop Hero Banner URL">
                      <Input placeholder="Or paste custom image link here..." style={{ borderRadius: 0 }} />
                    </Form.Item>
                    
                    <Form.Item name="mobile_hero_banner_url" label="Mobile Hero Banner Image">
                      <Select
                        showSearch placeholder="Select banner from Media Library or paste custom URL below"
                        options={imageSelectOptions}
                        optionRender={(option) => (option.data as any).customLabel || option.label}
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item name="mobile_hero_banner_url" label="Custom Mobile Hero Banner URL">
                      <Input placeholder="Or paste custom image link here..." style={{ borderRadius: 0 }} />
                    </Form.Item>

                    <Form.Item name="favicon_url" label="Site Favicon (32x32 or 16x16)">
                      <Select
                        showSearch placeholder="Select icon from Media Library or paste custom URL below"
                        options={imageSelectOptions}
                        optionRender={(option) => (option.data as any).customLabel || option.label}
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item name="favicon_url" label="Custom Favicon URL">
                      <Input placeholder="Or paste custom image link here..." style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="site_tagline" label="Site Tagline" rules={[{ required: true }]}>
                      <Input placeholder="e.g. BE POSH WITH POSHPLEX" style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="site_description" label="Site Description" rules={[{ required: true }]}>
                      <Input.TextArea rows={4} style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>Save General Settings</Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
            </Row>
          )
        },
        {
          key: "seo",
          label: <span><SearchOutlined /> SEO Optimization</span>,
          forceRender: true,
          children: (
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <Card title={<Space><SearchOutlined /><span>SEO Configuration</span></Space>}>
                  <Form form={seoForm} name="settingsSeoForm" layout="vertical" onFinish={(vals) => onSave("seo", vals, "SEO settings")} requiredMark={false}>
                    <Form.Item name="meta_title" label="Meta Title" help="Ideal length: 50-60 characters" rules={[{ required: true }]}>
                      <Input placeholder="e.g. Poshplex Storefront | Heavyweight Streetwear Brand" style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="meta_description" label="Meta Description" help="Ideal length: 150-160 characters" rules={[{ required: true }]}>
                      <Input.TextArea rows={3} placeholder="Description for search engines..." style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="meta_keywords" label="Meta Keywords" help="Comma separated keywords">
                      <Input placeholder="poshplex, streetwear, dhaka, heavyweight, t-shirts" style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="og_image_url" label="Open Graph (Social Share) Image">
                      <Select
                        showSearch placeholder="Select image from Media Library"
                        options={imageSelectOptions}
                        optionRender={(option) => (option.data as any).customLabel || option.label}
                      />
                    </Form.Item>
                    <Form.Item name="og_image_url" label="Custom Open Graph Image URL">
                      <Input placeholder="Or paste custom image link here..." style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>Save SEO Settings</Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
            </Row>
          )
        },
        {
          key: "storage",
          label: <span><SettingOutlined /> Storage Integration</span>,
          forceRender: true,
          children: (
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <Card title={<Space><SettingOutlined /><span>Cloudflare R2 / S3 Configuration</span></Space>}>
                  <Form form={storageForm} name="settingsStorageForm" layout="vertical" onFinish={(vals) => onSave("cloudflare_r2_config", vals, "Cloudflare R2 settings")} requiredMark={false}>
                    <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                      Configure a custom S3-compatible storage provider (like Cloudflare R2 or AWS S3) for your media files. If disabled, files will be saved directly to the VPS local disk.
                    </Paragraph>
                    <Form.Item name="use_r2" valuePropName="checked" label="Storage Mode">
                        <Select options={[{value: true, label: "Cloudflare R2 / S3 (External)"}, {value: false, label: "Local Disk (Internal VPS)"}]} />
                    </Form.Item>
                    <Form.Item name="bucket_name" label="Bucket Name">
                      <Input placeholder="e.g. poshplexbd-vps" style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="endpoint_url" label="Endpoint URL">
                      <Input placeholder="e.g. https://<account_id>.r2.cloudflarestorage.com" style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="custom_domain" label="Custom Domain (Optional)">
                      <Input placeholder="e.g. media.poshplexbd.com" style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="access_key_id" label="Access Key ID">
                      <Input placeholder="e.g. 324d208a4618b4db91c..." style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item name="secret_access_key" label="Secret Access Key">
                      <Input.Password autoComplete="new-password" placeholder="e.g. f6c473a7e80e47078f4a..." style={{ borderRadius: 0 }} />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>Save Storage Settings</Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
            </Row>
          )
        }
      ]} />
    </Space>
  );
};

export default SettingsPage;
