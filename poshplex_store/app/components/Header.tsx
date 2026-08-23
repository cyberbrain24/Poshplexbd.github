"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Search, Heart, User } from "lucide-react";
import { HeaderCartCounter } from "./HeaderCartCounter";
import { useCart } from "../../context/CartContext";

export default function Header({ categories = [] }: { categories?: any[] }) {
  const { openCart } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);

  // Search states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const isCategoryActive = (cat: any) => {
    if (!pathname) return false;
    const decodedPath = decodeURIComponent(pathname).toLowerCase();
    const catSlug = decodeURIComponent(cat.slug).toLowerCase();
    
    if (decodedPath === `/catalog/${catSlug}`) return true;
    
    if (cat.children && cat.children.length > 0) {
      return cat.children.some((child: any) => {
        const childSlug = decodeURIComponent(child.slug).toLowerCase();
        return decodedPath === `/catalog/${childSlug}`;
      });
    }
    return false;
  };

  // Close menus on route change
  useEffect(() => {
    setHoveredCategory(null);
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(prev => !prev);
    };
    document.addEventListener("toggle-mobile-menu", handleToggle);
    return () => {
      document.removeEventListener("toggle-mobile-menu", handleToggle);
    };
  }, []);

  useEffect(() => {
    const updateWishlistCount = () => {
      try {
        const stored = localStorage.getItem("wishlist");
        if (stored) {
          const list = JSON.parse(stored);
          setWishlistCount(Array.isArray(list) ? list.length : 0);
        } else {
          setWishlistCount(0);
        }
      } catch (e) {
        setWishlistCount(0);
      }
    };
    updateWishlistCount();
    window.addEventListener("wishlist_updated", updateWishlistCount);
    window.addEventListener("storage", (e) => {
      if (e.key === "wishlist") updateWishlistCount();
    });
    return () => {
      window.removeEventListener("wishlist_updated", updateWishlistCount);
      window.removeEventListener("storage", updateWishlistCount);
    };
  }, []);

  // Close category mobile menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
        if (isOpen) {
          const target = e.target as HTMLElement;
          const isCategoryToggle = target.closest(".category-toggle-btn") || target.closest(".mobile-menu-btn");
          if (!target.closest('.mobile-menu-overlay') && !isCategoryToggle) {
            setIsOpen(false);
          }
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`${process.env.INTERNAL_API_URL || process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/catalog/products?search=${encodeURIComponent(searchQuery)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(fetchSearchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <header className="street-header">
      <div style={{ background: "#111116", color: "#ffffff", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", padding: "6px 24px", textAlign: "center" }}>
        BE POSH WITH POSHPLEX
      </div>
      <div className="container header-main-nav-container">
        
        {/* Left: Mobile Hamburger / Desktop hidden */}
        <div className="mobile-menu-btn" style={{ display: "none" }}>
          <button 
            suppressHydrationWarning
            onClick={toggleMenu}
            aria-label="Toggle mobile menu"
            style={{ 
              background: "transparent", 
              border: "none", 
              color: "var(--text-main)", 
              cursor: "pointer", 
              display: "flex", 
              alignItems: "center",
              padding: 0
            }}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Center-Left Logo */}
        <Link 
          href="/" 
          onClick={closeMenu}
          className="header-logo-link"
          style={{ 
            fontSize: 24, 
            fontWeight: 900, 
            color: "var(--text-main)", 
            textDecoration: "none", 
            letterSpacing: "-1.5px" 
          }}
        >
          POSHPLEX
        </Link>
        
        {/* Center: Desktop Navigation Menu */}
        <nav className="desktop-nav">
          {categories.map((cat: any) => {
            const isActive = isCategoryActive(cat);
            const isCatalogPage = pathname && pathname.startsWith("/catalog");

            if (isCatalogPage) {
              return (
                <Link 
                  key={cat.id}
                  href={`/catalog/${cat.slug}`}
                  className={`header-nav-tab ${isActive ? "active" : ""}`}
                >
                  {cat.name}
                </Link>
              );
            } else {
              return (
                <div 
                  key={cat.id} 
                  onMouseEnter={() => setHoveredCategory(cat.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`header-nav-tab ${isActive ? "active" : ""}`}
                  style={{ cursor: "pointer" }}
                >
                  <Link 
                    href={`/catalog/${cat.slug}`} 
                    style={{ 
                      color: "inherit", 
                      textDecoration: "none", 
                      display: "flex", 
                      alignItems: "center", 
                      height: "100%", 
                      width: "100%", 
                      justifyContent: "center" 
                    }}
                  >
                    {cat.name}
                  </Link>
                  
                  {/* Megamenu dropdown */}
                  {hoveredCategory === cat.id && cat.children && cat.children.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      paddingTop: 0,
                      zIndex: 100,
                    }}>
                      <div style={{
                        background: "var(--bg-primary, #ffffff)",
                        border: "1px solid var(--border-glass, #eaeaea)",
                        padding: "32px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 32,
                        boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
                        borderRadius: "8px",
                        whiteSpace: "nowrap"
                      }}>
                      <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
                        {cat.children.map((child: any) => (
                          <Link 
                            key={child.id} 
                            href={`/catalog/${child.slug}`}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textDecoration: "none" }}
                          >
                            <div style={{
                              width: 140,
                              height: 140,
                              position: "relative",
                              borderRadius: 8,
                              overflow: "hidden",
                              background: "#f7f7f7",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1px solid #f0f0f0"
                            }}>
                              {child.image ? (
                                <Image src={child.image} alt={child.name} fill sizes="140px" style={{ objectFit: "cover" }} />
                              ) : (
                                <span style={{ color: "#777", fontSize: 10, textTransform: "uppercase" }}>No Image</span>
                              )}
                            </div>
                            <span style={{ color: "var(--text-main, #333)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>
                              {child.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                      
                      <Link 
                        href={`/catalog/${cat.slug}`}
                        style={{
                          background: "#2d2d2d",
                          color: "#ffffff",
                          padding: "12px 32px",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#2d2d2d")}
                      >
                        VIEW ALL {cat.name} <span>&rarr;</span>
                      </Link>
                    </div>
                    </div>
                  )}
                </div>
              );
            }
          })}
        </nav>
        
        {/* Right Utility Actions */}
        <div className="header-right-utils" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            {isSearchOpen && (
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim() !== '') {
                    setIsSearchOpen(false);
                    router.push(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                autoFocus
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--text-main)",
                  color: "var(--text-main)",
                  outline: "none",
                  padding: "4px 8px",
                  fontSize: 12,
                  width: 150,
                  marginRight: 8
                }}
              />
            )}

            {isSearchOpen && searchQuery.trim() !== "" && (
              <button
                suppressHydrationWarning
                onClick={() => {
                  setIsSearchOpen(false);
                  router.push(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
                }}
                aria-label="Submit Search"
                style={{ background: "transparent", border: "none", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", padding: 0, marginRight: 8 }}
                title="Go to Search Results"
              >
                <Search size={14} />
              </button>
            )}

            <button 
              suppressHydrationWarning
              onClick={() => {
                setIsOpen(false);
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchQuery("");
              }} 
              aria-label="Toggle Search"
              style={{ background: "transparent", border: "none", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
            >
              {isSearchOpen ? <X size={18} /> : <Search size={18} />}
            </button>

            {/* Search Results Dropdown */}
            {isSearchOpen && searchQuery.trim() !== "" && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 16,
                width: 300,
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-glass)",
                borderRadius: 12,
                padding: 16,
                zIndex: 100,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
              }}>
                <h4 style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Search Results</h4>
                {isSearching ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>Searching...</div>
                ) : searchResults.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {searchResults.map(product => {
                      const mainImage = product.images?.find((img: any) => img.is_main) || product.images?.[0];
                      return (
                        <Link 
                          key={product.id} 
                          href={`/product/${product.slug}`}
                          onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
                          style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none" }}
                        >
                          <div style={{ width: 40, height: 40, position: "relative", borderRadius: 6, overflow: "hidden", background: "#222" }}>
                            {mainImage && <Image src={mainImage.url} alt={product.name} fill sizes="40px" style={{ objectFit: "cover" }} />}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{product.name}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>৳{Math.round(product.price || product.base_price)}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No products found.</div>
                )}
              </div>
            )}
          </div>
          <Link href="/wishlist" onClick={closeMenu} aria-label="View Wishlist" style={{ background: "transparent", border: "none", color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", padding: 0, position: "relative" }}>
            <Heart size={18} fill={wishlistCount > 0 ? "#e11d48" : "none"} color={wishlistCount > 0 ? "#e11d48" : "currentColor"} />
            {wishlistCount > 0 && (
              <div style={{ position: "absolute", top: -8, right: -10, background: "#e11d48", color: "#fff", fontSize: 9, fontWeight: 700, height: 16, minWidth: 16, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, padding: "0 4px" }}>
                {wishlistCount}
              </div>
            )}
          </Link>
          <Link href="/profile" className="desktop-only-icon" onClick={closeMenu} style={{ color: "var(--text-main)", display: "flex", alignItems: "center" }}>
            <User size={18} />
          </Link>
          
          {/* Cart Shopping Bag Indicator */}
          <div className="desktop-only-icon" onClick={closeMenu}>
            <HeaderCartCounter />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Dropdown Drawer Overlay */}
      {isOpen && (
        <div 
          className="mobile-menu-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
          style={{
            position: "fixed",
            top: 100,
            left: 0,
            width: "100%",
            height: "calc(100vh - 100px)",
            backgroundColor: "rgba(10, 10, 12, 0.98)",
            backdropFilter: "blur(16px)",
            zIndex: 99,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            animation: "slideIn 0.3s ease",
            padding: "24px 20px",
            overflowY: "auto"
          }}
        >
          {categories.map((cat: any) => (
            <div key={cat.id} style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
              {/* Category Main Header Link */}
              <Link 
                href={`/catalog/${cat.slug}`} 
                onClick={closeMenu}
                style={{ 
                  color: "#ffffff", 
                  textDecoration: "none", 
                  fontSize: 15, 
                  fontWeight: 800, 
                  letterSpacing: "1.5px", 
                  textTransform: "uppercase",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  paddingBottom: 6,
                  textAlign: "right",
                  display: "block",
                  width: "100%"
                }}
              >
                {cat.name}
              </Link>
              
              {/* Grid list of Subcategories with Images */}
              {cat.children && cat.children.length > 0 && (
                <div 
                  style={{ 
                    display: "flex", 
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: "16px 8px", 
                    paddingBottom: 8
                  }} 
                  className="mobile-menu-subcategories"
                >
                  {cat.children.map((child: any) => (
                    <Link
                      key={child.id}
                      href={`/catalog/${child.slug}`}
                      onClick={closeMenu}
                      style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        gap: 6, 
                        textDecoration: "none",
                        width: "calc(20% - 6.4px)" 
                      }}
                    >
                      <div style={{
                        width: "100%",
                        aspectRatio: "1/1",
                        borderRadius: 4,
                        overflow: "hidden",
                        background: "#222",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        position: "relative"
                      }}>
                        {child.image ? (
                          <Image src={child.image} alt={child.name} fill sizes="(max-width: 768px) 20vw, 72px" style={{ objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#666", fontSize: 8, textTransform: "uppercase", fontWeight: 700 }}>Street</span>
                        )}
                      </div>
                      <span style={{ 
                        color: "#ccc", 
                        fontSize: 9, 
                        fontWeight: 700, 
                        textTransform: "uppercase", 
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        width: "100%" 
                      }}>
                        {child.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .header-main-nav-container {
          height: 72px;
          padding: 0 24px !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .desktop-nav {
          display: flex;
          gap: 16px;
          align-self: stretch;
          height: 100%;
          align-items: center;
        }

        .header-nav-tab {
          position: relative;
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 32px;
          color: var(--text-main);
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .header-nav-tab:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.04);
        }

        .header-nav-tab.active {
          background: #2f2f2f !important;
          color: #ffffff !important;
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          margin-top: 6px;
          margin-bottom: -1px;
          height: calc(100% - 5px);
          z-index: 2;
        }
        
        .mobile-menu-subcategories::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 768px) {
          .header-main-nav-container {
            min-height: 48px !important;
            height: 48px !important;
            padding: 6px 16px !important;
          }
          .header-right-utils {
            order: -1;
          }
          .header-logo-link {
            order: 0;
            font-size: 20px !important;
          }
          .mobile-menu-btn {
            order: 1;
          }
          .mobile-menu-overlay {
            top: 74px !important;
            height: calc(100vh - 74px) !important;
          }
        }
      ` }} />
    </header>
  );
}
