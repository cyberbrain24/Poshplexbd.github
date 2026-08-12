import React, { useState, useEffect } from "react";
import {
  Table, Card, Tabs, Space, Button, Badge, Modal, Form, Input, InputNumber,
  Select, DatePicker, Switch, Descriptions, List, Rate, Tag, message, Typography,
  Divider, Drawer, Timeline, Row, Col, Progress, Alert, Upload, Popconfirm
} from "antd";
import {
  UserOutlined, CheckCircleOutlined, CloseCircleOutlined, EnvironmentOutlined,
  StarOutlined, MessageOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  DownloadOutlined, LoginOutlined, SmileOutlined, WarningOutlined, SolutionOutlined
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

// import Reviews from "./reviews";
// import MembershipTiers from "./membership-tiers";
// import Locations from "./locations";

const CRM_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/crm";
const ORDERS_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/orders";
const CATALOG_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/catalog";

const Reviews: React.FC = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [form] = Form.useForm();
  const [imageList, setImageList] = useState<any[]>([]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createImageList, setCreateImageList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const res = await axios.get(`${CATALOG_URL}/admin/reviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReviews(res.data);
    } catch (err) {
      message.error("Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleModerate = async (id: number, action: any) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.post(`${CATALOG_URL}/admin/reviews/${id}/moderate`, action, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Review updated successfully.");
      fetchReviews();
    } catch (err) {
      message.error("Failed to moderate review.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.delete(`${CATALOG_URL}/admin/reviews/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Review deleted successfully.");
      fetchReviews();
    } catch (err) {
      message.error("Failed to delete review.");
    }
  };

  const openEditModal = (review: any) => {
    setEditingReview(review);
    form.setFieldsValue({
      comment: review.comment,
      rating: review.rating
    });
    if (review.images) {
      setImageList(review.images.map((url: string, idx: number) => ({
        uid: String(idx),
        name: `image-${idx}.webp`,
        status: 'done',
        url: url
      })));
    } else {
      setImageList([]);
    }
    setIsModalOpen(true);
  };

  const handleEditSubmit = async (values: any) => {
    const finalImages = imageList.map(f => f.url || (f.response && f.response.url)).filter(Boolean);
    await handleModerate(editingReview.id, { ...values, images: finalImages });
    setIsModalOpen(false);
  };

  const handleUploadChange = ({ fileList }: any) => setImageList(fileList);

  const openCreateModal = async () => {
    createForm.resetFields();
    setCreateImageList([]);
    setIsCreateModalOpen(true);
    
    const token = localStorage.getItem("poshplex_token") || "admin_imran";
    try {
      const [custRes, prodRes] = await Promise.all([
        axios.get(`${CRM_URL}/profiles`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${CATALOG_URL}/admin/products?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setCustomers(custRes.data);
      setProducts(prodRes.data.results || []);
    } catch(err) {}
  };

  const handleCreateSubmit = async (values: any) => {
    const finalImages = createImageList.map(f => f.url || (f.response && f.response.url)).filter(Boolean);
    const token = localStorage.getItem("poshplex_token") || "admin_imran";
    try {
      await axios.post(`${CATALOG_URL}/admin/reviews/create`, {
        ...values,
        images: finalImages
      }, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Review created successfully.");
      setIsCreateModalOpen(false);
      fetchReviews();
    } catch (err) {
      message.error("Failed to create review.");
    }
  };

  const handleCreateUploadChange = ({ fileList }: any) => setCreateImageList(fileList);
  const uploadToken = localStorage.getItem("poshplex_token") || "admin_imran";

  return (
    <Card 
      title="Product Reviews"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Create Review</Button>}
    >
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
        dataSource={reviews}
        loading={loading}
        renderItem={(item) => (
          <List.Item style={{ height: '100%' }}>
            <Card 
              title={
                <span style={{ whiteSpace: 'normal', display: 'block', lineHeight: 1.3, paddingRight: 24, fontSize: 13, fontWeight: 700 }}>
                  {item.product_name}
                </span>
              } 
              size="small"
              extra={
                <Popconfirm title="Delete this review?" onConfirm={() => handleDelete(item.id)}>
                  <Button danger size="small" type="text" icon={<DeleteOutlined />} style={{ position: 'absolute', top: 8, right: 8 }} />
                </Popconfirm>
              }
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12 }}
            >
              <div style={{ marginBottom: 8 }}>
                <Rate disabled defaultValue={item.rating} style={{ fontSize: 14 }} />
              </div>
              <p style={{ fontSize: 13, flex: 1, margin: '0 0 12px 0' }}>{item.comment}</p>
              
              {item.images && item.images.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                  {item.images.map((img: string, i: number) => <img key={i} src={img} style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4}} />)}
                </div>
              )}
              
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                By: <b>{item.username}</b> {item.customer_phone ? `(${item.customer_phone})` : ''}
              </div>
              
              <Space direction="vertical" style={{ width: '100%', borderTop: '1px solid #eee', paddingTop: 12 }} size={12}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12 }}>Approved</span>
                  <Switch size="small" checked={item.is_approved} onChange={(c) => handleModerate(item.id, { is_approved: c })} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12 }}>Featured</span>
                  <Switch size="small" checked={item.is_featured} onChange={(c) => handleModerate(item.id, { is_featured: c })} />
                </div>
                <Button size="small" block onClick={() => openEditModal(item)}>Edit Review</Button>
              </Space>
            </Card>
          </List.Item>
        )}
      />

      <Modal title="Edit Review" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item label="Rating" name="rating" rules={[{ required: true }]}>
            <Rate />
          </Form.Item>
          <Form.Item label="Comment" name="comment" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Listing Order" name="listing_order" initialValue={0}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Images">
            <Upload
              action={`${CATALOG_URL}/reviews/upload-photo`}
              headers={{ Authorization: `Bearer ${uploadToken}` }}
              listType="picture-card"
              fileList={imageList}
              onChange={handleUploadChange}
            >
              {imageList.length >= 5 ? null : <div><PlusOutlined /><div style={{ marginTop: 8 }}>Upload</div></div>}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Create Review" open={isCreateModalOpen} onCancel={() => setIsCreateModalOpen(false)} onOk={() => createForm.submit()} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item label="Customer" name="customer_phone" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select a customer" optionFilterProp="children" filterOption={(input, option: any) => option.children.join('').toLowerCase().includes(input.toLowerCase())}>
              {customers.map(c => <Select.Option key={c.phone} value={c.phone}>{c.phone} - {c.user?.username || ''}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Product" name="product_id" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select a product" optionFilterProp="children" filterOption={(input, option: any) => option.children.toLowerCase().includes(input.toLowerCase())}>
              {products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Rating" name="rating" rules={[{ required: true }]} initialValue={5}>
            <Rate />
          </Form.Item>
          <Form.Item label="Comment" name="comment" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Listing Order" name="listing_order" initialValue={0}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Images">
            <Upload
              action={`${CATALOG_URL}/reviews/upload-photo`}
              headers={{ Authorization: `Bearer ${uploadToken}` }}
              listType="picture-card"
              fileList={createImageList}
              onChange={handleCreateUploadChange}
            >
              {createImageList.length >= 5 ? null : <div><PlusOutlined /><div style={{ marginTop: 8 }}>Upload</div></div>}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

const MembershipTiers: React.FC = () => {
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchTiers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const res = await axios.get(`${CRM_URL}/tiers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTiers(res.data);
    } catch (err) {
      message.error("Failed to load membership tiers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  const openModal = (tier: any = null) => {
    setSelectedTier(tier);
    if (tier) {
      form.setFieldsValue(tier);
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      if (selectedTier) {
        await axios.put(`${CRM_URL}/tiers/${selectedTier.id}`, values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Membership Tier updated successfully.");
      } else {
        await axios.post(`${CRM_URL}/tiers`, values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Membership Tier created successfully.");
      }
      setIsModalOpen(false);
      form.resetFields();
      setSelectedTier(null);
      fetchTiers();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "Failed to save tier.");
    }
  };

  const handleDeleteTier = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.delete(`${CRM_URL}/tiers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Membership Tier deleted successfully.");
      fetchTiers();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "Failed to delete tier.");
    }
  };

  const columns = [
    { title: "Tier ID", dataIndex: "id", key: "id" },
    { title: "Name", dataIndex: "name", key: "name", render: (t: string) => <b>{t}</b> },
    { title: "Description", dataIndex: "description", key: "description" },
    { title: "Status", dataIndex: "is_active", key: "is_active", render: (v: boolean) => <Tag color={v ? "green" : "red"}>{v ? "Active" : "Inactive"}</Tag> },
    {
      title: "Actions", key: "actions", render: (r: any) => (
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openModal(r)}>Edit</Button>
      )
    }
  ];

  return (
    <Card
      title="Membership Tiers"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Membership Tier</Button>}
    >
      <Table scroll={{ x: 'max-content' }} loading={loading} dataSource={tiers} columns={columns} rowKey="id" />

      <Modal
        title={selectedTier ? "Edit Membership Tier" : "Add Membership Tier"}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setSelectedTier(null); }}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item name="name" label="Tier Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., VIP, Gold, Diamond" style={{ borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active Status" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export const CRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState("1");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Metadata dropdown options
  const [tiers, setTiers] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [thanas, setThanas] = useState<any[]>([]);
  const [filteredThanas, setFilteredThanas] = useState<any[]>([]);

  // Filtering states
  const [filterTier, setFilterTier] = useState<number | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<number | undefined>(undefined);
  const [filterGender, setFilterGender] = useState<string | undefined>(undefined);

  // Detail Drawer and Forms states
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [form] = Form.useForm();
  const [noteForm] = Form.useForm();

  // CSV Bulk Mapping states
  const [parsedCsvData, setParsedCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [columnMapping, setColumnMapping] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "",
    birthdate: "",
    membership_tier: "",
    district: "",
    thana: "",
    address: "",
    is_active: ""
  });
  const [defaultSettings, setDefaultSettings] = useState<{ membership_tier_id?: number; district_id?: number; thana_id?: number }>({});
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Mock reviews removed in favor of the full Reviews component

  // Exporter for CRM sample uploader template (only customer name, no username)
  const downloadCrmTemplate = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Name,Phone,Email,Gender,Birthdate,Membership Type,District,Thana,Address,Active\n";
    csvContent += '"Imran Ahmed","01711223344","imran@gmail.com","male","1995-05-12","VIP","Dhaka","Gulshan","House 12, Road 4","Yes"\n';
    csvContent += '"Sadia Islam","01811223344","sadia@gmail.com","female","1998-08-20","Regular","Chittagong","Kotwali","Flat 3A, Building B","Yes"\n';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Poshplex_CRM_Import_Sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch CRM Customers
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const params: any = {};
      if (searchText) params.search = searchText;
      if (filterTier) params.tier_id = filterTier;
      if (filterDistrict) params.district_id = filterDistrict;
      if (filterGender) params.gender = filterGender;

      const res = await axios.get(`${CRM_URL}/customers`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data);
    } catch (err) {
      message.error("Failed to load customer CRM profiles.");
    } finally {
      setLoading(false);
    }
  };

  // Client-side CSV uploader parser
  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length === 0) {
        message.error("Uploaded CSV file is empty.");
        return;
      }

      const parseLine = (line: string) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseLine(lines[0]);
      const rows = lines.slice(1).map(parseLine);
      setParsedCsvData({ headers, rows });
      message.success("CSV file parsed successfully! Configure column mapping below.");
    };
    reader.readAsText(file);
  };

  const getMappedValue = (row: string[], colName: string) => {
    if (!colName || !parsedCsvData) return "";
    const idx = parsedCsvData.headers.indexOf(colName);
    return idx !== -1 ? row[idx] : "";
  };

  // Helper resolvers mapping text values to database relational IDs
  const getMatchedDistrictId = (districtName: string) => {
    if (!districtName) return null;
    const matched = districts.find(d => d.name.toLowerCase() === districtName.trim().toLowerCase());
    return matched ? matched.id : null;
  };

  const getMatchedThanaId = (thanaName: string, districtId: number | null) => {
    if (!thanaName) return null;
    let matched = thanas.find(t => t.name.toLowerCase() === thanaName.trim().toLowerCase());
    if (districtId) {
      const sameDistrictThana = thanas.find(t => t.name.toLowerCase() === thanaName.trim().toLowerCase() && t.district_id === districtId);
      if (sameDistrictThana) matched = sameDistrictThana;
    }
    return matched ? matched.id : null;
  };

  const getMatchedTierId = (tierName: string) => {
    if (!tierName) return null;
    const matched = tiers.find(t => t.name.toLowerCase() === tierName.trim().toLowerCase());
    return matched ? matched.id : null;
  };

  const previewRows = parsedCsvData
    ? parsedCsvData.rows.map((row, rowIdx) => {
      const csvDistrict = getMappedValue(row, columnMapping.district);
      const resolvedDistrictId = getMatchedDistrictId(csvDistrict) || defaultSettings.district_id || null;

      const csvThana = getMappedValue(row, columnMapping.thana);
      const resolvedThanaId = getMatchedThanaId(csvThana, resolvedDistrictId) || defaultSettings.thana_id || null;

      const csvTier = getMappedValue(row, columnMapping.membership_tier);
      const resolvedTierId = getMatchedTierId(csvTier) || defaultSettings.membership_tier_id || null;

      const csvActive = getMappedValue(row, columnMapping.is_active);
      const resolvedActive = csvActive ? ["yes", "true", "1", "active"].includes(csvActive.toLowerCase()) : true;

      return {
        key: rowIdx,
        name: getMappedValue(row, columnMapping.name),
        phone: getMappedValue(row, columnMapping.phone),
        email: getMappedValue(row, columnMapping.email),
        gender: getMappedValue(row, columnMapping.gender),
        birthdate: getMappedValue(row, columnMapping.birthdate),
        address: getMappedValue(row, columnMapping.address),
        district_id: resolvedDistrictId,
        district_name: csvDistrict || (resolvedDistrictId ? districts.find(d => d.id === resolvedDistrictId)?.name : "-"),
        thana_id: resolvedThanaId,
        thana_name: csvThana || (resolvedThanaId ? thanas.find(t => t.id === resolvedThanaId)?.name : "-"),
        membership_tier_id: resolvedTierId,
        membership_tier_name: csvTier || (resolvedTierId ? tiers.find(t => t.id === resolvedTierId)?.name : "Regular"),
        is_active: resolvedActive
      };
    })
    : [];

  const executeCrmBulkImport = async () => {
    setImportLoading(true);
    setImportProgress({ current: 0, total: previewRows.length });
    const token = localStorage.getItem("poshplex_token") || "admin_imran";
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      const nameVal = row.name;
      if (!nameVal || !row.phone) {
        failCount++;
        setImportProgress(prev => ({ ...prev, current: i + 1 }));
        continue;
      }

      // Check client-side for duplicates by unique phone number
      const phoneExists = customers.some(c => c.phone.trim() === row.phone.trim());
      if (phoneExists) {
        failCount++;
        setImportProgress(prev => ({ ...prev, current: i + 1 }));
        continue;
      }

      const payload = {
        name: nameVal,
        username: row.phone, // Use phone number as unique system username key
        phone: row.phone,
        email: row.email || null,
        gender: ["male", "female", "other"].includes(row.gender?.toLowerCase()) ? row.gender.toLowerCase() : "unspecified",
        birthdate: row.birthdate || null,
        district_id: row.district_id,
        thana_id: row.thana_id,
        address: row.address || null,
        membership_tier_id: row.membership_tier_id,
        is_active: row.is_active
      };

      try {
        await axios.post(`${CRM_URL}/customers`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
      setImportProgress(prev => ({ ...prev, current: i + 1 }));
    }

    message.success(`Bulk import completed: ${successCount} successfully registered, ${failCount} failed.`);
    setImportLoading(false);
    setParsedCsvData(null);
    setColumnMapping({
      name: "",
      phone: "",
      email: "",
      gender: "",
      birthdate: "",
      membership_tier: "",
      district: "",
      thana: "",
      address: "",
      is_active: ""
    });
    setImportProgress({ current: 0, total: 0 });
    fetchCustomers();
  };

  // Load Metadata
  const loadMetadata = async () => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const [tiersRes, distsRes, thanasRes] = await Promise.all([
        axios.get(`${CRM_URL}/tiers`),
        axios.get(`${ORDERS_URL}/locations/districts`),
        axios.get(`${ORDERS_URL}/locations/thanas`)
      ]);
      setTiers(tiersRes.data);
      setDistricts(distsRes.data);
      setThanas(thanasRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, filterTier, filterDistrict, filterGender]);

  // Load Detailed Card profile
  const fetchCustomerDetail = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const res = await axios.get(`${CRM_URL}/customers/${id}/detail`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetailData(res.data);
      setIsDetailOpen(true);
    } catch (err) {
      message.error("Failed to load customer profile details.");
    }
  };

  // District select cascading dropdown trigger
  const handleDistrictChange = (districtId: number) => {
    const matched = thanas.filter(t => t.district_id === districtId);
    setFilteredThanas(matched);
    form.setFieldsValue({ thana_id: undefined });
  };

  // Create / Update Customer profile
  const handleSave = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";

      const payload = {
        ...values,
        birthdate: values.birthdate ? values.birthdate.format("YYYY-MM-DD") : null
      };

      if (selectedCustomer) {
        await axios.put(`${CRM_URL}/customers/${selectedCustomer.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Customer CRM profile updated successfully.");
      } else {
        await axios.post(`${CRM_URL}/customers`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success("Manual shadow customer account registered.");
      }

      setIsEditModalOpen(false);
      form.resetFields();
      fetchCustomers();
    } catch (err: any) {
      console.error("Save error:", err.response?.data);
      message.error(err.response?.data?.detail || err.response?.data?.message || "Failed to save customer profile.");
    }
  };

  // Soft Deactivate status inline
  const handleToggleActive = async (record: any, checked: boolean) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const payload = {
        name: record.username,
        phone: record.phone,
        email: record.email,
        gender: record.gender,
        birthdate: record.birthdate,
        district_id: record.district_id,
        thana_id: record.thana_id,
        address: record.address,
        membership_tier_id: record.membership_tier_id,
        is_active: checked
      };
      await axios.put(`${CRM_URL}/customers/${record.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`User status changed to: ${checked ? "Active" : "Inactive (Soft-Disabled)"}`);
      fetchCustomers();
    } catch (err) {
      message.error("Failed to toggle status.");
    }
  };

  // Delete Customer
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: "Confirm Customer Deletion",
      content: "Are you sure you want to delete this customer? This action is protected by referential rules if the customer has existing orders.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const token = localStorage.getItem("poshplex_token") || "admin_imran";
          await axios.delete(`${CRM_URL}/customers/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          message.success("Customer deleted successfully.");
          fetchCustomers();
        } catch (err: any) {
          message.error(err.response?.data?.message || "Cannot delete customer with linked orders.");
        }
      }
    });
  };

  // Impersonate User Session
  const handleImpersonate = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const res = await axios.post(`${CRM_URL}/customers/${id}/impersonate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Open the storefront impersonation page in a new tab
      const storefrontUrl = import.meta.env.VITE_STOREFRONT_URL || "http://localhost:3001";
      const impersonationUrl = `${storefrontUrl}/impersonate?token=${res.data.token}`;
      window.open(impersonationUrl, "_blank");

      message.success(`Impersonating customer ${res.data.impersonated_username} in a new tab.`);
    } catch (err) {
      console.error(err);
      message.error("Failed to open impersonation session.");
    }
  };

  // Collaborative Timeline notes post
  const handlePostNote = async (values: any) => {
    if (!detailData) return;
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const res = await axios.post(`${CRM_URL}/customers/${detailData.profile.id}/notes`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Timeline note logged successfully.");
      noteForm.resetFields();

      // Re-load detail logs
      const updatedNotes = [res.data, ...detailData.notes];
      setDetailData({
        ...detailData,
        notes: updatedNotes
      });
    } catch (err) {
      message.error("Failed to save timeline note.");
    }
  };

  // CSV Export filtered list with all requested CRM customer profile fields (only Name, no Username)
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM to support UTF-8 characters in Excel
    csvContent += "Name,Phone,Email,Gender,Birthdate,Membership Type,District,Thana,Address,Active,Orders,Total Spent\n";

    const escapeCSV = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    customers.forEach((c) => {
      const row = [
        escapeCSV(c.username), // Customer Name
        escapeCSV(c.phone),
        escapeCSV(c.email || "-"),
        escapeCSV(c.gender || "unspecified"),
        escapeCSV(c.birthdate || "-"),
        escapeCSV(c.membership_tier_name || "Regular"),
        escapeCSV(c.district_name || "-"),
        escapeCSV(c.thana_name || "-"),
        escapeCSV(c.address || "-"),
        escapeCSV(c.is_active ? "Yes" : "No"),
        c.total_orders,
        Math.round(c.lifetime_spend)
      ];
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CRM_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Moderation functions removed

  const customerColumns = [
    { title: "Customer Name", dataIndex: "username", key: "username", render: (text: string, rec: any) => <a onClick={() => fetchCustomerDetail(rec.id)}><b>{text}</b></a> },
    { title: "Phone number", dataIndex: "phone", key: "phone" },
    {
      title: "Location Hub",
      key: "location",
      render: (record: any) => (
        <span><EnvironmentOutlined style={{ color: "var(--accent-purple)" }} /> {record.thana_name || "Thana"}, {record.district_name || "District"}</span>
      )
    },
    {
      title: "Membership Tier",
      dataIndex: "membership_tier_name",
      key: "membership_tier_name",
      render: (tier: string) => <Tag color="purple">{tier?.toUpperCase() || "REGULAR"}</Tag>
    },
    { title: "Total Orders", dataIndex: "total_orders", key: "total_orders", render: (val: any) => <Badge count={val} showZero color="#8b5cf6" /> },
    { title: "Spend (BDT)", dataIndex: "lifetime_spend", key: "lifetime_spend", render: (val: any) => <b>৳{Math.round(parseFloat(val))}</b> },
    { title: "Active Status", dataIndex: "is_active", render: (active: any, record: any) => <Switch checked={active} onChange={(checked) => handleToggleActive(record, checked)} /> },
    {
      title: "Operations",
      key: "operations",
      render: (record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setSelectedCustomer(record);
            form.setFieldsValue({
              ...record,
              name: record.username,
              birthdate: record.birthdate ? dayjs(record.birthdate) : null
            });
            if (record.district_id) {
              const matched = thanas.filter(t => t.district_id === record.district_id);
              setFilteredThanas(matched);
            }
            setIsEditModalOpen(true);
          }}>
            Edit
          </Button>
          <Button size="small" type="primary" icon={<LoginOutlined />} onClick={() => handleImpersonate(record.id)} style={{ backgroundColor: "var(--accent-cyan)", border: "none" }}>
            Impersonate
          </Button>
          <Popconfirm title="Delete this customer record?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Review columns removed

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-main)" }}>Customer Relations & CRM</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>Manage customer profiles, shipping routes, and reviews.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>Export</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedCustomer(null); setIsEditModalOpen(true); form.resetFields(); }} style={{ borderRadius: 6 }}>
            Register Customer
          </Button>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* Tab 1: Customer Profile List */}
        <Tabs.TabPane tab={<span><UserOutlined /> CRM Profiles</span>} key="1">
          <Card>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <Input
                placeholder="Search Name / Phone / Email..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ flex: 1, minWidth: 160, borderRadius: 6 }}
              />
              <Select placeholder="Membership Tier" allowClear onChange={setFilterTier} style={{ minWidth: 140, flex: 1 }}>
                {tiers.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
              <Select placeholder="District" allowClear onChange={setFilterDistrict} style={{ minWidth: 120, flex: 1 }}>
                {districts.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
              </Select>
              <Select placeholder="Gender" allowClear onChange={setFilterGender} style={{ minWidth: 100, flex: 1 }}>
                <Select.Option value="male">Male</Select.Option>
                <Select.Option value="female">Female</Select.Option>
                <Select.Option value="other">Other</Select.Option>
                <Select.Option value="unspecified">Unspecified</Select.Option>
              </Select>
            </div>

            <Table scroll={{ x: 'max-content' }} loading={loading} dataSource={customers} columns={customerColumns} rowKey="id" />
          </Card>
        </Tabs.TabPane>

        {/* Tab 2: Reviews Moderation */}
        <Tabs.TabPane tab={<span><MessageOutlined /> Product Reviews</span>} key="2">
          <Reviews />
        </Tabs.TabPane>

        {/* Tab 3: Membership Tiers */}
        <Tabs.TabPane tab={<span><SolutionOutlined /> Membership Tiers</span>} key="3">
          <MembershipTiers />
        </Tabs.TabPane>



        {/* Tab 5: Bulk Customer Import */}
        <Tabs.TabPane tab={<span><DownloadOutlined /> Bulk CSV Import</span>} key="5">
          <Card title="CSV Client-Side Column Mapper Uploader">
            {!parsedCsvData ? (
              <div>
                <Alert
                  message="CSV Bulk Import Guidelines"
                  description="Upload your client-list database file in CSV format. In the next step, you will be able to map your custom CSV headers to Poshplex customer profile fields (Name, Phone, Email, etc.) and preview the rearranged table before importing."
                  type="info"
                  showIcon
                  style={{ marginBottom: 20 }}
                  action={
                    <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={downloadCrmTemplate} style={{ borderRadius: 0 }}>
                      Download CSV Template
                    </Button>
                  }
                />
                <Upload.Dragger
                  beforeUpload={(file) => {
                    handleCsvUpload(file);
                    return false;
                  }}
                  multiple={false}
                  showUploadList={false}
                  accept=".csv"
                >
                  <p className="ant-upload-drag-icon">
                    <DownloadOutlined style={{ fontSize: 40, color: "var(--accent-purple)" }} />
                  </p>
                  <p className="ant-upload-text">Click or drag CSV file here to start column mapping</p>
                </Upload.Dragger>
              </div>
            ) : (
              <div>
                <Alert
                  message="Column Mapping Configuration"
                  description="Select which CSV headers correspond to the required Customer Profile parameters. The table preview will instantly rearrange to verify matches before final import."
                  type="warning"
                  showIcon
                  style={{ marginBottom: 20 }}
                  action={
                    <Button size="small" onClick={() => setParsedCsvData(null)}>
                      Upload Different File
                    </Button>
                  }
                />

                <Card type="inner" title="Field Alignment Mapping" style={{ marginBottom: 24 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Form.Item label="Customer Name (Required)" required>
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.name}
                          onChange={(val) => setColumnMapping({ ...columnMapping, name: val })}
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Phone Number (Required)" required>
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.phone}
                          onChange={(val) => setColumnMapping({ ...columnMapping, phone: val })}
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Email Address">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.email}
                          onChange={(val) => setColumnMapping({ ...columnMapping, email: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Gender">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.gender}
                          onChange={(val) => setColumnMapping({ ...columnMapping, gender: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Birthdate">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.birthdate}
                          onChange={(val) => setColumnMapping({ ...columnMapping, birthdate: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Membership Type">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.membership_tier}
                          onChange={(val) => setColumnMapping({ ...columnMapping, membership_tier: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="District">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.district}
                          onChange={(val) => setColumnMapping({ ...columnMapping, district: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Thana">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.thana}
                          onChange={(val) => setColumnMapping({ ...columnMapping, thana: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Address">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.address}
                          onChange={(val) => setColumnMapping({ ...columnMapping, address: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Active Status">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.is_active}
                          onChange={(val) => setColumnMapping({ ...columnMapping, is_active: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "12px 0" }}>Fallback Defaults (When Mappings Are Empty)</Divider>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Default Membership Tier">
                        <Select
                          placeholder="Assign to all imported profiles"
                          value={defaultSettings.membership_tier_id}
                          onChange={(val) => setDefaultSettings({ ...defaultSettings, membership_tier_id: val })}
                          allowClear
                        >
                          {tiers.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Default District">
                        <Select
                          placeholder="Assign to all imported profiles"
                          value={defaultSettings.district_id}
                          onChange={(val) => {
                            setDefaultSettings({ ...defaultSettings, district_id: val, thana_id: undefined });
                            const matched = thanas.filter(t => t.district_id === val);
                            setFilteredThanas(matched);
                          }}
                          allowClear
                        >
                          {districts.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Default Thana">
                        <Select
                          placeholder="Assign to all imported"
                          value={defaultSettings.thana_id}
                          onChange={(val) => setDefaultSettings({ ...defaultSettings, thana_id: val })}
                          disabled={!defaultSettings.district_id}
                          allowClear
                        >
                          {filteredThanas.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ marginBottom: 12 }}>Rearranged Preview (Showing Mapped Fields)</h3>
                  <Table scroll={{ x: 'max-content' }}
                    size="small"
                    dataSource={previewRows}
                    rowKey="key"
                    columns={[
                      { title: "Mapped Name", dataIndex: "name", key: "name", render: (val) => val || <span style={{ color: "red" }}>Missing</span> },
                      { title: "Mapped Phone", dataIndex: "phone", key: "phone", render: (val) => val || <span style={{ color: "red" }}>Missing</span> },
                      { title: "Mapped Email", dataIndex: "email", key: "email", render: (val) => val || "-" },
                      { title: "Mapped Gender", dataIndex: "gender", key: "gender", render: (val) => val || "unspecified" },
                      { title: "Mapped Birthdate", dataIndex: "birthdate", key: "birthdate", render: (val) => val || "-" },
                      { title: "Mapped Tier", dataIndex: "membership_tier_name", key: "membership_tier_name" },
                      { title: "Mapped District", dataIndex: "district_name", key: "district_name" },
                      { title: "Mapped Thana", dataIndex: "thana_name", key: "thana_name" },
                      { title: "Mapped Address", dataIndex: "address", key: "address", render: (val) => val || "-" },
                      { title: "Mapped Active", dataIndex: "is_active", key: "is_active", render: (val) => val ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag> }
                    ]}
                  />
                </div>

                {importProgress.total > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <Progress percent={Math.round((importProgress.current / importProgress.total) * 100)} status="active" />
                    <p style={{ marginTop: 8 }}>Importing: {importProgress.current} of {importProgress.total} profiles completed...</p>
                  </div>
                )}

                <Button
                  type="primary"
                  onClick={executeCrmBulkImport}
                  loading={importLoading}
                  disabled={!columnMapping.name || !columnMapping.phone || previewRows.length === 0}
                  style={{ borderRadius: 0 }}
                >
                  Import {previewRows.length} Customers
                </Button>
              </div>
            )}
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* Add / Edit Form Modal */}
      <Modal
        title={selectedCustomer ? "Edit Customer CRM profile" : "Register Manual Customer"}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={() => form.submit()}
        width="min(700px, 96vw)"
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Customer Name" rules={[{ required: true }]}>
                <Input style={{ borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Unique Phone Number (Identity)" rules={[{ required: true }]}>
                <Input style={{ borderRadius: 0 }} placeholder="+8801XXXXXXXXX" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email Address">
                <Input style={{ borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="membership_tier_id" label="Membership tier Assignment">
                <Select placeholder="Assign membership tier" allowClear>
                  {tiers.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="gender" label="Gender Orientation" initialValue="unspecified">
                <Select>
                  <Select.Option value="male">Male</Select.Option>
                  <Select.Option value="female">Female</Select.Option>
                  <Select.Option value="other">Other</Select.Option>
                  <Select.Option value="unspecified">Unspecified</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="birthdate" label="Birthdate (Calendar)">
                <DatePicker style={{ width: "100%", borderRadius: 0 }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Locations Hierarchy Cascades</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="district_id" label="District (Division)" rules={[{ required: true, message: "District is required" }]}>
                <Select placeholder="Choose District" onChange={handleDistrictChange}>
                  {districts.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="thana_id" label="Thana (Area Hub)" rules={[{ required: true, message: "Thana is required" }]}>
                <Select placeholder="Choose Thana">
                  {filteredThanas.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="Detailed Delivery Street address">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} />
          </Form.Item>

          <Form.Item name="internal_notes" label="Internal admin notes remarks">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} />
          </Form.Item>

          <Form.Item name="is_active" label="Active status" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Customer Detail Drawer Overlay */}
      <Drawer
        title="CRM Customer Profile details"
        width="min(750px, 96vw)"
        onClose={() => setIsDetailOpen(false)}
        open={isDetailOpen}
      >
        {detailData && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>

            {/* Risk profile alerts */}
            <Alert
              message={`COD Reliability Score: ${Math.round(detailData.risk_profile.cod_reliability_score)}%`}
              description={`RTO Cancel rate: ${Math.round(detailData.risk_profile.cancellation_rate)}% | Total RTO counts: ${detailData.risk_profile.rto_count}`}
              type={detailData.risk_profile.cod_reliability_score < 75 ? "error" : detailData.risk_profile.cod_reliability_score < 90 ? "warning" : "success"}
              showIcon
              icon={<WarningOutlined />}
            />

            <Descriptions title="Customer Profile" bordered column={2}>
              <Descriptions.Item label="Customer Name">{detailData.profile.username}</Descriptions.Item>
              <Descriptions.Item label="Contact phone">{detailData.profile.phone}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailData.profile.email || "-"}</Descriptions.Item>
              <Descriptions.Item label="Membership Tier">{detailData.profile.membership_tier_name || "Regular"}</Descriptions.Item>
              <Descriptions.Item label="Gender">{detailData.profile.gender?.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="Birthday">{detailData.profile.birthdate || "-"}</Descriptions.Item>
              <Descriptions.Item label="District">{detailData.profile.district_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Thana">{detailData.profile.thana_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Detailed Address" span={2}>{detailData.profile.address || "-"}</Descriptions.Item>
            </Descriptions>

            <Divider>KPI summary metrics</Divider>
            <Row gutter={16}>
              <Col span={6}>
                <Card size="small">
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Lifetime spend</span>
                  <h2>৳{Math.round(detailData.kpis.lifetime_spend)}</h2>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Orders</span>
                  <h2>{detailData.kpis.total_orders}</h2>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Average value</span>
                  <h2>৳{Math.round(detailData.kpis.average_order_value)}</h2>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Last order date</span>
                  <span style={{ fontSize: 12, fontWeight: 700, display: "block", marginTop: 8 }}>
                    {detailData.kpis.last_order_date ? new Date(detailData.kpis.last_order_date).toLocaleDateString() : "-"}
                  </span>
                </Card>
              </Col>
            </Row>

            <Divider>Past checkout order logs</Divider>
            <Table scroll={{ x: 'max-content' }}
              size="small"
              dataSource={detailData.orders}
              pagination={{ pageSize: 5 }}
              rowKey="id"
              columns={[
                { title: "Invoice ID", dataIndex: "order_number", key: "order_number" },
                { title: "Amount", dataIndex: "total_amount", render: (val) => `৳${Math.round(val)}` },
                { title: "Status", dataIndex: "status", render: (s) => <Tag>{s?.toUpperCase()}</Tag> },
                { title: "Payment state", dataIndex: "payment_status", render: (p) => <Tag>{p?.toUpperCase()}</Tag> },
                { title: "Date", dataIndex: "created_at", render: (date) => new Date(date).toLocaleDateString() }
              ]}
            />

            <Divider>Collaborative timeline logs</Divider>
            <Form form={noteForm} onFinish={handlePostNote} layout="vertical">
              <Form.Item name="note" label="Record new timeline log remark" rules={[{ required: true }]}>
                <Input.TextArea placeholder="Type internal remark notes here..." rows={2} style={{ borderRadius: 0 }} />
              </Form.Item>
              <Button type="primary" htmlType="submit">Submit Note</Button>
            </Form>

            <Timeline style={{ marginTop: 24 }}>
              {detailData.notes?.map((n: any) => (
                <Timeline.Item key={n.id}>
                  <b>Log remark by {n.author_username}</b> - <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleString()}</span>
                  <p>{n.note}</p>
                </Timeline.Item>
              ))}
            </Timeline>

          </Space>
        )}
      </Drawer>
    </Space>
  );
};

export default CRM;




