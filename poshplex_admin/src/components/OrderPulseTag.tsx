import React, { useState } from "react";
import { Tag, Dropdown, message, Tooltip, Button } from "antd";
import { 
  ClockCircleOutlined, 
  WarningOutlined, 
  CloseCircleOutlined, 
  SplitCellsOutlined,
  CheckCircleOutlined 
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import axios from "axios";

export const DELAY_BLOCKER_MAP: Record<string, { label: string; color: string }> = {
  stockout_product: { label: "Product Stockout", color: "#f87171" },
  raw_material: { label: "Raw Material Shortage", color: "#fb923c" },
  packaging_stockout: { label: "Packaging Shortage", color: "#fbbf24" },
  printer_sticker_issue: { label: "Printer/Sticker Issue", color: "#a78bfa" },
  packer_shortage: { label: "Staff Shortage/Absent", color: "#38bdf8" },
  qc_defect: { label: "Pre-Pack QC Defect", color: "#f43f5e" },
  verification_hold: { label: "Verification Hold", color: "#c084fc" },
};

export const CANCELLATION_REASON_MAP: Record<string, { label: string; color: string }> = {
  call_dhore_na: { label: "Call Dhore Na / Unreachable", color: "#f43f5e" },
  customer_mind_change: { label: "Customer Changed Mind", color: "#fb923c" },
  fake_or_duplicate: { label: "Fake / Duplicate Order", color: "#ef4444" },
  refused_advance: { label: "Refused Advance Payment", color: "#eab308" },
  address_unserviceable: { label: "Unserviceable Address", color: "#94a3b8" },
  customer_refused_door: { label: "Refused COD at Door", color: "#dc2626" },
  courier_delayed: { label: "Courier Delivery Delayed", color: "#f97316" },
  customer_out_of_reach: { label: "Customer Out of Station", color: "#64748b" },
  disliked_on_delivery: { label: "Disliked on Delivery", color: "#b91c1c" },
};

export const SKU_RETURN_REASON_MAP: Record<string, { label: string; color: string }> = {
  size_fit: { label: "Size / Fit Issue", color: "#38bdf8" },
  fabric_quality: { label: "Fabric / Quality Dislike", color: "#f87171" },
  color_look: { label: "Color / Look Mismatch", color: "#a855f7" },
  stitching_defect: { label: "Stitching / Finish Defect", color: "#ef4444" },
  unwanted_item: { label: "Refused Extra Item", color: "#f59e0b" },
};

interface OrderPulseTagProps {
  order: any;
  apiUrl: string;
  onRefresh?: () => void;
  onOpenSplitModal?: (order: any) => void;
}

export const OrderPulseTag: React.FC<OrderPulseTagProps> = ({
  order,
  apiUrl,
  onRefresh,
  onOpenSplitModal,
}) => {
  const [updating, setUpdating] = useState(false);

  const handleUpdateBlocker = async (blockerKey: string) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      await axios.patch(
        `${apiUrl}/${order.id}/pulse`,
        { delay_reason: blockerKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success("Operational blocker updated");
      if (onRefresh) onRefresh();
    } catch {
      message.error("Failed to update blocker");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateCancellation = async (reasonKey: string) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem("poshplex_access_token");
      const cType = order.status === "manually_cancelled" ? "pre_dispatch" : "post_dispatch";
      await axios.patch(
        `${apiUrl}/${order.id}/pulse`,
        { cancellation_reason: reasonKey, cancellation_type: cType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success("Cancellation reason updated");
      if (onRefresh) onRefresh();
    } catch {
      message.error("Failed to update cancellation reason");
    } finally {
      setUpdating(false);
    }
  };

  const isUnshipped = ["placed", "review", "pending", "hold", "approval_pending"].includes(order.status);
  const isCancelled = ["cancelled", "manually_cancelled"].includes(order.status);
  const isPartial = order.status === "partially_delivered";

  // Menu items for operational delay blockers
  const delayMenuItems: MenuProps["items"] = Object.entries(DELAY_BLOCKER_MAP).map(([key, val]) => ({
    key,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: val.color }} />
        {val.label}
      </span>
    ),
    onClick: () => handleUpdateBlocker(key),
  }));

  // Menu items for cancellation reasons
  const cancellationMenuItems: MenuProps["items"] = Object.entries(CANCELLATION_REASON_MAP).map(([key, val]) => ({
    key,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: val.color }} />
        {val.label}
      </span>
    ),
    onClick: () => handleUpdateCancellation(key),
  }));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, margin: "4px 0" }}>
      {/* Delayed Hour Timer for Unshipped Orders */}
      {isUnshipped && order.is_delayed && (
        <Tooltip title={`Unshipped for ${order.delay_hours || 24} hours in warehouse`}>
          <Tag
            color="error"
            icon={<ClockCircleOutlined />}
            style={{
              fontWeight: 600,
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 4,
              animation: order.delay_hours >= 48 ? "pulse 2s infinite" : undefined,
            }}
          >
            ⏱ {order.delay_hours}h in Hub
          </Tag>
        </Tooltip>
      )}

      {/* Unshipped Delay Blocker Tag / 1-Click Dropdown */}
      {isUnshipped && (
        <Dropdown menu={{ items: delayMenuItems }} trigger={["click"]} disabled={updating}>
          {order.delay_reason && DELAY_BLOCKER_MAP[order.delay_reason] ? (
            <Tag
              color="volcano"
              icon={<WarningOutlined />}
              style={{ cursor: "pointer", fontSize: 10, padding: "1px 6px", borderRadius: 4 }}
            >
              ⚠️ {DELAY_BLOCKER_MAP[order.delay_reason].label}
            </Tag>
          ) : (
            <Tag
              style={{
                cursor: "pointer",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                borderStyle: "dashed",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: "#94a3b8",
              }}
            >
              + Tag Blocker
            </Tag>
          )}
        </Dropdown>
      )}

      {/* Cancelled Orders Root Cause Tag / 1-Click Dropdown */}
      {isCancelled && (
        <Dropdown menu={{ items: cancellationMenuItems }} trigger={["click"]} disabled={updating}>
          {order.cancellation_reason && CANCELLATION_REASON_MAP[order.cancellation_reason] ? (
            <Tag
              color="magenta"
              icon={<CloseCircleOutlined />}
              style={{ cursor: "pointer", fontSize: 10, padding: "1px 6px", borderRadius: 4 }}
            >
              ❌ {CANCELLATION_REASON_MAP[order.cancellation_reason].label}
            </Tag>
          ) : (
            <Tag
              style={{
                cursor: "pointer",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                borderStyle: "dashed",
                backgroundColor: "rgba(239,68,68,0.1)",
                color: "#f87171",
              }}
            >
              + Tag Reason
            </Tag>
          )}
        </Dropdown>
      )}

      {/* Partially Delivered Orders Split Button */}
      {isPartial && (
        <Button
          size="small"
          type="primary"
          icon={<SplitCellsOutlined />}
          style={{
            height: 22,
            fontSize: 10,
            padding: "0 8px",
            borderRadius: 4,
            backgroundColor: "#ea580c",
            borderColor: "#f97316",
          }}
          onClick={() => onOpenSplitModal && onOpenSplitModal(order)}
        >
          ⚡ Resolve Split
        </Button>
      )}
    </div>
  );
};
