import React, { useState, useEffect } from "react";
import {
  Table, Tag, Button, Space, Card, Form, Input, 
  InputNumber, Select, Descriptions, Divider, message, Tabs, Drawer, Timeline, Row, Col, Alert, Checkbox, Progress, Modal, Badge, Image
} from "antd";
import {
  CarOutlined, PrinterOutlined, CheckCircleOutlined, SyncOutlined, 
  EyeOutlined, EditOutlined, DollarOutlined, SolutionOutlined, LoadingOutlined, PhoneOutlined, InboxOutlined
} from "@ant-design/icons";
import axios from "axios";
import { EditOrderModal } from "../components/EditOrderModal";

const API_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/orders";
const CATALOG_API_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/catalog";

const formatCourierStatus = (status: string) => {
  if (!status) return "PENDING";
  const st = status.toLowerCase();
  if (
    st === "delivered_approval_pending" ||
    st === "partial_delivered_approval_pending" ||
    st === "cod_approval_pending" ||
    st === "delivered approval pending" ||
    st === "partial delivered approval pending"
  ) {
    return "COD Approval Pending";
  }
  return status.toUpperCase();
};

export const Fulfillment: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Filters and Sorting
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | undefined>("review");
  const [filterPayment, setFilterPayment] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState("created_at");

  // Operational states
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isCODModalOpen, setIsCODModalOpen] = useState(false);
  const [isEditTrackingOpen, setIsEditTrackingOpen] = useState(false);
  
  // Progress states for bulk dispatches
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [syncTotal, setSyncTotal] = useState(0);

  // Edit Modal and Metadata
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [orderCounts, setOrderCounts] = useState<any>({});
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [prodRes, pmRes] = await Promise.all([
          axios.get(`${CATALOG_API_URL}/products`, { params: { limit: 100 } }),
          axios.get(`${API_URL}/payments/methods`)
        ]);
        setProductsList(prodRes.data.results || []);
        setPaymentMethods(pmRes.data);
      } catch (err) {}
    };
    loadMetadata();
  }, []);


  const [codForm] = Form.useForm();
  const [trackingForm] = Form.useForm();

  // Load active orders from the queue endpoint
  const fetchFulfillmentQueue = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: 1,
        limit: 100, // fetch queue batch
        sort_by: sortBy
      };
      if (searchText) params.search = searchText;
      if (filterStatus) params.status = filterStatus;
      if (filterPayment) params.payment_status = filterPayment;

      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.get(`${API_URL}/fulfillment/queue`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data.results || []);

      const countsRes = await axios.get(`${API_URL}/counts`, { headers: { Authorization: `Bearer ${token}` } });
      setOrderCounts(countsRes.data);

    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to load active fulfillment queue."); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFulfillmentQueue();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, filterStatus, filterPayment, sortBy]);

  // Bulk push selected orders to Steadfast Courier
  const handleBulkPushSteadfast = async () => {
    if (selectedRowKeys.length === 0) return;
    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    
    const token = localStorage.getItem("poshplex_access_token");
    
    for (const orderId of selectedRowKeys) {
      try {
        await axios.post(`${API_URL}/${orderId}/ship`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    
    message.info(`Batch dispatch complete. Dispatched: ${successCount}, Failed: ${failCount}`);
    setSelectedRowKeys([]);
    fetchFulfillmentQueue();
    setLoading(false);
  };

  // Bulk sync Steadfast Courier statuses with progress indicator
  const handleBulkSyncCourier = async () => {
    if (selectedRowKeys.length === 0) return;
    const total = selectedRowKeys.length;
    setSyncTotal(total);
    setSyncProgress(0);
    setLoading(true);

    const token = localStorage.getItem("poshplex_access_token");
    let count = 0;

    for (const orderId of selectedRowKeys) {
      try {
        // Skip calling API if the order is already final state (safety built in frontend as well)
        const ord = orders.find(o => o.id === orderId);
        if (ord && !['placed', 'review', 'pending', 'approval_pending'].includes(ord.status)) {
          count++;
          setSyncProgress(count);
          continue;
        }

        await axios.post(`${API_URL}/${orderId}/sync-courier`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        count++;
        setSyncProgress(count);
      } catch (err) {
        count++;
        setSyncProgress(count);
      }
    }

    message.success(`Bulk synchronization of ${total} orders complete.`);
    setSyncProgress(null);
    setSelectedRowKeys([]);
    fetchFulfillmentQueue();
    setLoading(false);
  };

  // COD Collected approval
  const handleCODReconcile = async (values: any) => {
    if (!selectedOrder) return;
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const res = await axios.post(`${API_URL}/${selectedOrder.id}/cod-approve`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("COD Amount Reconciliation complete. Posted to Ledger cash account.");
      setIsCODModalOpen(false);
      codForm.resetFields();
      setIsDetailDrawerOpen(false);
      fetchFulfillmentQueue();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Failed to approve COD collection."); }
  };

  // Update Decoupled tracking numbers
  const handleUpdateTracking = async (values: any) => {
    if (!selectedOrder) return;
    try {
      const token = localStorage.getItem("poshplex_access_token");
      // Perform decoupled update by PUTing tracking changes
      const updatedData = {
        ...selectedOrder,
        tracking_number: values.tracking_number,
        courier_status: values.courier_status || "pending",
        // Map items back
        items: selectedOrder.items.map((i: any) => ({
          sku: i.sku,
          quantity: i.quantity,
          price: i.price
        }))
      };
      
      const res = await axios.put(`${API_URL}/${selectedOrder.id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Decoupled tracking details updated successfully.");
      setIsEditTrackingOpen(false);
      setSelectedOrder(res.data);
      fetchFulfillmentQueue();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Tracking update failed."); }
  };

  // Manual status override
  const handleStatusOverride = async (newStatus: string) => {
    if (!selectedOrder) return;
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const updatedData = {
        ...selectedOrder,
        status: newStatus,
        items: selectedOrder.items.map((i: any) => ({
          sku: i.sku,
          quantity: i.quantity,
          price: i.price
        }))
      };
      const res = await axios.put(`${API_URL}/${selectedOrder.id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Manual override set order status to: ${newStatus.toUpperCase()}`);
      setSelectedOrder(res.data);
      fetchFulfillmentQueue();
    } catch (err: any) { if (err?.response?.status !== 403) message.error("Override failed."); }
  };

  const getStatusBadge = (status: string) => {
    const mapping: Record<string, string> = {
      placed: "gold",
      review: "cyan",
      pending: "orange",
      approval_pending: "blue",
      delivered: "green",
      partially_delivered: "lime",
      cancelled: "red",
      returned: "magenta",
      rto: "volcano"
    };
    const labels: Record<string, string> = {
      placed: "ORDER PLACED",
      review: "IN REVIEW",
      pending: "PENDING",
      approval_pending: "SHIPPED",
      delivered: "DELIVERED",
      partially_delivered: "PARTIAL DELIVERY",
      cancelled: "CANCELLED",
      returned: "RETURNED",
      rto: "RTO"
    };
    return <Tag color={mapping[status] || "default"}>{labels[status] || status?.toUpperCase()}</Tag>;
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%", paddingBottom: 64 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InboxOutlined style={{ fontSize: 28 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-main)" }}>
              Order Fulfillment <span style={{ fontSize: 13, fontWeight: 'normal', color: '#888' }}>{orders.length}</span>
            </h1>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>Pack & prepare orders before courier</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
          <Button
            style={{ backgroundColor: '#1a1a1a', color: '#fff' }}
            onClick={() => setFilterStatus("review")}
          >
            In Review
          </Button>

          <Input
            prefix={<SyncOutlined style={{ color: 'transparent' }} />}
            placeholder="PO / phone / name"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ flex: 1, minWidth: 140 }}
          />

          <Button icon={<SyncOutlined />} onClick={handleBulkSyncCourier}>Sync</Button>
        </div>
      </div>

      {syncProgress !== null && (
        <Card>
          <Space direction="vertical" style={{ width: "100%" }}>
            <span>Bulk synchronizing consignment statuses with courier: <b>{syncProgress} / {syncTotal}</b></span>
            <Progress percent={Math.round((syncProgress / syncTotal) * 100)} status="active" />
          </Space>
        </Card>
      )}

      {/* Orders List / Cards Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {orders.map(order => {
          const items = order.items || [];
          const isReady = order.status !== 'review';
          
          return (
            <Card key={order.id} styles={{ body: { padding: '24px 16px' } }} style={{ borderRadius: 8, borderColor: '#e5e5e5' }}>
              <Row gutter={[24, 24]} align="middle">
                {/* Left: Products list */}
                <Col xs={24} md={10} lg={8}>
                  <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
                    {items.map((item: any, idx: number) => (
                      <div key={idx} style={{ textAlign: 'center', minWidth: 100 }}>
                        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 8, marginBottom: 8, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.image ? (
                            <Image src={`${(import.meta.env.VITE_SERVER_URL || 'http://localhost:8000')}${item.image}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="product" />
                          ) : (
                            <span style={{ color: '#ccc' }}>No Image</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>x{item.quantity}</div>
                        <div style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
                          {item.attributes?.size || ''} {item.attributes?.color ? `â€¢ ${item.attributes.color}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </Col>

                {/* Middle: Order Info */}
                <Col xs={24} md={10} lg={12} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <strong style={{ fontSize: 16 }}>{order.order_number || `#${order.id}`}</strong>
                    <Tag style={{ borderRadius: 12, border: '1px solid #d9d9d9', background: '#fff', color: '#666', margin: 0 }}>Confirmed</Tag>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#10b981' }}>
                    <CheckCircleOutlined />
                    <strong style={{ color: '#000' }}>Parcel ID: {order.tracking_number || 'N/A'}</strong>
                    {order.tracking_number && (
                      <a href={`https://steadfast.com.bd/tracking?id=${order.tracking_number}`} target="_blank" rel="noreferrer">
                        <EyeOutlined style={{ color: '#888' }} />
                      </a>
                    )}
                  </div>

                  <div style={{ marginBottom: 4, color: '#333' }}>{order.shipping_name || order.customer_name}</div>
                  <div style={{ color: '#666', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PhoneOutlined /> {order.shipping_phone || order.customer_phone}
                  </div>
                  {order.customer_notes && (
                    <div style={{ color: '#666', fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SolutionOutlined /> {order.customer_notes}
                    </div>
                  )}
                  
                  <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                    {order.created_at ? new Date(order.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} â€¢ ৳{Math.round(parseFloat(order.total_amount || 0))}
                  </div>
                </Col>

                {/* Right: Actions */}
                <Col xs={24} md={4} lg={4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
                  <Select defaultValue="None" style={{ width: '100%' }}>
                    <Select.Option value="None">None</Select.Option>
                    <Select.Option value="Stock Out">Stock Out</Select.Option>
                    <Select.Option value="Print Issues">Print Issues</Select.Option>
                    <Select.Option value="Courier Issues">Courier Issues</Select.Option>
                    <Select.Option value="Others Issues">Others Issues</Select.Option>
                  </Select>
                  
                  <Button 
                    type="primary" 
                    icon={!isReady ? <InboxOutlined /> : <CheckCircleOutlined />}
                    style={{ width: '100%', backgroundColor: !isReady ? '#000' : '#10b981', borderColor: !isReady ? '#000' : '#10b981', borderRadius: 4 }}
                    onClick={() => {
                      if (!isReady) handleStatusOverride('pending');
                      else { setSelectedOrder(order); setIsDetailDrawerOpen(true); }
                    }}
                  >
                    {!isReady ? 'Mark as Ready' : 'Ready'}
                  </Button>
                </Col>
              </Row>
            </Card>
          );
        })}
      </div>

      {/* Expandable Action Drawer */}
      <Drawer
        title={`Queue Action Card: ${selectedOrder?.order_number || "#" + selectedOrder?.id}`}
        width="min(700px, 96vw)"
        onClose={() => setIsDetailDrawerOpen(false)}
        open={isDetailDrawerOpen}
        extra={
          <Space>
            <Button icon={<PrinterOutlined />} onClick={() => triggerPrintWindow(selectedOrder)}>
              Print Pack list
            </Button>
          </Space>
        }
      >
        {selectedOrder && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            
            {selectedOrder.customer_notes && (
              <Alert message="Customer checkout instruction" description={selectedOrder.customer_notes} type="info" showIcon />
            )}

            <Descriptions title="Recipient Logistics" bordered column={2}>
              <Descriptions.Item label="Contact username">{selectedOrder.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Shipping phone">{selectedOrder.shipping_phone}</Descriptions.Item>
              <Descriptions.Item label="Shipping District">{selectedOrder.shipping_district}</Descriptions.Item>
              <Descriptions.Item label="Thana Area hub">{selectedOrder.shipping_thana}</Descriptions.Item>
              <Descriptions.Item label="Detailed Address" span={2}>{selectedOrder.shipping_address}</Descriptions.Item>
            </Descriptions>

            <Divider>Status Management</Divider>
            <Space size="middle">
              <span>Change Order status:</span>
              <Select defaultValue={selectedOrder.status} style={{ width: 200 }} onChange={handleStatusOverride}>
                <Select.Option value="placed">Order Placed</Select.Option>
                <Select.Option value="review">In Review</Select.Option>
                <Select.Option value="pending">Pending</Select.Option>
                <Select.Option value="approval_pending">Shipped / Dispatch</Select.Option>
                <Select.Option value="delivered">Delivered</Select.Option>
                <Select.Option value="partially_delivered">Partially Delivered</Select.Option>
                <Select.Option value="cancelled">Cancelled</Select.Option>
                <Select.Option value="returned">Returned</Select.Option>
                <Select.Option value="rto">RTO</Select.Option>
              </Select>
            </Space>

            <Divider>Decoupled Tracking details</Divider>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Tracking number">{selectedOrder.tracking_number || "NO CODE"}</Descriptions.Item>
              <Descriptions.Item label="Courier status">{formatCourierStatus(selectedOrder.courier_status)}</Descriptions.Item>
            </Descriptions>
            <Button icon={<EditOutlined />} onClick={() => { trackingForm.setFieldsValue(selectedOrder); setIsEditTrackingOpen(true); }}>
              Edit Tracking Info
            </Button>

            {/* COD Approval Section */}
            {selectedOrder.payment_status !== "paid" && (
              <>
                <Divider>COD Approval & Reconcile</Divider>
                <Alert
                  message="COD Amount Verification Needed"
                  description="Verify collected cash from the courier and approve to post ledger details."
                  type="warning"
                  showIcon
                  action={
                    <Button type="primary" icon={<DollarOutlined />} onClick={() => setIsCODModalOpen(true)}>
                      Reconcile Cash
                    </Button>
                  }
                />
              </>
            )}

            <Divider>Package Items list</Divider>
            <Table scroll={{ x: 'max-content' }}
              size="small"
              dataSource={selectedOrder.items}
              pagination={false}
              rowKey="id"
              columns={[
                { title: "SKU Code", dataIndex: "sku" },
                { title: "Ordered Qty", dataIndex: "quantity" },
                { title: "Line Price", dataIndex: "price", render: (p) => `৳${Math.round(p)}` }
              ]}
            />

            <Divider>Fulfillment status timeline logs</Divider>
            <Timeline>
              {selectedOrder.status_history?.map((h: any) => (
                <Timeline.Item key={h.id}>
                  <b>{h.status?.toUpperCase()}</b> - by <i>{h.admin_username || "system"}</i> <br />
                  <span>{h.notes}</span>
                </Timeline.Item>
              ))}
            </Timeline>

          </Space>
        )}
      </Drawer>

      {/* COD Reconcile Modal */}
      <Modal
        title="COD Reconcile Collected Cash"
        open={isCODModalOpen}
        onCancel={() => setIsCODModalOpen(false)}
        onOk={() => codForm.submit()}
      >
        <Form form={codForm} onFinish={handleCODReconcile} layout="vertical">
          <Form.Item name="amount_collected" label="Collected Cash Amount ($)" rules={[{ required: true }]} initialValue={selectedOrder?.total_amount}>
            <InputNumber style={{ width: "100%", borderRadius: 0 }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="notes" label="Reconciliation comments">
            <Input.TextArea rows={2} style={{ borderRadius: 0 }} placeholder="e.g. Collected via Steadfast invoice" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Decoupled Tracking Info */}
      <Modal
        title="Edit Decoupled Tracking coordinates"
        open={isEditTrackingOpen}
        onCancel={() => setIsEditTrackingOpen(false)}
        onOk={() => trackingForm.submit()}
      >
        <Form form={trackingForm} onFinish={handleUpdateTracking} layout="vertical">
          <Form.Item name="tracking_number" label="Tracking Code / Consignment ID" rules={[{ required: true }]}>
            <Input style={{ borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="courier_status" label="Courier status tracking text">
            <Input style={{ borderRadius: 0 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Hidden layout for Printable PDF Invoice checklist */}
      <div style={{ display: "none" }}>
        <div id="bulk-packing-invoice-slip">
          {selectedOrder && (
            <div style={{ padding: 40, fontFamily: "sans-serif", color: "#000" }}>
              <h2>POSHPLEX DISPATCH PACK LIST</h2>
              <hr />
              <p><b>Invoice No:</b> {selectedOrder.order_number || selectedOrder.id}</p>
              <p><b>Recipient Name:</b> {selectedOrder.shipping_name}</p>
              <p><b>Shipping Address:</b> {selectedOrder.shipping_address}</p>
              <p><b>District / Thana:</b> {selectedOrder.shipping_district} / {selectedOrder.shipping_thana}</p>
              <hr />
              <h3>Items Checklist</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #000" }}>
                    <th style={{ textAlign: "left" }}>SKU</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item: any) => (
                    <tr key={item.sku} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: "8px 0" }}><b>{item.sku}</b></td>
                      <td style={{ padding: "8px 0", textAlign: "center" }}>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Space>
  );
};

const triggerPrintWindow = (order: any) => {
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head><title>Print Pack List - ${order.order_number || order.id}</title></head>
        <body>
          <div style="padding: 40px; font-family: sans-serif;">
            <h2>POSHPLEX DISPATCH PACK LIST</h2>
            <hr />
            <p><b>Invoice No:</b> ${order.order_number || order.id}</p>
            <p><b>Recipient Name:</b> ${order.shipping_name}</p>
            <p><b>Phone:</b> ${order.shipping_phone}</p>
            <p><b>Shipping Address:</b> ${order.shipping_address}</p>
            <p><b>District / Thana:</b> ${order.shipping_district} / ${order.shipping_thana}</p>
            <hr />
            <h3>Items Checklist</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #000; text-align: left;">
                  <th style="padding: 8px 0;">SKU</th>
                  <th style="padding: 8px 0; text-align: center;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${order.items?.map((item: any) => `
                  <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 0;"><b>${item.sku}</b></td>
                    <td style="padding: 8px 0; text-align: center;">${item.quantity}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
};

export default Fulfillment;




