import React, { useState } from "react";
import { Card, Upload, InputNumber, Input, Button, Form, message, Typography, Space, Divider } from "antd";
import { InboxOutlined, CopyOutlined, PictureOutlined } from "@ant-design/icons";

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

const ImageOptimizer: React.FC = () => {
  const [maxWidth, setMaxWidth] = useState<number | null>(1000);
  const [prefix, setPrefix] = useState<string>("optimized_uploads");
  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);

  const customRequest = async (options: any) => {
    const { file, onSuccess, onError, onProgress } = options;

    const formData = new FormData();
    formData.append("file", file);
    if (maxWidth) {
      formData.append("max_width", maxWidth.toString());
    }
    if (prefix) {
      formData.append("prefix", prefix);
    }

    try {
      const token = localStorage.getItem("refine-auth");
      const headers: Record<string, string> = {};
      
      if (token) {
        let parsedToken = token;
        try {
          parsedToken = JSON.parse(token);
        } catch(e) {}
        headers["Authorization"] = `Bearer ${parsedToken}`;
      }

      // We simulate progress for better UX
      onProgress({ percent: 20 });
      
      const response = await fetch((import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://store.poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/image-optimizer/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      onProgress({ percent: 80 });

      if (response.ok) {
        const data = await response.json();
        setOptimizedUrl(data.url);
        onSuccess(data, file);
        message.success("Image successfully optimized!");
      } else {
        const errData = await response.json();
        throw new Error(errData.detail || "Optimization failed");
      }
    } catch (err: any) {
      console.error(err);
      onError(err);
      message.error(err.message || "Failed to optimize image");
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Title level={2} style={{ color: "var(--text-main)", marginBottom: 24 }}>
        <PictureOutlined style={{ marginRight: 12, color: "var(--accent-purple)" }} />
        Image Optimizer
      </Title>

      <Card style={{ background: "var(--bg-secondary)", borderColor: "var(--border-glass)", borderRadius: 12, marginBottom: 24 }}>
        <Title level={4}>Optimization Settings</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
          Configure the maximum width and target directory before uploading your images. Images will automatically maintain their aspect ratio and be converted to WebP format.
        </Text>
        
        <Form layout="vertical">
          <Space size="large" style={{ display: "flex" }}>
            <Form.Item label="Maximum Width (px)">
              <InputNumber 
                min={100} 
                max={4000} 
                value={maxWidth} 
                onChange={setMaxWidth} 
                style={{ width: 200, borderRadius: 0 }} 
              />
            </Form.Item>
            <Form.Item label="Storage Folder Prefix">
              <Input 
                value={prefix} 
                onChange={(e) => setPrefix(e.target.value)} 
                placeholder="e.g. banners"
                style={{ width: 300, borderRadius: 0 }} 
              />
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card style={{ background: "var(--bg-secondary)", borderColor: "var(--border-glass)", borderRadius: 12 }}>
        <Dragger 
          customRequest={customRequest}
          showUploadList={false}
          style={{ background: "var(--bg-base)", borderColor: "var(--border-glass)" }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: "var(--accent-purple)" }} />
          </p>
          <p className="ant-upload-text" style={{ color: "var(--text-main)", fontWeight: 600 }}>Click or drag image file to this area to optimize</p>
          <p className="ant-upload-hint" style={{ color: "var(--text-muted)" }}>
            Supports JPG, PNG, WEBP, etc. Output will strictly be highly optimized WEBP.
          </p>
        </Dragger>

        {optimizedUrl && (
          <div style={{ marginTop: 32, padding: 24, border: "1px dashed var(--accent-cyan)", borderRadius: 8, background: "rgba(6, 182, 212, 0.05)" }}>
            <Title level={4} style={{ color: "var(--accent-cyan)", marginTop: 0 }}>Optimization Successful!</Title>
            
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginTop: 24 }}>
              <div style={{ flex: 1, minWidth: 300 }}>
                <Text style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Optimized WebP Image URL:</Text>
                <div style={{ display: "flex" }}>
                  <Input 
                    value={optimizedUrl} 
                    readOnly 
                    style={{ borderRadius: "4px 0 0 4px", borderRight: 0 }} 
                  />
                  <Button 
                    type="primary" 
                    icon={<CopyOutlined />}
                    style={{ borderRadius: "0 4px 4px 0", background: "var(--accent-cyan)", borderColor: "var(--accent-cyan)" }}
                    onClick={() => {
                      navigator.clipboard.writeText(optimizedUrl);
                      message.success("URL copied to clipboard!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", background: "#000", padding: 16, borderRadius: 8 }}>
                <img 
                  src={optimizedUrl} 
                  alt="Optimized preview" 
                  style={{ maxWidth: "100%", maxHeight: 300, objectFit: "contain" }} 
                />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ImageOptimizer;
