"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  attributes: Record<string, any>;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (sku: string) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  /* drawer */
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /* toast */
  toastItem: CartItem | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastItem, setToastItem] = useState<CartItem | null>(null);

  // Load cart from localStorage upon mount
  useEffect(() => {
    const savedCart = localStorage.getItem("poshplex_cart");
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch { localStorage.removeItem("poshplex_cart"); }
    }
    setIsLoaded(true);
  }, []);

  // Save cart changes to localStorage
  useEffect(() => {
    if (isLoaded) localStorage.setItem("poshplex_cart", JSON.stringify(cart));
  }, [cart, isLoaded]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.sku === item.sku);
      if (existing) return prev.map((i) => i.sku === item.sku ? { ...i, quantity: i.quantity + item.quantity } : i);
      return [...prev, item];
    });
    // Show toast then open drawer
    setToastItem(item);
    setTimeout(() => setToastItem(null), 3000);
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((sku: string) => {
    setCart((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const updateQuantity = useCallback((sku: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.sku !== sku));
      return;
    }
    setCart((prev) => prev.map((i) => i.sku === sku ? { ...i, quantity } : i));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  const cartCount = cart.reduce((t, i) => t + i.quantity, 0);
  const cartTotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, updateQuantity, clearCart,
      cartCount, cartTotal,
      isCartOpen, openCart, closeCart,
      toastItem,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside a CartProvider");
  return context;
};
