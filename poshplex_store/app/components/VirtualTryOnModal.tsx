"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  X, Sparkles, Upload, User, Ruler, ChevronRight, Download, 
  ShoppingCart, RefreshCw, CheckCircle, AlertCircle, ArrowRight,
  ShieldCheck, Zap, Lock, Edit3, UserCheck, Eye
} from "lucide-react";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import { toast } from "react-hot-toast";

interface VirtualTryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: {
    id: number | string;
    name: string;
    image_url: string;
    price?: number | string;
  };
  onAddToCart?: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/fit-check` 
  : "http://localhost:8000/api/v1/fit-check";

const SERVER_BASE = API_BASE.replace("/api/v1/fit-check", "");

const getFullMediaUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${SERVER_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
};

function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server_session";
  let fp = localStorage.getItem("poshplex_device_fp");
  if (!fp) {
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const rand = Math.random().toString(36).substring(2, 10);
    fp = `fp_${screenRes}_${Date.now().toString(36)}_${rand}`;
    localStorage.setItem("poshplex_device_fp", fp);
  }
  return fp;
}

function cmToFeetInches(cm: number): string {
  const inches = cm / 2.54;
  const feet = Math.floor(inches / 12);
  const remainingInches = Math.round(inches % 12);
  return `${feet}' ${remainingInches}"`;
}

