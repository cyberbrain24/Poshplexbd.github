"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { 
  Shirt, Plus, Check, Tag, Truck, RefreshCw, X, CheckCircle2 
} from "lucide-react";
import ChooseProductModal from "./ChooseProductModal";

interface BuyMoreAndSaveProps {
  currentProduct: any;
  currentVariant: any;
  selectedAttributes: Record<string, string>;
  onSelectAttribute: (key: string, val: string) => void;
  initialAttributes?: any[];
  onBundleChange: (bundleInfo: any) => void;
}

const DEFAULT_TIERS = [
  {
    id: 1,
    name: "Duo",
    slug: "duo",
    items_count: 2,
    discount_percentage: 5,
    free_delivery: false,
    badge: "Popular",
    subtitle: "Mix & Match Any 2 Products From Our Collection",
    perks: ["SAVE 5%", "Mix & Match Any 2 Products"],
    is_active: true,
    listing_order: 1
  },
  {
    id: 2,
    name: "Trio",
    slug: "trio",
    items_count: 3,
    discount_percentage: 10,
    free_delivery: true,
    badge: "MOST POPULAR",
    subtitle: "Mix & Match Any 3 Products From Our Collection",
    perks: ["SAVE 10%", "FREE DELIVERY ALL OVER BANGLADESH", "Fan Favorite Bundle"],
    is_active: true,
    listing_order: 2
  },
  {
    id: 3,
    name: "4 Pack",
    slug: "4-pack",
    items_count: 4,
    discount_percentage: 12,
    free_delivery: true,
    badge: "BEST VALUE",
    subtitle: "Mix & Match Any 4 Products From Our Collection",
    perks: ["SAVE 12%", "FREE DELIVERY ALL OVER BANGLADESH", "Best Balance of Value & Variety", "Perfect for Building Your Rotation"],
    is_active: true,
    listing_order: 3
  },
  {
    id: 4,
    name: "5 Pack",
    slug: "5-pack",
    items_count: 5,
    discount_percentage: 15,
    free_delivery: true,
    badge: "MAXIMUM VALUE",
    subtitle: "Mix & Match Any 5 Products From Our Collection",
    perks: ["SAVE 15%", "FREE DELIVERY ALL OVER BANGLADESH", "Lowest Price Per Piece", "Ultimate Stock-Up Bundle"],
    is_active: true,
    listing_order: 4
  }
];

