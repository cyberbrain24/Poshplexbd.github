"use client";

import React, { useEffect, useState } from "react";
import { User, Package, MapPin, Award, CheckCircle, Clock, Star, Edit, Trash2, ShieldCheck, AlertCircle, X, Lock, Phone, Calendar, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Select from "react-select";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import GraffitiBackground from "../components/GraffitiBackground";

export default function ProfilePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "reviews" | "password" | "membership">("orders");
  
  // Edit review state
  const [editingReview, setEditingReview] = useState<any | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editTitle, setEditTitle] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editSubmitMsg, setEditSubmitMsg] = useState("");

  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Forgot Password State
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Change password states
  const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeConfirmPassword, setChangeConfirmPassword] = useState("");
  const [changePwdError, setChangePwdError] = useState("");
  const [changePwdSuccess, setChangePwdSuccess] = useState("");
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  
  // Timer for OTP countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);
  
  // Auth Form State
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regBirthYear, setRegBirthYear] = useState("");
  const [regBirthMonth, setRegBirthMonth] = useState("");
  const [regBirthDay, setRegBirthDay] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [token, setToken] = useState<string | null>(null);

  // Profile editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profName, setProfName] = useState("");
  const [profEmail, setProfEmail] = useState("");
  const [profGender, setProfGender] = useState("");
  const [profBirthYear, setProfBirthYear] = useState("");
  const [profBirthMonth, setProfBirthMonth] = useState("");
  const [profBirthDay, setProfBirthDay] = useState("");
  const [profErrorMsg, setProfErrorMsg] = useState("");
  const [profSuccessMsg, setProfSuccessMsg] = useState("");

  // Address editing states
  const [districts, setDistricts] = useState<any[]>([]);
  const [thanas, setThanas] = useState<any[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedThana, setSelectedThana] = useState("");
  const [addressText, setAddressText] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressSubmitMsg, setAddressSubmitMsg] = useState("");
  const [addressErrorMsg, setAddressErrorMsg] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/customers/me/upload-profile-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUserProfile({ ...userProfile, profile_image: data.url });
      } else {
        console.error("Failed to upload profile image");
      }
    } catch (err) {
      console.error("Error uploading image", err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const fetchDistricts = async () => {
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/locations/districts`);
      if (res.ok) {
        const data = await res.json();
        setDistricts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchThanas = async (districtId: string) => {
    if (!districtId) {
      setThanas([]);
      return;
    }
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/locations/thanas?district_id=${districtId}`);
      if (res.ok) {
        const data = await res.json();
        setThanas(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      fetchThanas(selectedDistrict);
    } else {
      setThanas([]);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (userProfile) {
      setAddressText(userProfile.address || "");
      setSelectedDistrict(userProfile.district_id ? String(userProfile.district_id) : "");
      setSelectedThana(userProfile.thana_id ? String(userProfile.thana_id) : "");
      
      setProfName(userProfile.username || "");
      setProfEmail(userProfile.email || "");
      setProfGender(userProfile.gender || "unspecified");
      if (userProfile.birthdate) {
        const parts = userProfile.birthdate.split("-");
        if (parts.length === 3) {
          setProfBirthYear(parts[0]);
          setProfBirthMonth(String(parseInt(parts[1])));
          setProfBirthDay(String(parseInt(parts[2])));
        }
      } else {
        setProfBirthYear("");
        setProfBirthMonth("");
        setProfBirthDay("");
      }
    }
  }, [userProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfErrorMsg("");
    setProfSuccessMsg("");
    if (!profName) {
      setProfErrorMsg("Full name is required.");
      return;
    }
    const birthdate = profBirthYear && profBirthMonth && profBirthDay 
      ? `${profBirthYear}-${profBirthMonth.padStart(2, '0')}-${profBirthDay.padStart(2, '0')}` 
      : null;
      
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/customers/me/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: profName,
          email: profEmail,
          gender: profGender,
          birthdate: birthdate,
          address: addressText,
          district_id: selectedDistrict ? parseInt(selectedDistrict) : null,
          thana_id: selectedThana ? parseInt(selectedThana) : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfSuccessMsg("Profile details updated successfully!");
        setUserProfile(data);
        setTimeout(() => {
          setIsEditingProfile(false);
          setProfSuccessMsg("");
        }, 1500);
      } else {
        setProfErrorMsg(data.detail || "Failed to update profile.");
      }
    } catch (err) {
      setProfErrorMsg("Network error. Please try again.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdError("");
    setChangePwdSuccess("");
    if (changeNewPassword !== changeConfirmPassword) {
      setChangePwdError("New passwords do not match.");
      return;
    }
    setChangePwdLoading(true);
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: changeCurrentPassword,
          new_password: changeNewPassword
        })
      });
      if (res.ok) {
        setChangePwdSuccess("Password updated successfully!");
        setChangeCurrentPassword("");
        setChangeNewPassword("");
        setChangeConfirmPassword("");
      } else {
        const data = await res.json();
        setChangePwdError(data.detail || "Failed to change password.");
      }
    } catch {
      setChangePwdError("Network error. Please try again.");
    } finally {
      setChangePwdLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("poshplex_access_token");
      if (storedToken && storedToken !== "buyer_imran") {
        setToken(storedToken);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch customer orders
  const loadProfileOrders = async () => {
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const ordersList = Array.isArray(data) ? data : (data.results || data.orders || []);
        setOrders(ordersList);
      } else {
        console.warn("Orders fetch returned non-ok status:", res.status);
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("poshplex_access_token");
          localStorage.removeItem("poshplex_refresh_token");
          setToken("");
          setIsAuthenticated(false);
        }
        setOrders([]);
      }
    } catch (err) {
      setOrders([
        { id: 1001, total_amount: "240.00", status: "shipped", tracking_number: "MOCK-SHIP-99X8", shipping_address: "House 45, Banani, Dhaka" },
        { id: 1002, total_amount: "45.00", status: "pending", tracking_number: null, shipping_address: "House 45, Banani, Dhaka" }
      ]);
    }
  };

  // Fetch customer reviews
  const loadUserReviews = async () => {
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/my-reviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      } else {
        console.warn("Reviews fetch returned non-ok status:", res.status);
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("poshplex_access_token");
          localStorage.removeItem("poshplex_refresh_token");
          setToken("");
          setIsAuthenticated(false);
        }
        setReviews([]);
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setReviews([
        { id: 101, product_name: "Ghost Ink Heavy Boxy Tee", product_slug: "ghost-ink", rating: 5, title: "Unreal Weight", comment: "Perfect boxy cut. Thick material.", is_approved: true, created_at: "2026-06-30T12:00:00Z" }
      ]);
    }
  };

  const loadCustomerProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/customers/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setToken("");
        localStorage.removeItem("poshplex_token");
      }
    } catch (err) {
      setIsAuthenticated(false);
    }
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressErrorMsg("");
    setAddressSubmitMsg("");
    if (!selectedDistrict || !selectedThana || !addressText) {
      setAddressErrorMsg("Please fill out all address fields.");
      return;
    }
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/customers/me/address`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          address: addressText,
          district_id: parseInt(selectedDistrict),
          thana_id: parseInt(selectedThana)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAddressSubmitMsg("Address updated successfully!");
        setUserProfile(data);
        setIsEditingAddress(false);
      } else {
        setAddressErrorMsg(data.detail || "Failed to update address.");
      }
    } catch (err) {
      setAddressErrorMsg("Network error. Please try again.");
    }
  };

  useEffect(() => {
    if (!token) return;
    const initLoad = async () => {
      setIsLoading(true);
      await Promise.all([loadCustomerProfile(), loadProfileOrders(), loadUserReviews()]);
      setIsLoading(false);
    };
    initLoad();
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: authPhone, password: authPassword }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("poshplex_token", data.token);
        setToken(data.token);
      } else {
        setAuthError(data.detail || "Login failed");
      }
    } catch (err) {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (regPassword !== regConfirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }
    setAuthLoading(true);
    const regBirthdate = regBirthYear && regBirthMonth && regBirthDay ? `${regBirthYear}-${regBirthMonth.padStart(2, '0')}-${regBirthDay.padStart(2, '0')}` : "";
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: regFullName, phone: regPhone, birthdate: regBirthdate, password: regPassword }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("poshplex_token", data.token);
        setToken(data.token);
      } else {
        setAuthError(data.detail || "Registration failed");
      }
    } catch (err) {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!forgotPhone) {
      setForgotError("Please enter your phone number.");
      return;
    }
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-forgot-password/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setCountdown(60);
      } else {
        setForgotError(data.detail || "Failed to send code.");
      }
    } catch (err) {
      setForgotError("Network error.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (newPassword !== confirmNewPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/customer-forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotPhone, otp: forgotOtp, new_password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Password reset successfully! Please login with your new password.");
        setIsForgotPasswordMode(false);
        setForgotPhone("");
        setForgotOtp("");
        setNewPassword("");
        setConfirmNewPassword("");
        setOtpSent(false);
        setCountdown(0);
      } else {
        setForgotError(data.detail || "Failed to reset password.");
      }
    } catch (err) {
      setForgotError("Network error.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/my-reviews/${reviewId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setReviews(reviews.filter(r => r.id !== reviewId));
      }
    } catch (err) {
      console.error(err);
      setReviews(reviews.filter(r => r.id !== reviewId));
    }
  };

  const startEditReview = (rev: any) => {
    setEditingReview(rev);
    setEditRating(rev.rating);
    setEditTitle(rev.title);
    setEditComment(rev.comment);
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;

    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/products/${editingReview.product_id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rating: editRating,
          comment: editComment,
          images: editingReview.images || []
        })
      });
      if (res.ok) {
        setEditSubmitMsg("Review updated! Awaiting moderation.");
        loadUserReviews();
        setTimeout(() => {
          setEditingReview(null);
          setEditSubmitMsg("");
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      setEditingReview(null);
    }
  };

  // Compute membership tiers based on cumulative expenditures
  const totalSpend = orders
    .filter(o => o.status === "paid" || o.status === "shipped")
    .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

  let membershipTier = "Silver Division";
  let tierColor = "#9ca3af"; 
  if (totalSpend > 500) {
    membershipTier = "Platinum Executive";
    tierColor = "#06b6d4"; 
  } else if (totalSpend > 200) {
    membershipTier = "Gold Vanguard";
    tierColor = "#a855f7"; 
  }

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated && !isLoading) {
    return <div className="container" style={{ paddingTop: 60, paddingBottom: 100, textAlign: "center" }}>Redirecting to Login...</div>;
  }

  if (isLoading || !userProfile) {
    return <div className="container" style={{ paddingTop: 60, paddingBottom: 100, textAlign: "center" }}>Loading Profile...</div>;
  }

  const calculateProfileCompletion = () => {
    if (!userProfile) return 0;
    
    const fields = [
      userProfile.username || userProfile.first_name, // Name
      userProfile.phone, // Phone
      userProfile.gender && userProfile.gender !== "unspecified", // Gender
      userProfile.birthdate, // Date of birth
      userProfile.district_name || userProfile.district, // District
      userProfile.thana_name || userProfile.thana, // Thana
      userProfile.address, // Street address
      userProfile.profile_image // Profile picture
    ];
    
    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
  };
  const profileCompletion = calculateProfileCompletion();

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: -1 }}>
        <GraffitiBackground />
      </div>
      <div className="container profile-container-mobile" style={{ position: "relative", zIndex: 1, paddingBottom: 100 }}>
      {/* Styles for dynamic layouts */}
      <style>{`
        .profile-container-mobile {
          padding-top: 60px;
        }
        .profile-layout-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 32px;
          align-items: start;
        }
        .profile-card-glow {
          background: var(--bg-secondary);
          border: 1px solid var(--border-glass);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .profile-avatar-circle {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: var(--text-main);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-bottom: 20px;
          box-shadow: 0 8px 30px rgba(168, 85, 247, 0.3);
          border: 2px solid rgba(255,255,255,0.1);
        }
        .profile-metadata-container {
          width: 100%;
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          text-align: left;
        }
        .metadata-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          background: rgba(255,255,255,0.01);
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid var(--border-glass);
        }
        .metadata-icon {
          color: var(--text-muted);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .metadata-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .metadata-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .metadata-value {
          font-size: 13px;
          color: var(--text-main);
          font-weight: 500;
        }
        .tier-card-box {
          width: 100%;
          margin-top: 24px;
          background: linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.03));
          border: 1px solid var(--border-glass);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.03);
        }
        .nav-grid-4col {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .nav-grid-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border-glass);
          border-radius: 16px;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: center;
          color: var(--text-main);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.03);
        }
        .nav-grid-item:hover {
          border-color: #f87171;
          background: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(248, 113, 113, 0.15), 0 0 0 1px rgba(248, 113, 113, 0.2);
        }
        .nav-grid-item:hover .nav-icon, .nav-grid-item:hover .nav-label {
          color: #f87171 !important;
        }
        .nav-grid-item.active {
          border-color: #f87171;
          background: #f87171;
          color: #ffffff !important;
          box-shadow: 0 12px 30px rgba(248, 113, 113, 0.3), 0 0 0 1px rgba(248, 113, 113, 0.5);
        }
        .nav-grid-item.active .nav-icon {
          color: #ffffff !important;
        }
        .nav-grid-item.active .nav-label {
          color: #ffffff !important;
        }
        .nav-icon {
          color: var(--text-muted);
          transition: color 0.25s;
        }
        .nav-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          transition: color 0.25s;
        }
        .profile-header-layout {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 0px;
        }
        .profile-avatar-clickable {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
        }
        .profile-upload-text {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-main);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.8;
          margin-top: 12px;
        }
        .profile-info-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .profile-user-name {
          font-size: 22px;
          font-weight: 900;
          color: var(--text-main);
          text-transform: uppercase;
          margin: 0 0 4px 0;
          letter-spacing: 0.5px;
        }
        .profile-member-since {
          font-size: 12px;
          color: var(--text-muted);
        }
        .content-panel-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border-glass);
          border-radius: 24px;
          padding: 32px;
          min-height: 300px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04);
        }
        .order-card, .review-card {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.02);
        }
        
        @media (max-width: 768px) {
          .profile-header-layout {
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 16px;
            margin-bottom: 20px;
          }
          .profile-avatar-clickable {
            margin-bottom: 0;
            width: 72px;
          }
          .profile-avatar-circle {
            width: 72px;
            height: 72px;
            margin-bottom: 0 !important;
          }
          .profile-upload-text {
            display: none;
          }
          .profile-info-block {
            align-items: flex-start;
            text-align: left;
            flex: 1;
          }
          .profile-user-name {
            font-size: 18px;
          }
          .profile-container-mobile {
            padding-top: 16px !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          .profile-layout-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .profile-card-glow {
            padding: 16px 16px;
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04);
          }
          .profile-avatar-circle {
            width: 72px;
            height: 72px;
            margin-bottom: 12px;
          }
          .profile-avatar-icon {
            width: 32px !important;
            height: 32px !important;
          }
          .profile-card-glow h2 {
            font-size: 18px !important;
          }
          .profile-metadata-container {
            margin-top: 12px;
            gap: 8px;
          }
          .metadata-row {
            padding: 8px 12px;
            border-radius: 8px;
            gap: 10px;
          }
          .metadata-icon {
            width: 14px !important;
            height: 14px !important;
          }
          .metadata-label {
            font-size: 8px;
          }
          .metadata-value {
            font-size: 12px;
          }
          .edit-prof-btn {
            margin-top: 16px !important;
            padding: 10px !important;
            border-radius: 10px !important;
            font-size: 11px !important;
          }
          .tier-card-box {
            margin-top: 12px;
            padding: 12px 16px;
            border-radius: 12px;
            gap: 12px;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.03);
          }
          .tier-card-box b {
            font-size: 14px !important;
          }
          .tier-icon-wrapper {
            width: 38px !important;
            height: 38px !important;
            border-radius: 8px !important;
          }
          .tier-icon-wrapper svg {
            width: 18px !important;
            height: 18px !important;
          }
          .nav-grid-4col {
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            margin-bottom: 16px;
            margin-top: 8px;
          }
          .nav-grid-item {
            padding: 10px 4px;
            gap: 6px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.02);
          }
          .nav-grid-item svg {
            width: 16px !important;
            height: 16px !important;
          }
          .nav-label {
            font-size: 9.5px !important;
          }
          .content-panel-box {
            padding: 16px;
            border-radius: 16px;
            min-height: auto;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.03);
          }
          .content-panel-box h3 {
            font-size: 15px !important;
            margin-bottom: 8px !important;
          }
          .order-card, .review-card {
            padding: 16px !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.01) !important;
          }
          .order-card-grid {
            margin-bottom: 12px !important;
          }
        }
      `}</style>

      <div className="profile-layout-grid">
        {/* Left Side: Profile Card & Membership */}
        <div>
          <div className="profile-card-glow">
            <div className="profile-header-layout">
              <div 
                className="profile-avatar-clickable"
                onClick={() => document.getElementById("profileUploadInput")?.click()}
              >
                <div 
                  className="profile-avatar-circle"
                  style={{ position: "relative", overflow: "hidden" }}
                  title={userProfile.profile_image ? "Change profile photo" : "Upload profile photo"}
                >
                  {isUploadingImage ? (
                    <span style={{ fontSize: 11, fontWeight: "bold" }}>UPDATING...</span>
                  ) : userProfile.profile_image ? (
                    <Image 
                      src={userProfile.profile_image} 
                      alt="Profile" 
                      fill
                      sizes="100px"
                      style={{ objectFit: "cover" }} 
                    />
                  ) : (
                    <User size={44} className="profile-avatar-icon" />
                  )}
                  <input 
                    id="profileUploadInput" 
                    type="file" 
                    accept="image/*" 
                    style={{ display: "none" }} 
                    onChange={handleImageUpload}
                  />
                </div>
                <span className="profile-upload-text">
                  {userProfile.profile_image ? "Change the image" : "Upload the profile image"}
                </span>
              </div>
              
              <div className="profile-info-block">
                <h2 className="profile-user-name">
                  {userProfile.username || "Customer"}
                </h2>
                <span className="profile-member-since">Loyal member since {new Date(userProfile.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div style={{ marginTop: 16, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Profile Completion</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: profileCompletion === 100 ? "#10b981" : "var(--accent-purple)" }}>{profileCompletion}%</span>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ 
                  height: "100%", 
                  width: `${profileCompletion}%`, 
                  background: profileCompletion === 100 ? "#10b981" : "var(--accent-purple)",
                  transition: "width 0.5s ease" 
                }} />
              </div>
            </div>

            <div className="profile-metadata-container">
              <div className="metadata-row">
                <Phone size={16} className="metadata-icon" />
                <div className="metadata-content">
                  <span className="metadata-label">Phone Number</span>
                  <span className="metadata-value">{userProfile.phone}</span>
                </div>
              </div>

              <div className="metadata-row">
                <User size={16} className="metadata-icon" />
                <div className="metadata-content">
                  <span className="metadata-label">Gender</span>
                  <span className="metadata-value">{userProfile.gender ? userProfile.gender.toUpperCase() : "NOT SPECIFIED"}</span>
                </div>
              </div>

              <div className="metadata-row">
                <Calendar size={16} className="metadata-icon" />
                <div className="metadata-content">
                  <span className="metadata-label">Date of Birth</span>
                  <span className="metadata-value">{userProfile.birthdate || "NOT SPECIFIED"}</span>
                </div>
              </div>

              <div className="metadata-row">
                <Home size={16} className="metadata-icon" />
                <div className="metadata-content">
                  <span className="metadata-label">Shipping Address</span>
                  <span className="metadata-value" style={{ wordBreak: "break-word" }}>
                    {userProfile.address ? (
                      <>
                        {userProfile.address}
                        {userProfile.thana_name ? `, ${userProfile.thana_name}` : ""}
                        {userProfile.district_name ? `, ${userProfile.district_name}` : ""}
                      </>
                    ) : (
                      "NOT SPECIFIED"
                    )}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditingProfile(true)}
              className="edit-prof-btn"
              style={{
                width: "100%",
                background: "transparent",
                border: "1.5px solid var(--border-glass)",
                borderRadius: 12,
                color: "var(--text-main)",
                padding: "12px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                textTransform: "uppercase",
                marginTop: 24,
                letterSpacing: "0.5px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text-main)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-glass)"; }}
            >
              Edit Profile Info
            </button>
          </div>
        </div>

        {/* Right Side: Tab Buttons Grid & Content */}
        <div>
          {/* Navigation Grid (4 Columns) */}
          <div className="nav-grid-4col">
            <div 
              className={`nav-grid-item ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              <Package size={22} className="nav-icon" />
              <span className="nav-label">My Orders</span>
            </div>

            <div 
              className={`nav-grid-item ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              <Star size={22} className="nav-icon" />
              <span className="nav-label">My Reviews</span>
            </div>

            <div 
              className={`nav-grid-item ${activeTab === "password" ? "active" : ""}`}
              onClick={() => setActiveTab("password")}
            >
              <Lock size={22} className="nav-icon" />
              <span className="nav-label">Reset Password</span>
            </div>

            <div 
              className={`nav-grid-item ${activeTab === "membership" ? "active" : ""}`}
              onClick={() => setActiveTab("membership")}
            >
              <Award size={22} className="nav-icon" />
              <span className="nav-label">My Membership</span>
            </div>
          </div>

          {/* Content Panel */}
          <div className="content-panel-box">
            {activeTab === "membership" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 12 }}>
                  Membership Info
                </h3>
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${tierColor}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Award size={24} color={tierColor} />
                    </div>
                    <div>
                      <span style={{ fontSize: 13, color: "var(--text-muted)", display: "block" }}>Current Tier</span>
                      <b style={{ color: tierColor, fontSize: 18, textTransform: "uppercase", fontWeight: 900 }}>
                        {userProfile?.membership_tier_name || membershipTier}
                      </b>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                    You are currently on the <b style={{ color: "var(--text-main)" }}>{userProfile?.membership_tier_name || membershipTier}</b> tier. Continue shopping to earn more points and unlock exclusive benefits like free shipping, early access to drops, and special discounts.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 12 }}>
                  Purchase Log & Dispatch Tracking
                </h3>
                  {orders.length === 0 ? (
                    <div style={{ padding: 40, border: "1px dashed var(--border-glass)", borderRadius: 12, textAlign: "center", color: "var(--text-muted)" }}>
                      No purchase logs recorded for this buyer account.
                    </div>
                  ) : (
                    orders.map((order) => (
                      <div key={order.id} className="order-card" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                        <div>
                          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Order Reference</span>
                          <h4 style={{ fontSize: 16, color: "var(--text-main)", fontWeight: 700 }}>#{order.id}</h4>
                        </div>
                        <div>
                          <span style={{ fontSize: 13, color: "var(--text-muted)", display: "block", textAlign: "right" }}>Total Paid</span>
                          <b style={{ fontSize: 16, color: "var(--text-main)" }}>৳{Math.round(parseFloat(order.total_amount))}</b>
                        </div>
                        <div>
                          <span style={{ fontSize: 13, color: "var(--text-muted)", display: "block", textAlign: "right" }}>Fulfillment status</span>
                          <span style={{
                            display: "inline-block",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 4,
                            background: order.status === "shipped" ? "rgba(16, 185, 129, 0.1)" : "rgba(251, 191, 36, 0.1)",
                            color: order.status === "shipped" ? "var(--accent-green)" : "var(--accent-purple)",
                            marginTop: 4
                          }}>
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {order.status === "shipped" && order.tracking_number ? (
                        <div style={{ background: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: 12, padding: 16, display: "flex", gap: 12 }}>
                          <CheckCircle size={18} style={{ color: "#e11d48", flexShrink: 0 }} />
                          <div>
                            <b style={{ fontSize: 13, color: "var(--text-main)" }}>Courier Consignment Dispatched</b>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                              Tracking ID: <code style={{ color: "var(--text-main)" }}>{order.tracking_number}</code>.
                            </p>
                          </div>
                        </div>
                      ) : order.status === "paid" ? (
                        <div style={{ background: "rgba(168, 85, 247, 0.05)", border: "1px solid rgba(168, 85, 247, 0.2)", borderRadius: 12, padding: 16, display: "flex", gap: 12 }}>
                          <Clock size={18} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
                          <div>
                            <b style={{ fontSize: 13, color: "var(--text-main)" }}>Preparing for packing</b>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Payment verified. Consignment is being compiled at our Dhaka warehouse.</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 12 }}>
                  My Styling & Quality Logs
                </h3>
                {reviews.length === 0 ? (
                  <div style={{ padding: 40, border: "1px dashed var(--border-glass)", borderRadius: 12, textAlign: "center", color: "var(--text-muted)" }}>
                    You haven't posted any styling checks or reviews yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
                    {reviews.map((rev) => (
                      <div key={rev.id} className="review-card" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glass)", borderRadius: 16, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>{rev.product_name}</h4>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Submitted on {new Date(rev.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            {rev.is_approved ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "4px 10px", borderRadius: 30, fontWeight: 700 }}>
                                <ShieldCheck size={12} /> Approved
                              </span>
                            ) : (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", padding: "4px 10px", borderRadius: 30, fontWeight: 700 }}>
                                <AlertCircle size={12} /> Pending Approval
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 2, color: "var(--text-main)", marginBottom: 12 }}>
                          {Array.from({ length: rev.rating }).map((_, idx) => <Star key={idx} size={12} fill="currentColor" />)}
                        </div>

                        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>"{rev.comment}"</p>

                        {rev.images && rev.images.length > 0 && (
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            {rev.images.map((url: string, i: number) => (
                              <div key={i} style={{ width: 50, height: 50, position: "relative", border: "1px solid var(--border-glass)" }}>
                                <Image src={url} alt="fit detail" fill sizes="50px" style={{ objectFit: "cover" }} />
                              </div>
                            ))}
                          </div>
                        )}

                        {!rev.is_approved && (
                          <div style={{ display: "flex", gap: 16, marginTop: 20, borderTop: "1px solid var(--border-glass)", paddingTop: 16, justifyContent: "flex-end" }}>
                            <button 
                              onClick={() => router.push(`/product/${rev.product_slug}?edit_review=true`)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-main)",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                              }}
                            >
                              <Edit size={14} /> Edit Log
                            </button>
                            <button 
                              onClick={() => handleDeleteReview(rev.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "password" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 450, margin: "0 auto" }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 12, textTransform: "uppercase" }}>
                  Reset Password
                </h3>
                {changePwdSuccess && <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)", padding: 12, borderRadius: 12, fontSize: 13, textAlign: "center" }}>{changePwdSuccess}</div>}
                {changePwdError && <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)", padding: 12, borderRadius: 12, fontSize: 13, textAlign: "center" }}>{changePwdError}</div>}
                <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", marginBottom: 6, textTransform: "uppercase" }}>
                      <span>Current Password</span>
                      <a 
                        onClick={(e) => { e.preventDefault(); router.push('/forgot-password'); }} 
                        style={{ color: "var(--text-main)", cursor: "pointer", textDecoration: "underline", textTransform: "none", fontWeight: 600 }}
                      >
                        I can't remember my current password
                      </a>
                    </label>
                    <input
                      type="password"
                      required
                      value={changeCurrentPassword}
                      onChange={(e) => setChangeCurrentPassword(e.target.value)}
                      style={{ width: "100%", background: "#ffffff", border: "1px solid var(--border-glass)", color: "#111", borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>New Password</label>
                    <input
                      type="password"
                      required
                      value={changeNewPassword}
                      onChange={(e) => setChangeNewPassword(e.target.value)}
                      style={{ width: "100%", background: "#ffffff", border: "1px solid var(--border-glass)", color: "#111", borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={changeConfirmPassword}
                      onChange={(e) => setChangeConfirmPassword(e.target.value)}
                      style={{ width: "100%", background: "#ffffff", border: "1px solid var(--border-glass)", color: "#111", borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none" }}
                    />
                  </div>
                  <button type="submit" disabled={changePwdLoading} style={{ background: "var(--text-main)", color: "var(--bg-primary)", border: "none", height: 44, borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase", marginTop: 8 }}>
                    {changePwdLoading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout link/button */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 48 }}>
        <button 
          onClick={async () => {
            try {
              await fetchWithAuth(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/core/logout`, {
                method: "POST"
              });
            } catch (err) {
              console.warn("Logout failed", err);
            }
            localStorage.removeItem("poshplex_access_token");
            localStorage.removeItem("poshplex_user");
            localStorage.removeItem("poshplex_is_impersonating");
            window.location.href = "/login";
          }}
          style={{
            background: "#ffffff",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            color: "#f87171",
            fontSize: 14,
            fontWeight: 800,
            padding: "12px 40px",
            borderRadius: "8px",
            textTransform: "uppercase",
            cursor: "pointer",
            letterSpacing: "1.5px",
            transition: "all 0.2s",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)"; }}
        >
          LOGOUT
        </button>
      </div>

      {/* Inline Modal Editor for Profile */}
      {isEditingProfile && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-glass)",
            borderRadius: 24,
            padding: 32,
            maxWidth: 500,
            width: "90%",
            maxHeight: "90vh",
            overflowY: "auto"
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase" }}>Edit Profile Info</h3>
              <button onClick={() => setIsEditingProfile(false)} style={{ background: "transparent", border: "none", color: "var(--text-main)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Profile Completion</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: profileCompletion === 100 ? "#10b981" : "var(--accent-purple)" }}>{profileCompletion}%</span>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ 
                  height: "100%", 
                  width: `${profileCompletion}%`, 
                  background: profileCompletion === 100 ? "#10b981" : "var(--accent-purple)",
                  transition: "width 0.5s ease" 
                }} />
              </div>
            </div>

            {profSuccessMsg && (
              <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)", padding: 12, borderRadius: 12, textAlign: "center", fontSize: 13, marginBottom: 16 }}>
                {profSuccessMsg}
              </div>
            )}
            {profErrorMsg && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)", padding: 12, borderRadius: 12, textAlign: "center", fontSize: 13, marginBottom: 16 }}>
                {profErrorMsg}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Full Name</label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  style={{ width: "100%", background: "#ffffff", border: "1px solid var(--border-glass)", color: "#111", borderRadius: 8, padding: 10, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Email Address</label>
                <input
                  type="email"
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  style={{ width: "100%", background: "#ffffff", border: "1px solid var(--border-glass)", color: "#111", borderRadius: 8, padding: 10, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Gender</label>
                <select 
                  value={profGender} 
                  onChange={(e) => setProfGender(e.target.value)} 
                  style={{ width: "100%", background: "#ffffff", border: "1px solid var(--border-glass)", color: "#111", borderRadius: 8, padding: 10 }}
                >
                  <option value="unspecified">Unspecified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Date of Birth</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={profBirthYear} onChange={(e) => setProfBirthYear(e.target.value)} style={{ flex: 1.2, padding: 10, background: "#ffffff", border: "1px solid var(--border-glass)", borderRadius: 8, color: "#111" }}>
                    <option value="" disabled>Year</option>
                    {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={profBirthMonth} onChange={(e) => setProfBirthMonth(e.target.value)} style={{ flex: 1.2, padding: 10, background: "#ffffff", border: "1px solid var(--border-glass)", borderRadius: 8, color: "#111" }}>
                    <option value="" disabled>Month</option>
                    {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <select value={profBirthDay} onChange={(e) => setProfBirthDay(e.target.value)} style={{ flex: 1, padding: 10, background: "#ffffff", border: "1px solid var(--border-glass)", borderRadius: 8, color: "#111" }}>
                    <option value="" disabled>Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: 16, marginTop: 8 }}>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: "var(--text-main)", marginBottom: 12, textTransform: "uppercase" }}>Shipping Address</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>District / Division</label>
                    <Select
                      options={districts.map(d => ({ value: d.id, label: d.name }))}
                      value={districts.find(d => String(d.id) === String(selectedDistrict)) ? { value: selectedDistrict, label: districts.find(d => String(d.id) === String(selectedDistrict))?.name } : null}
                      onChange={(selectedOption: any) => {
                        setSelectedDistrict(selectedOption?.value || "");
                        setSelectedThana("");
                      }}
                      isClearable
                      isSearchable
                      placeholder="Search District..."
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderRadius: 8,
                          padding: "2px",
                          borderColor: "var(--border-glass)",
                          boxShadow: "none",
                        }),
                        menu: (base) => ({ ...base, color: "#111" }),
                        singleValue: (base) => ({ ...base, color: "#111" })
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Thana / Area</label>
                    <Select
                      options={thanas.map(t => ({ value: t.id, label: t.name }))}
                      value={thanas.find(t => String(t.id) === String(selectedThana)) ? { value: selectedThana, label: thanas.find(t => String(t.id) === String(selectedThana))?.name } : null}
                      onChange={(selectedOption: any) => setSelectedThana(selectedOption?.value || "")}
                      isDisabled={!selectedDistrict}
                      isClearable
                      isSearchable
                      placeholder="Search Thana / Area..."
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderRadius: 8,
                          padding: "2px",
                          borderColor: "var(--border-glass)",
                          boxShadow: "none",
                        }),
                        menu: (base) => ({ ...base, color: "#111" }),
                        singleValue: (base) => ({ ...base, color: "#111" })
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Street Address</label>
                    <textarea required value={addressText} onChange={(e) => setAddressText(e.target.value)} placeholder="House number, Street name, Area etc." style={{ width: "100%", padding: 10, background: "#ffffff", border: "1px solid var(--border-glass)", borderRadius: 8, color: "#111", minHeight: 60, resize: "vertical" }} />
                  </div>
                </div>
              </div>

              <button type="submit" className="neon-btn" style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, marginTop: 8 }}>
                Save Profile Info
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
