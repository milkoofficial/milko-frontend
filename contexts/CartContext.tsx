'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { cartStorage, CartItem } from '@/lib/utils/cart';
import { trackCartEvent } from '@/lib/api';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variationId?: string) => void;
  setItemQuantity: (productId: string, quantity: number, variationId?: string) => void;
  clearCart: () => void;
  refreshCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const refreshCart = useCallback(() => {
    setItems(cartStorage.get());
  }, []);

  const getCartItemCount = useCallback(() => {
    return cartStorage.get().reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  useEffect(() => {
    refreshCart();
    
    // Listen for storage changes (for cross-tab synchronization)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'milko_cart_v1') {
        refreshCart();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshCart]);

  const addItem = useCallback((item: CartItem) => {
    cartStorage.add(item);
    refreshCart();
    void trackCartEvent({
      eventType: 'add',
      cartItemCount: getCartItemCount(),
      productId: item.productId,
      variationId: item.variationId,
    });
  }, [refreshCart, getCartItemCount]);

  const removeItem = useCallback((productId: string, variationId?: string) => {
    cartStorage.remove(productId, variationId);
    refreshCart();
    void trackCartEvent({
      eventType: 'remove',
      cartItemCount: getCartItemCount(),
      productId,
      variationId,
    });
  }, [refreshCart, getCartItemCount]);

  const setItemQuantity = useCallback((productId: string, quantity: number, variationId?: string) => {
    cartStorage.setQuantity(productId, quantity, variationId);
    refreshCart();
  }, [refreshCart]);

  const clearCart = useCallback(() => {
    cartStorage.clear();
    refreshCart();
    void trackCartEvent({
      eventType: 'clear',
      cartItemCount: 0,
    });
  }, [refreshCart]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        addItem,
        removeItem,
        setItemQuantity,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
