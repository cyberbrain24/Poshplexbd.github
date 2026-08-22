import React, { useState, useEffect } from "react";
import {
  Table, Tag, Button, Space, Card, Modal, Form, Input, 
  InputNumber, Select, Descriptions, Divider, message, Tabs, Drawer, Timeline, Tooltip, Switch, Row, Col, Alert, Badge, Popconfirm
} from "antd";
import {
  ShoppingCartOutlined, CheckCircleOutlined, CarOutlined, 
  PrinterOutlined, PlusOutlined, ShoppingOutlined, EyeOutlined, SyncOutlined, DeleteOutlined, GiftOutlined, CloseCircleOutlined, EditOutlined, WhatsAppOutlined, SaveOutlined, PhoneOutlined
} from "@ant-design/icons";
import { EditOrderModal } from "../components/EditOrderModal";
import axios from "axios";

const API_URL = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/orders";
const CATALOG_API_URL = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/catalog";

export const Orders: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState("");
  
  // Extra list filters
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string | undefined>(undefined);
  const [filterCourier, setFilterCourier] = useState<string | undefined>(undefined);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string | undefined>(undefined);

  // Selection states
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Call notes state
  const [callNotes, setCallNotes] = useState<Record<number, string>>({});
  
  // Active Phone WhatsApp toggles
  const [activePhones, setActivePhones] = useState<Record<number, boolean>>({});

  const handleSaveCallNote = async (id: number) => {
    const note = callNotes[id];
    if (note === undefined) return;
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.patch(`${API_URL}/${id}/notes`, { internal_notes: note }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Call note saved.");
      fetchOrders();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to save note."); }
  };


  // Order counts & Edit Modal
  const [orderCounts, setOrderCounts] = useState<any>({});
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Modals / Drawer toggles
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Drawer editing state
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [draftDiscount, setDraftDiscount] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // New product flow states
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
  const [gridProducts, setGridProducts] = useState<any[]>([]);
  const [selectedGridProduct, setSelectedGridProduct] = useState<any>(null);
  const [selectedVariantSku, setSelectedVariantSku] = useState<string>("");
  const [addQty, setAddQty] = useState<number>(1);

  // Modal product flow states
  const [modalCategoryId, setModalCategoryId] = useState<number | null>(null);
  const [modalSubcategoryId, setModalSubcategoryId] = useState<number | null>(null);
  const [modalSearchText, setModalSearchText] = useState<string>("");
  const [modalGridProducts, setModalGridProducts] = useState<any[]>([]);
  const [modalSelectedProduct, setModalSelectedProduct] = useState<any>(null);
  const [modalVariantSku, setModalVariantSku] = useState<string>("");
  const [modalAddQty, setModalAddQty] = useState<number>(1);
  const [modalOverridePrice, setModalOverridePrice] = useState<number | undefined>(undefined);
  const [modalDraftItems, setModalDraftItems] = useState<any[]>([]);

  // Forms hooks
  const [orderForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  // Dynamic Metadata lists
  const [locationRates, setLocationRates] = useState<any[]>([]);
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  // Customer on-the-fly switch
  const [createNewCustomer, setCreateNewCustomer] = useState(false);

  // Cascading location states
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [thanaOptions, setThanaOptions] = useState<string[]>([]);

  // Fetch orders from API
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: pageSize
      };
      if (searchText) params.search = searchText;
      if (activeTab !== "all") params.status = activeTab;
      if (filterPaymentStatus) params.payment_status = filterPaymentStatus;
      if (filterPaymentMethod) params.payment_method = filterPaymentMethod;
      if (filterCourier) params.courier = filterCourier;

      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data.results);
      setTotalCount(res.data.count);

      const countsRes = await axios.get(`${API_URL}/counts`, { headers: { Authorization: `Bearer ${token}` } });
      setOrderCounts(countsRes.data);

    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to load orders."); } finally {
      setLoading(false);
    }
  };

  // Load configuration metadata
  const loadMetadata = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const [locRes, prodRes, pmRes, bankRes] = await Promise.all([
        axios.get(`${API_URL}/shipping-locations/rates`),
        axios.get(`${CATALOG_API_URL}/products`, { params: { limit: 100 } }),
        axios.get(`${API_URL}/payments/methods`),
        axios.get(`${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}/api/v1/finance/bank-accounts`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setLocationRates(locRes.data.districts);
      setProductsList(prodRes.data.results || []);
      setPaymentMethods(pmRes.data);
      setBankAccounts(bankRes.data);
    } catch (err) {
      console.error("Failed loading metadata", err);
    }
  };

  // Search CRM customers
  const fetchCrmCustomers = async (search: string) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}/customers`, {
        params: { search },
        headers: { Authorization: `Bearer ${token}` }
      });
      setCrmCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, activeTab, filterPaymentStatus, filterCourier, filterPaymentMethod, currentPage, pageSize]);

  // Debounced customer lookup
  useEffect(() => {
    let timer: any;
    if (customerSearchQuery) {
      timer = setTimeout(() => {
        fetchCrmCustomers(customerSearchQuery);
      }, 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [customerSearchQuery]);

  useEffect(() => {
    loadMetadata();
    fetchCrmCustomers("");
  }, []);

  // Update thanas dropdown on District select
  const handleDistrictChange = (districtName: string) => {
    setSelectedDistrict(districtName);
    const dist = locationRates.find(d => d.name === districtName);
    if (dist) {
      setThanaOptions(dist.thanas);
      orderForm.setFieldsValue({
        shipping_cost: dist.shipping_cost,
        shipping_thana: dist.thanas[0]
      });
    } else {
      setThanaOptions([]);
    }
  };

  // Autofill customer profile
  const handleCustomerSelect = (userId: number) => {
    const customer = crmCustomers.find(c => c.id === userId);
    if (customer) {
      orderForm.setFieldsValue({
        shipping_name: customer.username,
        shipping_phone: customer.phone,
        shipping_address: customer.address
      });
    }
  };

  // Manual Order Submit handler
  const handleManualOrderSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      
      // Parse dynamic form items fields
      const itemsPayload = modalDraftItems.map((item: any) => ({
        sku: item.sku,
        quantity: item.quantity,
        price: item.price
      }));

      if (itemsPayload.length === 0) {
        message.warning("Add at least one item line.");
        return;
      }

      const payload = {
        ...values,
        items: itemsPayload
      };

      await axios.post(`${API_URL}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      message.success("Manual sales order created successfully!");
      setIsCreateModalOpen(false);
      orderForm.resetFields();
      fetchOrders();
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.message || "Failed to create order."); }
  };

  // Steadfast Courier actions
  const handleBookShipment = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/${id}/ship`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Booked with courier. Tracking: ${res.data.tracking_number}`);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(res.data);
      }
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.message || "Courier booking failed."); }
  };

  // Sync courier status
  const handleSyncCourier = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/${id}/sync-courier`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Synchronized status: ${res.data.courier_status?.toUpperCase()}`);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(res.data);
      }
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Sync failed."); }
  };

  const handleRemoveShipment = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.delete(`${API_URL}/${id}/ship`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Shipment removed locally.");
      fetchOrders();
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.message || "Failed to remove shipment."); }
  };

  const handleSyncAllCouriers = async () => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/sync-couriers`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Sync enqueued for ${res.data.count} pending shipments.`);
      setTimeout(fetchOrders, 3000);
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.message || "Bulk sync failed."); }
  };

  // Bulk Steadfast sync
  const handleBulkCourierSync = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/bulk-sync-courier`, selectedRowKeys, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Successfully synchronized ${res.data.synced_count} orders.`);
      setSelectedRowKeys([]);
      fetchOrders();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Bulk sync failed."); } finally {
      setLoading(false);
    }
  };

  // --- Modal Product Selection Handlers ---
  const handleOpenCreateModal = async () => {
    setIsCreateModalOpen(true);
    setModalDraftItems([]);
    setModalCategoryId(null);
    setModalSubcategoryId(null);
    setModalGridProducts([]);
    setModalSelectedProduct(null);
    orderForm.resetFields();
    if (catalogCategories.length === 0) {
      try {
        const token = localStorage.getItem("poshplex_access_token");
        const res = await axios.get(`${CATALOG_API_URL}/categories/tree`, { headers: { Authorization: `Bearer ${token}` }});
        setCatalogCategories(res.data);
      } catch (e: any) { if (e?.response?.status !== 403) message.error("Failed to fetch categories"); }
    }
  };

  const fetchModalCategoryProducts = async (catId?: number | null, search?: string) => {
    if (catId) setModalSubcategoryId(catId);
    setModalSelectedProduct(null);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const params: any = {};
      if (catId) params.category_id = catId;
      if (search) params.search = search;
      const res = await axios.get(`${CATALOG_API_URL}/products`, { params, headers: { Authorization: `Bearer ${token}` }});
      setModalGridProducts(res.data.results);
    } catch (e: any) { if (e?.response?.status !== 403) message.error("Failed to fetch products"); }
  };

  const handleAddModalDraftItem = () => {
    if (!modalSelectedProduct || !modalVariantSku) return;
    const variant = modalSelectedProduct.variants.find((v: any) => v.sku === modalVariantSku);
    if (!variant) return;
    setModalDraftItems([...modalDraftItems, {
      sku: variant.sku,
      price: modalOverridePrice !== undefined ? modalOverridePrice : variant.selling_price,
      quantity: modalAddQty,
      image: modalSelectedProduct.images?.[0]?.url || null,
      name: modalSelectedProduct.name
    }]);
    setModalSelectedProduct(null);
    setModalVariantSku("");
    setModalAddQty(1);
    setModalOverridePrice(undefined);
  };

  const handleRemoveModalDraftItem = (index: number) => {
    const newItems = [...modalDraftItems];
    newItems.splice(index, 1);
    setModalDraftItems(newItems);
  };

  // --- Drawer Editing Handlers ---
  const handleOpenDrawerWithDraft = (order: any) => {
    setSelectedOrder(order);
    setDraftItems(order.items ? [...order.items] : []);
    setDraftDiscount(parseFloat(order.discount_amount || 0));
    setPromoCode("");
    setIsAddingProduct(false);
    setIsDetailDrawerOpen(true);
  };

  const handleRemoveDraftItem = (index: number) => {
    const newItems = [...draftItems];
    newItems.splice(index, 1);
    setDraftItems(newItems);
  };

  const handleOpenAddProduct = async () => {
    setIsAddingProduct(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${CATALOG_API_URL}/categories/tree`, { headers: { Authorization: `Bearer ${token}` }});
      setCatalogCategories(res.data);
    } catch (e: any) { if (e?.response?.status !== 403) message.error("Failed to fetch categories"); }
  };

  const fetchCategoryProducts = async (catId: number) => {
    setSelectedSubcategoryId(catId);
    setSelectedGridProduct(null);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${CATALOG_API_URL}/products?category_id=${catId}`, { headers: { Authorization: `Bearer ${token}` }});
      setGridProducts(res.data.results);
    } catch (e: any) { if (e?.response?.status !== 403) message.error("Failed to fetch products"); }
  };

  const handleAddDraftItem = () => {
    if (!selectedGridProduct || !selectedVariantSku) return;
    const variant = selectedGridProduct.variants.find((v: any) => v.sku === selectedVariantSku);
    if (!variant) return;
    setDraftItems([...draftItems, {
      sku: variant.sku,
      price: variant.selling_price,
      quantity: addQty,
      image: selectedGridProduct.images?.[0]?.image_url || null,
      fulfillment_status: 'pending'
    }]);
    setIsAddingProduct(false);
    setSelectedGridProduct(null);
    setSelectedVariantSku("");
    setAddQty(1);
  };

  const handleSaveDrawerEdits = async () => {
    if (!selectedOrder) return;
    setIsSavingDraft(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const payload = {
        user_id: selectedOrder.user_id,
        items: draftItems.map(i => ({ sku: i.sku, quantity: i.quantity, price: i.price })),
        shipping_address: selectedOrder.shipping_address,
        shipping_name: selectedOrder.shipping_name,
        shipping_phone: selectedOrder.shipping_phone,
        shipping_district: selectedOrder.shipping_district,
        shipping_thana: selectedOrder.shipping_thana,
        shipping_postal_code: selectedOrder.shipping_postal_code,
        discount_amount: draftDiscount,
        shipping_cost: parseFloat(selectedOrder.shipping_cost || 0),
        customer_notes: selectedOrder.customer_notes,
        internal_notes: selectedOrder.internal_notes,
        payment_status: selectedOrder.payment_status,
      };
      const res = await axios.put(`${API_URL}/${selectedOrder.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Order updated successfully.");
      setSelectedOrder(res.data);
      setDraftItems(res.data.items);
      fetchOrders();
    } catch (e: any) { if (e?.response?.status !== 403) message.error(e.response?.data?.detail || "Failed to update order."); } finally {
      setIsSavingDraft(false);
    }
  };


  // Record Payment Submit
  const handlePaymentSubmit = async (values: any) => {
    if (!selectedOrder) return;
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/${selectedOrder.id}/payments`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Payment recorded. Syncing Finance Ledger...");
      setIsPaymentModalOpen(false);
      paymentForm.resetFields();
      setSelectedOrder(res.data);
      fetchOrders();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to record payment."); }
  };

  // Record Return Submit
  const handleReturnSubmit = async (values: any) => {
    if (!selectedOrder) return;
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/${selectedOrder.id}/returns`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Item return processed. Ledger refunded.");
      setIsReturnModalOpen(false);
      returnForm.resetFields();
      setSelectedOrder(res.data);
      fetchOrders();
    } catch (err: any) { if (err?.response?.status !== 403) message.error(err.response?.data?.message || "Failed to process return."); }
  };

  // Delete Order
  const handleDeleteOrder = async (id: number) => {
    Modal.confirm({
      title: "Confirm Deletion",
      content: "Are you sure you want to delete this order? All items, history, and payment ledger entries will be permanently deleted.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const token = localStorage.getItem("poshplex_access_token");
          await axios.delete(`${API_URL}/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          message.success("Order deleted.");
          setIsDetailDrawerOpen(false);
          fetchOrders();
        } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to delete order."); }
      }
    });
  };

  // Status mapping UI helpers
  const getStatusTag = (status: string) => {
    const mapping: Record<string, { color: string; label: string }> = {
      placed: { color: "gold", label: "Order Placed" },
      review: { color: "cyan", label: "In Review" },
      pending: { color: "orange", label: "Pending" },
      hold: { color: "volcano", label: "Hold" },
      approval_pending: { color: "blue", label: "Approval Pending" },
      delivered: { color: "green", label: "Delivered" },
      partially_delivered: { color: "lime", label: "Partially Delivered" },
      cancelled: { color: "red", label: "Cancelled" },
      returned: { color: "purple", label: "Returned" },
      rto: { color: "magenta", label: "RTO" },
    };
    const details = mapping[status] || { color: "default", label: status };
    return <Tag color={details.color}>{details.label.toUpperCase()}</Tag>;
  };

  const getPaymentStatusTag = (status: string) => {
    const mapping: Record<string, { color: string; label: string }> = {
      unpaid: { color: "error", label: "Unpaid" },
      pending_verification: { color: "warning", label: "Pending Verification" },
      paid: { color: "success", label: "Paid" },
      partially_paid: { color: "processing", label: "Partially Paid" },
      refunded: { color: "magenta", label: "Refunded" },
      failed: { color: "error", label: "Failed" }
    };
    const details = mapping[status] || { color: "default", label: status };
    return <Tag color={details.color}>{details.label.toUpperCase()}</Tag>;
  };

  const orderColumns = [
    { title: "Order Number", dataIndex: "order_number", key: "order_number", render: (text: string, rec: any) => <a onClick={() => handleOpenDrawerWithDraft(rec)}>{text || `#${rec.id}`}</a> },
    { title: "Customer Name", dataIndex: "shipping_name", key: "shipping_name", render: (text: string, rec: any) => <b>{text || rec.customer_name}</b> },
    { title: "Phone", dataIndex: "customer_phone", key: "customer_phone" },
    {
      title: "Total Pay",
      dataIndex: "total_amount",
      key: "total_amount",
      render: (val: any) => <b>৳{Math.round(parseFloat(val))}</b>,
    },
    { title: "Order Status", dataIndex: "status", key: "status", render: (status: string) => getStatusTag(status) },
    { title: "Payment Status", dataIndex: "payment_status", key: "payment_status", render: (p: string) => getPaymentStatusTag(p) },
    {
      title: "Tracking",
      dataIndex: "tracking_number",
      key: "tracking_number",
      render: (track: string) => (track ? <code style={{ color: "var(--accent-purple)" }}>{track}</code> : <Tag>NO COURIER</Tag>),
    },
    {
      title: "Operations",
      key: "operations",
      render: (record: any) => (
        <Space>
          {!record.tracking_number && (
            <Button size="small" type="primary" icon={<CarOutlined />} onClick={() => handleBookShipment(record.id)}>
              Ship Drop
            </Button>
          )}
          {record.tracking_number && (
            <Button size="small" icon={<SyncOutlined />} onClick={() => handleSyncCourier(record.id)}>
              Sync Status
            </Button>
          )}
                    <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => { setSelectedOrder(record); setIsEditModalOpen(true); }}>
            Edit
          </Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => { setSelectedOrder(record); setIsPrintModalOpen(true); }}>
            Invoice Slip
          </Button>
        </Space>
      ),
    },
  ];

  // Print slip triggers
  const triggerPrintWindow = () => {
    const printContent = document.getElementById("packing-slip-print")?.innerHTML;
    const originalContent = document.body.innerHTML;
    if (printContent) {
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-main)" }}>Orders & Fulfillment</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>Manage orders, payments, and courier dispatches.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<SyncOutlined />} onClick={handleSyncAllCouriers} style={{ borderRadius: 6, whiteSpace: 'nowrap' }}>
            Sync Steadfast
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal} style={{ borderRadius: 6, whiteSpace: 'nowrap' }}>
            Create Order
          </Button>
        </div>
      </div>

      <Card styles={{ body: { padding: '12px 14px' } }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search Order No / Phone..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ flex: 1, minWidth: 160, borderRadius: 6 }}
            />
            <Select placeholder="Pay Status" allowClear onChange={setFilterPaymentStatus} style={{ minWidth: 120, flex: 1 }}>
              <Select.Option value="unpaid">Unpaid</Select.Option>
              <Select.Option value="paid">Paid</Select.Option>
              <Select.Option value="refunded">Refunded</Select.Option>
            </Select>
            <Select placeholder="Method" allowClear onChange={setFilterPaymentMethod} style={{ minWidth: 100, flex: 1 }}>
              <Select.Option value="COD">COD</Select.Option>
              <Select.Option value="bKash">bKash</Select.Option>
              <Select.Option value="Nagad">Nagad</Select.Option>
            </Select>
            {selectedRowKeys.length > 0 && (
              <Button type="primary" icon={<SyncOutlined />} onClick={handleBulkCourierSync}>
                Bulk Sync ({selectedRowKeys.length})
              </Button>
            )}
          </div>
        </div>
        <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" items={[
          { label: <span>All <Badge count={orderCounts.all || 0} showZero style={{ backgroundColor: '#52c41a' }} /></span>, key: "all" },
          { label: <span>Placed <Badge count={orderCounts.placed || 0} showZero color="gold" /></span>, key: "placed" },
          { label: <span>Review <Badge count={orderCounts.review || 0} showZero color="cyan" /></span>, key: "review" },
          { label: <span>Pending <Badge count={orderCounts.pending || 0} showZero color="orange" /></span>, key: "pending" },
          { label: <span>Hold <Badge count={orderCounts.hold || 0} showZero color="volcano" /></span>, key: "hold" },
          { label: <span>Approval Pending <Badge count={orderCounts.approval_pending || 0} showZero color="blue" /></span>, key: "approval_pending" },
          { label: <span>Delivered <Badge count={orderCounts.delivered || 0} showZero color="green" /></span>, key: "delivered" },
          { label: <span>Returned <Badge count={orderCounts.returned || 0} showZero color="purple" /></span>, key: "returned" },
          { label: <span>Cancelled <Badge count={orderCounts.cancelled || 0} showZero color="red" /></span>, key: "cancelled" },
        ]} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {orders.map(order => {
            const total = Math.round(parseFloat(order.total_amount || 0));
            const paid = order.payment_status === 'paid' ? total : (order.payment_status === 'partially_paid' ? 'Partial' : 0);
            const due = order.payment_status === 'paid' ? 0 : (order.payment_status === 'partially_paid' ? 'Partial' : total);
            const items = order.items || [];
            
            return (
              <Card key={order.id} styles={{ body: { padding: '12px', display: 'flex', flexDirection: 'column', height: '100%' } }} style={{ borderRadius: 8, overflow: 'hidden', minWidth: 200 }}>
                {/* Images Top Section */}
                <div style={{ margin: '-12px -12px 12px -12px', height: 160, display: 'flex', backgroundColor: '#f0f0f0' }}>
                  {items.length === 1 ? (
                    <img src={items[0].image ? `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${items[0].image}` : ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="product" />
                  ) : items.length > 1 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: '100%' }}>
                      <img src={items[0].image ? `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${items[0].image}` : ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="product 1" />
                      <img src={items[1].image ? `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${items[1].image}` : ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="product 2" />
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>No Items</div>
                  )}
                </div>

                {/* PO & Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <strong>{order.order_number || `#${order.id}`}</strong>
                  <span style={{ color: '#888' }}>{order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                </div>

                {/* Customer Name & Phone */}
                <div style={{ fontSize: 13, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {order.shipping_name || order.customer_name}
                </div>
                <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {order.customer_phone}
                  {activePhones[order.id] ? (
                    <PhoneOutlined 
                      style={{ color: '#25D366', cursor: 'pointer', fontSize: 16 }} 
                      onClick={() => setActivePhones(prev => ({...prev, [order.id]: false}))} 
                    />
                  ) : (
                    <PhoneOutlined 
                      style={{ color: '#888', cursor: 'pointer', fontSize: 16 }} 
                      onClick={() => setActivePhones(prev => ({...prev, [order.id]: true}))} 
                    />
                  )}
                </div>

                {/* Qty & Price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{items.reduce((acc: number, item: any) => acc + item.quantity, 0)} items</span>
                  <strong style={{ color: '#000' }}>৳{total}</strong>
                </div>

                {/* Paid & Due */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: '#888' }}>Paid: ৳{paid}</span>
                  <strong style={{ color: '#e11d48' }}>Due: ৳{due}</strong>
                </div>

                {/* Status Tags */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {getStatusTag(order.status)}
                  {getPaymentStatusTag(order.payment_status)}
                  <Tag color="default">Web Order</Tag>
                </div>

                {/* Payment Method & Location */}
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{order.payments?.[0]?.method || 'Cash on Delivery'}</div>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 12 }}>
                  Location: {order.shipping_district === 'Dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  {!order.tracking_number ? (
                    <Button size="small" type="default" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }} onClick={() => handleBookShipment(order.id)}>
                      <CarOutlined /> Ship
                    </Button>
                  ) : (
                    <>
                      <Button size="small" style={{ flex: 1, borderColor: '#10b981', color: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, overflow: 'hidden' }} onClick={() => { navigator.clipboard.writeText(order.tracking_number); message.success('Parcel ID copied to clipboard'); }}>
                        <CheckCircleOutlined style={{ flexShrink: 0 }} /> 
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Shipped: {order.tracking_number}
                        </span>
                      </Button>
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveShipment(order.id)} />
                    </>
                  )}
                </div>

                {/* Call Note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  <Input 
                    size="small" 
                    placeholder="+ Add call note" 
                    defaultValue={order.internal_notes || ''}
                    onChange={(e) => setCallNotes({ ...callNotes, [order.id]: e.target.value })}
                    style={{ fontSize: 11 }}
                  />
                  <Button 
                    size="small" 
                    type="text" 
                    icon={<SaveOutlined />} 
                    onClick={() => handleSaveCallNote(order.id)}
                    style={{ fontSize: 11, color: '#888', alignSelf: 'flex-start', padding: 0 }}
                  >
                    Save note
                  </Button>
                </div>

                {/* Bottom Icons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'auto' }}>
                  <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDrawerWithDraft(order)} />
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOrder(order.id)} />
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      
      <EditOrderModal
        visible={isEditModalOpen}
        order={selectedOrder}
        onClose={() => setIsEditModalOpen(false)}
        onRefresh={() => {
          setIsEditModalOpen(false);
          fetchOrders();
        }}
        productsList={productsList}
        paymentMethods={paymentMethods}
      />

      {/* Manual Creation Modal */}
      <Modal 
        title="Place Manual Sales Order" 
        open={isCreateModalOpen} 
        onCancel={() => setIsCreateModalOpen(false)} 
        onOk={() => orderForm.submit()}
        width="min(800px, 96vw)"
      >
        <Form form={orderForm} onFinish={handleManualOrderSubmit} layout="vertical">
          
          <Divider orientation="left">Customer Coordinates</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Create Customer On the Fly?">
                <Switch checked={createNewCustomer} onChange={setCreateNewCustomer} />
              </Form.Item>
            </Col>
          </Row>

          {createNewCustomer ? (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="customer_name" label="Full Name" rules={[{ required: true }]}>
                  <Input style={{ borderRadius: 0 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="customer_phone" label="Phone" rules={[{ required: true }]}>
                  <Input style={{ borderRadius: 0 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="customer_email" label="Email">
                  <Input style={{ borderRadius: 0 }} />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="user_id" label="Search Existing Customer" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    placeholder="Search by Name/Email"
                    defaultActiveFirstOption={false}
                    suffixIcon={null}
                    filterOption={false}
                    onSearch={setCustomerSearchQuery}
                    onChange={handleCustomerSelect}
                    notFoundContent={null}
                  >
                    {crmCustomers.map((c) => (
                      <Select.Option key={c.id} value={c.id}>
                        {c.username} ({c.email}) - {c.phone}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}



          <Divider orientation="left">Shipping Address & Cost</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="shipping_name" label="Shipping Recipient Name">
                <Input style={{ borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="shipping_phone" label="Shipping Recipient Phone">
                <Input style={{ borderRadius: 0 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="shipping_district" label="District (Division)" rules={[{ required: true }]}>
                <Select placeholder="Select district" onChange={handleDistrictChange}>
                  {locationRates.map((d) => <Select.Option key={d.name} value={d.name}>{d.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shipping_thana" label="Thana (Area Hub)" rules={[{ required: true }]}>
                <Select placeholder="Select thana">
                  {thanaOptions.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shipping_cost" label="Shipping Cost override ($)" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="shipping_address" label="Detailed Delivery Street Address" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="House No, Road, Flat..." style={{ borderRadius: 0 }} />
          </Form.Item>

          <Divider orientation="left">Product Lines Selection</Divider>
          
          <Table
            scroll={{ x: 'max-content' }}
            size="small"
            dataSource={modalDraftItems}
            pagination={false}
            rowKey={(rec) => `${rec.sku}`}
            columns={[
              { title: "SKU Variant", dataIndex: "sku", key: "sku" },
              { title: "Name", dataIndex: "name", key: "name" },
              { title: "Price", dataIndex: "price", key: "price", render: (val) => `৳${Math.round(val)}` },
              { title: "Qty", dataIndex: "quantity", key: "quantity" },
              { title: "Action", key: "action", render: (_, __, index) => <Popconfirm title="Remove item from order?" onConfirm={() => handleRemoveModalDraftItem(index)}><Button danger size="small" type="text" icon={<DeleteOutlined />} /></Popconfirm> }
            ]}
            style={{ marginBottom: 16 }}
          />

          <Card size="small" style={{ marginBottom: 24, background: '#f9f9f9', borderColor: '#e5e5e5' }}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Select style={{ width: '100%' }} placeholder="Select Category" value={modalCategoryId} onChange={(val) => { setModalCategoryId(val); setModalSubcategoryId(null); }}>
                  {catalogCategories.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                </Select>
              </Col>
              <Col span={8}>
                <Select style={{ width: '100%' }} placeholder="Select Subcategory" value={modalSubcategoryId} onChange={(val) => fetchModalCategoryProducts(val)} disabled={!modalCategoryId}>
                  {catalogCategories.find(c => c.id === modalCategoryId)?.children?.map((sub: any) => (
                    <Select.Option key={sub.id} value={sub.id}>{sub.name}</Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={8}>
                <Input.Search placeholder="Search product by name" onSearch={(val) => fetchModalCategoryProducts(modalSubcategoryId, val)} allowClear />
              </Col>
            </Row>
            {modalGridProducts.length > 0 && (
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginTop: 16, paddingBottom: 8 }}>
                {modalGridProducts.map(p => (
                  <Card 
                    key={p.id} 
                    hoverable 
                    size="small"
                    onClick={() => setModalSelectedProduct(p)}
                    style={{ minWidth: 100, border: modalSelectedProduct?.id === p.id ? '2px solid var(--primary-color)' : '1px solid #d9d9d9' }}
                  >
                    <img src={p.images?.[0]?.url ? (p.images[0].url.startsWith('http') ? p.images[0].url : `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${p.images[0].url}`) : ''} style={{ width: '100%', height: 60, objectFit: 'cover' }} alt="prod" />
                    <div style={{ fontSize: 10, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  </Card>
                ))}
              </div>
            )}
            {modalSelectedProduct && (
              <Row gutter={16} align="bottom" style={{ marginTop: 16 }}>
                <Col span={10}>
                  <Select style={{ width: '100%' }} placeholder="Select Variant" value={modalVariantSku} onChange={setModalVariantSku}>
                    {modalSelectedProduct.variants.map((v: any) => {
                      const attrLabel = v.attributes && Object.keys(v.attributes).length > 0
                        ? Object.entries(v.attributes).map(([key, val]) => `${key}: ${val}`).join(', ')
                        : v.sku;
                      return (
                        <Select.Option key={v.sku} value={v.sku}>
                          {attrLabel} - ৳{Math.round(v.selling_price)}
                        </Select.Option>
                      );
                    })}
                  </Select>
                </Col>
                <Col span={4}>
                  <label style={{ fontSize: 11, display: 'block' }}>Qty</label>
                  <InputNumber min={1} value={modalAddQty} onChange={(val) => setModalAddQty(val || 1)} style={{ width: '100%' }} />
                </Col>
                <Col span={6}>
                  <label style={{ fontSize: 11, display: 'block' }}>Override Price ($)</label>
                  <InputNumber min={0} precision={2} placeholder="Optional" value={modalOverridePrice} onChange={(val) => setModalOverridePrice(val !== null ? val : undefined)} style={{ width: '100%' }} />
                </Col>
                <Col span={4}>
                  <Button type="primary" onClick={handleAddModalDraftItem} block disabled={!modalVariantSku}>Add</Button>
                </Col>
              </Row>
            )}
          </Card>

          <Divider orientation="left">Ledger Billing Details</Divider>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="promo_code" label="Promo Code (Optional)">
                <Input placeholder="E.g. SUMMER20" style={{ borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="discount_amount" label="Discount Value (৳)" initialValue={0}>
                <InputNumber min={0} precision={2} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="payment_amount" label="Paid Amount (৳)" initialValue={0}>
                <InputNumber min={0} precision={2} style={{ width: "100%", borderRadius: 0 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="payment_method" label="Payment Option" initialValue="COD">
                <Select>
                  <Select.Option value="COD">Cash on Delivery (COD)</Select.Option>
                  {bankAccounts.map((ba: any) => (
                    <Select.Option key={ba.id} value={ba.name}>{ba.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="customer_notes" label="Customer Notes (Visible on Invoices)">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="internal_notes" label="Internal Notes (Admins only)">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detailed Side Drawer Overlay */}
      <Drawer
        title={`Order Details: ${selectedOrder?.order_number || "#" + selectedOrder?.id}`}
        width="min(750px, 96vw)"
        onClose={() => setIsDetailDrawerOpen(false)}
        open={isDetailDrawerOpen}
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => setIsEditModalOpen(true)}>
              Edit Order
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteOrder(selectedOrder.id)}>
              Delete Order
            </Button>
          </Space>
        }
      >
        {selectedOrder && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            
            {/* Risk and Status Overview */}
            <Alert
              message={`Operational Risk Check Status: ${selectedOrder.risk_level?.toUpperCase()}`}
              description={
                selectedOrder.risk_reasons?.length > 0 ? (
                  <ul>{selectedOrder.risk_reasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)}</ul>
                ) : (
                  "Clear dataset. No order warning flags detected."
                )
              }
              type={selectedOrder.risk_level === "high" ? "error" : selectedOrder.risk_level === "medium" ? "warning" : "success"}
              showIcon
            />

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16, fontWeight: 600 }}>Order Coordinates</h3>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Order Status</div>
                  <div style={{ marginTop: 4 }}>{getStatusTag(selectedOrder.status)}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Payment Status</div>
                  <div style={{ marginTop: 4 }}>{getPaymentStatusTag(selectedOrder.payment_status)}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Customer</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedOrder.shipping_name || selectedOrder.customer_name}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>{selectedOrder.shipping_phone || selectedOrder.customer_phone}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Courier Tracking</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrder.tracking_number || "NOT DISPATCHED"}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>{selectedOrder.courier_status || "PENDING"}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Location</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrder.shipping_district}, {selectedOrder.shipping_thana}</div>
                </Col>
                <Col span={24}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Address</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrder.shipping_address}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Customer Notes</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrder.customer_notes || "-"}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Internal Notes</div>
                  <div style={{ fontWeight: 600, color: '#e11d48' }}>{selectedOrder.internal_notes || "-"}</div>
                </Col>
              </Row>
            </div>

            <Divider>Drop Lines checklist</Divider>

            <Table
              scroll={{ x: 'max-content' }}
              size="small"
              dataSource={draftItems}
              pagination={false}
              rowKey={(rec) => rec.sku}
              columns={[
                { title: "SKU Variant", dataIndex: "sku", key: "sku" },
                { title: "Price", dataIndex: "price", key: "price", render: (val) => `৳${Math.round(val)}` },
                { title: "Qty Ordered", dataIndex: "quantity", key: "quantity" },
                { title: "Returned Qty", dataIndex: "returned_quantity", key: "returned_quantity" },
                { title: "Fulfillment State", dataIndex: "fulfillment_status", key: "fulfillment_status", render: (s) => <Tag>{s?.toUpperCase()}</Tag> },
                { title: "Action", key: "action", render: (_, __, index) => <Popconfirm title="Remove item from draft?" onConfirm={() => handleRemoveDraftItem(index)}><Button danger size="small" type="text" icon={<DeleteOutlined />} /></Popconfirm> }
              ]}
            />

            {isAddingProduct ? (
              <Card size="small" style={{ marginTop: 16, background: '#f9f9f9', borderColor: '#e5e5e5' }}>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Select style={{ width: '100%' }} placeholder="Select Category" value={selectedCategoryId} onChange={(val) => { setSelectedCategoryId(val); setSelectedSubcategoryId(null); }}>
                      {catalogCategories.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={12}>
                    <Select style={{ width: '100%' }} placeholder="Select Subcategory" value={selectedSubcategoryId} onChange={fetchCategoryProducts} disabled={!selectedCategoryId}>
                      {catalogCategories.find(c => c.id === selectedCategoryId)?.children?.map((sub: any) => (
                        <Select.Option key={sub.id} value={sub.id}>{sub.name}</Select.Option>
                      ))}
                    </Select>
                  </Col>
                </Row>
                {gridProducts.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginTop: 16, paddingBottom: 8 }}>
                    {gridProducts.map(p => (
                      <Card 
                        key={p.id} 
                        hoverable 
                        size="small"
                        onClick={() => setSelectedGridProduct(p)}
                        style={{ minWidth: 100, border: selectedGridProduct?.id === p.id ? '2px solid var(--primary-color)' : '1px solid #d9d9d9' }}
                      >
                        <img src={p.images?.[0]?.url ? (p.images[0].url.startsWith('http') ? p.images[0].url : `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${p.images[0].url}`) : ''} style={{ width: '100%', height: 60, objectFit: 'cover' }} alt="prod" />
                        <div style={{ fontSize: 10, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      </Card>
                    ))}
                  </div>
                )}
                {selectedGridProduct && (
                  <Row gutter={16} align="bottom" style={{ marginTop: 16 }}>
                    <Col span={12}>
                      <Select style={{ width: '100%' }} placeholder="Select Variant" value={selectedVariantSku} onChange={setSelectedVariantSku}>
                        {selectedGridProduct.variants.map((v: any) => {
                          const attrLabel = v.attributes && Object.keys(v.attributes).length > 0
                            ? Object.entries(v.attributes).map(([key, val]) => `${key}: ${val}`).join(', ')
                            : v.sku;
                          return (
                            <Select.Option key={v.sku} value={v.sku}>
                              {attrLabel} - ৳{Math.round(v.selling_price)}
                            </Select.Option>
                          );
                        })}
                      </Select>
                    </Col>
                    <Col span={6}>
                      <InputNumber min={1} value={addQty} onChange={(val) => setAddQty(val || 1)} style={{ width: '100%' }} />
                    </Col>
                    <Col span={6}>
                      <Button type="primary" onClick={handleAddDraftItem} block disabled={!selectedVariantSku}>Add to Order</Button>
                    </Col>
                  </Row>
                )}
                <Button type="text" danger block style={{ marginTop: 8 }} onClick={() => setIsAddingProduct(false)}>Cancel</Button>
              </Card>
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginTop: 16 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenAddProduct}>
                  Add New Product
                </Button>
                <Button type="dashed" icon={<GiftOutlined />} onClick={() => setIsReturnModalOpen(true)}>
                  Process Return Request
                </Button>
              </div>
            )}

            <Card size="small" style={{ marginTop: 16, borderColor: '#e5e5e5' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Discount Amount (৳)</label>
                  <InputNumber 
                    style={{ width: '100%' }} 
                    min={0} 
                    value={draftDiscount} 
                    onChange={(v) => setDraftDiscount(v || 0)} 
                  />
                </Col>
                <Col span={12}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Promo Code (Optional)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input 
                      placeholder="Enter code" 
                      value={promoCode} 
                      onChange={e => setPromoCode(e.target.value)} 
                    />
                    <Button type="default" onClick={async () => {
                      if (!promoCode) return;
                      const subtotal = draftItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);
                      try {
                        const token = localStorage.getItem("poshplex_access_token");
                        const res = await axios.post(`${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}/api/v1/marketing/promocodes/validate`, { code: promoCode, order_amount: subtotal }, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (res.data.valid) {
                           setDraftDiscount(res.data.discount_amount);
                           message.success(`Promo code applied: -৳${res.data.discount_amount}`);
                        } else {
                           message.error(res.data.message || "Invalid promo code");
                        }
                      } catch (e: any) {
                         message.info("Code received, please apply discount manually if backend doesn't support promo code lookup yet.");
                      }
                    }}>Apply</Button>
                  </div>
                </Col>
              </Row>

              {(() => {
                const subtotal = draftItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);
                const finalTotal = subtotal - (draftDiscount || 0) + parseFloat(selectedOrder?.shipping_cost || 0);
                return (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#aaa' }}>Subtotal:</span>
                      <strong>৳{Math.round(subtotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#e11d48' }}>
                      <span>Discount:</span>
                      <strong>- ৳{Math.round(draftDiscount || 0)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#aaa' }}>Shipping:</span>
                      <strong>৳{Math.round(parseFloat(selectedOrder?.shipping_cost || 0))}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, marginTop: 12, paddingTop: 12, borderTop: '1px solid #444' }}>
                      <strong>Total:</strong>
                      <strong>৳{Math.round(finalTotal)}</strong>
                    </div>
                  </div>
                );
              })()}

              <Button type="primary" size="large" icon={<SaveOutlined />} block style={{ marginTop: 16 }} onClick={handleSaveDrawerEdits} loading={isSavingDraft}>
                Save Order Changes
              </Button>
            </Card>

            <Divider>Financial ledger allocations</Divider>
            <Table
              size="small"
              dataSource={selectedOrder.payments}
              pagination={false}
              rowKey="id"
              columns={[
                { title: "Amount", dataIndex: "amount", key: "amount", render: (val) => `৳${Math.round(val)}` },
                { title: "Method", dataIndex: "method", key: "method" },
                { title: "Ref transaction", dataIndex: "reference_number", key: "reference_number" },
                { title: "Sender No", dataIndex: "sender_number", key: "sender_number" },
                { title: "Status", dataIndex: "status", key: "status", render: (s) => <Tag color="success">{s?.toUpperCase()}</Tag> }
              ]}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 16 }}>
              <Button type="primary" onClick={() => setIsPaymentModalOpen(true)} style={{ borderRadius: 0 }}>
                Record Payment allocation
              </Button>
            </div>

            <Divider>Operational status log history</Divider>
            <Timeline>
              {selectedOrder.status_history?.map((h: any) => (
                <Timeline.Item key={h.id}>
                  <b>{h.status?.toUpperCase()}</b> - by <i>{h.admin_username || "system"}</i> <br />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(h.timestamp).toLocaleString()}</span> <br />
                  <span>{h.notes}</span>
                </Timeline.Item>
              ))}
            </Timeline>

          </Space>
        )}
      </Drawer>

      {/* Invoice packing slip modal preview */}
      <Modal
        title="PDF Invoice packing slip"
        open={isPrintModalOpen}
        onCancel={() => setIsPrintModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsPrintModalOpen(false)}>Close</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={triggerPrintWindow} style={{ borderRadius: 0 }}>Print PDF Slip</Button>
        ]}
        width="min(700px, 96vw)"
      >
        {selectedOrder && (
          <div id="packing-slip-print" style={{ padding: 24, color: "#000", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111" }}>POSHPLEX STREETWEAR</h1>
                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Poshplexbd.com Hub - Warehouse Dispatch</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h3 style={{ margin: 0, color: "#333" }}>PACKING SLIP / INVOICE</h3>
                <p style={{ margin: 0, fontSize: 13 }}><b>Order ID:</b> {selectedOrder.order_number || `#${selectedOrder.id}`}</p>
                <p style={{ margin: 0, fontSize: 13 }}><b>Status:</b> {selectedOrder.status?.toUpperCase()}</p>
              </div>
            </div>

            <Divider style={{ borderColor: "#ddd" }} />

            <Descriptions title="Fulfillment Demographics" column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Customer Name">{selectedOrder.shipping_name || selectedOrder.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Courier Tracking">{selectedOrder.tracking_number || "Not generated yet"}</Descriptions.Item>
              <Descriptions.Item label="District Location">{selectedOrder.shipping_district}</Descriptions.Item>
              <Descriptions.Item label="Thana location Hub">{selectedOrder.shipping_thana}</Descriptions.Item>
              <Descriptions.Item label="Courier Address" span={2}>{selectedOrder.shipping_address}</Descriptions.Item>
            </Descriptions>

            <Divider style={{ borderColor: "#ddd" }} />

            <h3 style={{ marginBottom: 16 }}>Consigned Items Checklist</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
                  <th style={{ padding: "8px 0" }}>SKU Code</th>
                  <th style={{ padding: "8px 0", textAlign: "right" }}>Price</th>
                  <th style={{ padding: "8px 0", textAlign: "center" }}>Qty</th>
                  <th style={{ padding: "8px 0", textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items?.map((item: any) => (
                  <tr key={item.sku} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px 0" }}><b>{item.sku}</b></td>
                    <td style={{ padding: "10px 0", textAlign: "right" }}>৳{Math.round(item.price)}</td>
                    <td style={{ padding: "10px 0", textAlign: "center" }}>{item.quantity}</td>
                    <td style={{ padding: "10px 0", textAlign: "right" }}>৳{Math.round(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: "right", paddingRight: 8 }}>
              <h3>Subtotal: ৳{Math.round(selectedOrder.subtotal)}</h3>
              <h3>Shipping Cost: ৳{Math.round(selectedOrder.shipping_cost)}</h3>
              <h3>Discount Value: -৳{Math.round(selectedOrder.discount_amount)}</h3>
              <h2 style={{ borderTop: "2px solid #111", paddingTop: 8, display: "inline-block" }}>Total Pay Value: ৳{Math.round(selectedOrder.total_amount)}</h2>
            </div>
            
            <div style={{ marginTop: 40, border: "2px dashed #999", padding: 12, borderRadius: 8, textAlign: "center" }}>
              <span style={{ fontSize: 13, letterSpacing: 4, color: "#555", fontWeight: 600 }}>BARCODE SCAN AREA / CHECKLIST VERIFIED</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        title="Record Payment allocation"
        open={isPaymentModalOpen}
        onCancel={() => setIsPaymentModalOpen(false)}
        onOk={() => paymentForm.submit()}
      >
        <Form form={paymentForm} onFinish={handlePaymentSubmit} layout="vertical">
          <Form.Item name="amount" label="Payment Amount ($)" rules={[{ required: true }]} initialValue={selectedOrder?.total_amount}>
            <InputNumber style={{ width: "100%", borderRadius: 0 }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="method" label="Payment Method" rules={[{ required: true }]} initialValue="COD">
            <Select>
              <Select.Option value="COD">Cash on Delivery (COD)</Select.Option>
              {bankAccounts.map((ba: any) => (
                <Select.Option key={ba.id} value={ba.name}>{ba.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reference_number" label="Transaction reference ID">
            <Input style={{ borderRadius: 0 }} placeholder="e.g. TR-A1B2C3D4" />
          </Form.Item>
          <Form.Item name="sender_number" label="Sender Phone No">
            <Input style={{ borderRadius: 0 }} placeholder="e.g. +88017XXXXXXXX" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Process Return Modal */}
      <Modal
        title="Record Item Return Request"
        open={isReturnModalOpen}
        onCancel={() => setIsReturnModalOpen(false)}
        onOk={() => returnForm.submit()}
      >
        <Form form={returnForm} onFinish={handleReturnSubmit} layout="vertical">
          <Form.Item name="sku" label="Return SKU Variant Item" rules={[{ required: true }]}>
            <Select placeholder="Select variant SKU">
              {selectedOrder?.items?.map((item: any) => (
                <Select.Option key={item.sku} value={item.sku}>
                  {item.sku} (Ordered Qty: {item.quantity})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Return Quantity" rules={[{ required: true }]} initialValue={1}>
            <InputNumber min={1} style={{ width: "100%", borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason for return request" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Describe defective details..." style={{ borderRadius: 0 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Order Modal */}
      <EditOrderModal
        visible={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        order={selectedOrder}
        onRefresh={() => {
          setIsEditModalOpen(false);
          fetchOrders();
          if (selectedOrder) {
            // Re-fetch or update the selectedOrder if needed. The drawer might show stale data until refetched.
            const updated = orders.find(o => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
          }
        }}
        productsList={productsList}
        paymentMethods={paymentMethods}
      />
    </Space>
  );
};

export default Orders;