// ============================================================================
// Default Character Model on Clean White Background (Custom Photo or Vector)
// ============================================================================
function DefaultCharacterPreview({ 
  structure, 
  heightCm, 
  gender,
  customDummyImageUrl,
  customLabel,
  customDescription
}: { 
  structure: string; 
  heightCm: number; 
  gender: string; 
  customDummyImageUrl?: string;
  customLabel?: string;
  customDescription?: string;
}) {
  // SVG Proportions per structure
  let shoulderW = 100;
  let chestW = 92;
  let waistW = 76;
  let hipW = 88;
  let armW = 20;
  let label = customLabel || "Athletic / Average Model";
  let subtitle = customDescription || "Balanced streetwear silhouette with broad shoulders";

  if (!customLabel) {
    if (structure === "slim") {
      shoulderW = 84;
      chestW = 76;
      waistW = 64;
      hipW = 76;
      armW = 16;
      label = "Slim Silhouette Model";
      subtitle = "Slender build with lean torso and tailored drape";
    } else if (structure === "full_figured") {
      shoulderW = 104;
      chestW = 108;
      waistW = 90;
      hipW = 114;
      armW = 24;
      label = "Full-Figured Model";
      subtitle = "Curvaceous silhouette with fuller chest and hips";
    } else if (structure === "plus_size") {
      shoulderW = 120;
      chestW = 126;
      waistW = 116;
      hipW = 128;
      armW = 28;
      label = "Plus-Size Model";
      subtitle = "Generous, relaxed silhouette with oversized streetwear drape";
    }
  }

  const cx = 130;
  const headY = 48;
  const neckY = 82;
  const shoulderY = 96;
  const waistY = 165;
  const hipY = 210;
  const legBottomY = 320;

  return (
    <div style={{
      backgroundColor: "#f8fafc",
      borderRadius: "14px",
      padding: "16px 14px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
      marginBottom: "20px",
      color: "#0f172a"
    }}>
      {/* Character Box: Custom Dummy Image or Vector Silhouette on White Background */}
      <div style={{
        width: "124px",
        height: "174px",
        flexShrink: 0,
        backgroundColor: "#ffffff",
        borderRadius: "10px",
        border: "1.5px solid #e4e4e7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        {customDummyImageUrl ? (
          <img
            src={customDummyImageUrl}
            alt={label}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              backgroundColor: "#ffffff"
            }}
          />
        ) : (
          <>
            {/* Subtle futuristic grid background */}
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "linear-gradient(to right, rgba(139, 92, 246, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(139, 92, 246, 0.08) 1px, transparent 1px)",
              backgroundSize: "14px 14px"
            }} />

            <svg 
              viewBox="0 0 260 340" 
              width="100%" 
              height="100%" 
              style={{ position: "relative", zIndex: 1 }}
            >
              <defs>
                <linearGradient id="aiMannequinTorso" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="50%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="aiMannequinAcc" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>

              {/* Head & Neck */}
              <ellipse cx={cx} cy={headY} rx="26" ry="34" fill="url(#aiMannequinTorso)" stroke="#8b5cf6" strokeWidth="1.5" />
              <rect x={cx - 14} y={neckY - 6} width="28" height="20" rx="4" fill="#334155" />

              {/* Torso & Shoulders Polygon */}
              <path
                d={`
                  M ${cx - shoulderW} ${shoulderY}
                  Q ${cx - shoulderW + 15} ${shoulderY - 8} ${cx - 16} ${neckY + 6}
                  L ${cx + 16} ${neckY + 6}
                  Q ${cx + shoulderW - 15} ${shoulderY - 8} ${cx + shoulderW} ${shoulderY}
                  L ${cx + chestW} ${shoulderY + 35}
                  Q ${cx + waistW} ${waistY} ${cx + hipW} ${hipY}
                  L ${cx - hipW} ${hipY}
                  Q ${cx - waistW} ${waistY} ${cx - chestW} ${shoulderY + 35}
                  Z
                `}
                fill="url(#aiMannequinTorso)"
                stroke="rgba(139, 92, 246, 0.4)"
                strokeWidth="1.5"
              />

              {/* Arms */}
              <path
                d={`
                  M ${cx - shoulderW} ${shoulderY}
                  L ${cx - shoulderW - armW} ${waistY}
                  L ${cx - shoulderW - armW + 10} ${waistY + 40}
                  L ${cx - chestW - 4} ${shoulderY + 35}
                  Z
                `}
                fill="#475569"
                stroke="rgba(139, 92, 246, 0.3)"
                strokeWidth="1"
              />
              <path
                d={`
                  M ${cx + shoulderW} ${shoulderY}
                  L ${cx + shoulderW + armW} ${waistY}
                  L ${cx + shoulderW + armW - 10} ${waistY + 40}
                  L ${cx + chestW + 4} ${shoulderY + 35}
                  Z
                `}
                fill="#475569"
                stroke="rgba(139, 92, 246, 0.3)"
                strokeWidth="1"
              />

              {/* Legs */}
              <rect x={cx - hipW + 8} y={hipY} width={hipW - 14} height={legBottomY - hipY} rx="8" fill="#1e293b" />
              <rect x={cx + 6} y={hipY} width={hipW - 14} height={legBottomY - hipY} rx="8" fill="#1e293b" />

              {/* Futuristic Contour Grid Lines on Chest */}
              <line x1={cx - 30} y1={shoulderY + 22} x2={cx + 30} y2={shoulderY + 22} stroke="rgba(139, 92, 246, 0.6)" strokeWidth="1.5" strokeDasharray="2 3" />
              <line x1={cx - 24} y1={waistY - 15} x2={cx + 24} y2={waistY - 15} stroke="rgba(236, 72, 153, 0.6)" strokeWidth="1.5" strokeDasharray="2 3" />

              {/* Height guide marker line */}
              <line x1="22" y1="20" x2="22" y2="320" stroke="url(#aiMannequinAcc)" strokeWidth="2" strokeDasharray="3 3" />
              <circle cx="22" cy="20" r="3.5" fill="#ec4899" />
              <circle cx="22" cy="320" r="3.5" fill="#8b5cf6" />
            </svg>
          </>
        )}

        {/* Floating Model Badge */}
        <div style={{
          position: "absolute",
          bottom: "6px",
          left: "50%",
          transform: "translateX(-50%)",
          background: customDummyImageUrl ? "#10b981" : "linear-gradient(135deg, #8b5cf6, #ec4899)",
          color: "#ffffff",
          fontSize: "9px",
          fontWeight: 800,
          padding: "2px 6px",
          borderRadius: "4px",
          letterSpacing: "0.5px",
          whiteSpace: "nowrap",
          zIndex: 2
        }}>
          {customDummyImageUrl ? "STUDIO MODEL" : "DEFAULT MODEL"}
        </div>
      </div>

      {/* Description & Proportions Column */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{
            fontSize: "10px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            backgroundColor: "#f4f4f5",
            color: "#8b5cf6",
            padding: "3px 7px",
            borderRadius: "6px",
            border: "1px solid #e4e4e7"
          }}>
            Body Baseline
          </span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#71717a" }}>
            {heightCm} cm • {cmToFeetInches(heightCm)}
          </span>
        </div>

        <div style={{ fontSize: "15px", fontWeight: 800, color: "#09090b", marginBottom: "4px" }}>
          {label}
        </div>

        <p style={{ fontSize: "12px", color: "#52525b", lineHeight: 1.4, margin: "0 0 10px 0" }}>
          {subtitle}. Upload your photo below to blend your facial landmarks onto this exact 3D character base.
        </p>

        <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "#71717a" }}>
          <span>✓ Standard Studio Scale</span>
          <span>✓ 100% Proportional Fit</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Virtual Try-On Modal Component
