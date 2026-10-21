"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Ruler } from "lucide-react";

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
}

export default function SizeChartModal({
  isOpen,
  onClose,
  product
}: SizeChartModalProps) {
  const [unit, setUnit] = useState<"in" | "cm">("in");

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

  if (!isOpen || typeof document === "undefined") return null;

  // Measurement data: support database size_guide or standard Poshplex streetwear measurements
  const defaultInchesRows = [
    ["M", "40\"", "28\"", "8.5\""],
    ["L", "42\"", "29\"", "9\""],
    ["XL", "44\"", "30\"", "9.5\""],
    ["XXL", "46\"", "31\"", "10\""]
  ];

  const defaultCmRows = [
    ["M", "101.6 cm", "71.1 cm", "21.6 cm"],
    ["L", "106.7 cm", "73.7 cm", "22.9 cm"],
    ["XL", "111.8 cm", "76.2 cm", "24.1 cm"],
    ["XXL", "116.8 cm", "78.7 cm", "25.4 cm"]
  ];

  const defaultHeaders = ["Size", "Chest (Round)", "Length", "Sleeve"];

  // Determine headers and rows
  let headers = defaultHeaders;
  let rows = unit === "in" ? defaultInchesRows : defaultCmRows;

  if (product?.size_guide) {
    if (product.size_guide.headers && product.size_guide.rows) {
      headers = product.size_guide.headers;
      // If user toggles cm and original data has inches, we can convert if numeric
      if (unit === "cm") {
        rows = product.size_guide.rows.map((r: string[]) =>
          r.map((val: string, idx: number) => {
            if (idx === 0) return val; // Size code like M, L
            const cleanNum = parseFloat(val.replace(/[^0-9.]/g, ""));
            if (!isNaN(cleanNum)) {
              return `${(cleanNum * 2.54).toFixed(1)} cm`;
            }
            return val;
          })
        );
      } else {
        rows = product.size_guide.rows;
      }
    }
  }

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
                {product?.name ? `${product.name} • Oversized Fit` : "Standard Streetwear Measurements"}
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
          {/* Unit Switcher */}
          <div className="scm-unit-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Unit:
              </span>
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

          {/* Measurement Table */}
          <div className="scm-table-container">
            <table className="scm-table">
              <thead>
                <tr>
                  {headers.map((h: string, idx: number) => (
                    <th key={idx} className={idx === 0 ? "size-col" : ""}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: string[], rIdx: number) => (
                  <tr key={rIdx}>
                    {row.map((cell: string, cIdx: number) => (
                      <td key={cIdx} className={cIdx === 0 ? "size-cell" : ""}>
                        {cIdx === 0 ? (
                          <span className="scm-size-pill">{cell}</span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
          max-width: 540px;
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
        }

        .scm-title {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
          color: #111111;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .scm-subtitle {
          margin: 2px 0 0;
          font-size: 11px;
          color: #777777;
          font-weight: 500;
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
        }

        .scm-close-btn:hover {
          background: #e5e5e5;
          color: #000000;
          transform: scale(1.05);
        }

        .scm-body {
          flex: 1;
          overflow-y: auto;
          padding: 18px;
        }

        .scm-unit-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 10px;
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
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }

        .scm-fit-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          borderRadius: 4px;
        }

        .scm-table-container {
          width: 100%;
          overflow-x: auto;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          background-color: #ffffff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
          margin-bottom: 0;
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
        }

        .scm-table th.size-col {
          width: 25%;
        }

        .scm-table td {
          padding: 11px 14px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          color: #444444;
          font-weight: 500;
          font-size: 12px;
        }

        .scm-table tr:last-child td {
          border-bottom: none;
        }

        .scm-table tr:hover td {
          background-color: #fcfcfc;
        }

        .scm-size-pill {
          display: inline-block;
          font-weight: 800;
          color: #111111;
          background-color: #f2f2f2;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.1);
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
            width: calc(100% - 24px) !important;
            max-width: 440px !important;
            border-radius: 12px !important;
            margin: auto !important;
          }
        }
      `}} />
    </div>,
    document.body
  );
}
