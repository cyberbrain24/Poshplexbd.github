import React, { useState, useEffect, useRef } from "react";
import {
  Table, Tag, Button, Space, Card, Modal, Form, Input, Switch, message, Upload, InputNumber, Popconfirm
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, UploadOutlined,
  CustomerServiceOutlined
} from "@ant-design/icons";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/music";

export const MusicLibrary: React.FC = () => {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [form] = Form.useForm();
  
  // Master Storefront Music Feature Toggle State
  const [isMusicEnabled, setIsMusicEnabled] = useState<boolean>(true);
  const [togglingMaster, setTogglingMaster] = useState<boolean>(false);

  // Custom preview player state
  const [previewingTrackId, setPreviewingTrackId] = useState<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // File Upload states
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioUploading, setAudioUploading] = useState(false);

  const token = localStorage.getItem("poshplex_access_token") || localStorage.getItem("token");

  // Load Master Config
  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && typeof res.data.is_active === "boolean") {
        setIsMusicEnabled(res.data.is_active);
      }
    } catch (err) {
      console.warn("Could not fetch music master config:", err);
    }
  };

  // Toggle Master Music Feature
  const handleToggleMaster = async (checked: boolean) => {
    setTogglingMaster(true);
    try {
      await axios.post(`${API_BASE}/admin/config`, { is_active: checked }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMusicEnabled(checked);
      message.success(checked ? "Storefront Music Feature is now ACTIVE." : "Storefront Music Feature is now INACTIVE / DISABLED.");
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to toggle storefront music feature.");
    } finally {
      setTogglingMaster(false);
    }
  };

  // Load Tracks
  const fetchTracks = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/tracks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTracks(res.data);
    } catch (err) {
      message.error("Failed to load music library.");
      // Fallback fallback mockup
      setTracks([
        { id: 1, title: "Street Culture Loop 1", audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", is_active: true, sort_order: 0 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
    fetchConfig();
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, []);

  // Handle Playback Preview inline
  const handleTogglePreview = (track: any) => {
    if (previewingTrackId === track.id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPreviewingTrackId(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      
      // Resolve relative backend paths to absolute URLs using the API base host
      const backendOrigin = API_BASE.split("/api/v1")[0];
      const audioUrlToPlay = track.audio_url && track.audio_url.startsWith("http")
        ? track.audio_url
        : `${backendOrigin}${track.audio_url}`;

      audioPreviewRef.current = new Audio(audioUrlToPlay);
      audioPreviewRef.current.play().catch(() => {
        message.error("Could not play audio track preview.");
      });
      setPreviewingTrackId(track.id);
      
      audioPreviewRef.current.addEventListener("ended", () => {
        setPreviewingTrackId(null);
      });
    }
  };

  // Toggle active status inline
  const handleToggleActive = async (record: any, checked: boolean) => {
    try {
      const payload = {
        title: record.title,
        audio_url: record.audio_url,
        is_active: checked,
        sort_order: record.sort_order
      };
      await axios.put(`${API_BASE}/admin/tracks/${record.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Track status toggled.");
      fetchTracks();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to update status."); }
  };

  // Delete Track
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: "Confirm Track Deletion",
      content: "Are you sure you want to delete this track? It will immediately stop playing on the storefront.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await axios.delete(`${API_BASE}/admin/tracks/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          message.success("Track deleted successfully.");
          fetchTracks();
        } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to delete track."); }
      }
    });
  };

  // Save / Edit track meta
  const handleSave = async (values: any) => {
    try {
      const payload = {
        ...values,
        audio_url: audioUrl || values.audio_url
      };

      if (selectedTrack) {
        await axios.put(`${API_BASE}/admin/tracks/${selectedTrack.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Track parameters updated.");
      } else {
        await axios.post(`${API_BASE}/admin/tracks`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("New track added to library.");
      }

      setIsModalOpen(false);
      form.resetFields();
      setAudioUrl("");
      fetchTracks();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to save track parameters."); }
  };

  const uploadAudioFile = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setAudioUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_BASE}/tracks/upload-audio`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      setAudioUrl(res.data.url);
      onSuccess("Ok");
      message.success("Audio file uploaded successfully.");
    } catch (err) {
      onError(err);
      message.error("Audio upload failed.");
    } finally {
      setAudioUploading(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-main)" }}>Music Library</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
            Manage the storefront player library. Curate loop tracks, rearrange playback sequences, and toggle visibility.
          </p>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => { 
            setSelectedTrack(null); 
            setAudioUrl("");
            setIsModalOpen(true); 
            form.resetFields(); 
          }} 
          style={{ borderRadius: 0 }}
        >
          Add Track to Library
        </Button>
      </div>

      {/* Master Storefront Feature Toggle Banner */}
      <Card
        variant="borderless"
        style={{
          background: isMusicEnabled 
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)" 
            : "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(185, 28, 28, 0.03) 100%)",
          border: isMusicEnabled ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 12
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <Space align="center" size="middle">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: isMusicEnabled ? "#10b981" : "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 20,
                boxShadow: isMusicEnabled ? "0 4px 12px rgba(16, 185, 129, 0.35)" : "0 4px 12px rgba(239, 68, 68, 0.35)",
                transition: "all 0.3s ease"
              }}
            >
              <CustomerServiceOutlined />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                  Storefront Ambient Music Feature
                </span>
                <Tag color={isMusicEnabled ? "success" : "error"} style={{ fontWeight: 700 }}>
                  {isMusicEnabled ? "● ACTIVE ON STOREFRONT" : "○ INACTIVE / HIDDEN"}
                </Tag>
              </div>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                {isMusicEnabled
                  ? "Ambient music player is currently active and visible to all storefront visitors."
                  : "Music player and floating audio button are completely disabled and hidden from the storefront."}
              </p>
            </div>
          </Space>

          <Space align="center" size="middle">
            <span style={{ fontSize: 13, fontWeight: 600, color: isMusicEnabled ? "#10b981" : "#ef4444" }}>
              {isMusicEnabled ? "Turn Off Music" : "Turn On Music"}
            </span>
            <Switch
              checked={isMusicEnabled}
              loading={togglingMaster}
              onChange={handleToggleMaster}
              checkedChildren="ON"
              unCheckedChildren="OFF"
              style={{
                backgroundColor: isMusicEnabled ? "#10b981" : "#4b5563",
                transform: "scale(1.2)"
              }}
            />
          </Space>
        </div>
      </Card>

      {/* Tracks Grid Table */}
      <Card variant='borderless'>
        <Table scroll={{ x: 'max-content' }}
          loading={loading}
          dataSource={tracks}
          rowKey="id"
          columns={[
            {
              title: "Title",
              dataIndex: "title",
              render: (title) => <b style={{ color: "var(--text-main)" }}>{title?.toUpperCase()}</b>
            },
            {
              title: "Sequence Priority",
              dataIndex: "sort_order",
              render: (order) => <Tag color="purple">Priority: {order}</Tag>
            },
            {
              title: "Active storefront",
              dataIndex: "is_active",
              render: (active, record) => (
                <Switch 
                  checked={active} 
                  onChange={(checked) => handleToggleActive(record, checked)} 
                />
              )
            },
            {
              title: "Inline Preview",
              key: "preview",
              render: (record) => (
                <Button 
                  type="text"
                  icon={previewingTrackId === record.id ? <PauseCircleOutlined style={{ fontSize: 20, color: "var(--accent-purple)" }} /> : <PlayCircleOutlined style={{ fontSize: 20 }} />}
                  onClick={() => handleTogglePreview(record)}
                />
              )
            },
            {
              title: "Operations",
              key: "operations",
              render: (record: any) => (
                <Space>
                  <Button 
                    size="small" 
                    icon={<EditOutlined />} 
                    onClick={() => {
                      setSelectedTrack(record);
                      setAudioUrl(record.audio_url);
                      form.setFieldsValue(record);
                      setIsModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Popconfirm title="Delete this track?" onConfirm={() => handleDelete(record.id)}>
                    <Button 
                      size="small" 
                      danger 
                      icon={<DeleteOutlined />} 
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        title={selectedTrack ? "Edit soundtrack parameters" : "Upload new soundtrack to player library"}
        open={isModalOpen}
        onCancel={() => {
          if (audioPreviewRef.current) audioPreviewRef.current.pause();
          setPreviewingTrackId(null);
          setIsModalOpen(false);
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} name="musicForm" onFinish={handleSave} layout="vertical">
          <Form.Item name="title" label="Track Title" rules={[{ required: true }]}>
            <Input style={{ borderRadius: 0 }} placeholder="e.g. Street Lo-Fi Beat" />
          </Form.Item>

          {/* Audio Upload */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, display: "block", marginBottom: 8, color: "var(--text-main)" }}>Audio Track File</label>
            <Upload 
              customRequest={uploadAudioFile}
              maxCount={1}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} loading={audioUploading}>
                {audioUrl ? "Replace Audio Track File" : "Choose Audio Track File"}
              </Button>
            </Upload>
            {audioUrl && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent-cyan)", wordBreak: "break-all" }}>
                Active Audio Path: <code>{audioUrl}</code>
              </div>
            )}
            
            <Form.Item name="audio_url" label="Or paste Remote Audio URL fallback" style={{ marginTop: 12 }}>
              <Input style={{ borderRadius: 0 }} placeholder="https://example.com/soundtrack.mp3" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} />
            </Form.Item>
          </div>

          <Form.Item name="sort_order" label="Sorting Sequence Priority" initialValue={0}>
            <InputNumber style={{ width: "100%", borderRadius: 0 }} min={0} />
          </Form.Item>

          <Form.Item name="is_active" label="Active storefront status" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

    </Space>
  );
};

export default MusicLibrary;