export default function BuyMoreAndSave({
  currentProduct,
  currentVariant,
  selectedAttributes,
  onSelectAttribute,
  initialAttributes = [],
  onBundleChange
}: BuyMoreAndSaveProps) {
  const [tiers, setTiers] = useState<any[]>(DEFAULT_TIERS);
  const [selectedTierSlug, setSelectedTierSlug] = useState<string>("single");
  const [chosenSlots, setChosenSlots] = useState<Record<number, { product: any; variant: any }>>({});
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  // Fetch active combo tiers from backend
  useEffect(() => {
    let isCancelled = false;
    const fetchCombos = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_URL}/api/v1/marketing/combos`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data) && data.length > 0) {
            setTiers(data);
          }
        }
      } catch (err) {
        console.error("Failed to load combo tiers, using defaults", err);
      }
    };
    fetchCombos();
    return () => { isCancelled = true; };
  }, []);

  // Current active tier object
  const activeTier = useMemo(() => {
    if (selectedTierSlug === "single") return null;
    return tiers.find(t => t.slug === selectedTierSlug || t.name.toLowerCase() === selectedTierSlug.toLowerCase()) || null;
  }, [tiers, selectedTierSlug]);

  // Current product pricing
  const currentProductOrigPrice = useMemo(() => {
    if (currentVariant) {
      return parseFloat(currentVariant.selling_price || currentVariant.price || 0);
    }
    return parseFloat(currentProduct?.selling_price || currentProduct?.price || currentProduct?.base_price || 0);
  }, [currentProduct, currentVariant]);

  // Determine size attribute key dynamically
  const sizeAttributeKey = useMemo(() => {
    if (currentProduct?.variants) {
      for (const v of currentProduct.variants) {
        for (const k of Object.keys(v.attributes || {})) {
          if (k.toLowerCase().includes("size")) return k;
        }
      }
    }
    return "size";
  }, [currentProduct]);

  // Extract available sizes for the current product
  const currentProductSizes = useMemo(() => {
    const sizes = new Set<string>();
    (currentProduct?.variants || []).forEach((v: any) => {
      if (v.is_active !== false) {
        const s = v.attributes?.[sizeAttributeKey] || v.attributes?.size || v.attributes?.Size;
        if (s) sizes.add(s);
      }
    });
    if (sizes.size > 0) return Array.from(sizes);

    const sizeAttr = (currentProduct?.attributes || initialAttributes || []).find(
      (a: any) => a.code?.toLowerCase().includes("size") || a.name?.toLowerCase().includes("size")
    );
    if (sizeAttr && Array.isArray(sizeAttr.choices) && sizeAttr.choices.length > 0) {
      return sizeAttr.choices;
    }
    return [];
  }, [currentProduct, initialAttributes, sizeAttributeKey]);

  // Current selected size (null if not chosen by customer)
  const currentProductSelectedSize = selectedAttributes[sizeAttributeKey] || selectedAttributes.size || selectedAttributes.Size || null;

  // Helper to order attributes (Color/Drop Color first, then Size, then others)
  const getAttrWeight = (k: string) => {
    const attr = (initialAttributes || []).find(
      (a: any) => a.code === k || a.name?.toLowerCase() === k.toLowerCase()
    );
    if (attr && typeof attr.listing_order === "number") {
      return attr.listing_order;
    }
    const lower = k.toLowerCase();
    if (lower.includes("color") || lower.includes("colour")) return 990;
    if (lower.includes("size")) return 991;
    return 999;
  };

  // Extract all attribute variation groups for current product
  const currentProductAttributeGroups = useMemo(() => {
    const rawSets: Record<string, Set<string>> = {};

    (currentProduct?.variants || []).forEach((v: any) => {
      if (v.is_active !== false) {
        Object.entries(v.attributes || {}).forEach(([k, val]) => {
          if (val) {
            if (!rawSets[k]) rawSets[k] = new Set();
            rawSets[k].add(String(val));
          }
        });
      }
    });

    const groups: Record<string, string[]> = {};
    Object.entries(rawSets).forEach(([key, set]) => {
      const attrDef = (initialAttributes || []).find(
        (a: any) => a.code === key || a.name?.toLowerCase() === key.toLowerCase()
      );
      const arr = Array.from(set);
      if (attrDef?.choices && Array.isArray(attrDef.choices)) {
        arr.sort((a, b) => {
          const idxA = attrDef.choices.indexOf(a);
          const idxB = attrDef.choices.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });
      }
      groups[key] = arr;
    });

    if (Object.keys(groups).length === 0 && Array.isArray(currentProduct?.attributes)) {
      currentProduct.attributes.forEach((attr: any) => {
        if (Array.isArray(attr.choices) && attr.choices.length > 0) {
          groups[attr.code || attr.name] = attr.choices;
        }
      });
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const wA = getAttrWeight(a);
      const wB = getAttrWeight(b);
      if (wA !== wB) return wA - wB;
      return a.localeCompare(b);
    });

    return sortedKeys.map((key) => {
      const attrDef = (initialAttributes || []).find(
        (a: any) => a.code === key || a.name?.toLowerCase() === key.toLowerCase()
      );
      const label = attrDef ? attrDef.name : (key.charAt(0).toUpperCase() + key.slice(1));
      return {
        key,
        label,
        values: groups[key],
        selectedValue: selectedAttributes[key] || null
      };
    });
  }, [currentProduct, initialAttributes, selectedAttributes]);

  const isAllCurrentAttributesSelected = useMemo(() => {
    if (currentProductAttributeGroups.length === 0) return true;
    return currentProductAttributeGroups.every(g => Boolean(g.selectedValue));
  }, [currentProductAttributeGroups]);

  const configuredLabels = useMemo(() => {
    return currentProductAttributeGroups
      .filter(g => g.selectedValue)
      .map(g => `${g.label}: ${g.selectedValue}`);
  }, [currentProductAttributeGroups]);

  const scrollToVariations = () => {
    if (typeof document === "undefined") return;
    const el = document.getElementById("product-variations-section") || document.querySelector(".product-selectors-container");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("variation-highlight-flash");
      setTimeout(() => el.classList.remove("variation-highlight-flash"), 1500);
    }
  };

  // Calculate items and pricing whenever slots or tier change
  useEffect(() => {
    if (!activeTier) {
      // Single product mode
      onBundleChange({
        isBundle: false,
        tier: null,
        items: [{
          product: currentProduct,
          variant: currentVariant,
          image: currentVariant?.image_id 
            ? (currentProduct.images?.find((i: any) => i.id === currentVariant.image_id)?.url || currentProduct.images?.[0]?.url)
            : currentProduct.images?.[0]?.url,
          discountedPrice: currentProductOrigPrice,
          originalPrice: currentProductOrigPrice
        }],
        isComplete: true,
        totalPrice: currentProductOrigPrice,
        originalTotal: currentProductOrigPrice,
        savings: 0,
        freeDelivery: false
      });
      return;
    }

    const discountPct = parseFloat(activeTier.discount_percentage || 0);
    const requiredCount = activeTier.items_count;

    // Slot 0: Current product
    const itemsList: any[] = [
      {
        product: currentProduct,
        variant: currentVariant,
        image: currentVariant?.image_id 
          ? (currentProduct.images?.find((i: any) => i.id === currentVariant.image_id)?.url || currentProduct.images?.[0]?.url)
          : currentProduct.images?.[0]?.url,
        originalPrice: currentProductOrigPrice,
        discountedPrice: Math.round(currentProductOrigPrice * (1 - discountPct / 100))
      }
    ];

    // Slots 1 to N-1
    for (let i = 1; i < requiredCount; i++) {
      const slotData = chosenSlots[i];
      if (slotData) {
        const pOrig = parseFloat(slotData.variant?.selling_price || slotData.variant?.price || slotData.product.selling_price || slotData.product.price || slotData.product.base_price || 0);
        itemsList.push({
          product: slotData.product,
          variant: slotData.variant,
          image: slotData.product.images?.[0]?.url || "",
          originalPrice: pOrig,
          discountedPrice: Math.round(pOrig * (1 - discountPct / 100))
        });
      }
    }

    const originalTotal = itemsList.reduce((sum, item) => sum + item.originalPrice, 0);
    const totalPrice = itemsList.reduce((sum, item) => sum + item.discountedPrice, 0);

    // Slot 0 is complete if all multiple-choice attributes have been selected
    const isSlot0Configured = currentProductAttributeGroups.length === 0 ||
      currentProductAttributeGroups.every(g => g.values.length <= 1 || Boolean(g.selectedValue));
    const isComplete = isSlot0Configured && itemsList.length === requiredCount;

    onBundleChange({
      isBundle: true,
      tier: activeTier,
      items: itemsList,
      isComplete,
      isSlot0SizeMissing: !isSlot0Configured,
      totalPrice,
      originalTotal,
      savings: originalTotal - totalPrice,
      freeDelivery: activeTier.free_delivery
    });
  }, [activeTier, chosenSlots, currentProduct, currentVariant, currentProductOrigPrice, currentProductSizes, currentProductSelectedSize, currentProductAttributeGroups]);

  // Open modal for slot
  const handleOpenChooseModal = (slotIndex: number) => {
    setActiveSlotIndex(slotIndex);
    setIsModalOpen(true);
  };

  // When product is selected in modal
  const handleProductSelected = (product: any, variant: any) => {
    if (activeSlotIndex !== null) {
      setChosenSlots(prev => ({
        ...prev,
        [activeSlotIndex]: { product, variant }
      }));
    }
    setIsModalOpen(false);
    setActiveSlotIndex(null);
  };

  // Remove item from slot
  const handleRemoveSlot = (slotIndex: number) => {
    setChosenSlots(prev => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  };

  const currentProductImg = currentProduct?.images?.[0]?.url || "https://placehold.co/100x100?text=Product";

  return (
    <div className="bms-wrapper" style={{ marginTop: 18, marginBottom: 18 }}>
      {/* Title Header */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <h3 className="bms-main-title">
          Buy more &amp; save
        </h3>
        <p className="bms-main-sub">
          Choose a bundle below to unlock a discount
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* ============================================================ */}
        {/* OPTION 0: SINGLE (0% OFF) */}
        {/* ============================================================ */}
        <div
          onClick={() => {
            setSelectedTierSlug("single");
            if (currentProductAttributeGroups.length > 0 && !isAllCurrentAttributesSelected) {
              scrollToVariations();
            }
          }}
          className={`bms-card ${selectedTierSlug === "single" ? "bms-card-active" : "bms-card-inactive"}`}
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 38, height: 38, borderRadius: 6, overflow: "hidden", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", flexShrink: 0 }}>
                <Image unoptimized src={currentProductImg} alt={currentProduct?.name || "Single"} fill style={{ objectFit: "contain" }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="bms-card-name">Single</span>
                  <span className="bms-discount-tag" style={{ backgroundColor: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" }}>0% OFF</span>
                </div>
                <div className="bms-card-sub">Just One</div>
              </div>
            </div>

            <div className="bms-price-main">
              Tk {Math.round(currentProductOrigPrice)}
            </div>
          </div>

          {/* Clean Variation Note for Single Option (No duplicate buttons) */}
          {currentProductAttributeGroups.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              {isAllCurrentAttributesSelected ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToVariations();
                  }}
                  title="Click to change variation"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "3px 8px",
                    backgroundColor: "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#94a3b8";
                    e.currentTarget.style.backgroundColor = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                  }}
                >
                  <span style={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", fontSize: 9.5 }}>Variation:</span>
                  <span>{configuredLabels.join(" • ")}</span>
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToVariations();
                  }}
                  title="Click to select variation above"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#be123c",
                    border: "1px dashed #fda4af",
                    borderRadius: 4,
                    padding: "3px 8px",
                    backgroundColor: "#fff1f2",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.2px",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffe4e6";
                    e.currentTarget.style.borderColor = "#f43f5e";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#fff1f2";
                    e.currentTarget.style.borderColor = "#fda4af";
                  }}
                >
                  <span>Select Variation Options</span>
                  <span style={{ fontSize: 12, lineHeight: 1 }}>↑</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* DYNAMIC COMBO TIERS (DUO, TRIO, 4 PACK, 5 PACK) */}
        {/* ============================================================ */}
        {tiers.filter(t => t.is_active !== false).map((tier) => {
          const isSelected = selectedTierSlug === (tier.slug || tier.name.toLowerCase());
          const discountPct = parseFloat(tier.discount_percentage || 0);
          const discountedUnit = Math.round(currentProductOrigPrice * (1 - discountPct / 100));
          const totalEstimatedBundle = Math.round(currentProductOrigPrice * tier.items_count * (1 - discountPct / 100));
          const totalEstimatedOriginal = Math.round(currentProductOrigPrice * tier.items_count);
          const estimatedSavings = totalEstimatedOriginal - totalEstimatedBundle;

          // Check how many products are added to this tier
          const chosenCount = 1 + Object.keys(chosenSlots).filter(k => {
            const num = Number(k);
            return num >= 1 && num < tier.items_count && Boolean(chosenSlots[num]);
          }).length;
          const isAllRequiredAdded = chosenCount >= tier.items_count;
          const remainingCount = tier.items_count - chosenCount;

          // Compute exact pricing & savings when products are chosen
          const actualOriginalTotal = Math.round(
            currentProductOrigPrice + 
            Array.from({ length: tier.items_count - 1 }).reduce((sum: number, _, idx) => {
              const slot = chosenSlots[idx + 1];
              if (!slot) return sum;
              const p = parseFloat(slot.variant?.selling_price || slot.variant?.price || slot.product?.selling_price || slot.product?.price || slot.product?.base_price || 0);
              return sum + p;
            }, 0)
          );

          const actualBundleTotal = Math.round(
            Math.round(currentProductOrigPrice * (1 - discountPct / 100)) +
            Array.from({ length: tier.items_count - 1 }).reduce((sum: number, _, idx) => {
              const slot = chosenSlots[idx + 1];
              if (!slot) return sum;
              const p = parseFloat(slot.variant?.selling_price || slot.variant?.price || slot.product?.selling_price || slot.product?.price || slot.product?.base_price || 0);
              return sum + Math.round(p * (1 - discountPct / 100));
            }, 0)
          );

          const actualSavings = actualOriginalTotal - actualBundleTotal;

          return (
            <div
              key={tier.id || tier.name}
              onClick={() => setSelectedTierSlug(tier.slug || tier.name.toLowerCase())}
              className={`bms-card ${isSelected ? "bms-card-active" : "bms-card-inactive"}`}
            >
              {/* Badge on Top Right */}
              {tier.badge && (
                <div className="bms-top-badge">
                  {tier.badge}
                </div>
              )}

              {/* Header: Radio, Name, Discount Pill, Price */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ paddingTop: 2 }}>
                    <div className={`bms-radio-circle ${isSelected ? "bms-radio-active" : ""}`} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="bms-card-name">{tier.name}</span>
                      <span className="bms-discount-tag">
                        {discountPct}% OFF
                      </span>
                    </div>
                    {tier.subtitle && (
                      <div className="bms-card-sub">{tier.subtitle}</div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: 8 }}>
                  <div className="bms-price-main">
                    Tk {discountedUnit}
                  </div>
                  <div className="bms-price-strike">
                    Tk {Math.round(currentProductOrigPrice)}
                  </div>
                </div>
              </div>

              {/* Bullet perks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 5, paddingLeft: 25 }}>
                {estimatedSavings > 0 && (
                  <div className="bms-perk-row">
                    <Tag size={11} color="#64748b" />
                    <span>SAVE Tk {estimatedSavings}</span>
                  </div>
                )}
                {tier.free_delivery && (
                  <div className="bms-perk-row" style={{ color: "#16a34a", fontWeight: 600 }}>
                    <Truck size={12} />
                    <span>FREE DELIVERY ALL OVER BANGLADESH</span>
                  </div>
                )}
              </div>

              {/* ACTIVE COMBO CONTAINER: DOTTED SLOTS & SAVINGS NOTE */}
              {isSelected && (
                <>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bms-active-slots-box"
                  >
                  {/* Slot 0: CURRENT PRODUCT (Default) */}
                  <div
                    onClick={() => {
                      if (currentProductAttributeGroups.length > 0 && !isAllCurrentAttributesSelected) {
                        scrollToVariations();
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      cursor: currentProductAttributeGroups.length > 0 && !isAllCurrentAttributesSelected ? "pointer" : "default"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{ position: "relative", width: 38, height: 38, borderRadius: 5, overflow: "hidden", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", flexShrink: 0 }}>
                        <Image unoptimized src={currentProductImg} alt={currentProduct?.name || "Product"} fill style={{ objectFit: "contain" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#334155", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {currentProduct.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                          <span style={{ fontSize: 10, color: "#94a3b8", textDecoration: "line-through" }}>
                            Tk {Math.round(currentProductOrigPrice)}
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1e293b" }}>
                            Tk {discountedUnit}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {isAllCurrentAttributesSelected ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToVariations();
                          }}
                          title="Click to change variation"
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "2.5px 7px",
                            backgroundColor: "#f8fafc",
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#94a3b8";
                            e.currentTarget.style.backgroundColor = "#f1f5f9";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#cbd5e1";
                            e.currentTarget.style.backgroundColor = "#f8fafc";
                          }}
                        >
                          {configuredLabels.join(" • ")}
                        </span>
                      ) : currentProductAttributeGroups.length > 0 ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToVariations();
                          }}
                          title="Click to select variation above"
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            color: "#be123c",
                            border: "1px dashed #fda4af",
                            borderRadius: 4,
                            padding: "2.5px 7px",
                            backgroundColor: "#fff1f2",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffe4e6";
                            e.currentTarget.style.borderColor = "#f43f5e";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#fff1f2";
                            e.currentTarget.style.borderColor = "#fda4af";
                          }}
                        >
                          Select Options ↑
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Slots 1 to N-1 */}
                  {Array.from({ length: tier.items_count - 1 }).map((_, idx) => {
                    const slotIndex = idx + 1;
                    const chosen = chosenSlots[slotIndex];

                    return (
                      <React.Fragment key={slotIndex}>
                        {/* Dotted divider with + */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", height: 12 }}>
                          <div style={{ position: "absolute", left: 0, right: 0, borderTop: "1px dashed #e2e8f0" }} />
                          <span style={{ position: "relative", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10, fontWeight: 700 }}>
                            +
                          </span>
                        </div>

                        {/* Slot Content */}
                        {chosen ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <div style={{ position: "relative", width: 38, height: 38, borderRadius: 5, overflow: "hidden", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", flexShrink: 0 }}>
                                <Image
                                  unoptimized
                                  src={chosen.product.images?.[0]?.url || "https://placehold.co/100x100?text=Product"}
                                  alt={chosen.product.name}
                                  fill
                                  style={{ objectFit: "contain" }}
                                />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#334155", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {chosen.product.name}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                                  <span style={{ fontSize: 10, color: "#94a3b8", textDecoration: "line-through" }}>
                                    Tk {Math.round(parseFloat(chosen.variant?.selling_price || chosen.variant?.price || chosen.product.selling_price || chosen.product.price || chosen.product.base_price || 0))}
                                  </span>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1e293b" }}>
                                    Tk {Math.round(parseFloat(chosen.variant?.selling_price || chosen.variant?.price || chosen.product.selling_price || chosen.product.price || chosen.product.base_price || 0) * (1 - discountPct / 100))}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              {(() => {
                                const chosenSize = chosen.variant?.attributes?.size || chosen.variant?.attributes?.Size;
                                const chosenColor = chosen.variant?.attributes?.color || chosen.variant?.attributes?.Color;
                                const chosenLabel = [chosenSize ? `Size: ${chosenSize}` : null, chosenColor].filter(Boolean).join(" • ") || "Selected";
                                return (
                                  <span 
                                    onClick={() => handleOpenChooseModal(slotIndex)}
                                    title="Click to change size or variation"
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      color: "#334155",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: 4,
                                      padding: "2.5px 7px",
                                      backgroundColor: "#f8fafc",
                                      cursor: "pointer",
                                      transition: "all 0.15s ease"
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.borderColor = "#94a3b8";
                                      e.currentTarget.style.backgroundColor = "#f1f5f9";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.borderColor = "#cbd5e1";
                                      e.currentTarget.style.backgroundColor = "#f8fafc";
                                    }}
                                  >
                                    {chosenLabel}
                                  </span>
                                );
                              })()}
                              <button
                                onClick={() => handleOpenChooseModal(slotIndex)}
                                title="Change product or variation"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 3,
                                  color: "#64748b"
                                }}
                              >
                                <RefreshCw size={13} />
                              </button>
                              <button
                                onClick={() => handleRemoveSlot(slotIndex)}
                                title="Remove product"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 3,
                                  color: "#f43f5e"
                                }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Empty Slot: Choose Product Button */
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 36,
                              height: 36,
                              borderRadius: 5,
                              backgroundColor: "#f8fafc",
                              border: "1px dashed #cbd5e1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#94a3b8",
                              flexShrink: 0
                            }}>
                              <Shirt size={16} />
                            </div>
                            <button
                              onClick={() => handleOpenChooseModal(slotIndex)}
                              className="bms-choose-btn"
                            >
                              <Plus size={14} /> Choose product
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Note for added required products & money savings */}
                {isAllRequiredAdded ? (
                  <div 
                    className="bms-savings-note-complete"
                    style={{
                      marginTop: 9,
                      padding: "9px 12px",
                      backgroundColor: "#f0fdf4",
                      border: "1.5px solid #86efac",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      boxShadow: "0 1px 3px rgba(22, 163, 74, 0.08)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 17, flexShrink: 0 }}>🎉</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", lineHeight: 1.25 }}>
                          All {tier.items_count} products added! You are saving Tk {actualSavings} on this {tier.name} bundle!
                        </div>
                        <div style={{ fontSize: 10.5, color: "#166534", marginTop: 2, lineHeight: 1.2 }}>
                          Bundle Total: <strong>Tk {actualBundleTotal}</strong> <span style={{ textDecoration: "line-through", color: "#86efac", marginLeft: 4 }}>Tk {actualOriginalTotal}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: "#16a34a",
                      color: "#ffffff",
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: "3.5px 8px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                      flexShrink: 0
                    }}>
                      SAVE Tk {actualSavings}
                    </div>
                  </div>
                ) : (
                  <div 
                    className="bms-savings-note-incomplete"
                    style={{
                      marginTop: 8,
                      padding: "8px 11px",
                      backgroundColor: "#fffbeb",
                      border: "1px dashed #fcd34d",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>⚡</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", lineHeight: 1.25 }}>
                        Add {remainingCount} more product{remainingCount > 1 ? "s" : ""} to unlock bundle &amp; save Tk {estimatedSavings}!
                      </span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#b45309",
                      backgroundColor: "#fef3c7",
                      padding: "2px 6px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                      flexShrink: 0
                    }}>
                      {discountPct}% OFF
                    </span>
                  </div>
                )}
              </>
            )}

              {/* Active Perks List at Bottom */}
              {isSelected && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, paddingLeft: 25 }}>
                  {tier.perks && tier.perks.map((p: string, pIdx: number) => (
                    <div key={pIdx} className="bms-perk-row">
                      <CheckCircle2 size={11} color="#16a34a" />
                      <span>{p}</span>
                    </div>
                  ))}
                  {tier.free_delivery && (
                    <div className="bms-perk-row" style={{ color: "#16a34a", fontWeight: 600, marginTop: 1 }}>
                      <Truck size={12} />
                      <span>FREE DELIVERY ALL OVER BANGLADESH</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Choose Product Popup Modal */}
      <ChooseProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveSlotIndex(null);
        }}
        onSelectProduct={handleProductSelected}
        discountPercentage={activeTier ? parseFloat(activeTier.discount_percentage || 0) : 0}
        excludeProductId={currentProduct?.id}
        initialProduct={activeSlotIndex !== null ? chosenSlots[activeSlotIndex]?.product : null}
        initialVariant={activeSlotIndex !== null ? chosenSlots[activeSlotIndex]?.variant : null}
        bundleName={activeTier?.name}
      />

      {/* Scoped CSS for light-black borders and compact mobile typography */}
      <style dangerouslySetInnerHTML={{__html: `
        .bms-main-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          letter-spacing: -0.01em;
        }
        .bms-main-sub {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 400;
        }
        .bms-card {
          border-radius: 8px;
          padding: 11px 13px;
          cursor: pointer;
          position: relative;
          transition: all 0.18s ease;
          background-color: #ffffff;
        }
        .bms-card-inactive {
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }
        .bms-card-inactive:hover {
          border-color: #cbd5e1;
          background-color: #fcfcfd;
        }
        .bms-card-active {
          border: 1.5px solid #475569;
          background-color: #f8fafc;
          box-shadow: 0 2px 8px rgba(71, 85, 105, 0.06);
        }
        .bms-top-badge {
          position: absolute;
          top: -8px;
          right: 12px;
          background-color: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          font-size: 8.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 2px 8px;
          border-radius: 999px;
          line-height: 1.2;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .bms-radio-circle {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 1.5px solid #cbd5e1;
          background-color: #ffffff;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .bms-radio-active {
          border: 4.5px solid #475569 !important;
          background-color: #ffffff;
        }
        .bms-card-name {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
        }
        .bms-discount-tag {
          font-size: 9px;
          font-weight: 700;
          color: #15803d;
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 1.5px 6px;
          border-radius: 4px;
          line-height: 1.2;
        }
        .bms-card-sub {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 2px;
          line-height: 1.25;
        }
        .bms-price-main {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.2;
        }
        .bms-price-strike {
          font-size: 10px;
          color: #94a3b8;
          text-decoration: line-through;
          line-height: 1.2;
          margin-top: 1px;
        }
        .bms-perk-row {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          color: #64748b;
          line-height: 1.2;
          font-weight: 500;
        }
        .bms-active-slots-box {
          margin-top: 8px;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          padding: 8px 9px;
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .bms-choose-btn {
          flex: 1;
          height: 32px;
          background-color: #f8fafc;
          border: 1px dashed #94a3b8;
          border-radius: 5px;
          color: #475569;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .bms-choose-btn:hover {
          border-color: #475569;
          background-color: #ffffff;
          color: #1e293b;
        }
        @media (max-width: 640px) {
          .bms-card {
            padding: 8px 10px;
          }
          .bms-card-name {
            font-size: 12.5px;
          }
          .bms-price-main {
            font-size: 12.5px;
          }
          .bms-card-sub {
            font-size: 10px;
          }
          .bms-perk-row {
            font-size: 9.5px;
          }
          .bms-top-badge {
            font-size: 8px;
            padding: 1.5px 6px;
            top: -7px;
            right: 8px;
          }
          .bms-active-slots-box {
            padding: 7px 7px;
            gap: 6px;
          }
          .bms-choose-btn {
            height: 30px;
            font-size: 10.5px;
          }
        }
      `}} />
    </div>
  );
}
