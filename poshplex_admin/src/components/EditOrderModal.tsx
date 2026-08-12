import React, { useState, useEffect } from "react";
import { Modal, Form, Input, InputNumber, Select, Divider, Button, Row, Col, Tabs, Timeline, Tag, message, Popconfirm } from "antd";
import { PlusOutlined, DeleteOutlined, SyncOutlined, DollarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const API_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:8000') + "/api/v1/orders";

interface EditOrderModalProps {
  visible: boolean;
  order: any;
  onClose: () => void;
  onRefresh: () => void;
  productsList: any[];
  paymentMethods: any[];
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ visible, order, onClose, onRefresh, productsList, paymentMethods }) => {
  const [activeTab, setActiveTab] = useState("items");
  const [loading, setLoading] = useState(false);

  const [itemsForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [statusForm] = Form.useForm();

  const STATUS_CHOICES = [
    { value: "placed", label: "Order Placed" },
    { value: "review", label: "In Review" },
    { value: "pending", label: "Pending Payment" },
    { value: "approval_pending", label: "Approval Pending" },
    { value: "delivered", label: "Delivered" },
    { value: "partially_delivered", label: "Partially Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "returned", label: "Returned" },
    { value: "rto", label: "RTO" },
  ];

  useEffect(() => {
    if (visible && order) {
      itemsForm.setFieldsValue({
        items: order.items.map((i: any) => ({ sku: i.sku, quantity: i.quantity, price: i.price }))
      });
      statusForm.setFieldsValue({ status: order.status, notes: "" });
      paymentForm.resetFields();
    }
  }, [visible, order, itemsForm, statusForm, paymentForm]);

  const handleUpdateItems = async () => {
    try {
      const values = await itemsForm.validateFields();
      setLoading(true);
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      // To update items, we need to send the full order update schema
      const payload = {
        user_id: order.user_id,
        items: values.items,
        shipping_address: order.shipping_address,
        shipping_name: order.shipping_name,
        shipping_phone: order.shipping_phone,
        shipping_district: order.shipping_district,
        shipping_thana: order.shipping_thana,
        shipping_postal_code: order.shipping_postal_code,
        discount_amount: order.discount_amount,
        shipping_cost: order.shipping_cost,
        customer_notes: order.customer_notes,
        internal_notes: order.internal_notes,
        payment_status: order.payment_status,
      };
      await axios.put(`${API_URL}/${order.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Order items updated successfully.");
      onRefresh();
    } catch (e: any) {
      if (e.response?.data?.detail) {
        message.error(e.response.data.detail);
      } else {
        message.error("Validation failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReceivePayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      setLoading(true);
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.post(`${API_URL}/${order.id}/payments`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Payment recorded successfully.");
      paymentForm.resetFields();
      onRefresh();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "Failed to record payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      const values = await statusForm.validateFields();
      setLoading(true);
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.put(`${API_URL}/${order.id}/status`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Order status updated.");
      onRefresh();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Modal
      title={<span>Edit Order: <span style={{ color: "var(--primary-color)" }}>{order.order_number || order.id}</span></span>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      bodyStyle={{ maxHeight: "70vh", overflowY: "auto" }}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab={<span><SyncOutlined /> Edit Products</span>} key="items">
          <Form form={itemsForm} layout="vertical">
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row gutter={16} key={key} align="bottom" style={{ marginBottom: 12 }}>
                      <Col span={12}>
                        <Form.Item {...restField} name={[name, "sku"]} label="Product Variant SKU" rules={[{ required: true }]}>
                          <Select placeholder="Choose Drop SKU" showSearch>
                            {productsList.map((p: any) => (
                              <Select.OptGroup key={p.id} label={p.name}>
                                {p.variants?.map((v: any) => (
                                  <Select.Option key={v.sku} value={v.sku}>
                                    {v.sku} - ৳{Math.round(v.selling_price)}
                                  </Select.Option>
                                ))}
                              </Select.OptGroup>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...restField} name={[name, "quantity"]} label="Qty" initialValue={1} rules={[{ required: true }]}>
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, "price"]} label="Override Price">
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Popconfirm title="Remove this line item?" onConfirm={() => remove(name)}>
                          <Button danger style={{ marginBottom: 24 }} icon={<DeleteOutlined />} block />
                        </Popconfirm>
                      </Col>
                    </Row>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Product
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
            <Button type="primary" onClick={handleUpdateItems} loading={loading} block>Save Product Changes</Button>
          </Form>
        </Tabs.TabPane>
        
        <Tabs.TabPane tab={<span><DollarOutlined /> Receive Payment</span>} key="payment">
          <Form form={paymentForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="amount" label="Amount (৳)" rules={[{ required: true }]}>
                  <InputNumber style={{ width: "100%" }} min={0.01} precision={2} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="method" label="Payment Method" rules={[{ required: true }]}>
                  <Select>
                    {paymentMethods.map(pm => (
                      <Select.Option key={pm.name} value={pm.name}>{pm.name}</Select.Option>
                    ))}
                    <Select.Option value="Cash">Cash (Manual)</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="reference_number" label="Reference / TrxID">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="sender_number" label="Sender Number">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" onClick={handleReceivePayment} loading={loading} block>Record Payment</Button>
          </Form>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<span><ClockCircleOutlined /> Update Status</span>} key="status">
          <Form form={statusForm} layout="vertical">
            <Form.Item name="status" label="New Order Status" rules={[{ required: true }]}>
              <Select options={STATUS_CHOICES} />
            </Form.Item>
            <Form.Item name="notes" label="Admin Note (Optional)">
              <Input.TextArea rows={3} placeholder="Reason for manual status change..." />
            </Form.Item>
            <Button type="primary" onClick={handleUpdateStatus} loading={loading} block>Update Status</Button>
          </Form>
        </Tabs.TabPane>
      </Tabs>

      <Divider style={{ margin: "32px 0 16px 0" }} />
      <h3>Order Timeline</h3>
      <Timeline mode="left" style={{ marginTop: 24 }}>
        {order.status_history?.map((h: any) => (
          <Timeline.Item key={h.id} color={h.status === "cancelled" ? "red" : h.status === "delivered" ? "green" : "blue"}>
            <div style={{ marginBottom: 4 }}>
              <Tag color="cyan">{h.status.toUpperCase()}</Tag>
              <span style={{ color: "#888", fontSize: 12 }}>
                {dayjs(h.timestamp).format("MMM D, YYYY h:mm A")} {h.admin_username ? `(by ${h.admin_username})` : ""}
              </span>
            </div>
            {h.notes && <p style={{ margin: 0, fontSize: 13, color: "#555" }}>{h.notes}</p>}
          </Timeline.Item>
        ))}
      </Timeline>
    </Modal>
  );
};
