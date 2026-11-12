import React, { useEffect, useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Space,
  message,
  Row,
  Col,
  Typography,
  Tabs,
  Upload,
  Popconfirm,
  Spin,
  Tag,
} from "antd";
import type { FormInstance } from "antd";
import {
  SaveOutlined,
  SettingOutlined,
  SearchOutlined,
  UploadOutlined,
  DeleteOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { useList } from "@refinedev/core";
import axios from "axios";

const { Paragraph, Text } = Typography;

const getApiBaseUrl = () =>
  import.meta.env.VITE_SERVER_URL ||
  (window.location.hostname === "admin.poshplexbd.com"
    ? "https://poshplexbd.com"
    : "http://localhost:8000");

const getAuthToken = () =>
  localStorage.getItem("poshplex_access_token") ||
  localStorage.getItem("poshplex_token") ||
  "";

type GeneralImageField =
  | "desktop_hero_banner_url"
  | "mobile_hero_banner_url"
  | "favicon_url";

interface SettingsImageUploaderProps {
  form: FormInstance;
  field: GeneralImageField;
  label: string;
  hint: string;
  accept: string;
  previewVariant: "desktop" | "mobile" | "favicon";
}

/**
 * Reusable direct photo uploader for Storefront Configuration assets.
 * Uploading a new photo saves immediately and deletes the replaced asset on the backend.
 */
const SettingsImageUploader: React.FC<SettingsImageUploaderProps> = ({
  form,
  field,
  label,
  hint,
  accept,
  previewVariant,
}) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentUrl = Form.useWatch(field, form) as string | undefined;

  const fileName = React.useMemo(() => {
    if (!currentUrl) return "";
    try {
      const clean = currentUrl.split("?")[0];
      return decodeURIComponent(clean.split("/").pop() || clean);
    } catch {
      return currentUrl;
    }
  }, [currentUrl]);

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const rawFile = file as File;
    if (rawFile.size > 15 * 1024 * 1024) {
      message.error("Image must be smaller than 15MB.");
      onError?.(new Error("File too large"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("field", field);
      formData.append("setting_key", "general");
      formData.append("file", rawFile);

      const res = await axios.post(
        `${getApiBaseUrl()}/api/v1/core/settings/upload-asset`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const newUrl = res.data?.url || "";
      form.setFieldValue(field, newUrl);
      if (field === "desktop_hero_banner_url") {
        form.setFieldValue("banner_image_url", newUrl);
      }
      message.success(
        `${label} uploaded${res.data?.deleted_old ? " & previous image deleted" : ""}!`
      );
      onSuccess?.(res.data);
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error(
          err?.response?.data?.detail || err?.message || `Failed to upload ${label}`
        );
      }
      onError?.(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await axios.delete(
        `${getApiBaseUrl()}/api/v1/core/settings/delete-asset`,
        {
          params: { setting_key: "general", field },
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        }
      );
      form.setFieldValue(field, "");
      if (field === "desktop_hero_banner_url") {
        form.setFieldValue("banner_image_url", "");
      }
      message.success(
        `${label} removed${res.data?.deleted_old ? " & file deleted" : ""}.`
      );
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error(
          err?.response?.data?.detail || err?.message || `Failed to remove ${label}`
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  const previewBoxStyle: React.CSSProperties =
    previewVariant === "desktop"
      ? {
          width: "100%",
          maxWidth: 420,
          aspectRatio: "16 / 7",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid var(--border-color, #2f2f37)",
          background: "#111115",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }
      : previewVariant === "mobile"
      ? {
          maxWidth: 220,
          maxHeight: 260,
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid var(--border-color, #2f2f37)",
          background: "#111115",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }
      : {
          width: 64,
          height: 64,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border-color, #2f2f37)",
          background: "#111115",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
        };

  return (
    <div style={{ marginBottom: 22 }}>
      {/* Hidden Form.Item keeps uploaded URL synced when saving general text fields */}
      <Form.Item name={field} hidden>
        <Input />
      </Form.Item>

      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ display: "block", color: "var(--text-main)" }}>
          {label}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {hint}
        </Text>
      </div>

      <Spin spinning={uploading || deleting} tip={uploading ? "Uploading & cleaning old image..." : "Removing..."}>
        {currentUrl ? (
          <div
            style={{
              padding: 14,
              border: "1px solid var(--border-color, #2f2f37)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={previewBoxStyle}>
              <img
                src={currentUrl}
                alt={label}
                style={{
                  width: previewVariant === "mobile" ? "auto" : "100%",
                  maxWidth: "100%",
                  height: previewVariant === "mobile" ? "auto" : "100%",
                  maxHeight: previewVariant === "mobile" ? 260 : undefined,
                  objectFit: previewVariant === "desktop" ? "cover" : "contain",
                  display: "block",
                }}
              />
            </div>

            <Space direction="vertical" size={8} style={{ flex: 1, minWidth: 200 }}>
              <Space wrap size={6}>
                <Tag color="purple" icon={<PictureOutlined />}>
                  Active Photo
                </Tag>
                <Text
                  style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}
                >
                  {fileName}
                </Text>
              </Space>

              <Space wrap>
                <Upload
                  name="file"
                  accept={accept}
                  showUploadList={false}
                  customRequest={handleUpload}
                  disabled={uploading || deleting}
                >
                  <Button type="primary" ghost icon={<UploadOutlined />} loading={uploading}>
                    Upload New Photo
                  </Button>
                </Upload>

                <Popconfirm
                  title={`Delete ${label}?`}
                  description="This removes the photo from settings and deletes the stored file."
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={handleDelete}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleting}
                    disabled={uploading}
                  >
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            </Space>
          </div>
        ) : (
          <Upload.Dragger
            name="file"
            accept={accept}
            multiple={false}
            showUploadList={false}
            customRequest={handleUpload}
            disabled={uploading}
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "var(--border-color, #2f2f37)",
              padding: "12px 16px",
            }}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: 6 }}>
              <UploadOutlined style={{ fontSize: 24, color: "var(--accent-purple, #8b5cf6)" }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 14, marginBottom: 2 }}>
              Click or drag photo to upload {label}
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 12 }}>
              Direct upload to storage (max 15MB)
            </p>
          </Upload.Dragger>
        )}
      </Spin>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const [generalForm] = Form.useForm();
  const [seoForm] = Form.useForm();
  const [storageForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Fetch media library assets for SEO Open Graph image select dropdown
  const { data: mediaData } = useList<any>({ resource: "media" });
  const mediaFiles = mediaData?.data || [];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const headers = { Authorization: `Bearer ${getAuthToken()}` };
        const baseUrl = getApiBaseUrl();

        // Load general settings
        try {
          const resGen = await axios.get(`${baseUrl}/api/v1/core/settings/general`, {
            headers,
          });
          if (resGen.data && resGen.data.value) {
            const desktopUrl =
              resGen.data.value.desktop_hero_banner_url ||
              resGen.data.value.banner_image_url ||
              "";
            generalForm.setFieldsValue({
              ...resGen.data.value,
              banner_image_url: desktopUrl,
              desktop_hero_banner_url: desktopUrl,
              mobile_hero_banner_url: resGen.data.value.mobile_hero_banner_url || "",
              favicon_url: resGen.data.value.favicon_url || "",
              site_tagline: resGen.data.value.site_tagline || "",
              site_description: resGen.data.value.site_description || "",
            });
          }
        } catch (err) {
          generalForm.setFieldsValue({
            desktop_hero_banner_url: "",
            mobile_hero_banner_url: "",
            favicon_url: "",
            site_tagline: "BE POSH WITH POSHPLEX",
            site_description:
              "Heavyweight distressed boxy street-culture brand. Mapped deliveries across Banani, Dhaka, Bangladesh.",
          });
        }

        // Load seo settings
        try {
          const resSeo = await axios.get(`${baseUrl}/api/v1/core/settings/seo`, {
            headers,
          });
          if (resSeo.data && resSeo.data.value) {
            seoForm.setFieldsValue(resSeo.data.value);
          }
        } catch (err) {
          seoForm.setFieldsValue({
            meta_title: "Poshplex Storefront | Heavyweight Streetwear Brand",
            meta_description:
              "Heavyweight distressed boxy street-culture brand. Mapped deliveries across Banani, Dhaka, Bangladesh.",
            meta_keywords: "poshplex, streetwear, dhaka, heavyweight, t-shirts",
            og_image_url: "",
          });
        }

        // Load storage settings
        try {
          const resStorage = await axios.get(
            `${baseUrl}/api/v1/core/settings/cloudflare_r2_config`,
            { headers }
          );
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
            secret_access_key: "",
          });
        }
      } catch (err) {
        console.error("Error loading settings", err);
      }
    };
    loadSettings();
  }, [generalForm, seoForm, storageForm]);

  const onSave = async (key: string, values: any, description: string) => {
    setLoading(true);
    try {
      await axios.post(
        `${getApiBaseUrl()}/api/v1/core/settings`,
        { key, value: values, description },
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            "Content-Type": "application/json",
          },
        }
      );
      message.success(`${key.toUpperCase()} settings saved successfully!`);
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error(err.message || "Failed to save settings");
      }
    } finally {
      setLoading(false);
    }
  };

  const imageSelectOptions = [
    ...mediaFiles
      .filter((f: any) => f.mime_type?.startsWith("image/"))
      .map((f: any) => ({
        value: f.url || `${getApiBaseUrl()}/media/${f.file}`,
        label: f.file_name,
        customLabel: (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
            <img
              src={f.url || `${getApiBaseUrl()}/media/${f.file}`}
              alt=""
              style={{
                width: 40,
                height: 40,
                objectFit: "cover",
                borderRadius: 4,
                border: "1px solid #333",
              }}
            />
            <span>{f.file_name}</span>
          </div>
        ),
      })),
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>
          Settings Module
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
          Manage global configs, hero banner upload, favicon upload, site descriptions, taglines, and storage.
        </p>
      </div>

      <Tabs
        defaultActiveKey="general"
        items={[
          {
            key: "general",
            label: (
              <span>
                <SettingOutlined /> General
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                  <Card
                    title={
                      <Space>
                        <SettingOutlined />
                        <span>Storefront Configuration</span>
                      </Space>
                    }
                  >
                    <Form
                      form={generalForm}
                      name="settingsGeneralForm"
                      layout="vertical"
                      onFinish={(vals) => onSave("general", vals, "General settings")}
                      requiredMark={false}
                    >
                      <SettingsImageUploader
                        form={generalForm}
                        field="desktop_hero_banner_url"
                        label="Desktop Hero Banner Image"
                        hint="Recommended: Wide banner (1920×1080 JPG, PNG, or WebP). Uploading a new photo automatically deletes the previous banner."
                        accept=".png,.jpg,.jpeg,.webp,.gif,.svg,image/*"
                        previewVariant="desktop"
                      />

                      <SettingsImageUploader
                        form={generalForm}
                        field="mobile_hero_banner_url"
                        label="Mobile Hero Banner Image"
                        hint="Any dimensions supported — fits mobile width and height automatically with zero cropping. Uploading a new photo automatically deletes the previous banner."
                        accept=".png,.jpg,.jpeg,.webp,.gif,.svg,image/*"
                        previewVariant="mobile"
                      />

                      <SettingsImageUploader
                        form={generalForm}
                        field="favicon_url"
                        label="Site Favicon (32×32 or 16×16)"
                        hint="Recommended: Square 32×32 or 64×64 PNG, ICO, or SVG icon. Uploading a new icon automatically deletes the previous one."
                        accept=".ico,.png,.jpg,.jpeg,.webp,.gif,.svg,image/*"
                        previewVariant="favicon"
                      />

                      <Form.Item name="site_tagline" label="Site Tagline" rules={[{ required: true }]}>
                        <Input placeholder="e.g. BE POSH WITH POSHPLEX" style={{ borderRadius: 0 }} />
                      </Form.Item>
                      <Form.Item
                        name="site_description"
                        label="Site Description"
                        rules={[{ required: true }]}
                      >
                        <Input.TextArea rows={4} style={{ borderRadius: 0 }} />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          loading={loading}
                        >
                          Save General Settings
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "seo",
            label: (
              <span>
                <SearchOutlined /> SEO Optimization
              </span>
            ),
            forceRender: true,
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                  <Card
                    title={
                      <Space>
                        <SearchOutlined />
                        <span>SEO Configuration</span>
                      </Space>
                    }
                  >
                    <Form
                      form={seoForm}
                      name="settingsSeoForm"
                      layout="vertical"
                      onFinish={(vals) => onSave("seo", vals, "SEO settings")}
                      requiredMark={false}
                    >
                      <Form.Item
                        name="meta_title"
                        label="Meta Title"
                        help="Ideal length: 50-60 characters"
                        rules={[{ required: true }]}
                      >
                        <Input
                          placeholder="e.g. Poshplex Storefront | Heavyweight Streetwear Brand"
                          style={{ borderRadius: 0 }}
                        />
                      </Form.Item>
                      <Form.Item
                        name="meta_description"
                        label="Meta Description"
                        help="Ideal length: 150-160 characters"
                        rules={[{ required: true }]}
                      >
                        <Input.TextArea
                          rows={3}
                          placeholder="Description for search engines..."
                          style={{ borderRadius: 0 }}
                        />
                      </Form.Item>
                      <Form.Item
                        name="meta_keywords"
                        label="Meta Keywords"
                        help="Comma separated keywords"
                      >
                        <Input
                          placeholder="poshplex, streetwear, dhaka, heavyweight, t-shirts"
                          style={{ borderRadius: 0 }}
                        />
                      </Form.Item>
                      <Form.Item name="og_image_url" label="Open Graph (Social Share) Image">
                        <Select
                          showSearch
                          placeholder="Select image from Media Library"
                          options={imageSelectOptions}
                          optionRender={(option) => (option.data as any).customLabel || option.label}
                        />
                      </Form.Item>
                      <Form.Item name="og_image_url" label="Custom Open Graph Image URL">
                        <Input
                          placeholder="Or paste custom image link here..."
                          style={{ borderRadius: 0 }}
                        />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          loading={loading}
                        >
                          Save SEO Settings
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "storage",
            label: (
              <span>
                <SettingOutlined /> Storage Integration
              </span>
            ),
            forceRender: true,
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                  <Card
                    title={
                      <Space>
                        <SettingOutlined />
                        <span>Cloudflare R2 / S3 Configuration</span>
                      </Space>
                    }
                  >
                    <Form
                      form={storageForm}
                      name="settingsStorageForm"
                      layout="vertical"
                      onFinish={(vals) =>
                        onSave("cloudflare_r2_config", vals, "Cloudflare R2 settings")
                      }
                      requiredMark={false}
                    >
                      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                        Configure a custom S3-compatible storage provider (like Cloudflare R2 or AWS S3) for your media files. If disabled, files will be saved directly to the VPS local disk.
                      </Paragraph>
                      <Form.Item name="use_r2" valuePropName="checked" label="Storage Mode">
                        <Select
                          options={[
                            { value: true, label: "Cloudflare R2 / S3 (External)" },
                            { value: false, label: "Local Disk (Internal VPS)" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name="bucket_name" label="Bucket Name">
                        <Input placeholder="e.g. poshplexbd-vps" style={{ borderRadius: 0 }} />
                      </Form.Item>
                      <Form.Item name="endpoint_url" label="Endpoint URL">
                        <Input
                          placeholder="e.g. https://<account_id>.r2.cloudflarestorage.com"
                          style={{ borderRadius: 0 }}
                        />
                      </Form.Item>
                      <Form.Item name="custom_domain" label="Custom Domain (Optional)">
                        <Input placeholder="e.g. media.poshplexbd.com" style={{ borderRadius: 0 }} />
                      </Form.Item>
                      <Form.Item name="access_key_id" label="Access Key ID">
                        <Input
                          placeholder="e.g. 324d208a4618b4db91c..."
                          style={{ borderRadius: 0 }}
                        />
                      </Form.Item>
                      <Form.Item name="secret_access_key" label="Secret Access Key">
                        <Input.Password
                          autoComplete="new-password"
                          placeholder="e.g. f6c473a7e80e47078f4a..."
                          style={{ borderRadius: 0 }}
                        />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          loading={loading}
                        >
                          Save Storage Settings
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </Space>
  );
};

export default SettingsPage;
