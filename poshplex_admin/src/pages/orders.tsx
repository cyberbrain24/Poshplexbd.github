import React, { useState, useEffect, useRef } from "react";
import {
  Table, Tag, Button, Space, Card, Modal, Form, Input, Pagination,
  InputNumber, Select, Descriptions, Divider, message, Tabs, Drawer, Timeline, Tooltip, Row, Col, Alert, Badge, Popconfirm, Popover
} from "antd";
import {
  ShoppingCartOutlined, CheckCircleOutlined, CarOutlined, ClockCircleOutlined,
  PrinterOutlined, PlusOutlined, ShoppingOutlined, EyeOutlined, SyncOutlined, DeleteOutlined, GiftOutlined, CloseCircleOutlined, EditOutlined, WhatsAppOutlined, SaveOutlined, PhoneOutlined, WarningOutlined, SafetyCertificateOutlined, ThunderboltOutlined
} from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getOrderLocationZone } from "../utils/orderUtils";
import { SteadfastRiskCard, OrderCardRiskBadge } from "../components/SteadfastRiskCard";
import { OrderPulseTag } from "../components/OrderPulseTag";
import { PartialSplitModal } from "../components/PartialSplitModal";
import { OrderPulseDrawer } from "../components/OrderPulseDrawer";

const API_URL = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/orders";
const CATALOG_API_URL = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/catalog";

const normalizePhoneDigits = (phone: string | undefined | null): string => {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length >= 13) digits = digits.slice(2);
  else if (digits.startsWith("008801") && digits.length >= 15) digits = digits.slice(4);
  return digits;
};

const isValidPhone = (phone: string | undefined | null) => {
  const digits = normalizePhoneDigits(phone);
  return digits.startsWith("01") && digits.length === 11;
};