// ============================================================================
export default function VirtualTryOnModal({
  isOpen,
  onClose,
  product,
  onAddToCart
}: VirtualTryOnModalProps) {
  const fallbackProduct = {
    id: "poshplex-signature",
    name: "PoshPlex Signature Fit Check",
    image_url: "/logo.png",
    price: 2450
  };
  const activeProduct = product || fallbackProduct;
  // Modal Mode: "create_character" (initial input form) | "character_active" (generated character view, NO inputs) | "scanning" | "locked"
  const [mode, setMode] = useState<"create_character" | "character_active" | "scanning" | "locked" | "disabled">("create_character");
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [statusData, setStatusData] = useState<any>(null);

  // Character Form Inputs
  const [faceBase64, setFaceBase64] = useState<string>("");
  const [facePreviewUrl, setFacePreviewUrl] = useState<string>("");
  const [heightCm, setHeightCm] = useState<number>(175);
  const [bodyStructure, setBodyStructure] = useState<string>("athletic");
  const [genderPreference, setGenderPreference] = useState<string>("unisex");
  const [structuresList, setStructuresList] = useState<any[]>([]);

  // Generated Active Character Representation State
  const [activeCharacter, setActiveCharacter] = useState<{
    faceUrl: string;
    heightCm: number;
    bodyStructure: string;
    gender: string;
  } | null>(null);

  // Job & Try-On Result State
  const [jobId, setJobId] = useState<string>("");
  const [scanProgress, setScanProgress] = useState<number>(15);
  const [scanLog, setScanLog] = useState<string>("Initializing character model...");
  const [resultImage, setResultImage] = useState<string>("");
  const [resultMetrics, setResultMetrics] = useState<any>(null);

  // Split Comparison Slider State (0 to 100%)
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dynamic Body Structures from Backend API
  useEffect(() => {
    if (!isOpen) return;
    const fetchStructures = async () => {
      try {
        const res = await fetch(`${API_BASE}/body-structures`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setStructuresList(list);
          }
        }
      } catch (err) {
        console.error("Failed to load body structures:", err);
      }
    };
    fetchStructures();
  }, [isOpen]);

  // On open: check for existing character (from backend or local storage)
  useEffect(() => {
    if (!isOpen) return;

    const initStatus = async () => {
      setLoadingStatus(true);
      try {
        const fp = getDeviceFingerprint();
        const res = await fetchWithAuth(`${API_BASE}/status?fingerprint=${encodeURIComponent(fp)}`);
        
        let characterLoaded = false;

        if (res.ok) {
          const data = await res.json();
          setStatusData(data);

          // 1. Check if user already has a saved backend profile
          if (data.has_saved_character && data.saved_character?.face_image_url) {
            const char = {
              faceUrl: data.saved_character.face_image_url,
              heightCm: data.saved_character.height_cm || 175,
              bodyStructure: data.saved_character.body_structure || "athletic",
              gender: data.saved_character.gender_preference || "unisex"
            };
            setActiveCharacter(char);
            setHeightCm(char.heightCm);
            setBodyStructure(char.bodyStructure);
            setFacePreviewUrl(char.faceUrl);
            setGenderPreference(char.gender);
            characterLoaded = true;
          }

          // 2. If not in backend, check local storage for guest
          if (!characterLoaded && typeof window !== "undefined") {
            const storedChar = localStorage.getItem("poshplex_saved_character");
            if (storedChar) {
              try {
                const parsed = JSON.parse(storedChar);
                if (parsed.faceUrl) {
                  setActiveCharacter(parsed);
                  setHeightCm(parsed.heightCm || 175);
                  setBodyStructure(parsed.bodyStructure || "athletic");
                  setFacePreviewUrl(parsed.faceUrl);
                  setGenderPreference(parsed.gender || "unisex");
                  characterLoaded = true;
                }
              } catch (e) {}
            }
          }

          // 0. Check if AI Fit Check is disabled by Admin
          if (data.is_active === false) {
            setMode("disabled");
            return;
          }

          // 3. Set Initial View Mode
          if (!data.is_authenticated && !data.can_generate && !characterLoaded) {
            setMode("locked"); // Guest consumed trial without an existing character
          } else if (characterLoaded) {
            // If character exists, open directly into Active Character Try-On mode (NO INPUTS!)
            setMode("character_active");
            // If we don't have a result yet for this product, run auto-generation
            triggerAutoTryOn(data.saved_character || activeCharacter);
          } else {
            // First time visitor: show Character Creation Mode
            setMode("create_character");
          }
        }
      } catch (err) {
        console.error("Failed to initialize fit check modal:", err);
      } finally {
        setLoadingStatus(false);
      }
    };

    initStatus();
  }, [isOpen]);

  // Handle Photo File Upload
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a JPG or PNG image.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image file size should be under 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setFaceBase64(b64);
      setFacePreviewUrl(b64);
    };
    reader.readAsDataURL(file);
  };

  // Trigger Try-On for existing active character
  const triggerAutoTryOn = async (charData: any) => {
    if (!charData?.faceUrl && !charData?.face_image_url) return;
    const faceSrc = charData.faceUrl || charData.face_image_url;
    
    setScanProgress(20);
    setScanLog("Applying garment to your custom character model...");

    const fp = getDeviceFingerprint();
    const payload = {
      face_image_url: faceSrc,
      use_saved_character: true,
      height_cm: charData.heightCm || charData.height_cm || 175,
      body_structure: charData.bodyStructure || charData.body_structure || "athletic",
      gender_preference: charData.gender || charData.gender_preference || "unisex",
      product_id: typeof activeProduct.id === "number" ? activeProduct.id : undefined,
      product_name: activeProduct.name,
      product_image_url: activeProduct.image_url,
      guest_fingerprint: fp
    };

    try {
      const res = await fetchWithAuth(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setJobId(data.job_id);
        if (data.status === "completed" && data.result_image_url) {
          setResultImage(data.result_image_url);
          setResultMetrics(data);
          setScanProgress(100);
        } else {
          pollJobStatus(data.job_id);
        }
      }
    } catch (e) {}
  };

  // Submit Character Creation Form -> Generates Model & Enters Active Character View
  const handleCreateCharacter = async () => {
    if (!facePreviewUrl && !faceBase64) {
      toast.error("Please upload a face portrait photo to create your character.");
      return;
    }

    setMode("scanning");
    setScanProgress(15);
    setScanLog("Building 3D character mesh & facial geometry...");

    const fp = getDeviceFingerprint();
    const payload = {
      face_image_base64: faceBase64 || undefined,
      face_image_url: (!faceBase64 && facePreviewUrl) ? facePreviewUrl : undefined,
      height_cm: heightCm,
      body_structure: bodyStructure,
      gender_preference: genderPreference,
      product_id: typeof activeProduct.id === "number" ? activeProduct.id : undefined,
      product_name: activeProduct.name,
      product_image_url: activeProduct.image_url,
      guest_fingerprint: fp
    };

    try {
      const res = await fetchWithAuth(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403 || res.status === 429) {
          setMode("locked");
          return;
        }
        throw new Error(errData.message || "Failed to generate character");
      }

      const jobData = await res.json();
      setJobId(jobData.job_id);

      // Save character locally and in state
      const createdChar = {
        faceUrl: facePreviewUrl,
        heightCm: heightCm,
        bodyStructure: bodyStructure,
        gender: genderPreference
      };
      setActiveCharacter(createdChar);
      if (typeof window !== "undefined") {
        localStorage.setItem("poshplex_saved_character", JSON.stringify(createdChar));
      }

      // If immediately completed
      if (jobData.status === "completed" && jobData.result_image_url) {
        setResultImage(jobData.result_image_url);
        setResultMetrics(jobData);
        setScanProgress(100);
        setTimeout(() => setMode("character_active"), 500);
        return;
      }

      // Poll background worker
      pollJobStatus(jobData.job_id);

    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error(err.message || "Could not generate character. Please try again.");
      setMode("create_character");
    }
  };

  // Poll Celery Background Job
  const pollJobStatus = (id: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        if (attempts === 1) {
          setScanProgress(45);
          setScanLog("Draping streetwear garment & aligning shoulder fit...");
        } else if (attempts === 2) {
          setScanProgress(80);
          setScanLog("Rendering photorealistic studio lighting...");
        }

        const pollRes = await fetchWithAuth(`${API_BASE}/job/${id}`);
        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.status === "completed" && pollData.result_image_url) {
            clearInterval(interval);
            setScanProgress(100);
            setResultImage(pollData.result_image_url);
            setResultMetrics(pollData);
            setTimeout(() => setMode("character_active"), 600);
          } else if (pollData.status === "failed") {
            clearInterval(interval);
            toast.error(pollData.error || "Generation could not be completed.");
            setMode("create_character");
          }
        }

        if (attempts > 30) {
          clearInterval(interval);
          toast.error("Generation timed out. Please try again.");
          setMode("create_character");
        }
      } catch (e) {
        clearInterval(interval);
        setMode("create_character");
      }
    }, 1200);
  };

  if (!isOpen) return null;

  const fallbackStructures = [
    { code: "slim", name: "Slim", description: "Slender build with lean torso and tailored drape", dummy_image_url: "" },
    { code: "athletic", name: "Athletic / Average", description: "Balanced streetwear silhouette with broad shoulders", dummy_image_url: "" },
    { code: "full_figured", name: "Full-Figured", description: "Curvaceous silhouette with fuller chest and hips", dummy_image_url: "" },
    { code: "plus_size", name: "Plus-Size", description: "Generous, relaxed silhouette with oversized streetwear fit", dummy_image_url: "" }
  ];

  const activeStructureOptions = structuresList.length > 0 ? structuresList : fallbackStructures;
  const currentStructureObj = activeStructureOptions.find((s: any) => s.code === bodyStructure) || activeStructureOptions[1] || fallbackStructures[1];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      padding: "16px"
    }}>
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "680px",
        maxHeight: "92vh",
        backgroundColor: "#ffffff",
        borderRadius: "20px",
        border: "1.5px solid rgba(139, 92, 246, 0.3)",
        boxShadow: "0 25px 60px -15px rgba(139, 92, 246, 0.22), 0 0 35px rgba(139, 92, 246, 0.08)",
        overflowY: "auto",
        color: "#0f172a",
        fontFamily: "'Outfit', sans-serif"
      }}>
        {/* Header Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1px solid #f1f5f9",
          backgroundColor: "#ffffff"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(139, 92, 246, 0.3)"
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.5px", color: "#0f172a" }}>
                {mode === "create_character" ? "CREATE YOUR AI CHARACTER" : "AI FIT CHECK"}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                {mode === "create_character" 
                  ? "Calibrate once • Reuse seamlessly on all clothing" 
                  : "Verified Virtual Fit on Your Custom AI Avatar"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Quota Badge */}
            {statusData && (
              <div style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "20px",
                backgroundColor: statusData.is_authenticated 
                  ? "#f5f3ff" 
                  : (statusData.can_generate ? "#ecfdf5" : "#fef2f2"),
                border: statusData.is_authenticated 
                  ? "1px solid #ddd6fe" 
                  : (statusData.can_generate ? "1px solid #a7f3d0" : "1px solid #fecaca"),
                color: statusData.is_authenticated 
                  ? "#7c3aed" 
                  : (statusData.can_generate ? "#059669" : "#dc2626"),
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}>
                <Zap size={12} />
                {statusData.is_authenticated 
                  ? `${statusData.remaining_today} checks left today` 
                  : (statusData.can_generate ? "1 Free Guest Trial" : "Trial Consumed")}
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#64748b",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "#0f172a";
                e.currentTarget.style.backgroundColor = "#f1f5f9";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.backgroundColor = "#f8fafc";
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px" }}>
          
          {/* =============================================================== */}
          {/* STATE 1: CREATE CHARACTER MODE (Input Fields Visible)          */}
          {/* =============================================================== */}
          {mode === "create_character" && (
            <div>
              {/* Product Target Banner */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                marginBottom: "16px"
              }}>
                {activeProduct.image_url && (
                  <div style={{ width: "42px", height: "42px", borderRadius: "6px", overflow: "hidden", position: "relative", flexShrink: 0, backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <img 
                      src={activeProduct.image_url} 
                      alt={activeProduct.name} 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {activeProduct.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "#8b5cf6", fontWeight: 600 }}>
                    Fitting Item Preview
                  </div>
                </div>
              </div>

              {/* By-Default Character Model on Clean Background */}
              <DefaultCharacterPreview 
                structure={bodyStructure} 
                heightCm={heightCm} 
                gender={genderPreference} 
                customDummyImageUrl={getFullMediaUrl(currentStructureObj?.dummy_image_url)}
                customLabel={currentStructureObj?.name}
                customDescription={currentStructureObj?.description}
              />

              {/* 1. Face Portrait Photo Upload */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "8px", textTransform: "uppercase" }}>
                  1. Face Portrait Photo
                </label>
                
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  {facePreviewUrl ? (
                    <div style={{ position: "relative" }}>
                      <img 
                        src={facePreviewUrl} 
                        alt="Face Preview" 
                        style={{ width: "70px", height: "70px", borderRadius: "50%", objectFit: "cover", border: "2px solid #8b5cf6", boxShadow: "0 0 15px rgba(139, 92, 246, 0.4)" }}
                      />
                      <button
                        onClick={() => {
                          setFacePreviewUrl("");
                          setFaceBase64("");
                        }}
                        style={{
                          position: "absolute",
                          top: "-4px",
                          right: "-4px",
                          background: "#ef4444",
                          border: "none",
                          borderRadius: "50%",
                          width: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#fff"
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: "70px",
                        height: "70px",
                        borderRadius: "50%",
                        backgroundColor: "#faf5ff",
                        border: "2px dashed #c084fc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#8b5cf6",
                        flexShrink: 0,
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "#8b5cf6")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#c084fc")}
                    >
                      <Upload size={22} />
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handlePhotoSelect} 
                      accept="image/*" 
                      style={{ display: "none" }} 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        color: "#1e293b",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        marginBottom: "6px",
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                    >
                      {facePreviewUrl ? "Replace Face Photo" : "Upload Portrait Photo"}
                    </button>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Clear front-facing portrait. Blends seamlessly onto the mannequin above.
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Height Selector */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>
                    2. Height
                  </label>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#7c3aed" }}>
                    {heightCm} cm ({cmToFeetInches(heightCm)})
                  </span>
                </div>
                <input 
                  type="range" 
                  min={145} 
                  max={210} 
                  value={heightCm}
                  onChange={e => setHeightCm(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#8b5cf6",
                    cursor: "pointer"
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  <span>145 cm (4' 9")</span>
                  <span>175 cm (5' 9")</span>
                  <span>210 cm (6' 11")</span>
                </div>
              </div>

              {/* 3. Body Structure Selector Cards */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", textTransform: "uppercase" }}>
                  3. Select Body Structure
                </label>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px"
                }}>
                  {activeStructureOptions.map((opt: any) => {
                    const isSelected = bodyStructure === opt.code;
                    const optThumb = getFullMediaUrl(opt.dummy_image_url);
                    return (
                      <div
                        key={opt.code}
                        onClick={() => setBodyStructure(opt.code)}
                        style={{
                          padding: "10px 8px",
                          borderRadius: "10px",
                          backgroundColor: isSelected ? "#faf5ff" : "#f8fafc",
                          border: isSelected ? "2px solid #8b5cf6" : "1px solid #e2e8f0",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          textAlign: "center",
                          boxShadow: isSelected ? "0 0 16px rgba(139, 92, 246, 0.25)" : "none"
                        }}
                      >
                        {optThumb && (
                          <div style={{
                            width: "48px",
                            height: "58px",
                            margin: "0 auto 8px auto",
                            backgroundColor: "#ffffff",
                            borderRadius: "6px",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: isSelected ? "1.5px solid #8b5cf6" : "1px solid #e4e4e7",
                            boxShadow: isSelected ? "0 0 10px rgba(139, 92, 246, 0.3)" : "none"
                          }}>
                            <img 
                              src={optThumb} 
                              alt={opt.name} 
                              style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#ffffff" }} 
                            />
                          </div>
                        )}
                        <div style={{ fontSize: "12px", fontWeight: 800, color: isSelected ? "#7c3aed" : "#1e293b", marginBottom: "4px" }}>
                          {opt.name}
                        </div>
                        <div style={{ fontSize: "10px", color: isSelected ? "#6b21a8" : "#64748b", lineHeight: 1.3 }}>
                          {opt.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleCreateCharacter}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                  border: "none",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(139, 92, 246, 0.35)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.01)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <Sparkles size={16} />
                <span>GENERATE CHARACTER & FIT CHECK</span>
              </button>
            </div>
          )}

          {/* =============================================================== */}
          {/* STATE 2: SCANNING / GENERATING ANIMATION                       */}
          {/* =============================================================== */}
          {mode === "scanning" && (
            <div style={{ padding: "40px 10px", textAlign: "center" }}>
              <div style={{
                position: "relative",
                width: "220px",
                height: "280px",
                margin: "0 auto 24px",
                borderRadius: "14px",
                overflow: "hidden",
                border: "2px solid #8b5cf6",
                boxShadow: "0 0 35px rgba(139, 92, 246, 0.25)",
                backgroundColor: "#f8fafc"
              }}>
                <img 
                  src={activeProduct.image_url} 
                  alt={activeProduct.name} 
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                />
                
                {/* Neon Laser Scanning Bar */}
                <div style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: "4px",
                  background: "linear-gradient(90deg, transparent, #ec4899, #8b5cf6, transparent)",
                  boxShadow: "0 0 15px #ec4899, 0 0 25px #8b5cf6",
                  animation: "laserScan 2s ease-in-out infinite alternate"
                }} />

                <style>{`
                  @keyframes laserScan {
                    0% { top: 5%; }
                    100% { top: 95%; }
                  }
                `}</style>
              </div>

              <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
                Synthesizing AI Character Fitting
              </div>
              <div style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 600, marginBottom: "20px" }}>
                {scanLog}
              </div>

              <div style={{ width: "100%", maxWidth: "340px", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px", margin: "0 auto 10px", overflow: "hidden" }}>
                <div style={{
                  width: `${scanProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #8b5cf6, #ec4899)",
                  transition: "width 0.4s ease"
                }} />
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Decoupled asynchronous processing • Fast 2-4 second rendering
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STATE 3: ACTIVE CHARACTER & TRY-ON VIEW (NO INPUT FIELDS!)     */}
          {/* =============================================================== */}
          {mode === "character_active" && (
            <div>
              {/* Active Character Top Summary Card with "Change Character" button */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "#faf5ff",
                border: "1px solid #ddd6fe",
                marginBottom: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {activeCharacter?.faceUrl ? (
                    <img 
                      src={activeCharacter.faceUrl} 
                      alt="Active Character" 
                      style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "2px solid #8b5cf6" }}
                    />
                  ) : (
                    <div style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <UserCheck size={20} color="#fff" />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                      Your AI Character ({activeCharacter?.bodyStructure?.replace("_", " ").toUpperCase()}, {activeCharacter?.heightCm}cm)
                    </div>
                    <div style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 600 }}>
                      ✓ Permanent Model Active • Fitted to {activeProduct.name.slice(0, 30)}
                    </div>
                  </div>
                </div>

                {/* THE "CHANGE CHARACTER" BUTTON */}
                <button
                  type="button"
                  onClick={() => setMode("create_character")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#ffffff")}
                >
                  <Edit3 size={13} />
                  <span>Change Character</span>
                </button>
              </div>

              {/* Before & After Interactive Comparison Slider */}
              <div 
                style={{
                  position: "relative",
                  width: "100%",
                  height: "440px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                  backgroundImage: "radial-gradient(circle at center, #ffffff 0%, #f8fafc 100%)",
                  border: "1.5px solid rgba(139, 92, 246, 0.25)",
                  boxShadow: "0 8px 30px rgba(139, 92, 246, 0.12)",
                  marginBottom: "16px",
                  userSelect: "none"
                }}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                onMouseMove={(e) => {
                  if (!isDragging) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
                  setSliderPos(pct);
                }}
                onTouchMove={(e) => {
                  if (!isDragging) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.touches[0].clientX - rect.left;
                  const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
                  setSliderPos(pct);
                }}
              >
                {/* Layer 1: Virtual Fit Render on Character (Background) */}
                {resultImage ? (
                  <img 
                    src={resultImage} 
                    alt="Virtual Fit Result" 
                    style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#ffffff" }} 
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6", fontWeight: 700, fontSize: "14px" }}>
                    Generating fit for {activeProduct.name}...
                  </div>
                )}

                {/* Layer 2: Original Product Flat-lay (Clipped) */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  width: `${sliderPos}%`,
                  overflow: "hidden",
                  borderRight: "2px solid #8b5cf6"
                }}>
                  <img 
                    src={activeProduct.image_url} 
                    alt="Original Garment" 
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      backgroundColor: "#ffffff",
                      minWidth: "630px"
                    }} 
                  />
                  <div style={{
                    position: "absolute",
                    top: "14px",
                    left: "14px",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(15, 23, 42, 0.85)",
                    backdropFilter: "blur(6px)",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                  }}>
                    ORIGINAL GARMENT
                  </div>
                </div>

                {/* Top Right Label for Character Fit */}
                <div style={{
                  position: "absolute",
                  top: "14px",
                  right: "14px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(236, 72, 153, 0.95))",
                  backdropFilter: "blur(6px)",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  boxShadow: "0 2px 10px rgba(139, 92, 246, 0.35)"
                }}>
                  YOUR AI CHARACTER FIT
                </div>

                {/* Draggable Divider Handle */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${sliderPos}%`,
                  transform: "translateX(-50%)",
                  width: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "ew-resize"
                }}>
                  <div style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                    border: "2.5px solid #ffffff",
                    boxShadow: "0 0 16px rgba(139, 92, 246, 0.8), 0 2px 8px rgba(0,0,0,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 800
                  }}>
                    ⇄
                  </div>
                </div>
              </div>

              {/* Slider instruction */}
              <div style={{ textAlign: "center", fontSize: "11px", color: "#64748b", marginBottom: "16px" }}>
                Drag slider left/right to compare product flat-lay with your custom AI character on-model fit.
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {resultImage && (
                  <a
                    href={resultImage}
                    target="_blank"
                    download={`poshplex_fitcheck_${activeProduct.id}.jpg`}
                    style={{
                      flex: 1,
                      minWidth: "140px",
                      padding: "12px",
                      borderRadius: "10px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#1e293b",
                      fontSize: "13px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      textDecoration: "none"
                    }}
                  >
                    <Download size={15} />
                    <span>Download Fit</span>
                  </a>
                )}

                {onAddToCart && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddToCart();
                      toast.success("Added to cart with your verified fit!");
                      onClose();
                    }}
                    style={{
                      flex: 1.5,
                      minWidth: "160px",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                      border: "none",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: "pointer",
                      boxShadow: "0 4px 18px rgba(139, 92, 246, 0.35)"
                    }}
                  >
                    <ShoppingCart size={15} />
                    <span>Add to Cart with This Fit</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STATE 4: GATEKEEPER LOCKED (1-Time Guest Trial Consumed)       */}
          {/* =============================================================== */}
          {mode === "locked" && (
            <div style={{ padding: "30px 10px", textAlign: "center" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#faf5ff",
                border: "1px solid #ddd6fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "#7c3aed"
              }}>
                <Lock size={26} />
              </div>

              <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
                1-Time Free Guest Trial Consumed
              </div>

              <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5, maxWidth: "420px", margin: "0 auto 24px" }}>
                You have used your 1 free guest trial! Create a free customer account to unlock 
                <strong style={{ color: "#0f172a" }}> 10 free AI Fit Checks every day</strong> and permanently save your character avatar across all devices.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "320px", margin: "0 auto" }}>
                <Link
                  href="/register"
                  onClick={onClose}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "13px",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 18px rgba(139, 92, 246, 0.35)"
                  }}
                >
                  <span>CREATE FREE ACCOUNT</span>
                  <ArrowRight size={15} />
                </Link>

                <Link
                  href="/login"
                  onClick={onClose}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "10px",
                    backgroundColor: "#ffffff",
                    color: "#1e293b",
                    fontWeight: 700,
                    fontSize: "13px",
                    textDecoration: "none",
                    border: "1px solid #cbd5e1"
                  }}
                >
                  Sign In to Existing Account
                </Link>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STATE 5: FEATURE DISABLED BY STORE ADMINISTRATOR               */}
          {/* =============================================================== */}
          {mode === "disabled" && (
            <div style={{ padding: "40px 10px", textAlign: "center" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "#dc2626"
              }}>
                <AlertCircle size={28} />
              </div>

              <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
                AI Fit Check Temporarily Inactive
              </div>

              <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5, maxWidth: "420px", margin: "0 auto 24px" }}>
                The AI Virtual Fit Check engine is currently inactive or under routine maintenance. Please check our standard Size Chart or check back soon!
              </p>

              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Close Studio
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
