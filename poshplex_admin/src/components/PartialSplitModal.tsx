import React, { useState, useEffect } from "react";
import { Modal, Table, Select, Input, InputNumber, Button, message, Space, Tag, Typography } from "antd";
import { CheckCircleOutlined, RollbackOutlined, SaveOutlined } from "@ant-design/icons";
import axios from "axios";
import { SKU_RETURN_REASON_MAP } from "./OrderPulseTag";

const { Text } = Typography;

interface PartialSplitModalProps {
  visible: boolean;
  order: any;
  apiUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PartialSplitModal: React.FC<PartialSplitModalProps> = ({
  visible,
  order,
  apiUrl,
  onClose,
  onSuccess,
}) => {
  const [splitItems, setSplitItems] = useState<any[]>([]);
  const [splitNotes, setSplitNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (order && order.items) {
      setSplitItems(
        order.items.map((item: any) => ({
          item_id: item.id,
          sku: item.sku,
          product_name: item.product_name || item.sku,
          image: item.image,
          price: item.price,
          original_qty: item.quantity,
          fulfilled_quantity: item.fulfilled_quantity || 0,
          returned_quantity: item.returned_quantity || (item.quantity - (item.fulfilled_quantity || 0)),
          return_reason: item.return_reason || "size_fit",
          rejection_notes: item.rejection_notes || "",
        }))
      );
      setSplitNotes("");
    }
  }, [order]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setSplitItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      
      // Auto-balance quantities if quantity adjusted
      if (field === "fulfilled_quantity") {
        const kept = Math.min(copy[index].original_qty, Math.max(0, Number(value) || 0));
        copy[index].fulfilled_quantity = kept;
        copy[index].returned_quantity = copy[index].original_qty - kept;
      } else if (field === "returned_quantity") {
        const ret = Math.min(copy[index].original_qty, Math.max(0, Number(value) || 0));
        copy[index].returned_quantity = ret;
        copy[index].fulfilled_quantity = copy[index].original_qty - ret;
      }
      return copy;
    });
  };

  const handleSaveSplit = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.post(
        `${apiUrl}/${order.id}/partial-split`,
        {
          items: splitItems.map(item => ({
            item_id: item.item_id,
            fulfilled_quantity: item.fulfilled_quantity,
            returned_quantity: item.returned_quantity,
            return_reason: item.returned_quantity > 0 ? item.return_reason : null,
            rejection_notes: item.returned_quantity > 0 ? item.rejection_notes : null,
          })),
          notes: splitNotes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success("Partial delivery resolution saved successfully");
      onSuccess();
      onClose();
    } catch {
      message.error("Failed to save partial split resolution");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "Product & SKU",
      dataIndex: "product_name",
      key: "product_name",
      render: (_: any, record: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {record.image && (
            <img
              src={record.image.startsWith("http") ? record.image : `${window.location.origin}${record.image}`}
              alt="sku"
              style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 4 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{record.product_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>SKU: {record.sku} (Total: {record.original_qty}x)</div>
          </div>
        </div>
      ),
    },
    {
      title: "Kept / Delivered",
      dataIndex: "fulfilled_quantity",
      key: "fulfilled_quantity",
      width: 140,
      render: (val: number, record: any, index: number) => (
        <Space orientation="horizontal" size="small">
          <InputNumber
            min={0}
            max={record.original_qty}
            value={val}
            onChange={(newVal) => handleUpdateItem(index, "fulfilled_quantity", newVal)}
            style={{ width: 60 }}
          />
          {val > 0 && <Tag color="green" icon={<CheckCircleOutlined />}>Kept</Tag>}
        </Space>
      ),
    },
    {
      title: "Returned / Rejected",
      dataIndex: "returned_quantity",
      key: "returned_quantity",
      width: 150,
      render: (val: number, record: any, index: number) => (
        <Space orientation="horizontal" size="small">
          <InputNumber
            min={0}
            max={record.original_qty}
            value={val}
            onChange={(newVal) => handleUpdateItem(index, "returned_quantity", newVal)}
            style={{ width: 60 }}
          />
          {val > 0 && <Tag color="error" icon={<RollbackOutlined />}>Returned</Tag>}
        </Space>
      ),
    },
    {
      title: "Return Root Cause",
      key: "return_reason",
      width: 220,
      render: (_: any, record: any, index: number) => {
        if (record.returned_quantity === 0) {
          return <Text type="secondary" style={{ fontSize: 12 }}>N/A (Accepted)</Text>;
        }
        return (
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Select
              value={record.return_reason}
              onChange={(newVal) => handleUpdateItem(index, "return_reason", newVal)}
              style={{ width: "100%" }}
            >
              {Object.entries(SKU_RETURN_REASON_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {v.label}
                </Select.Option>
              ))}
            </Select>
            <Input
              placeholder="Specific flaw or fit feedback..."
              value={record.rejection_notes}
              onChange={(e) => handleUpdateItem(index, "rejection_notes", e.target.value)}
              style={{ fontSize: 11 }}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚡ Partial Delivery SKU Split Resolver</span>
          {order && <Tag color="orange">{order.order_number || `Order #${order.id}`}</Tag>}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={780}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          onClick={handleSaveSplit}
          style={{ backgroundColor: "#ea580c", borderColor: "#f97316" }}
        >
          Save Partial Resolution
        </Button>,
      ]}
    >
      <div style={{ margin: "12px 0" }}>
        <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 12 }}>
          Split the items the customer accepted from the items returned back to your hub. Tag the return reason so it feeds into your product catalog R&D analytics.
        </p>

        <Table
          dataSource={splitItems}
          columns={columns}
          rowKey="item_id"
          pagination={false}
          size="middle"
        />

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
            Fulfillment Notes / Customer Incident Details
          </label>
          <Input.TextArea
            rows={2}
            placeholder="e.g., Customer kept the Black M t-shirt, but returned the cargo pants due to waist being 1 inch smaller than chart."
            value={splitNotes}
            onChange={(e) => setSplitNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

