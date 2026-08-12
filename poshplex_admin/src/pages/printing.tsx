import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Button, Space, Modal, Form, Input, Select, Upload, InputNumber,
  message, Tabs, Table, Tag, Tooltip, Popconfirm, Image, Row, Col,
  Typography, Drawer, Badge, Divider, Empty, Radio, Alert, Spin
} from "antd";
import {
  PlusOutlined, PrinterOutlined, UploadOutlined, EditOutlined, DeleteOutlined,
  FileImageOutlined, SaveOutlined, DownloadOutlined, SearchOutlined, AppstoreOutlined,
  OrderedListOutlined, EyeOutlined, CloseOutlined, PlusCircleOutlined, ReloadOutlined
} from "@ant-design/icons";
import axios from "axios";

const API = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/printing";
const CATALOG_API = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/catalog";

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

function authHeaders() {
  const token = localStorage.getItem("poshplex_token") || "admin_imran";
  return { Authorization: `Bearer ${token}` };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PrintingFile {
  id: number;
  name: string;
  product_id: number;
  product_name: string;
  design_file_1_url: string | null;
  design_file_1_width_mm: number;
  design_file_1_height_mm: number;
  design_file_2_url: string | null;
  design_file_2_width_mm: number | null;
  design_file_2_height_mm: number | null;
  additional_notes: string;
  created_at: string;
}

interface PreparedItem {
  id?: number;
  printing_file_id: number;
  printing_file_name: string;
  product_name: string;
  design_file_1_url: string | null;
  design_file_1_width_mm: number;
  design_file_1_height_mm: number;
  design_file_2_url: string | null;
  design_file_2_width_mm: number | null;
  design_file_2_height_mm: number | null;
  quantity: number;
  order_number: string;
}

interface PreparedList {
  id: number;
  name: string;
  notes: string;
  total_items: number;
  total_quantity: number;
  created_at: string;
  updated_at: string;
  items: PreparedItem[];
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tab 1 â€” Print Files Library
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PrintFilesLibrary: React.FC = () => {
  const [files, setFiles] = useState<PrintingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<PrintingFile | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm();

  // Upload state
  const [design1File, setDesign1File] = useState<File | null>(null);
  const [design2File, setDesign2File] = useState<File | null>(null);
  const [design1Preview, setDesign1Preview] = useState<string>("");
  const [design2Preview, setDesign2Preview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/files`, {
        headers: authHeaders(),
        params: { search: searchText || undefined },
      });
      setFiles(res.data);
    } catch {
      message.error("Failed to load printing files.");
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  const fetchProducts = async (search = "") => {
    try {
      const res = await axios.get(`${CATALOG_API}/products`, {
        headers: authHeaders(),
        params: { search: search || undefined, limit: 30 },
      });
      setProducts(res.data?.results || res.data || []);
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  useEffect(() => { fetchProducts(); }, []);

  const openCreateDrawer = () => {
    setEditingFile(null);
    form.resetFields();
    setDesign1File(null);
    setDesign2File(null);
    setDesign1Preview("");
    setDesign2Preview("");
    setDrawerOpen(true);
  };

  const openEditDrawer = (file: PrintingFile) => {
    setEditingFile(file);
    form.setFieldsValue({
      name: file.name,
      product_id: file.product_id,
      design_file_1_width_mm: file.design_file_1_width_mm,
      design_file_1_height_mm: file.design_file_1_height_mm,
      design_file_2_width_mm: file.design_file_2_width_mm,
      design_file_2_height_mm: file.design_file_2_height_mm,
      additional_notes: file.additional_notes,
    });
    setDesign1File(null);
    setDesign2File(null);
    setDesign1Preview(file.design_file_1_url || "");
    setDesign2Preview(file.design_file_2_url || "");
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (!editingFile) {
        // CREATE â€” multipart upload
        if (!design1File) {
          message.error("Design File 1 is required.");
          setSaving(false);
          return;
        }
        const fd = new FormData();
        fd.append("name", values.name);
        fd.append("product_id", String(values.product_id));
        fd.append("design_file_1_width_mm", String(values.design_file_1_width_mm || 0));
        fd.append("design_file_1_height_mm", String(values.design_file_1_height_mm || 0));
        if (values.design_file_2_width_mm) fd.append("design_file_2_width_mm", String(values.design_file_2_width_mm));
        if (values.design_file_2_height_mm) fd.append("design_file_2_height_mm", String(values.design_file_2_height_mm));
        fd.append("additional_notes", values.additional_notes || "");
        fd.append("design_file_1", design1File);
        if (design2File) fd.append("design_file_2", design2File);

        await axios.post(`${API}/files/upload`, fd, {
          headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
        });
        message.success("Printing file created successfully.");
      } else {
        // UPDATE META
        await axios.post(`${API}/files/${editingFile.id}/update-meta`, {
          name: values.name,
          product_id: values.product_id,
          design_file_1_width_mm: values.design_file_1_width_mm || 0,
          design_file_1_height_mm: values.design_file_1_height_mm || 0,
          design_file_2_width_mm: values.design_file_2_width_mm || null,
          design_file_2_height_mm: values.design_file_2_height_mm || null,
          additional_notes: values.additional_notes || "",
        }, { headers: { ...authHeaders(), "Content-Type": "application/json" } });

        // Upload new images if provided
        if (design1File) {
          const fd1 = new FormData();
          fd1.append("design_file_1", design1File);
          await axios.post(`${API}/files/${editingFile.id}/upload-design1`, fd1, {
            headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
          });
        }
        if (design2File) {
          const fd2 = new FormData();
          fd2.append("design_file_2", design2File);
          await axios.post(`${API}/files/${editingFile.id}/upload-design2`, fd2, {
            headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
          });
        }
        message.success("Printing file updated.");
      }

      setDrawerOpen(false);
      fetchFiles();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to save printing file.";
      message.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API}/files/${id}`, { headers: authHeaders() });
      message.success("Printing file deleted.");
      fetchFiles();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Delete failed.";
      message.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  const handleFileSelect = (file: File, slot: 1 | 2) => {
    const url = URL.createObjectURL(file);
    if (slot === 1) { setDesign1File(file); setDesign1Preview(url); }
    else { setDesign2File(file); setDesign2Preview(url); }
    return false; // prevent auto-upload
  };

  const filteredFiles = files; // backend already filters

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Input.Search
          placeholder="Search by name or product..."
          allowClear
          style={{ width: 320 }}
          onSearch={(v) => setSearchText(v)}
          onChange={(e) => { if (!e.target.value) setSearchText(""); }}
          prefix={<SearchOutlined />}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateDrawer}
          style={{ background: "var(--accent-purple)", borderColor: "var(--accent-purple)", borderRadius: 4 }}
          size="large"
        >
          Add Print File
        </Button>
      </div>

      {/* 8-Column Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      ) : filteredFiles.length === 0 ? (
        <Empty
          description={<Text style={{ color: "var(--text-muted)" }}>No printing files yet. Click "Add Print File" to get started.</Text>}
          image={<PrinterOutlined style={{ fontSize: 64, color: "var(--text-muted)", opacity: 0.3 }} />}
        />
      ) : (
        <Row gutter={[12, 12]}>
          {filteredFiles.map((file) => (
            <Col key={file.id} xs={12} sm={8} md={6} lg={4} xl={3} style={{ minWidth: 140 }}>
              <Card
                hoverable
                bodyStyle={{ padding: 0 }}
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--border-glass)",
                  background: "var(--bg-secondary)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                cover={
                  <div style={{ position: "relative", height: 130, background: "#0a0a12", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {file.design_file_1_url ? (
                      <Image
                        src={file.design_file_1_url}
                        alt={file.name}
                        style={{ width: "100%", height: 130, objectFit: "cover" }}
                        preview={false}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                      />
                    ) : (
                      <FileImageOutlined style={{ fontSize: 36, color: "var(--text-muted)", opacity: 0.4 }} />
                    )}
                    {/* Overlay actions */}
                    <div style={{
                      position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: 0, transition: "opacity 0.2s",
                    }}
                      className="card-overlay"
                    >
                      <Tooltip title="Edit">
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditDrawer(file)} />
                      </Tooltip>
                      <Popconfirm
                        title="Delete this printing file?"
                        onConfirm={() => handleDelete(file.id)}
                        okText="Delete" cancelText="Cancel" okType="danger"
                      >
                        <Tooltip title="Delete">
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                }
              >
                <div style={{ padding: "8px 10px" }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "var(--text-main)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 2,
                  }}>
                    {file.name}
                  </div>
                  <div style={{
                    fontSize: 10, color: "var(--accent-purple)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginBottom: 4,
                  }}>
                    {file.product_name}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <Tag style={{ fontSize: 9, padding: "0 4px", margin: 0, lineHeight: "16px" }} color="blue">
                      {file.design_file_1_width_mm}Ã—{file.design_file_1_height_mm}mm
                    </Tag>
                    {file.design_file_2_url && (
                      <Tag style={{ fontSize: 9, padding: "0 4px", margin: 0, lineHeight: "16px" }} color="geekblue">D2</Tag>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Add / Edit Drawer */}
      <Drawer
        title={
          <Space>
            <PrinterOutlined style={{ color: "var(--accent-purple)" }} />
            <span>{editingFile ? "Edit Printing File" : "Add New Printing File"}</span>
          </Space>
        }
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            style={{ background: "var(--accent-purple)", borderColor: "var(--accent-purple)" }}
          >
            Save
          </Button>
        }
        styles={{ body: { paddingBottom: 80 } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Printing File Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="e.g. Skull Tee â€” Front & Back Print" />
          </Form.Item>

          <Form.Item name="product_id" label="Related Product" rules={[{ required: true, message: "Product is required" }]}>
            <Select
              showSearch
              placeholder="Search and select a product..."
              filterOption={false}
              onSearch={(v) => fetchProducts(v)}
              notFoundContent={<Text style={{ color: "var(--text-muted)" }}>No products found</Text>}
            >
              {products.map((p: any) => (
                <Option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</Option>
              ))}
            </Select>
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, color: "var(--accent-purple)" }}>
            Design File 1 <span style={{ color: "var(--accent-rose)", fontSize: 11 }}>*required</span>
          </Divider>

          <Alert
            message="Design File 1 Specifications"
            description="Upload the primary design image (front print, main graphic, etc.). Any format accepted: PNG, JPG, PDF, AI, PSD. Specify the exact print dimensions in millimetres (mm)."
            type="info"
            showIcon
            style={{ marginBottom: 16, fontSize: 12 }}
          />

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="design_file_1_width_mm" label="Width (mm)" rules={[{ required: true, message: "Width required" }]}>
                <InputNumber min={0} style={{ width: "100%" }} placeholder="e.g. 300" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="design_file_1_height_mm" label="Height (mm)" rules={[{ required: true, message: "Height required" }]}>
                <InputNumber min={0} style={{ width: "100%" }} placeholder="e.g. 400" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <Upload
              beforeUpload={(f) => handleFileSelect(f, 1)}
              showUploadList={false}
              accept="image/*,.pdf,.ai,.psd,.eps"
            >
              <Button icon={<UploadOutlined />} style={{ marginBottom: 8 }}>
                {design1File ? `âœ“ ${design1File.name}` : (editingFile ? "Replace Design File 1" : "Upload Design File 1")}
              </Button>
            </Upload>
            {design1Preview && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={design1Preview}
                  alt="Design 1 preview"
                  style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 4, border: "1px solid var(--border-glass)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>

          <Divider orientation="left" style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Design File 2 <span style={{ color: "var(--text-muted)", fontSize: 11 }}>optional</span>
          </Divider>

          <Alert
            message="Design File 2 Specifications"
            description="Optional secondary design image (back print, sleeve label, inner tag, etc.). Specify print dimensions in millimetres (mm) if applicable."
            type="info"
            showIcon
            style={{ marginBottom: 16, fontSize: 12 }}
          />

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="design_file_2_width_mm" label="Width (mm)">
                <InputNumber min={0} style={{ width: "100%" }} placeholder="e.g. 150" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="design_file_2_height_mm" label="Height (mm)">
                <InputNumber min={0} style={{ width: "100%" }} placeholder="e.g. 200" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <Upload
              beforeUpload={(f) => handleFileSelect(f, 2)}
              showUploadList={false}
              accept="image/*,.pdf,.ai,.psd,.eps"
            >
              <Button icon={<UploadOutlined />} style={{ marginBottom: 8 }}>
                {design2File ? `âœ“ ${design2File.name}` : (editingFile && editingFile.design_file_2_url ? "Replace Design File 2" : "Upload Design File 2 (optional)")}
              </Button>
            </Upload>
            {design2Preview && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={design2Preview}
                  alt="Design 2 preview"
                  style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 4, border: "1px solid var(--border-glass)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>

          <Divider />
          <Form.Item name="additional_notes" label="Additional Notes for Press Operator">
            <Input.TextArea
              rows={3}
              placeholder="Fabric type, Pantone colour codes, special finishing instructions, etc."
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* CSS override for card overlay */}
      <style>{`
        .ant-card:hover .card-overlay { opacity: 1 !important; }
      `}</style>
    </Space>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tab 2 â€” Prepare Print
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PreparePrint: React.FC = () => {
  const [mode, setMode] = useState<"build" | "saved">("build");

  // Build mode state
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [orderSearch, setOrderSearch] = useState<string>("");
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [buildItems, setBuildItems] = useState<PreparedItem[]>([]);
  const [listName, setListName] = useState("");
  const [listNotes, setListNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Saved lists state
  const [savedLists, setSavedLists] = useState<PreparedList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [editingList, setEditingList] = useState<PreparedList | null>(null);
  const [listDrawerOpen, setListDrawerOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);

  // Print file search
  const [printingFiles, setPrintingFiles] = useState<PrintingFile[]>([]);
  const [pfSearch, setPfSearch] = useState("");

  const fetchOrderItems = async () => {
    setLoadingOrderItems(true);
    try {
      const res = await axios.get(`${API}/order-items`, {
        headers: authHeaders(),
        params: {
          status: orderStatus || undefined,
          search: orderSearch || undefined,
        },
      });
      setOrderItems(res.data);
    } catch {
      message.error("Failed to load order items.");
    } finally {
      setLoadingOrderItems(false);
    }
  };

  const fetchSavedLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const res = await axios.get(`${API}/lists`, { headers: authHeaders() });
      setSavedLists(res.data);
    } catch {
      message.error("Failed to load saved print lists.");
    } finally {
      setLoadingLists(false);
    }
  }, []);

  const fetchPrintingFiles = async (search = "") => {
    try {
      const res = await axios.get(`${API}/files`, {
        headers: authHeaders(),
        params: { search: search || undefined },
      });
      setPrintingFiles(res.data);
    } catch {
      setPrintingFiles([]);
    }
  };

  useEffect(() => { fetchSavedLists(); fetchPrintingFiles(); }, [fetchSavedLists]);

  // Add from order items
  const addOrderItemToBuild = (item: any) => {
    setBuildItems((prev) => {
      const existing = prev.find((b) => b.printing_file_id === item.printing_file_id && b.order_number === item.order_number);
      if (existing) {
        message.info("Already in list. Adjust quantity in the table.");
        return prev;
      }
      return [...prev, {
        printing_file_id: item.printing_file_id,
        printing_file_name: item.printing_file_name,
        product_name: item.product_name,
        design_file_1_url: item.design_file_1_url,
        design_file_1_width_mm: item.design_file_1_width_mm,
        design_file_1_height_mm: item.design_file_1_height_mm,
        design_file_2_url: item.design_file_2_url,
        design_file_2_width_mm: item.design_file_2_width_mm,
        design_file_2_height_mm: item.design_file_2_height_mm,
        quantity: item.suggested_quantity || 1,
        order_number: item.order_number || "",
      }];
    });
  };

  // Add from print file search
  const addPrintFileToBuild = (pf: PrintingFile) => {
    setBuildItems((prev) => {
      const existing = prev.find((b) => b.printing_file_id === pf.id && !b.order_number);
      if (existing) {
        message.info("Already in list.");
        return prev;
      }
      return [...prev, {
        printing_file_id: pf.id,
        printing_file_name: pf.name,
        product_name: pf.product_name,
        design_file_1_url: pf.design_file_1_url,
        design_file_1_width_mm: pf.design_file_1_width_mm,
        design_file_1_height_mm: pf.design_file_1_height_mm,
        design_file_2_url: pf.design_file_2_url,
        design_file_2_width_mm: pf.design_file_2_width_mm,
        design_file_2_height_mm: pf.design_file_2_height_mm,
        quantity: 1,
        order_number: "",
      }];
    });
  };

  const updateBuildItemQty = (idx: number, qty: number) => {
    setBuildItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
  };

  const removeBuildItem = (idx: number) => {
    setBuildItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveList = async () => {
    if (buildItems.length === 0) {
      message.warning("Add at least one item to the list.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: listName || "",
        notes: listNotes,
        items: buildItems.map((i) => ({
          printing_file_id: i.printing_file_id,
          quantity: i.quantity,
          order_number: i.order_number,
        })),
      };
      await axios.post(`${API}/lists`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      message.success("Print list saved!");
      setBuildItems([]);
      setListName("");
      setListNotes("");
      setMode("saved");
      fetchSavedLists();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to save list.";
      message.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async (listId: number, listName: string) => {
    setDownloadingPdf(listId);
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const response = await fetch(`${API}/lists/${listId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `print_list_${listName.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      message.success("PDF downloaded!");
    } catch {
      message.error("Failed to download PDF.");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const deleteList = async (id: number) => {
    try {
      await axios.delete(`${API}/lists/${id}`, { headers: authHeaders() });
      message.success("Print list deleted.");
      fetchSavedLists();
    } catch {
      message.error("Failed to delete list.");
    }
  };

  const openEditList = (list: PreparedList) => {
    setEditingList(list);
    setBuildItems(list.items.map((i) => ({ ...i })));
    setListName(list.name);
    setListNotes(list.notes);
    setListDrawerOpen(true);
  };

  const updateEditList = async () => {
    if (!editingList) return;
    setSaving(true);
    try {
      const payload = {
        name: listName,
        notes: listNotes,
        items: buildItems.map((i) => ({
          printing_file_id: i.printing_file_id,
          quantity: i.quantity,
          order_number: i.order_number,
        })),
      };
      await axios.put(`${API}/lists/${editingList.id}`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      message.success("Print list updated!");
      setListDrawerOpen(false);
      setEditingList(null);
      fetchSavedLists();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Update failed.";
      message.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const ORDER_STATUSES = [
    { label: "All", value: "" },
    { label: "Placed", value: "placed" },
    { label: "In Review", value: "review" },
    { label: "Pending", value: "pending" },
    { label: "Approval Pending", value: "approval_pending" },
    { label: "Delivered", value: "delivered" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Returned", value: "returned" },
    { label: "RTO", value: "rto" },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        buttonStyle="solid"
        size="large"
      >
        <Radio.Button value="build">
          <PlusCircleOutlined /> Build Print List
        </Radio.Button>
        <Radio.Button value="saved">
          <OrderedListOutlined /> Saved Lists
        </Radio.Button>
      </Radio.Group>

      {/* â”€â”€ BUILD MODE â”€â”€ */}
      {mode === "build" && (
        <Row gutter={[16, 16]}>
          {/* Left: filter & source panel */}
          <Col xs={24} lg={14}>
            <Card
              title={<Space><SearchOutlined /><span>Filter Orders</span></Space>}
              bordered={false}
              style={{ background: "var(--bg-secondary)" }}
              extra={
                <Button icon={<ReloadOutlined />} onClick={fetchOrderItems} loading={loadingOrderItems} size="small">
                  Load
                </Button>
              }
            >
              <Space style={{ marginBottom: 12, flexWrap: "wrap" }} size={8}>
                {ORDER_STATUSES.map((s) => (
                  <Button
                    key={s.value}
                    size="small"
                    type={orderStatus === s.value ? "primary" : "default"}
                    onClick={() => setOrderStatus(s.value)}
                    style={orderStatus === s.value ? { background: "var(--accent-purple)", borderColor: "var(--accent-purple)" } : {}}
                  >
                    {s.label}
                  </Button>
                ))}
              </Space>
              <Input.Search
                placeholder="Search by order number..."
                allowClear
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onSearch={fetchOrderItems}
                style={{ marginBottom: 12 }}
              />
              <Table
                size="small"
                loading={loadingOrderItems}
                dataSource={orderItems}
                rowKey={(r: any) => `${r.order_number}-${r.printing_file_id}`}
                scroll={{ x: "max-content" }}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  {
                    title: "Order",
                    dataIndex: "order_number",
                    render: (v) => <Tag color="purple">{v}</Tag>,
                    width: 90,
                  },
                  {
                    title: "Print File",
                    dataIndex: "printing_file_name",
                    render: (v, r: any) => (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{v}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.product_name}</div>
                      </div>
                    ),
                  },
                  {
                    title: "Qty",
                    dataIndex: "suggested_quantity",
                    width: 50,
                    render: (v) => <Tag>{v}</Tag>,
                  },
                  {
                    title: "",
                    key: "add",
                    width: 60,
                    render: (r: any) => (
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => addOrderItemToBuild(r)}
                        style={{ background: "var(--accent-purple)", borderColor: "var(--accent-purple)" }}
                      />
                    ),
                  },
                ]}
              />
            </Card>

            <Card
              title={<Space><AppstoreOutlined /><span>Add Print File by Search</span></Space>}
              bordered={false}
              style={{ background: "var(--bg-secondary)", marginTop: 12 }}
            >
              <Input.Search
                placeholder="Search printing files by name or product..."
                allowClear
                onSearch={(v) => fetchPrintingFiles(v)}
                onChange={(e) => { if (!e.target.value) fetchPrintingFiles(); }}
                style={{ marginBottom: 12 }}
              />
              <Table
                size="small"
                dataSource={printingFiles.slice(0, 12)}
                rowKey="id"
                scroll={{ x: "max-content" }}
                pagination={false}
                columns={[
                  {
                    title: "Design",
                    dataIndex: "design_file_1_url",
                    width: 50,
                    render: (url) => url ? (
                      <img src={url} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 3 }} />
                    ) : <FileImageOutlined style={{ fontSize: 24, color: "var(--text-muted)" }} />,
                  },
                  {
                    title: "File Name / Product",
                    render: (r: any) => (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.product_name}</div>
                      </div>
                    ),
                  },
                  {
                    title: "",
                    key: "add",
                    width: 60,
                    render: (r: any) => (
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => addPrintFileToBuild(r)}
                        style={{ background: "var(--accent-purple)", borderColor: "var(--accent-purple)" }}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          {/* Right: build queue */}
          <Col xs={24} lg={10}>
            <Card
              title={
                <Space>
                  <PrinterOutlined style={{ color: "var(--accent-purple)" }} />
                  <span>Print Queue</span>
                  <Badge count={buildItems.length} color="purple" />
                </Space>
              }
              bordered={false}
              style={{ background: "var(--bg-secondary)", position: "sticky", top: 20 }}
              extra={
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={saveList}
                  loading={saving}
                  disabled={buildItems.length === 0}
                  style={{ background: "var(--accent-purple)", borderColor: "var(--accent-purple)" }}
                >
                  Save List
                </Button>
              }
            >
              <Space style={{ marginBottom: 12, width: "100%" }} direction="vertical">
                <Input
                  placeholder={`List name (auto: date-time if blank)`}
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  prefix={<OrderedListOutlined style={{ color: "var(--text-muted)" }} />}
                />
                <Input.TextArea
                  placeholder="Batch notes (optional)..."
                  value={listNotes}
                  onChange={(e) => setListNotes(e.target.value)}
                  rows={2}
                />
              </Space>

              {buildItems.length === 0 ? (
                <Empty
                  description={<Text style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    Add items from order filter or file search on the left.
                  </Text>}
                />
              ) : (
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {buildItems.map((item, idx) => (
                    <div key={idx} style={{
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid var(--border-glass)",
                      background: "rgba(139,92,246,0.04)",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}>
                      {item.design_file_1_url ? (
                        <img
                          src={item.design_file_1_url}
                          alt=""
                          style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, background: "#0a0a12", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FileImageOutlined style={{ color: "var(--text-muted)" }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.printing_file_name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--accent-purple)", marginBottom: 4 }}>
                          {item.product_name}
                        </div>
                        {item.order_number && (
                          <Tag color="purple" style={{ fontSize: 10, marginBottom: 4 }}>{item.order_number}</Tag>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontSize: 11, color: "var(--text-muted)" }}>Qty:</Text>
                          <InputNumber
                            min={1}
                            max={9999}
                            value={item.quantity}
                            onChange={(v) => updateBuildItemQty(idx, v || 1)}
                            size="small"
                            style={{ width: 70 }}
                          />
                        </div>
                      </div>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => removeBuildItem(idx)}
                      />
                    </div>
                  ))}
                  <Divider style={{ margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <Text style={{ color: "var(--text-muted)" }}>Total Items: <b>{buildItems.length}</b></Text>
                    <Text style={{ color: "var(--text-muted)" }}>
                      Total Qty: <b>{buildItems.reduce((s, i) => s + i.quantity, 0)}</b>
                    </Text>
                  </div>
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* â”€â”€ SAVED LISTS MODE â”€â”€ */}
      {mode === "saved" && (
        <Card
          title={<Space><OrderedListOutlined style={{ color: "var(--accent-purple)" }} /><span>Saved Print Lists</span></Space>}
          bordered={false}
          style={{ background: "var(--bg-secondary)" }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={fetchSavedLists} loading={loadingLists} size="small">
              Refresh
            </Button>
          }
        >
          <Table
            loading={loadingLists}
            dataSource={savedLists}
            rowKey="id"
            scroll={{ x: "max-content" }}
            expandable={{
              expandedRowRender: (record: PreparedList) => (
                <div style={{ padding: "8px 0" }}>
                  <Table
                    size="small"
                    dataSource={record.items}
                    rowKey={(i: any) => `${i.printing_file_id}-${i.order_number}`}
                    pagination={false}
                    columns={[
                      {
                        title: "Design",
                        dataIndex: "design_file_1_url",
                        width: 60,
                        render: (url) => url ? (
                          <img src={url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 3 }} />
                        ) : <FileImageOutlined />,
                      },
                      { title: "Print File", dataIndex: "printing_file_name" },
                      { title: "Product", dataIndex: "product_name", render: (v) => <Text style={{ color: "var(--accent-purple)" }}>{v}</Text> },
                      {
                        title: "Sizes",
                        render: (r: any) => (
                          <Space>
                            <Tag color="blue">{r.design_file_1_width_mm}Ã—{r.design_file_1_height_mm}mm</Tag>
                            {r.design_file_2_url && <Tag color="geekblue">D2: {r.design_file_2_width_mm}Ã—{r.design_file_2_height_mm}mm</Tag>}
                          </Space>
                        ),
                      },
                      { title: "Order Ref", dataIndex: "order_number", render: (v) => v ? <Tag color="purple">{v}</Tag> : "â€”" },
                      { title: "Qty", dataIndex: "quantity", render: (v) => <b style={{ color: "var(--accent-purple)" }}>{v}</b>, width: 60 },
                    ]}
                  />
                </div>
              ),
            }}
            columns={[
              {
                title: "List Name",
                dataIndex: "name",
                render: (v) => <b style={{ color: "var(--text-main)" }}>{v}</b>,
              },
              {
                title: "Created",
                dataIndex: "created_at",
                render: (v) => new Date(v).toLocaleString(),
                width: 160,
              },
              {
                title: "Items",
                dataIndex: "total_items",
                render: (v) => <Badge count={v} color="purple" />,
                width: 70,
              },
              {
                title: "Total Qty",
                dataIndex: "total_quantity",
                render: (v) => <Tag color="geekblue">{v}</Tag>,
                width: 90,
              },
              {
                title: "Notes",
                dataIndex: "notes",
                render: (v) => v ? <Text style={{ color: "var(--text-muted)", fontSize: 12 }}>{v}</Text> : "â€”",
              },
              {
                title: "Actions",
                key: "actions",
                width: 200,
                render: (record: PreparedList) => (
                  <Space>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEditList(record)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={downloadingPdf === record.id}
                      onClick={() => downloadPdf(record.id, record.name)}
                      style={{ color: "var(--accent-purple)", borderColor: "var(--accent-purple)" }}
                    >
                      PDF
                    </Button>
                    <Popconfirm
                      title="Delete this print list?"
                      onConfirm={() => deleteList(record.id)}
                      okType="danger" okText="Delete" cancelText="Cancel"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* Edit saved list drawer */}
      <Drawer
        title={
          <Space>
            <EditOutlined style={{ color: "var(--accent-purple)" }} />
            <span>Edit Print List</span>
          </Space>
        }
        width={560}
        open={listDrawerOpen}
        onClose={() => { setListDrawerOpen(false); setEditingList(null); setBuildItems([]); }}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={updateEditList}
            loading={saving}
            style={{ background: "var(--accent-purple)", borderColor: "var(--accent-purple)" }}
          >
            Update
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            placeholder="List name"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            addonBefore="Name"
          />
          <Input.TextArea
            placeholder="Batch notes..."
            value={listNotes}
            onChange={(e) => setListNotes(e.target.value)}
            rows={2}
          />
          <Divider style={{ margin: "8px 0" }}>Items</Divider>
          {buildItems.map((item, idx) => (
            <div key={idx} style={{
              padding: 10, borderRadius: 6,
              border: "1px solid var(--border-glass)",
              background: "rgba(139,92,246,0.04)",
              display: "flex", gap: 10, alignItems: "center",
            }}>
              {item.design_file_1_url ? (
                <img src={item.design_file_1_url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 3 }} />
              ) : (
                <FileImageOutlined style={{ fontSize: 24, color: "var(--text-muted)" }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.printing_file_name}</div>
                <div style={{ fontSize: 11, color: "var(--accent-purple)" }}>{item.product_name}</div>
                {item.order_number && <Tag color="purple" style={{ fontSize: 10 }}>{item.order_number}</Tag>}
              </div>
              <InputNumber
                min={1}
                value={item.quantity}
                onChange={(v) => updateBuildItemQty(idx, v || 1)}
                size="small"
                style={{ width: 70 }}
              />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeBuildItem(idx)} />
            </div>
          ))}
        </Space>
      </Drawer>
    </Space>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Page
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const PrintingQueue: React.FC = () => {
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={2} style={{ margin: 0, color: "var(--text-main)" }}>
          <PrinterOutlined style={{ color: "var(--accent-purple)", marginRight: 10 }} />
          Printing Queue
        </Title>
        <Text style={{ color: "var(--text-muted)" }}>
          Manage print design files, build press-ready instruction sheets, and download PDF reports for your printing & press office.
        </Text>
      </div>

      <Tabs
        defaultActiveKey="library"
        type="card"
        size="large"
        items={[
          {
            key: "library",
            label: (
              <span>
                <AppstoreOutlined />
                Print Files Library
              </span>
            ),
            children: <PrintFilesLibrary />,
          },
          {
            key: "prepare",
            label: (
              <span>
                <PrinterOutlined />
                Prepare Print
              </span>
            ),
            children: <PreparePrint />,
          },
        ]}
      />
    </Space>
  );
};

export default PrintingQueue;