export const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("placed");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(32);
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

  // Steadfast Delivery Risk scores cache for current orders
  const [deliveryRiskMap, setDeliveryRiskMap] = useState<Record<string, any>>({});
  const [loadingRiskMap, setLoadingRiskMap] = useState<boolean>(false);

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
  // Modals / Drawer toggles
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "create">("edit");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  // OrderPulse states
  const [isPulseDrawerOpen, setIsPulseDrawerOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitSelectedOrder, setSplitSelectedOrder] = useState<any>(null);

  // Drawer editing state
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [draftDiscount, setDraftDiscount] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // New product flow states (shared by Edit Order & Create Order Drawers)
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [catalogSearchText, setCatalogSearchText] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
  const [gridProducts, setGridProducts] = useState<any[]>([]);
  const [selectedGridProduct, setSelectedGridProduct] = useState<any>(null);
  const [selectedVariantSku, setSelectedVariantSku] = useState<string>("");
  const [addQty, setAddQty] = useState<number>(1);
  const [addPriceOverride, setAddPriceOverride] = useState<number | undefined>(undefined);

  // Forms hooks
  const [paymentForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  // Dynamic Metadata lists
  const [locationRates, setLocationRates] = useState<any[]>([]);
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [phoneMatchedName, setPhoneMatchedName] = useState<string | null>(null);
  const lastAutoFilledPhoneRef = useRef<string>("");

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

  // Batch fetch Steadfast delivery risk for orders on the current page (Placed status only)
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const phonesToFetch: string[] = [];
    orders.forEach((o: any) => {
      // Steadfast delivery risk is only shown and queried for 'placed' status orders
      if (String(o.status || "").toLowerCase() !== "placed") return;

      let ph = (o.shipping_phone || o.customer_phone || "").replace(/\D/g, "");
      if (ph.startsWith("8801") && ph.length === 13) ph = ph.slice(2);
      else if (ph.startsWith("008801") && ph.length === 15) ph = ph.slice(4);
      if (ph.length >= 10 && !deliveryRiskMap[ph] && !phonesToFetch.includes(ph)) {
        phonesToFetch.push(ph);
      }
    });

    if (phonesToFetch.length === 0) return;

    setLoadingRiskMap(true);
    const token = localStorage.getItem("poshplex_access_token") || localStorage.getItem("poshplex_token") || "admin_imran";
    axios.post(`${API_URL}/delivery-risk/batch`, { phones: phonesToFetch }, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data) {
        setDeliveryRiskMap(prev => ({ ...prev, ...res.data }));
      }
    }).catch(err => {
      console.error("Batch delivery risk fetch error:", err);
    }).finally(() => {
      setLoadingRiskMap(false);
    });
  }, [orders]);

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

  // Shared customer-profile autofill helper for dropdown selection and 11-digit phone lookup
  const applyCustomerProfileToDraft = (customer: any, keepTypedPhone: boolean = false) => {
    if (!customer) return;
    const distName = customer.district_name || customer.district || "";
    const thanaName = customer.thana_name || customer.thana || "";
    const matchedDist = distName
      ? locationRates.find((d: any) => d.name?.toLowerCase() === String(distName).toLowerCase())
      : null;
    const matchedThana =
      matchedDist && thanaName
        ? matchedDist.thanas?.find((t: string) => t.toLowerCase() === String(thanaName).toLowerCase()) || thanaName
        : matchedDist?.thanas?.[0] || thanaName || "";

    setSelectedOrder((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        user_id: customer.user_id ?? customer.id ?? prev.user_id ?? null,
        shipping_name: customer.name || customer.username || prev.shipping_name || "",
        shipping_phone: keepTypedPhone
          ? (prev.shipping_phone || customer.phone || "")
          : (customer.phone || prev.shipping_phone || ""),
        customer_email: customer.email || prev.customer_email || "",
        shipping_address: customer.address || prev.shipping_address || "",
        shipping_postal_code: customer.postal_code || prev.shipping_postal_code || "",
        ...(matchedDist
          ? {
              shipping_district: matchedDist.name,
              shipping_thana: matchedThana,
              shipping_cost: matchedDist.shipping_cost ?? prev.shipping_cost ?? 0,
            }
          : distName
          ? {
              shipping_district: distName,
              shipping_thana: thanaName || prev.shipping_thana,
            }
          : {}),
      };
    });
  };

  // Autofill customer profile inside Create Order Drawer via Quick Customer dropdown
  const handleCreateCustomerSelect = (userId: number | undefined) => {
    if (!userId) {
      setSelectedOrder((prev: any) => (prev ? { ...prev, user_id: null } : prev));
      setPhoneMatchedName(null);
      return;
    }
    const customer = crmCustomers.find((c) => c.id === userId);
    if (customer) {
      lastAutoFilledPhoneRef.current = normalizePhoneDigits(customer.phone);
      setPhoneMatchedName(customer.username || customer.phone || null);
      applyCustomerProfileToDraft(customer, false);
    }
  };

  // Auto-lookup & fill customer information in Create Order Drawer once full 11-digit phone is entered
  useEffect(() => {
    if (!isDetailDrawerOpen || drawerMode !== "create" || !selectedOrder) return;
    const digits = normalizePhoneDigits(selectedOrder.shipping_phone);

    if (digits.length < 11) {
      if (lastAutoFilledPhoneRef.current) {
        lastAutoFilledPhoneRef.current = "";
      }
      if (phoneMatchedName) {
        setPhoneMatchedName(null);
      }
      return;
    }

    if (digits === lastAutoFilledPhoneRef.current) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setPhoneLookupLoading(true);
      try {
        const token = localStorage.getItem("poshplex_access_token");
        const res = await axios.get(`${API_URL}/customers/by-phone`, {
          params: { phone: digits },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        lastAutoFilledPhoneRef.current = digits;
        if (res.data?.found) {
          applyCustomerProfileToDraft(res.data, true);
          const matchedLabel = res.data.name || res.data.username || res.data.phone;
          setPhoneMatchedName(matchedLabel);
          message.success(`Existing customer "${matchedLabel}" found — details auto-filled.`);
        } else {
          setPhoneMatchedName(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPhoneMatchedName(null);
        }
      } finally {
        if (!cancelled) {
          setPhoneLookupLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isDetailDrawerOpen, drawerMode, selectedOrder?.shipping_phone, locationRates]);

  // Manual Order Create Drawer Submit handler
  const handleSaveCreateOrder = async () => {
    if (!selectedOrder) return;
    if (!selectedOrder.shipping_name?.trim()) {
      message.warning("Please enter Customer Name.");
      return;
    }
    if (!selectedOrder.shipping_phone?.trim()) {
      message.warning("Please enter Customer Phone number.");
      return;
    }
    if (!selectedOrder.shipping_district || !selectedOrder.shipping_thana) {
      message.warning("Please select District and Thana.");
      return;
    }
    if (!selectedOrder.shipping_address?.trim()) {
      message.warning("Please enter Detailed Delivery Address.");
      return;
    }
    if (draftItems.length === 0) {
      message.warning("Add at least one item line.");
      return;
    }

    setIsSavingDraft(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const payload = {
        user_id: selectedOrder.user_id || null,
        customer_name: selectedOrder.shipping_name.trim(),
        customer_phone: selectedOrder.shipping_phone.trim(),
        customer_email: selectedOrder.customer_email || "",
        shipping_name: selectedOrder.shipping_name.trim(),
        shipping_phone: selectedOrder.shipping_phone.trim(),
        shipping_district: selectedOrder.shipping_district,
        shipping_thana: selectedOrder.shipping_thana,
        shipping_postal_code: selectedOrder.shipping_postal_code || "",
        shipping_address: selectedOrder.shipping_address.trim(),
        shipping_cost: parseFloat(selectedOrder.shipping_cost || 0),
        discount_amount: draftDiscount || 0,
        promo_code: promoCode || "",
        customer_notes: selectedOrder.customer_notes || "",
        internal_notes: selectedOrder.internal_notes || "",
        status: selectedOrder.status || "placed",
        payment_method: selectedOrder.payment_method || "COD",
        payment_status: selectedOrder.payment_status || "unpaid",
        payment_amount:
          selectedOrder.payment_amount !== undefined &&
          selectedOrder.payment_amount !== null &&
          Number(selectedOrder.payment_amount) > 0
            ? Number(selectedOrder.payment_amount)
            : undefined,
        payment_reference: selectedOrder.payment_reference || "",
        items: draftItems.map((item: any) => ({
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      const res = await axios.post(`${API_URL}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success(`Manual order ${res.data?.order_number || ""} created successfully!`);
      setIsDetailDrawerOpen(false);
      setIsAddingProduct(false);
      fetchOrders();
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error(err.response?.data?.detail || err.response?.data?.message || "Failed to create order.");
      }
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Steadfast Courier actions
  const handleBookShipment = async (id: number) => {
    const order = orders.find(o => o.id === id);
    if (order) {
      const phoneToUse = order.shipping_phone || order.customer_phone;
      if (!isValidPhone(phoneToUse)) {
        Modal.error({
          title: 'Invalid Phone Number',
          content: 'The customer did not provide a valid Bangladeshi phone number. The parcel cannot be shipped. Please click the eye icon to edit the order and update the phone number to a valid 11-digit number.',
        });
        return;
      }
    }

    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/${id}/ship`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Booked with courier. Parcel ID: ${res.data.courier_consignment_id || res.data.tracking_number}`);
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

  // Auto-trigger Steadfast sync every 1 hour (24 times a day) while Orders Queue is open
  useEffect(() => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const interval = setInterval(() => {
      console.log("[OrdersQueue] Auto-triggering hourly Steadfast sync (24x/day)...");
      handleSyncAllCouriers();
    }, ONE_HOUR_MS);
    return () => clearInterval(interval);
  }, []);

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

  // --- Unified Drawer Open Handlers (Create & Edit share the exact Drawer UI) ---
  const handleOpenCreateDrawer = () => {
    setDrawerMode("create");
    setSelectedOrder({
      id: null,
      user_id: null,
      status: "placed",
      payment_status: "unpaid",
      shipping_name: "",
      shipping_phone: "",
      customer_email: "",
      shipping_district: undefined,
      shipping_thana: undefined,
      shipping_postal_code: "",
      shipping_address: "",
      shipping_cost: 0,
      customer_notes: "",
      internal_notes: "",
      payment_method: "COD",
      payment_amount: 0,
      payment_reference: "",
      payments: [],
      status_history: [],
    });
    setDraftItems([]);
    setDraftDiscount(0);
    setPromoCode("");
    setIsAddingProduct(false);
    setSelectedGridProduct(null);
    setSelectedVariantSku("");
    setSelectedAttributes({});
    setAddQty(1);
    setAddPriceOverride(undefined);
    lastAutoFilledPhoneRef.current = "";
    setPhoneMatchedName(null);
    setPhoneLookupLoading(false);
    setIsDetailDrawerOpen(true);
  };

  // --- Drawer Editing Handlers ---
  const handleOpenDrawerWithDraft = (order: any) => {
    setDrawerMode("edit");
    setSelectedOrder(order);
    setDraftItems(order.items ? [...order.items] : []);
    setDraftDiscount(parseFloat(order.discount_amount || 0));
    setPromoCode("");
    setIsAddingProduct(false);
    setSelectedGridProduct(null);
    setSelectedVariantSku("");
    setSelectedAttributes({});
    setAddQty(1);
    setAddPriceOverride(undefined);
    lastAutoFilledPhoneRef.current = "";
    setPhoneMatchedName(null);
    setPhoneLookupLoading(false);
    setIsDetailDrawerOpen(true);
  };

  const handleRemoveDraftItem = (index: number) => {
    const newItems = [...draftItems];
    newItems.splice(index, 1);
    setDraftItems(newItems);
  };

  const handleOpenAddProduct = async () => {
    setIsAddingProduct(true);
    setSelectedGridProduct(null);
    setSelectedVariantSku("");
    setSelectedAttributes({});
    setAddQty(1);
    setAddPriceOverride(undefined);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      if (catalogCategories.length === 0) {
        const res = await axios.get(`${CATALOG_API_URL}/categories/tree`, { headers: { Authorization: `Bearer ${token}` }});
        setCatalogCategories(res.data);
      }
      if (gridProducts.length === 0) {
        const prodRes = await axios.get(`${CATALOG_API_URL}/products?limit=40`, { headers: { Authorization: `Bearer ${token}` }});
        setGridProducts(prodRes.data.results || []);
      }
    } catch (e: any) { if (e?.response?.status !== 403) message.error("Failed to fetch categories"); }
  };

  const fetchCategoryProducts = async (catId: number) => {
    setSelectedGridProduct(null);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${CATALOG_API_URL}/products?category_id=${catId}&limit=1000`, { headers: { Authorization: `Bearer ${token}` }});
      setGridProducts(res.data.results);
    } catch (e: any) { if (e?.response?.status !== 403) message.error("Failed to fetch products"); }
  };

  const handleCatalogSearch = async (value: string) => {
    setSelectedSubcategoryId(null);
    setSelectedGridProduct(null);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const url = value 
        ? `${CATALOG_API_URL}/products?search=${encodeURIComponent(value)}&limit=1000`
        : selectedCategoryId ? `${CATALOG_API_URL}/products?category_id=${selectedCategoryId}&limit=1000` : `${CATALOG_API_URL}/products?limit=50`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }});
      setGridProducts(res.data.results);
    } catch (e: any) { 
      if (e?.response?.status !== 403) message.error("Failed to fetch products"); 
    }
  };

  const handleAddDraftItem = () => {
    if (!selectedGridProduct || !selectedVariantSku) return;
    const variant = selectedGridProduct.variants.find((v: any) => v.sku === selectedVariantSku);
    if (!variant) return;
    const unitPrice = addPriceOverride !== undefined ? addPriceOverride : variant.selling_price;
    const imgUrl = selectedGridProduct.images?.[0]?.url || selectedGridProduct.images?.[0]?.image_url || null;

    setDraftItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.sku === variant.sku);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: (updated[existingIdx].quantity || 1) + addQty,
          price: unitPrice,
        };
        return updated;
      }
      return [
        ...prev,
        {
          sku: variant.sku,
          product_name: selectedGridProduct.name,
          attributes: variant.attributes,
          price: unitPrice,
          quantity: addQty,
          image: imgUrl,
          fulfillment_status: "pending",
        },
      ];
    });
    setIsAddingProduct(false);
    setSelectedGridProduct(null);
    setSelectedVariantSku("");
    setSelectedAttributes({});
    setAddQty(1);
    setAddPriceOverride(undefined);
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
        status: selectedOrder.status,
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

  // Manually Cancel Order
  const handleManualCancelOrder = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.put(`${API_URL}/${id}/status`, {
        status: "manually_cancelled",
        notes: "Order manually cancelled by admin from Orders Queue."
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Order #${res.data.order_number || id} marked as Manually Cancelled.`);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(res.data);
      }
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        message.error(err.response?.data?.message || err.response?.data?.detail || "Failed to cancel order manually.");
      }
    }
  };

  // Toggle Urgent status for fast fulfillment
  const handleToggleUrgent = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_access_token") || localStorage.getItem("poshplex_token") || "admin_imran";
      const res = await axios.post(`${API_URL}/${id}/toggle-urgent`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedOrder = res.data;
      const isUrgent = updatedOrder?.is_urgent;
      // Optimistically update local orders list
      setOrders(prev => prev.map(o => o.id === id ? { ...o, is_urgent: isUrgent } : o));
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder((prev: any) => ({ ...prev, is_urgent: isUrgent }));
      }
      if (isUrgent) {
        message.success(`Order #${updatedOrder?.order_number || id} marked as URGENT parcel! Prioritized at top of Fulfillment Queue.`);
      } else {
        message.info(`Order #${updatedOrder?.order_number || id} urgent priority removed.`);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to toggle urgent status.");
    }
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
      manually_cancelled: { color: "#c41d7f", label: "Manually Cancelled" },
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
    {
      title: "Order Number",
      dataIndex: "order_number",
      key: "order_number",
      render: (text: string, rec: any) => (
        <Space size={6}>
          <a onClick={() => handleOpenDrawerWithDraft(rec)}>{text || `#${rec.id}`}</a>
          {rec.is_urgent && (
            <Tag color="#ff4d4f" style={{ fontSize: 10, fontWeight: 800, padding: "0 4px", lineHeight: "16px", borderRadius: 3 }}>
              ⚡ URGENT
            </Tag>
          )}
        </Space>
      )
    },
    { title: "Customer Name", dataIndex: "shipping_name", key: "shipping_name", render: (text: string, rec: any) => <b>{text || rec.customer_name}</b> },
    { title: "Phone", dataIndex: "customer_phone", key: "customer_phone" },
    {
      title: "Delivery Risk",
      key: "delivery_risk",
      width: 140,
      render: (_: any, rec: any) => {
        // Steadfast delivery risk is only shown for 'placed' status orders
        if (String(rec.status || "").toLowerCase() !== "placed") {
          return <span style={{ color: "#6b7280", fontSize: 12 }}>-</span>;
        }
        const ph = rec.shipping_phone || rec.customer_phone;
        if (!ph) return <span style={{ color: "#9ca3af" }}>-</span>;
        let clean = ph.replace(/\D/g, "");
        if (clean.startsWith("8801") && clean.length === 13) clean = clean.slice(2);
        else if (clean.startsWith("008801") && clean.length === 15) clean = clean.slice(4);
        const risk = deliveryRiskMap[clean];

        return (
          <OrderCardRiskBadge
            phone={ph}
            data={risk}
            loading={loadingRiskMap && !risk}
          />
        );
      }
    },
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
      render: (track: string, record: any) => {
        const id = record.courier_consignment_id || track;
        return id ? <code style={{ color: "var(--accent-purple)" }}>{id}</code> : <Tag>NO COURIER</Tag>;
      },
    },
    {
      title: "Notes",
      dataIndex: "customer_notes",
      key: "customer_notes",
      render: (text: string) => {
        if (!text) return <span style={{ color: "var(--text-muted)" }}>-</span>;
        return (
          <Tooltip title={text} placement="top">
            <div style={{
              maxWidth: 140,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
              color: "var(--text-main)"
            }}>
              {text}
            </div>
          </Tooltip>
        );
      }
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
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => handleOpenDrawerWithDraft(record)}>
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button 
            style={{ 
              borderRadius: 6, 
              whiteSpace: 'nowrap',
              backgroundColor: '#4338ca', 
              borderColor: '#6366f1', 
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }} 
            icon={<ThunderboltOutlined style={{ color: '#a5b4fc' }} />}
            onClick={() => navigate("/order-analytics")}
          >
            OrderPulse Analytics
          </Button>
          <Tooltip title="Steadfast sync runs automatically every 1 hour (24 times a day) in the background via Celery Beat and live timers.">
            <Tag
              color="cyan"
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer"
              }}
            >
              <ClockCircleOutlined /> Auto: 1h (24x/day)
            </Tag>
          </Tooltip>
          <Button icon={<SyncOutlined />} onClick={handleSyncAllCouriers} style={{ borderRadius: 6, whiteSpace: 'nowrap' }}>
            Sync Steadfast
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateDrawer} style={{ borderRadius: 6, whiteSpace: 'nowrap' }}>
            Create Order
          </Button>
        </div>
      </div>

      <Card styles={{ body: { padding: '12px 14px' } }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search Order / Phone / Name / Consignment ID..."
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
          { label: <span>All <Badge count={orderCounts.all || 0} overflowCount={99999} showZero style={{ backgroundColor: '#52c41a' }} /></span>, key: "all" },
          { label: <span>Placed <Badge count={orderCounts.placed || 0} overflowCount={99999} showZero color="gold" /></span>, key: "placed" },
          { label: <span>Review <Badge count={orderCounts.review || 0} overflowCount={99999} showZero color="cyan" /></span>, key: "review" },
          { label: <span>Pending <Badge count={orderCounts.pending || 0} overflowCount={99999} showZero color="orange" /></span>, key: "pending" },
          { label: <span>Delayed <Badge count={orderCounts.delayed || 0} overflowCount={99999} showZero color="#ff4d4f" /></span>, key: "delayed" },
          { label: <span>Hold <Badge count={orderCounts.hold || 0} overflowCount={99999} showZero color="volcano" /></span>, key: "hold" },
          { label: <span>Approval Pending <Badge count={orderCounts.approval_pending || 0} overflowCount={99999} showZero color="blue" /></span>, key: "approval_pending" },
          { label: <span>Delivered <Badge count={orderCounts.delivered || 0} overflowCount={99999} showZero color="green" /></span>, key: "delivered" },
          { label: <span>Partially Delivered <Badge count={orderCounts.partially_delivered || 0} overflowCount={99999} showZero color="#fa8c16" /></span>, key: "partially_delivered" },
          { label: <span>Returned <Badge count={orderCounts.returned || 0} overflowCount={99999} showZero color="purple" /></span>, key: "returned" },
          { label: <span>Cancelled <Badge count={orderCounts.cancelled || 0} overflowCount={99999} showZero color="red" /></span>, key: "cancelled" },
          { label: <span>Manually Cancelled <Badge count={orderCounts.manually_cancelled || 0} overflowCount={99999} showZero color="#eb2f96" /></span>, key: "manually_cancelled" },
        ]} />

        <div className="posh-orders-grid">
          {orders.map(order => {
            const total = Math.round(parseFloat(order.total_amount || 0));
            const paid = order.payment_status === 'paid' ? total : (order.payment_status === 'partially_paid' ? 'Partial' : 0);
            const due = order.payment_status === 'paid' ? 0 : (order.payment_status === 'partially_paid' ? 'Partial' : total);
            const items = order.items || [];
            
            return (
              <Card
                key={order.id}
                className="posh-order-card"
                style={{
                  border: order.is_urgent ? "1px solid rgba(255, 77, 79, 0.5)" : undefined,
                  boxShadow: order.is_urgent ? "0 0 10px rgba(255, 77, 79, 0.18)" : undefined,
                }}
                styles={{ body: { padding: '12px', display: 'flex', flexDirection: 'column', height: '100%' } }}
              >
                {/* Images Top Section */}
                <div className="posh-order-card-img">
                  {items.length === 1 ? (
                    <img src={items[0].image ? (items[0].image.startsWith('http') ? items[0].image : `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${items[0].image}`) : ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="product" />
                  ) : items.length > 1 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: '100%' }}>
                      <img src={items[0].image ? (items[0].image.startsWith('http') ? items[0].image : `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${items[0].image}`) : ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="product 1" />
                      <img src={items[1].image ? (items[1].image.startsWith('http') ? items[1].image : `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://poshplexbd.com' : 'http://localhost:8000'))}${items[1].image}`) : ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="product 2" />
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>No Items</div>
                  )}
                </div>

                {/* PO & Date */}
                <div className="posh-order-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong>{order.order_number || `#${order.id}`}</strong>
                    {order.is_urgent && (
                      <Tag color="#ff4d4f" style={{ margin: 0, padding: "0 5px", fontSize: 10, lineHeight: "16px", fontWeight: 800, borderRadius: 3 }}>
                        ⚡ URGENT
                      </Tag>
                    )}
                  </div>
                  <span style={{ color: '#888' }}>{order.created_at ? new Date(order.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}</span>
                </div>

                {/* Customer Name & Phone */}
                <div className="posh-order-card-title" style={{ fontSize: 13, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {order.shipping_name || order.customer_name}
                </div>
                <div className="posh-order-card-phone" style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{order.customer_phone}</span>
                    {!isValidPhone(order.shipping_phone || order.customer_phone) && (
                      <Tooltip title="Invalid Phone Number. Cannot Ship. Click eye icon to edit.">
                        <WarningOutlined style={{ color: 'red' }} />
                      </Tooltip>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {activePhones[order.id] ? (
                      <PhoneOutlined 
                        style={{ color: '#25D366', cursor: 'pointer', fontSize: 15 }} 
                        onClick={() => setActivePhones(prev => ({...prev, [order.id]: false}))} 
                      />
                    ) : (
                      <PhoneOutlined 
                        style={{ color: '#888', cursor: 'pointer', fontSize: 15 }} 
                        onClick={() => setActivePhones(prev => ({...prev, [order.id]: true}))} 
                      />
                    )}
                  </div>
                </div>

                {/* Embedded Steadfast Delivery Risk Box - ONLY for 'placed' status orders */}
                {String(order.status || "").toLowerCase() === "placed" && (() => {
                  let ph = (order.shipping_phone || order.customer_phone || "").replace(/\D/g, "");
                  if (ph.startsWith("8801") && ph.length === 13) ph = ph.slice(2);
                  else if (ph.startsWith("008801") && ph.length === 15) ph = ph.slice(4);
                  return (
                    <OrderCardRiskBadge 
                      phone={order.shipping_phone || order.customer_phone} 
                      data={deliveryRiskMap[ph]} 
                      loading={loadingRiskMap && !deliveryRiskMap[ph]} 
                    />
                  );
                })()}

                {order.customer_notes && (
                  <Tooltip title={order.customer_notes} placement="top">
                    <div style={{
                      fontSize: 11,
                      color: "#c084fc",
                      backgroundColor: "rgba(192, 132, 252, 0.1)",
                      padding: "4px 8px",
                      borderRadius: 4,
                      marginBottom: 8,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                      border: "1px solid rgba(192, 132, 252, 0.2)"
                    }}>
                      <strong style={{ color: "#e879f9" }}>Note:</strong> {order.customer_notes}
                    </div>
                  </Tooltip>
                )}

                {/* Qty & Price */}
                <div className="posh-order-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{items.reduce((acc: number, item: any) => acc + item.quantity, 0)} items</span>
                  <strong style={{ color: '#fff' }}>৳{total}</strong>
                </div>

                {/* Paid & Due */}
                <div className="posh-order-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: '#888' }}>Paid: ৳{paid}</span>
                  <strong style={{ color: '#e11d48' }}>Due: ৳{due}</strong>
                </div>

                {/* Status Tags */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {getStatusTag(order.status)}
                  {getPaymentStatusTag(order.payment_status)}
                  <Tag color="default">Web Order</Tag>
                </div>

                {/* OrderPulse Blocker & Root Cause Diagnostics */}
                <OrderPulseTag
                  order={order}
                  apiUrl={API_URL}
                  onRefresh={fetchOrders}
                  onOpenSplitModal={(o) => {
                    setSplitSelectedOrder(o);
                    setIsSplitModalOpen(true);
                  }}
                />

                {/* Payment Method & Location */}
                <div className="posh-order-card-sub" style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{order.payments?.[0]?.method || 'Cash on Delivery'}</div>
                <div className="posh-order-card-sub" style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 12 }}>
                  Location: {getOrderLocationZone(order)}
                </div>

                {/* Actions */}
                <div className="posh-order-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  {!order.tracking_number ? (
                    <Button size="small" type="default" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }} onClick={() => handleBookShipment(order.id)}>
                      <CarOutlined /> Ship
                    </Button>
                  ) : (
                    <>
                      <Button size="small" style={{ flex: 1, borderColor: '#10b981', color: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, overflow: 'hidden' }} onClick={() => { navigator.clipboard.writeText(order.courier_consignment_id || order.tracking_number); message.success('Parcel ID copied to clipboard'); }}>
                        <CheckCircleOutlined style={{ flexShrink: 0 }} /> 
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Shipped: {order.courier_consignment_id || order.tracking_number}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {order.status !== 'cancelled' && order.status !== 'manually_cancelled' && (
                      <Popconfirm
                        title="Cancel Order Manually"
                        description="Mark this order as Manually Cancelled?"
                        onConfirm={() => handleManualCancelOrder(order.id)}
                        okText="Yes, Cancel"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<CloseCircleOutlined />}
                          style={{ fontSize: 11, padding: "0 6px", color: "#c41d7f", height: 24, borderRadius: 4, background: "rgba(196, 29, 127, 0.08)" }}
                        >
                          Cancel
                        </Button>
                      </Popconfirm>
                    )}

                    {/* Urgent button beside Cancel on Placed & Review status orders */}
                    {(String(order.status).toLowerCase() === 'placed' || String(order.status).toLowerCase() === 'review') && (
                      <Button
                        type="text"
                        size="small"
                        icon={<ThunderboltOutlined style={{ color: order.is_urgent ? '#fff' : '#ff4d4f', fontSize: 11 }} />}
                        onClick={() => handleToggleUrgent(order.id)}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "0 7px",
                          height: 24,
                          borderRadius: 4,
                          color: order.is_urgent ? '#fff' : '#ff4d4f',
                          background: order.is_urgent ? '#ff4d4f' : 'rgba(255, 77, 79, 0.1)',
                          border: order.is_urgent ? '1px solid #ff4d4f' : '1px dashed rgba(255, 77, 79, 0.4)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {order.is_urgent ? 'Urgent ✓' : 'Urgent'}
                      </Button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDrawerWithDraft(order)} />
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOrder(order.id)} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Pagination Control */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingBottom: 12 }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalCount}
            showSizeChanger
            pageSizeOptions={['16', '32', '64', '100']}
            onChange={(page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }}
          />
        </div>
      </Card>

      {/* Unified Order Create & Edit Side Drawer Overlay */}
      <Drawer
        title={
          !isAddingProduct
            ? drawerMode === "create"
              ? "Create New Order"
              : `Order Details: ${selectedOrder?.order_number || "#" + selectedOrder?.id}`
            : null
        }
        width={isAddingProduct ? "100vw" : "min(750px, 96vw)"}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setIsAddingProduct(false);
        }}
        open={isDetailDrawerOpen}
        bodyStyle={{ padding: 0, overflow: "hidden" }}
        headerStyle={isAddingProduct ? { display: "none" } : {}}
        closeIcon={!isAddingProduct ? undefined : null}
        extra={
          !isAddingProduct && drawerMode === "edit" ? (
            <Space>
              {(selectedOrder?.status === "placed" || selectedOrder?.status === "review") && (
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleToggleUrgent(selectedOrder.id)}
                  style={{
                    color: selectedOrder.is_urgent ? "#fff" : "#ff4d4f",
                    background: selectedOrder.is_urgent ? "#ff4d4f" : "rgba(255, 77, 79, 0.1)",
                    borderColor: selectedOrder.is_urgent ? "#ff4d4f" : "rgba(255, 77, 79, 0.4)",
                    fontWeight: 700,
                  }}
                >
                  {selectedOrder.is_urgent ? "Urgent Parcel ✓" : "Mark Urgent"}
                </Button>
              )}
              {selectedOrder?.status !== "cancelled" && selectedOrder?.status !== "manually_cancelled" && (
                <Popconfirm
                  title="Cancel Order Manually"
                  description="Are you sure you want to mark this order as Manually Cancelled?"
                  onConfirm={() => handleManualCancelOrder(selectedOrder.id)}
                  okText="Yes, Cancel"
                  cancelText="No"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    style={{
                      color: "#c41d7f",
                      borderColor: "rgba(196, 29, 127, 0.4)",
                      background: "rgba(196, 29, 127, 0.08)",
                    }}
                  >
                    Manually Cancel
                  </Button>
                </Popconfirm>
              )}
              <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteOrder(selectedOrder.id)}>
                Delete Order
              </Button>
            </Space>
          ) : null
        }
        footer={
          !isAddingProduct ? (
            <div style={{ textAlign: "right" }}>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                block
                onClick={drawerMode === "create" ? handleSaveCreateOrder : handleSaveDrawerEdits}
                loading={isSavingDraft}
              >
                {drawerMode === "create" ? "Create Order" : "Save Order Changes"}
              </Button>
            </div>
          ) : null
        }
      >
        <div
          className={isAddingProduct ? "posh-drawer-split adding" : "posh-drawer-split"}
          style={{ display: "flex", height: "100%", width: isAddingProduct ? "100vw" : "100%", overflow: "hidden" }}
        >
          {isAddingProduct && (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                background: "#141414",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                borderRight: "1px solid #333",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: "1px solid #333",
                  background: "#1f1f1f",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600 }}>Product Catalog</span>
                <Button
                  type="text"
                  onClick={() => setIsAddingProduct(false)}
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  X
                </Button>
              </div>

              <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                <Input.Search
                  placeholder="Search products..."
                  allowClear
                  size="large"
                  value={catalogSearchText}
                  onChange={(e) => setCatalogSearchText(e.target.value)}
                  onSearch={handleCatalogSearch}
                  enterButton
                  style={{ backgroundColor: "#1f1f1f", border: "none", borderRadius: 6, marginBottom: 16 }}
                />
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col span={12}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Select Category"
                      allowClear
                      value={selectedCategoryId}
                      onChange={(val) => {
                        setSelectedCategoryId(val || null);
                        setSelectedSubcategoryId(null);
                        if (val) {
                          fetchCategoryProducts(val);
                        } else {
                          handleCatalogSearch(catalogSearchText);
                        }
                      }}
                      dropdownStyle={{ background: "#1f1f1f", color: "#fff" }}
                    >
                      {catalogCategories.map((c) => (
                        <Select.Option key={c.id} value={c.id} style={{ color: "#fff" }}>
                          {c.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={12}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Select Subcategory"
                      allowClear
                      value={selectedSubcategoryId}
                      onChange={(val) => {
                        setSelectedSubcategoryId(val || null);
                        if (val) {
                          fetchCategoryProducts(val);
                        } else if (selectedCategoryId) {
                          fetchCategoryProducts(selectedCategoryId);
                        }
                      }}
                      disabled={!selectedCategoryId}
                      dropdownStyle={{ background: "#1f1f1f", color: "#fff" }}
                    >
                      {catalogCategories
                        .find((c) => c.id === selectedCategoryId)
                        ?.children?.map((sub: any) => (
                          <Select.Option key={sub.id} value={sub.id} style={{ color: "#fff" }}>
                            {sub.name}
                          </Select.Option>
                        ))}
                    </Select>
                  </Col>
                </Row>

                {gridProducts.length > 0 ? (
                  <div className="posh-drawer-product-grid">
                    {gridProducts.map((p) => (
                      <Card
                        key={p.id}
                        hoverable
                        size="small"
                        onClick={() => {
                          setSelectedGridProduct(p);
                          setSelectedAttributes({});
                          setAddQty(1);
                          setAddPriceOverride(undefined);
                          const singleSimpleVariant =
                            p.variants?.length === 1 &&
                            (!p.variants[0].attributes || Object.keys(p.variants[0].attributes).length === 0)
                              ? p.variants[0].sku
                              : "";
                          setSelectedVariantSku(singleSimpleVariant);
                        }}
                        style={{
                          border: selectedGridProduct?.id === p.id ? "2px solid #1677ff" : "1px solid #333",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#1f1f1f",
                          color: "#fff",
                        }}
                        bodyStyle={{ padding: 8 }}
                      >
                        <img
                          src={
                            p.images?.[0]?.url
                              ? p.images[0].url.startsWith("http")
                                ? p.images[0].url
                                : `${
                                    import.meta.env.VITE_SERVER_URL ||
                                    (window.location.hostname === "admin.poshplexbd.com"
                                      ? "https://poshplexbd.com"
                                      : "http://localhost:8000")
                                  }${p.images[0].url}`
                              : ""
                          }
                          style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 4 }}
                          alt={p.name}
                        />
                        <div
                          style={{
                            fontSize: 10,
                            marginTop: 4,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textAlign: "center",
                            fontWeight: 600,
                            color: "#ccc",
                          }}
                        >
                          {p.name}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#666" }}>No products found.</div>
                )}
              </div>

              {selectedGridProduct && (
                <div style={{ padding: 24, background: "#1f1f1f", borderTop: "1px solid #333" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#fff" }}>
                    Select Variation for {selectedGridProduct.name}
                  </div>

                  {(() => {
                    const attrMap: Record<string, Set<string>> = {};
                    selectedGridProduct.variants.forEach((v: any) => {
                      if (v.attributes) {
                        Object.entries(v.attributes).forEach(([key, val]) => {
                          if (!attrMap[key]) attrMap[key] = new Set();
                          attrMap[key].add(String(val));
                        });
                      }
                    });

                    return Object.entries(attrMap).map(([attrKey, valuesSet]) => (
                      <div key={attrKey} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Choose {attrKey}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {Array.from(valuesSet).map((val) => {
                            const isSelected = selectedAttributes[attrKey] === val;
                            if (attrKey.toLowerCase() === "color") {
                              return (
                                <div
                                  key={val}
                                  onClick={() => {
                                    const newAttrs = { ...selectedAttributes, [attrKey]: val };
                                    setSelectedAttributes(newAttrs);
                                    const matchingVariant = selectedGridProduct.variants.find((v: any) =>
                                      Object.entries(newAttrs).every(([k, v_val]) => v.attributes?.[k] === v_val)
                                    );
                                    setSelectedVariantSku(matchingVariant ? matchingVariant.sku : "");
                                  }}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: "50%",
                                    backgroundColor: val.toLowerCase(),
                                    border: isSelected ? "2px solid #1677ff" : "2px solid #444",
                                    cursor: "pointer",
                                    boxShadow: isSelected ? "0 0 0 2px rgba(255,255,255,0.8)" : "none",
                                  }}
                                  title={val}
                                />
                              );
                            }
                            return (
                              <div
                                key={val}
                                onClick={() => {
                                  const newAttrs = { ...selectedAttributes, [attrKey]: val };
                                  setSelectedAttributes(newAttrs);
                                  const matchingVariant = selectedGridProduct.variants.find((v: any) =>
                                    Object.entries(newAttrs).every(([k, v_val]) => v.attributes?.[k] === v_val)
                                  );
                                  setSelectedVariantSku(matchingVariant ? matchingVariant.sku : "");
                                }}
                                style={{
                                  padding: "4px 12px",
                                  border: isSelected ? "1px solid #1677ff" : "1px solid #444",
                                  background: isSelected ? "rgba(22, 119, 255, 0.1)" : "transparent",
                                  color: isSelected ? "#1677ff" : "#ccc",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: isSelected ? 600 : 400,
                                }}
                              >
                                {val}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}

                  {!selectedVariantSku && Object.keys(selectedAttributes).length > 0 && (
                    <div style={{ color: "#ff4d4f", fontSize: 12, marginBottom: 8 }}>
                      Selected combination is unavailable.
                    </div>
                  )}
                  {selectedVariantSku && (() => {
                    const v = selectedGridProduct.variants.find((x: any) => x.sku === selectedVariantSku);
                    return v ? (
                      <div style={{ color: "#52c41a", fontSize: 12, marginBottom: 8 }}>
                        Price: ৳{Math.round(v.selling_price)}
                      </div>
                    ) : null;
                  })()}

                  <Row gutter={12} align="bottom" style={{ marginTop: 12 }}>
                    <Col xs={8} sm={6}>
                      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>Quantity</div>
                      <InputNumber
                        min={1}
                        value={addQty}
                        onChange={(val) => setAddQty(val || 1)}
                        style={{ width: "100%", background: "#333", color: "#fff", border: "1px solid #444" }}
                      />
                    </Col>
                    <Col xs={16} sm={8}>
                      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>Unit Price Override (৳)</div>
                      <InputNumber
                        min={0}
                        placeholder={
                          selectedVariantSku
                            ? `৳${Math.round(
                                selectedGridProduct.variants.find((x: any) => x.sku === selectedVariantSku)
                                  ?.selling_price || 0
                              )}`
                            : "Default"
                        }
                        value={addPriceOverride}
                        onChange={(val) => setAddPriceOverride(val !== null ? val : undefined)}
                        style={{ width: "100%", background: "#333", color: "#fff", border: "1px solid #444" }}
                      />
                    </Col>
                    <Col xs={24} sm={10}>
                      <Button type="primary" onClick={handleAddDraftItem} block size="large" disabled={!selectedVariantSku}>
                        Add to Order
                      </Button>
                    </Col>
                  </Row>
                </div>
              )}
            </div>
          )}

          <div
            className="posh-drawer-right-pane"
            style={{
              width: isAddingProduct ? "min(750px, 100vw)" : "100%",
              height: "100%",
              overflowY: "auto",
              background: "var(--bg-primary)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "16px", flex: 1 }}>
              {selectedOrder && (
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  {/* Top Steadfast Delivery Risk & Merchant Reports (ONLY for 'placed' status orders or when creating a new order) */}
                  {(drawerMode === "create" || String(selectedOrder.status || "").toLowerCase() === "placed") && (() => {
                    const activeDrawerPhone = selectedOrder.shipping_phone || selectedOrder.customer_phone || "";
                    const normalizedDigits = normalizePhoneDigits(activeDrawerPhone);
                    const rawDigits = String(activeDrawerPhone).replace(/\D/g, "");
                    const canQuerySteadfast =
                      drawerMode === "edit" ? rawDigits.length >= 10 : normalizedDigits.length >= 11;

                    return (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#888",
                            textTransform: "uppercase",
                            marginBottom: 8,
                            fontWeight: 700,
                          }}
                        >
                          Steadfast Delivery Risk &amp; Merchant Reports
                        </div>
                        {canQuerySteadfast ? (
                          <SteadfastRiskCard key={normalizedDigits || rawDigits} phone={activeDrawerPhone} />
                        ) : (
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: 8,
                              border: "1px dashed #333",
                              background: "rgba(255,255,255,0.02)",
                              color: "#9ca3af",
                              fontSize: 12,
                            }}
                          >
                            Enter the customer&apos;s full 11-digit phone number below to load Steadfast delivery risk &amp; auto-fill existing customer details.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Risk and Status Overview */}
                  {drawerMode === "create" ? (
                    (() => {
                      const subtotal = draftItems.reduce(
                        (acc, item) => acc + parseFloat(item.price || 0) * (item.quantity || 1),
                        0
                      );
                      const reasons: string[] = [];
                      if (subtotal > 800 && (selectedOrder.payment_status || "unpaid") === "unpaid") {
                        reasons.push("High value Cash on Delivery (COD) order (> ৳800).");
                      }
                      if (selectedOrder.shipping_phone && !isValidPhone(selectedOrder.shipping_phone)) {
                        reasons.push("Phone number format does not match 11-digit BD standard.");
                      }
                      const riskLevel = reasons.length > 0 ? "MEDIUM" : "LOW";
                      return (
                        <Alert
                          message={`Operational Risk Check Status: ${riskLevel}`}
                          description={
                            reasons.length > 0 ? (
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {reasons.map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                              </ul>
                            ) : (
                              "New manual order draft. Fill customer coordinates and add product items below."
                            )
                          }
                          type={riskLevel === "MEDIUM" ? "warning" : "success"}
                          showIcon
                        />
                      );
                    })()
                  ) : (
                    <Alert
                      message={`Operational Risk Check Status: ${selectedOrder.risk_level?.toUpperCase()}`}
                      description={
                        selectedOrder.risk_reasons?.length > 0 ? (
                          <ul>
                            {selectedOrder.risk_reasons.map((r: string, idx: number) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        ) : (
                          "Clear dataset. No order warning flags detected."
                        )
                      }
                      type={
                        selectedOrder.risk_level === "high"
                          ? "error"
                          : selectedOrder.risk_level === "medium"
                          ? "warning"
                          : "success"
                      }
                      showIcon
                    />
                  )}

                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, marginBottom: 16, fontWeight: 600 }}>
                      Order Coordinates &amp; Editable Details
                    </h3>

                    {drawerMode === "create" && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>
                          Quick Existing Customer Lookup (Optional)
                        </div>
                        <Select
                          showSearch
                          allowClear
                          placeholder="Search existing customer by Name, Phone or Email (or fill fields directly below)"
                          value={selectedOrder.user_id || undefined}
                          filterOption={false}
                          onSearch={setCustomerSearchQuery}
                          onChange={(val) => handleCreateCustomerSelect(val)}
                          style={{ width: "100%", marginTop: 4 }}
                        >
                          {crmCustomers.map((c) => (
                            <Select.Option key={c.id} value={c.id}>
                              {c.username} {c.phone ? `· ${c.phone}` : ""} {c.email ? `(${c.email})` : ""}
                            </Select.Option>
                          ))}
                        </Select>
                      </div>
                    )}

                    <Row gutter={[12, 12]}>
                      <Col xs={12} sm={12}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Order Status</div>
                        <Select
                          value={selectedOrder.status}
                          style={{ width: "100%", marginTop: 4 }}
                          onChange={(v) => setSelectedOrder({ ...selectedOrder, status: v })}
                        >
                          <Select.Option value="placed">Order Placed</Select.Option>
                          <Select.Option value="review">In Review</Select.Option>
                          <Select.Option value="pending">Pending</Select.Option>
                          <Select.Option value="hold">Hold</Select.Option>
                          <Select.Option value="approval_pending">Approval Pending</Select.Option>
                          {drawerMode === "edit" && (
                            <>
                              <Select.Option value="delivered">Delivered</Select.Option>
                              <Select.Option value="partially_delivered">Partially Delivered</Select.Option>
                              <Select.Option value="cancelled">Cancelled (Courier)</Select.Option>
                              <Select.Option value="manually_cancelled">Manually Cancelled</Select.Option>
                              <Select.Option value="returned">Returned</Select.Option>
                              <Select.Option value="rto">RTO</Select.Option>
                            </>
                          )}
                        </Select>
                      </Col>
                      <Col xs={12} sm={12}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Payment Status</div>
                        <Select
                          value={selectedOrder.payment_status}
                          style={{ width: "100%", marginTop: 4 }}
                          onChange={(v) => setSelectedOrder({ ...selectedOrder, payment_status: v })}
                        >
                          <Select.Option value="unpaid">Unpaid</Select.Option>
                          <Select.Option value="pending_verification">Pending Verification</Select.Option>
                          <Select.Option value="paid">Paid</Select.Option>
                          <Select.Option value="partially_paid">Partially Paid</Select.Option>
                          {drawerMode === "edit" && (
                            <>
                              <Select.Option value="refunded">Refunded</Select.Option>
                              <Select.Option value="failed">Failed</Select.Option>
                            </>
                          )}
                        </Select>
                      </Col>
                      <Col xs={12} sm={12}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Customer Name</div>
                        <Input
                          placeholder="Full name"
                          value={selectedOrder.shipping_name || selectedOrder.customer_name}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, shipping_name: e.target.value })}
                          style={{ marginTop: 4 }}
                        />
                      </Col>
                      <Col xs={12} sm={12}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Phone</div>
                        <Input
                          placeholder="01XXXXXXXXX (11 digits)"
                          value={selectedOrder.shipping_phone || selectedOrder.customer_phone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedOrder({ ...selectedOrder, shipping_phone: val });
                          }}
                          style={{ marginTop: 4 }}
                        />
                        {drawerMode === "create" && phoneLookupLoading && (
                          <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 4 }}>
                            Checking customer database...
                          </div>
                        )}
                        {drawerMode === "create" && !phoneLookupLoading && phoneMatchedName && (
                          <div style={{ fontSize: 11, color: "#22c55e", marginTop: 4 }}>
                            Auto-filled existing customer: {phoneMatchedName}
                          </div>
                        )}
                      </Col>
                      <Col xs={12} sm={8}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>District</div>
                        <Select
                          showSearch
                          placeholder="Select district"
                          value={selectedOrder.shipping_district}
                          onChange={(val) => {
                            const d = locationRates.find((l) => l.name === val);
                            setSelectedOrder({
                              ...selectedOrder,
                              shipping_district: val,
                              shipping_thana: d?.thanas?.[0] || "",
                              shipping_cost: d?.shipping_cost ?? selectedOrder.shipping_cost,
                            });
                          }}
                          style={{ width: "100%", marginTop: 4 }}
                        >
                          {locationRates.map((d: any) => (
                            <Select.Option key={d.name} value={d.name}>
                              {d.name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={12} sm={8}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Thana</div>
                        <Select
                          showSearch
                          placeholder="Select thana"
                          value={selectedOrder.shipping_thana}
                          onChange={(val) => setSelectedOrder({ ...selectedOrder, shipping_thana: val })}
                          style={{ width: "100%", marginTop: 4 }}
                        >
                          {locationRates
                            .find((d: any) => d.name === selectedOrder.shipping_district)
                            ?.thanas?.map((t: string) => (
                              <Select.Option key={t} value={t}>
                                {t}
                              </Select.Option>
                            ))}
                        </Select>
                      </Col>
                      <Col xs={24} sm={8}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Postal Code</div>
                        <Input
                          placeholder="Optional"
                          value={selectedOrder.shipping_postal_code}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, shipping_postal_code: e.target.value })}
                          style={{ marginTop: 4 }}
                        />
                      </Col>
                      <Col span={24}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Detailed Address</div>
                        <Input.TextArea
                          placeholder="House No, Road, Area..."
                          value={selectedOrder.shipping_address}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, shipping_address: e.target.value })}
                          style={{ marginTop: 4 }}
                        />
                      </Col>
                      {drawerMode === "edit" ? (
                        <Col xs={12} sm={12}>
                          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Courier Tracking</div>
                          <div style={{ fontWeight: 600 }}>
                            {selectedOrder.courier_consignment_id || selectedOrder.tracking_number || "NOT DISPATCHED"}
                          </div>
                          <div style={{ color: "#888", fontSize: 13 }}>{selectedOrder.courier_status || "PENDING"}</div>
                        </Col>
                      ) : (
                        <Col xs={12} sm={12}>
                          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Payment Method</div>
                          <Select
                            value={selectedOrder.payment_method || "COD"}
                            onChange={(v) => setSelectedOrder({ ...selectedOrder, payment_method: v })}
                            style={{ width: "100%", marginTop: 4 }}
                          >
                            <Select.Option value="COD">Cash on Delivery (COD)</Select.Option>
                            {bankAccounts.map((ba: any) => (
                              <Select.Option key={ba.id} value={ba.name}>
                                {ba.name}
                              </Select.Option>
                            ))}
                          </Select>
                        </Col>
                      )}
                      <Col xs={12} sm={12}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>
                          Shipping Cost Override
                        </div>
                        <InputNumber
                          min={0}
                          value={selectedOrder.shipping_cost}
                          onChange={(v) => setSelectedOrder({ ...selectedOrder, shipping_cost: v })}
                          style={{ width: "100%", marginTop: 4 }}
                        />
                      </Col>

                      {drawerMode === "create" &&
                        (selectedOrder.payment_status === "paid" || selectedOrder.payment_status === "partially_paid") && (
                          <>
                            <Col xs={12} sm={12}>
                              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>
                                Paid / Advance Amount (৳)
                              </div>
                              <InputNumber
                                min={0}
                                value={selectedOrder.payment_amount}
                                onChange={(v) => setSelectedOrder({ ...selectedOrder, payment_amount: v || 0 })}
                                style={{ width: "100%", marginTop: 4 }}
                              />
                            </Col>
                            <Col xs={12} sm={12}>
                              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>
                                Transaction Reference ID
                              </div>
                              <Input
                                placeholder="e.g. TR-A1B2C3D4"
                                value={selectedOrder.payment_reference}
                                onChange={(e) => setSelectedOrder({ ...selectedOrder, payment_reference: e.target.value })}
                                style={{ marginTop: 4 }}
                              />
                            </Col>
                          </>
                        )}

                      <Col xs={24} sm={12}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Customer Notes</div>
                        <Input.TextArea
                          value={selectedOrder.customer_notes}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, customer_notes: e.target.value })}
                          style={{ marginTop: 4 }}
                        />
                      </Col>
                      <Col xs={24} sm={12}>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Internal Notes</div>
                        <Input.TextArea
                          value={selectedOrder.internal_notes}
                          onChange={(e) => setSelectedOrder({ ...selectedOrder, internal_notes: e.target.value })}
                          style={{ marginTop: 4 }}
                        />
                      </Col>
                    </Row>
                  </div>

                  <Divider>Drop Lines checklist</Divider>

                  <Table
                    scroll={{ x: "max-content" }}
                    size="small"
                    dataSource={draftItems}
                    pagination={false}
                    rowKey={(rec) => rec.sku}
                    columns={[
                      {
                        title: "SKU Variant",
                        dataIndex: "sku",
                        key: "sku",
                        render: (text, rec: any) => {
                          const attrs =
                            rec.attributes && Object.keys(rec.attributes).length > 0
                              ? Object.entries(rec.attributes)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ")
                              : "";
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              {rec.image && (
                                <div
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    flexShrink: 0,
                                    border: "1px solid rgba(255,255,255,0.1)",
                                  }}
                                >
                                  <img
                                    src={rec.image}
                                    alt={rec.product_name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 500 }}>{rec.product_name || "Unknown Product"}</div>
                                <div style={{ fontSize: "0.85em", color: "#666" }}>{text}</div>
                                {attrs && <div style={{ fontSize: "0.85em", color: "#888" }}>( {attrs} )</div>}
                              </div>
                            </div>
                          );
                        },
                      },
                      {
                        title: "Price",
                        dataIndex: "price",
                        key: "price",
                        render: (val, _, idx) =>
                          drawerMode === "create" ? (
                            <InputNumber
                              size="small"
                              min={0}
                              value={Math.round(parseFloat(val || 0))}
                              onChange={(v) => {
                                const updated = [...draftItems];
                                updated[idx] = { ...updated[idx], price: v || 0 };
                                setDraftItems(updated);
                              }}
                              style={{ width: 76 }}
                            />
                          ) : (
                            `৳${Math.round(val)}`
                          ),
                      },
                      {
                        title: "Qty Ordered",
                        dataIndex: "quantity",
                        key: "quantity",
                        render: (val, _, idx) => (
                          <InputNumber
                            size="small"
                            min={1}
                            value={val}
                            onChange={(v) => {
                              const updated = [...draftItems];
                              updated[idx] = { ...updated[idx], quantity: v || 1 };
                              setDraftItems(updated);
                            }}
                            style={{ width: 64 }}
                          />
                        ),
                      },
                      ...(drawerMode === "edit"
                        ? [
                            { title: "Returned Qty", dataIndex: "returned_quantity", key: "returned_quantity" },
                            {
                              title: "Fulfillment State",
                              dataIndex: "fulfillment_status",
                              key: "fulfillment_status",
                              render: (s: string) => <Tag>{s?.toUpperCase()}</Tag>,
                            },
                          ]
                        : []),
                      {
                        title: "Action",
                        key: "action",
                        render: (_, __, index) => (
                          <Popconfirm title="Remove item from draft?" onConfirm={() => handleRemoveDraftItem(index)}>
                            <Button danger size="small" type="text" icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ),
                      },
                    ]}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenAddProduct}>
                      Add New Product
                    </Button>
                    {drawerMode === "edit" && (
                      <Button type="dashed" icon={<GiftOutlined />} onClick={() => setIsReturnModalOpen(true)}>
                        Process Return Request
                      </Button>
                    )}
                  </div>

                  <Card size="small" style={{ marginTop: 16, borderColor: "#e5e5e5" }}>
                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={12}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Discount Amount (৳)</label>
                        <InputNumber
                          style={{ width: "100%" }}
                          min={0}
                          value={draftDiscount}
                          onChange={(v) => setDraftDiscount(v || 0)}
                        />
                      </Col>
                      <Col xs={24} sm={12}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Promo Code (Optional)</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Input
                            placeholder="Enter code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                          />
                          <Button
                            type="default"
                            onClick={async () => {
                              if (!promoCode) return;
                              const subtotal = draftItems.reduce(
                                (acc, item) => acc + parseFloat(item.price || 0) * (item.quantity || 1),
                                0
                              );
                              try {
                                const token = localStorage.getItem("poshplex_access_token");
                                const res = await axios.post(
                                  `${
                                    import.meta.env.VITE_SERVER_URL ||
                                    (window.location.hostname === "admin.poshplexbd.com"
                                      ? "https://poshplexbd.com"
                                      : "http://localhost:8000")
                                  }/api/v1/marketing/promocodes/validate`,
                                  { code: promoCode, order_amount: subtotal },
                                  {
                                    headers: { Authorization: `Bearer ${token}` },
                                  }
                                );
                                if (res.data.valid) {
                                  setDraftDiscount(res.data.discount_amount);
                                  message.success(`Promo code applied: -৳${res.data.discount_amount}`);
                                } else {
                                  message.error(res.data.message || "Invalid promo code");
                                }
                              } catch (e: any) {
                                message.info(
                                  "Code received, please apply discount manually if backend doesn't support promo code lookup yet."
                                );
                              }
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      </Col>
                    </Row>

                    {(() => {
                      const subtotal = draftItems.reduce(
                        (acc, item) => acc + parseFloat(item.price || 0) * (item.quantity || 1),
                        0
                      );
                      const finalTotal = subtotal - (draftDiscount || 0) + parseFloat(selectedOrder?.shipping_cost || 0);
                      return (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed #444" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ color: "#aaa" }}>Subtotal:</span>
                            <strong>৳{Math.round(subtotal)}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#e11d48" }}>
                            <span>Discount:</span>
                            <strong>- ৳{Math.round(draftDiscount || 0)}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ color: "#aaa" }}>Shipping:</span>
                            <strong>৳{Math.round(parseFloat(selectedOrder?.shipping_cost || 0))}</strong>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 18,
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: "1px solid #444",
                            }}
                          >
                            <strong>Total:</strong>
                            <strong>৳{Math.round(finalTotal)}</strong>
                          </div>
                        </div>
                      );
                    })()}
                  </Card>

                  {drawerMode === "edit" && (
                    <>
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
                          {
                            title: "Status",
                            dataIndex: "status",
                            key: "status",
                            render: (s) => <Tag color="success">{s?.toUpperCase()}</Tag>,
                          },
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
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {new Date(h.timestamp).toLocaleString()}
                            </span>{" "}
                            <br />
                            <span>{h.notes}</span>
                          </Timeline.Item>
                        ))}
                      </Timeline>
                    </>
                  )}
                </Space>
              )}
            </div>
            {isAddingProduct && (
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid var(--border-glass)",
                  textAlign: "right",
                  background: "var(--bg-primary)",
                  position: "sticky",
                  bottom: 0,
                  zIndex: 10,
                }}
              >
                <Button
                  type="primary"
                  size="large"
                  icon={<SaveOutlined />}
                  block
                  onClick={drawerMode === "create" ? handleSaveCreateOrder : handleSaveDrawerEdits}
                  loading={isSavingDraft}
                >
                  {drawerMode === "create" ? "Create Order" : "Save Order Changes"}
                </Button>
              </div>
            )}
          </div>
        </div>
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
              <Descriptions.Item label="Courier Status"><Tag color={selectedOrder.courier_status === 'delivered' ? 'green' : 'blue'}>{selectedOrder.courier_status || "N/A"}</Tag></Descriptions.Item>
              <Descriptions.Item label="Courier Tracking">{selectedOrder.courier_consignment_id || selectedOrder.tracking_number || "Not generated yet"}</Descriptions.Item>
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

      {/* OrderPulse Analytics Drawer */}
      <OrderPulseDrawer
        visible={isPulseDrawerOpen}
        onClose={() => setIsPulseDrawerOpen(false)}
        apiUrl={API_URL}
      />

      {/* Partial Delivery SKU Split Resolver Modal */}
      <PartialSplitModal
        visible={isSplitModalOpen}
        order={splitSelectedOrder}
        apiUrl={API_URL}
        onClose={() => setIsSplitModalOpen(false)}
        onSuccess={fetchOrders}
      />

    </Space>
  );
};

export default Orders;



