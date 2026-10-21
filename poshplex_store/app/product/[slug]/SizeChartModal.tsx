"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Ruler } from "lucide-react";

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
}

interface NormalizedTable {
  name: string;
  headers: string[];
  rows: string[][];
}

// Convert inch measurements into cm, preserving ranges (e.g. 30-32 -> 76.2-81.3 cm)
function convertCellToCm(val: string): string {
  if (!val || typeof val !== "string") return val;
  const trimmed = val.trim();

  // Match ranges like "30-32", "30 - 32", "30-32\"", "30"-32""
  const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*[-–—/]\s*(\d+(?:\.\d+)?)\s*(?:\"|in|inch|inches)?$/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      const minCm = (min * 2.54).toFixed(1).replace(/\.0$/, "");
      const maxCm = (max * 2.54).toFixed(1).replace(/\.0$/, "");
      return `${minCm}-${maxCm} cm`;
    }
  }

  // Match single number like "44", "44\"", "28.5", "28.5 in"
  const singleMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:\"|in|inch|inches)?$/i);
  if (singleMatch) {
    const num = parseFloat(singleMatch[1]);
    if (!isNaN(num)) {
      const cm = (num * 2.54).toFixed(1).replace(/\.0$/, "");
      return `${cm} cm`;
    }
  }

  return val;
}

function formatHeader(header: string, currentUnit: "in" | "cm"): string {
  if (!header || typeof header !== "string") return "";
  if (currentUnit === "cm") {
    if (/\(in(?:ch(?:es)?)?\)/i.test(header)) {
      return header.replace(/\(in(?:ch(?:es)?)?\)/gi, "(cm)");
    }
    if (/in(?:ch(?:es)?)?/i.test(header) && !/cm/i.test(header)) {
      return header.replace(/in(?:ch(?:es)?)?/gi, "cm");
    }
  }
  return header;
}

