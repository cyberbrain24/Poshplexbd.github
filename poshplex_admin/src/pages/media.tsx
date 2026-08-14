import React, { useState } from "react";
import {
  Card, Table, Button, Upload, Space, Row, Col, 
  Tag, message, Modal, Image, Typography, Badge, Input, Popconfirm
} from "antd";
import {
  UploadOutlined, FileImageOutlined, InfoCircleOutlined, 
  DeleteOutlined, EyeOutlined, VideoCameraOutlined,
  SoundOutlined, FilePdfOutlined, FileTextOutlined
} from "@ant-design/icons";
import { useList, useCreate, useDelete } from "@refinedev/core";
import axios from "axios";

const { Text } = Typography;

export const MediaLibrary: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [visibleCount, setVisibleCount] = useState(32);

  // API integrations
  const { data: mediaData, refetch } = useList<any>({ resource: "media" });
  const { mutate: deleteAsset } = useDelete();

  const assets = mediaData?.data || [];
  const filteredAssets = assets.filter((asset: any) =>
    asset.file_name?.toLowerCase().includes(searchText.toLowerCase())
  );
  const visibleAssets = filteredAssets.slice(0, visibleCount);

  const handleUploadChange = (info: any) => {
    if (info.file.status === "done") {
      message.success(`${info.file.name} uploaded successfully and registered in central media library.`);
      refetch();
    } else if (info.file.status === "error") {
      message.error(`${info.file.name} file upload failed.`);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.delete(`${(import.meta.env.VITE_SERVER_URL || 'http://localhost:8000')}/api/v1/core/media/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Asset deleted successfully.");
      refetch();
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.usages) {
        Modal.error({
          title: "Asset Currently In Use",
          content: (
            <div>
              <p>This media asset cannot be deleted because it is currently linked to the following systems:</p>
              <ul>
                {err.response.data.usages.map((link: string, idx: number) => <li key={idx}><b>{link}</b></li>)}
              </ul>
              <p>Remove references in catalog or marketing pages before deleting.</p>
            </div>
          )
        });
      } else {
        message.error(err.response?.data?.detail || err.message || "Deletion failed");
      }
    }
  };

  const openPreview = (asset: any) => {
    setSelectedAsset(asset);
    setIsPreviewOpen(true);
  };

    // mediaColumns removed in favor of grid layout

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>Media Asset Library</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>Upload brand images, organize storefront banners, and analyze usage references.</p>
        </div>
        <Upload
          name="file"
          multiple={true}
          action={(import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/core/media"}
          headers={{ Authorization: `Bearer ${localStorage.getItem("poshplex_token") || ""}` }}
          showUploadList={false}
          onChange={handleUploadChange}
        >
          <Button type="primary" icon={<UploadOutlined />}>
            Bulk Upload Files
          </Button>
        </Upload>
      </div>

      <Card 
        title={
          <Space>
            <span>Brand Assets Directory</span>
            <Badge count={filteredAssets.length} overflowCount={99999} color="var(--accent-cyan)" />
          </Space>
        }
        extra={
          <Input
            placeholder="Search by filename..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setVisibleCount(32);
            }}
            style={{ width: 260, borderRadius: 0 }}
            allowClear
          />
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "16px" }}>
          {visibleAssets.map((record: any) => {
            const url = record.url || `${(import.meta.env.VITE_SERVER_URL || 'http://localhost:8000')}/media/${record.file || ""}`;
            return (
              <div key={record.id} style={{ 
                border: "1px solid var(--border-glass)", 
                borderRadius: 8, 
                padding: 8, 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center",
                background: "var(--bg-secondary)",
                position: "relative"
              }}>
                <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", marginBottom: 8, cursor: "pointer" }} onClick={() => openPreview(record)}>
                  {record.mime_type?.startsWith("image/") ? (
                    <img src={url} alt={record.file_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => {
                      e.currentTarget.src = "https://placehold.co/100x100?text=IMAGE";
                    }} />
                  ) : record.mime_type?.startsWith("video/") ? (
                    <VideoCameraOutlined style={{ fontSize: 32, color: "var(--text-muted)" }} />
                  ) : record.mime_type?.startsWith("audio/") ? (
                    <SoundOutlined style={{ fontSize: 32, color: "var(--text-muted)" }} />
                  ) : record.mime_type === "application/pdf" ? (
                    <FilePdfOutlined style={{ fontSize: 32, color: "var(--text-muted)" }} />
                  ) : (
                    <FileTextOutlined style={{ fontSize: 32, color: "var(--text-muted)" }} />
                  )}
                </div>
                <div style={{ width: "100%", textAlign: "center" }}>
                  <Text ellipsis style={{ width: "100%", fontSize: 11, display: "block" }} title={record.file_name}>
                    {record.file_name}
                  </Text>
                  <Space style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openPreview(record)} />
                    <Popconfirm title="Delete this media asset?" onConfirm={() => handleDelete(record.id)}><Button type="text" danger size="small" icon={<DeleteOutlined />} /></Popconfirm>
                  </Space>
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredAssets.length > visibleCount && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Button onClick={() => setVisibleCount(c => c + 32)}>Load More</Button>
          </div>
        )}
      </Card>

      {/* Asset Inspection Modal */}
      <Modal
        title="Asset Inspection Summary"
        open={isPreviewOpen}
        onCancel={() => setIsPreviewOpen(false)}
        footer={[<Button key="close" onClick={() => setIsPreviewOpen(false)}>Close Inspector</Button>]}
      >
        {selectedAsset && (() => {
          const url = selectedAsset.url || `${(import.meta.env.VITE_SERVER_URL || 'http://localhost:8000')}/media/${selectedAsset.file || ""}`;
          return (
            <Space direction="vertical" size="middle" style={{ width: "100%", textAlign: "center" }}>
              <div style={{ width: "100%", maxWidth: 300, minHeight: 120, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-glass)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)" }}>
                {selectedAsset.mime_type?.startsWith("image/") ? (
                  <img src={url} alt={selectedAsset.file_name} style={{ width: "100%", height: "auto", objectFit: "cover" }} onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/300x300?text=IMAGE";
                  }} />
                ) : selectedAsset.mime_type?.startsWith("video/") ? (
                  <video controls src={url} style={{ width: "100%", maxHeight: 300 }} />
                ) : selectedAsset.mime_type?.startsWith("audio/") ? (
                  <audio controls src={url} style={{ width: "100%", marginTop: 10 }} />
                ) : selectedAsset.mime_type === "application/pdf" ? (
                  <div style={{ padding: 20 }}>
                    <FilePdfOutlined style={{ fontSize: 48, color: "var(--text-muted)", marginBottom: 10 }} />
                    <br />
                    <a href={url} target="_blank" rel="noreferrer">Open PDF</a>
                  </div>
                ) : (
                  <div style={{ padding: 20 }}>
                    <FileTextOutlined style={{ fontSize: 48, color: "var(--text-muted)", marginBottom: 10 }} />
                    <br />
                    <a href={url} target="_blank" rel="noreferrer">Download File</a>
                  </div>
                )}
              </div>
            
            <h3 style={{ margin: 0 }}>{selectedAsset.file_name}</h3>
            <Text type="secondary">{selectedAsset.mime_type} | {(selectedAsset.file_size / (1024 * 1024)).toFixed(2)} MB</Text>
            
            <div style={{ textAlign: "left", width: "100%", marginTop: 12 }}>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>This file can be deleted if it is not bound to any storefront components. The system will automatically check for active references if you attempt to delete it.</p>
            </div>
          </Space>
        );
      })}
      </Modal>
    </Space>
  );
};
export default MediaLibrary;