export default function SizeChartModal({
  isOpen,
  onClose,
  product
}: SizeChartModalProps) {
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [fetchedGuide, setFetchedGuide] = useState<any | null>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    if (typeof document !== "undefined") {
      document.body.classList.add("size-chart-modal-open");
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (typeof document !== "undefined") {
        document.body.classList.remove("size-chart-modal-open");
      }
    };
  }, [isOpen, onClose]);

  // Extract raw guide if provided on product
  const rawGuide = useMemo(() => {
    let guide = product?.size_guide;
    if (typeof guide === "string") {
      try {
        guide = JSON.parse(guide);
      } catch {
        guide = null;
      }
    }
    if (!guide && product?.size_guide_template) {
      guide = product.size_guide_template;
      if (typeof guide === "string") {
        try {
          guide = JSON.parse(guide);
        } catch {
          guide = null;
        }
      }
    }
    return guide;
  }, [product]);

  // Client-side fallback fetch if size_guide was not populated but template ID exists
  useEffect(() => {
    if (!isOpen) return;
    if (rawGuide && (rawGuide.tables?.length || rawGuide.headers?.length)) return;
    const tplId = product?.size_guide_template_id;
    if (!tplId) return;

    let isMounted = true;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API_URL}/api/v1/catalog/templates/size`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !Array.isArray(data)) return;
        const matched = data.find((t: any) => t.id === tplId);
        if (matched) {
          setFetchedGuide(matched);
        }
      })
      .catch((err) => console.error("Error fetching size guide template fallback:", err));

    return () => {
      isMounted = false;
    };
  }, [isOpen, product, rawGuide]);

  // Reset active tab to 'all' whenever modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab("all");
    }
  }, [isOpen, product?.id]);

  const activeGuide = rawGuide || fetchedGuide;

  // Normalized tables array
  const normalizedTables: NormalizedTable[] = useMemo(() => {
    if (activeGuide) {
      let candidateTables = activeGuide.tables;
      if (typeof candidateTables === "string") {
        try {
          candidateTables = JSON.parse(candidateTables);
        } catch {
          candidateTables = [];
        }
      }

      if (Array.isArray(candidateTables) && candidateTables.length > 0) {
        return candidateTables.map((t: any, idx: number) => {
          let headers: string[] = [];
          if (Array.isArray(t.headers)) {
            headers = t.headers;
          } else if (typeof t.headers === "string") {
            headers = t.headers.split(",").map((s: string) => s.trim());
          }

          let rows: string[][] = [];
          if (Array.isArray(t.rows)) {
            rows = t.rows.map((r: any) =>
              Array.isArray(r) ? r : typeof r === "string" ? r.split(",").map((s: string) => s.trim()) : []
            );
          } else if (typeof t.rows === "string") {
            rows = t.rows
              .split("\n")
              .filter((line: string) => line.trim() !== "")
              .map((line: string) => line.split(",").map((s: string) => s.trim()));
          }

          return {
            name: t.name || (candidateTables.length > 1 ? `Size Chart ${idx + 1}` : "Size Guide"),
            headers: headers.length > 0 ? headers : ["Size"],
            rows
          };
        });
      }

      if (activeGuide.headers && Array.isArray(activeGuide.headers) && activeGuide.headers.length > 0) {
        return [{
          name: activeGuide.name || "Size Guide",
          headers: activeGuide.headers,
          rows: Array.isArray(activeGuide.rows) ? activeGuide.rows : []
        }];
      }
    }

    // Default fallback if no size guide attached
    return [{
      name: "Standard Streetwear Measurements",
      headers: ["Size", "Chest (Round)", "Length", "Sleeve"],
      rows: [
        ["M", "40\"", "28\"", "8.5\""],
        ["L", "42\"", "29\"", "9\""],
        ["XL", "44\"", "30\"", "9.5\""],
        ["XXL", "46\"", "31\"", "10\""]
      ]
    }];
  }, [activeGuide]);

  if (!isOpen || typeof document === "undefined") return null;

  const displayedTables = activeTab === "all"
    ? normalizedTables
    : [normalizedTables[parseInt(activeTab, 10)] || normalizedTables[0]];

  const guideSubtitle = activeGuide?.name
    ? activeGuide.name
    : product?.name
    ? `${product.name} • Measurements`
    : "Standard Streetwear Measurements";

  return createPortal(
    <div
      className="scm-backdrop"
      onClick={(e) => {
        // Close modal if user clicks/taps outside the popup card
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="scm-dialog" role="dialog" aria-modal="true" aria-labelledby="scm-title">
        {/* --- MODAL HEADER --- */}
        <div className="scm-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="scm-icon-wrap">
              <Ruler size={18} color="#111111" strokeWidth={2.4} />
            </div>
            <div>
              <h3 id="scm-title" className="scm-title">
                Size Chart & Fit Guide
              </h3>
              <p className="scm-subtitle">
                {guideSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="scm-close-btn"
            aria-label="Close size chart modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* --- MODAL SCROLLABLE BODY --- */}
        <div className="scm-body">
          {/* Controls Bar: Multi-table Tabs & Unit Switcher */}
          <div className="scm-top-controls">
            {/* Multi-table tab buttons (if product has 2+ charts, e.g. Tees + Baggy) */}
            {normalizedTables.length > 1 ? (
              <div className="scm-table-tabs">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`scm-tab-pill ${activeTab === "all" ? "active" : ""}`}
                >
                  All ({normalizedTables.length})
                </button>
                {normalizedTables.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveTab(String(idx))}
                    className={`scm-tab-pill ${activeTab === String(idx) ? "active" : ""}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ) : <div />}

            {/* Unit Switcher */}
            <div className="scm-unit-bar">
              <span className="scm-unit-label">Unit:</span>
              <div className="scm-toggle-group">
                <button
                  type="button"
                  onClick={() => setUnit("in")}
                  className={`scm-toggle-btn ${unit === "in" ? "active" : ""}`}
                >
                  Inches
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("cm")}
                  className={`scm-toggle-btn ${unit === "cm" ? "active" : ""}`}
                >
                  CM
                </button>
              </div>
            </div>
          </div>

          {/* Tables Rendering */}
          <div className="scm-tables-stack">
            {displayedTables.map((table, tIdx) => {
              const tableNum = activeTab === "all" ? tIdx + 1 : parseInt(activeTab, 10) + 1;
              return (
                <div key={tIdx} className="scm-table-card">
                  {normalizedTables.length > 1 && (
                    <div className="scm-table-card-header">
                      <div className="scm-table-card-badge">TABLE {tableNum}</div>
                      <h4 className="scm-table-card-title">{table.name}</h4>
                    </div>
                  )}

                  <div className="scm-table-container">
                    <table className="scm-table">
                      <thead>
                        <tr>
                          {table.headers.map((h: string, idx: number) => (
                            <th key={idx} className={idx === 0 ? "size-col" : ""}>
                              {formatHeader(h, unit)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.length > 0 ? (
                          table.rows.map((row: string[], rIdx: number) => (
                            <tr key={rIdx}>
                              {row.map((cell: string, cIdx: number) => (
                                <td key={cIdx} className={cIdx === 0 ? "size-cell" : ""}>
                                  {cIdx === 0 ? (
                                    <span className="scm-size-pill">{cell}</span>
                                  ) : unit === "cm" ? (
                                    convertCellToCm(cell)
                                  ) : (
                                    cell
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={table.headers.length || 1} style={{ textAlign: "center", color: "#888", padding: 16 }}>
                              No measurements entered for this table.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- MODAL FOOTER --- */}
        <div className="scm-footer">
          <button
            type="button"
            onClick={onClose}
            className="scm-confirm-btn"
          >
            Got It • Close
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .scm-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 99999999 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: scmFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        body.size-chart-modal-open .mobile-bottom-nav,
        body.size-chart-modal-open .music-toggle-btn {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -1 !important;
        }

        .scm-dialog {
          background-color: #ffffff;
          width: 100%;
          max-width: 580px;
          max-height: 88vh;
          border-radius: 12px;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          animation: scmPopUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(0, 0, 0, 0.08);
        }

        .scm-header {
          padding: 14px 18px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #ffffff;
          flex-shrink: 0;
        }

        .scm-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background-color: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(0, 0, 0, 0.06);
          flex-shrink: 0;
        }

        .scm-title {
          margin: 0;
          font-size: 13.5px;
          font-weight: 800;
          color: #111111;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .scm-subtitle {
          margin: 2px 0 0;
          font-size: 11.5px;
          color: #666666;
          font-weight: 600;
          line-height: 1.3;
        }

        .scm-close-btn {
          background: #f2f2f2;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333333;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .scm-close-btn:hover {
          background: #e5e5e5;
          color: #000000;
          transform: scale(1.05);
        }

        .scm-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
        }

        .scm-top-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .scm-table-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .scm-tab-pill {
          background-color: #f3f4f6;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          padding: 5px 11px;
          font-size: 11px;
          font-weight: 700;
          color: #4b5563;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          transition: all 0.15s ease;
        }

        .scm-tab-pill:hover {
          background-color: #e5e7eb;
          color: #111827;
        }

        .scm-tab-pill.active {
          background-color: #111111;
          border-color: #111111;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }

        .scm-unit-bar {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }

        .scm-unit-label {
          font-size: 11px;
          font-weight: 700;
          color: #555555;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .scm-toggle-group {
          display: inline-flex;
          background-color: #f0f0f0;
          border-radius: 6px;
          padding: 2px;
        }

        .scm-toggle-btn {
          border: none;
          background: transparent;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #666666;
          cursor: pointer;
          transition: all 0.15s ease;
          text-transform: uppercase;
        }

        .scm-toggle-btn.active {
          background-color: #111111;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }

        .scm-tables-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .scm-table-card {
          display: flex;
          flex-direction: column;
        }

        .scm-table-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
        }

        .scm-table-card-badge {
          font-size: 9.5px;
          font-weight: 800;
          background-color: #111111;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 3px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .scm-table-card-title {
          margin: 0;
          font-size: 12.5px;
          font-weight: 800;
          color: #111111;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .scm-table-container {
          width: 100%;
          overflow-x: auto;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          background-color: #ffffff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
        }

        .scm-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: left;
        }

        .scm-table th {
          background-color: #f7f7f8;
          color: #111111;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 10.5px;
          letter-spacing: 0.6px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          white-space: nowrap;
        }

        .scm-table th.size-col {
          width: 22%;
        }

        .scm-table td {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          color: #374151;
          font-weight: 500;
          font-size: 12px;
          white-space: nowrap;
        }

        .scm-table tr:last-child td {
          border-bottom: none;
        }

        .scm-table tr:hover td {
          background-color: #f9fafb;
        }

        .scm-size-pill {
          display: inline-block;
          font-weight: 800;
          color: #111111;
          background-color: #f3f4f6;
          padding: 3px 9px;
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          min-width: 32px;
          text-align: center;
        }

        .scm-footer {
          padding: 12px 18px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          background-color: #ffffff;
          flex-shrink: 0;
        }

        .scm-confirm-btn {
          width: 100%;
          padding: 12px;
          background-color: #111111;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .scm-confirm-btn:hover {
          background-color: #333333;
        }

        @keyframes scmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scmPopUp {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @media (max-width: 640px) {
          .scm-backdrop {
            padding: 16px;
            align-items: center !important;
            justify-content: center !important;
          }
          .scm-dialog {
            width: calc(100% - 20px) !important;
            max-width: 460px !important;
            border-radius: 12px !important;
            margin: auto !important;
          }
          .scm-top-controls {
            flex-direction: column;
            align-items: flex-start;
          }
          .scm-unit-bar {
            margin-left: 0;
            width: 100%;
            justify-content: space-between;
          }
        }
      `}} />
    </div>,
    document.body
  );
}
