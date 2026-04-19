'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { getCartStorage, CartItem, CartMutationResult } from '@/lib/utils/cart';
import { trackCartEvent } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  addItem: (item: CartItem, maxQuantity?: number) => CartMutationResult;
  removeItem: (productId: string, variationId?: string) => void;
  setItemQuantity: (productId: string, quantity: number, variationId?: string, maxQuantity?: number) => CartMutationResult;
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
  const { user } = useAuth();
  const cart = useMemo(() => getCartStorage(user?.id ?? null), [user?.id]);
  const [items, setItems] = useState<CartItem[]>([]);

  const refreshCart = useCallback(() => {
    setItems(cart.get());
  }, [cart]);

  const getCartItemCount = useCallback(() => {
    return cart.get().reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [cart]);

  useEffect(() => {
    refreshCart();
  }, [cart, refreshCart]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === cart.storageKey || e.key.startsWith('milko_cart_v1')) {
        refreshCart();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [cart, refreshCart]);

  const addItem = useCallback(
    (item: CartItem, maxQuantity?: number) => {
      const result = cart.add(item, maxQuantity);
      refreshCart();
      if (result.appliedQuantity > 0) {
        void trackCartEvent({
          eventType: 'add',
          cartItemCount: getCartItemCount(),
          productId: item.productId,
          variationId: item.variationId,
        });
      }
      return result;
    },
    [cart, refreshCart, getCartItemCount],
  );

  const removeItem = useCallback(
    (productId: string, variationId?: string) => {
      cart.remove(productId, variationId);
      refreshCart();
      void trackCartEvent({
        eventType: 'remove',
        cartItemCount: getCartItemCount(),
        productId,
        variationId,
      });
    },
    [cart, refreshCart, getCartItemCount],
  );

  const setItemQuantity = useCallback(
    (productId: string, quantity: number, variationId?: string, maxQuantity?: number) => {
      const result = cart.setQuantity(productId, quantity, variationId, maxQuantity);
      refreshCart();
      return result;
    },
    [cart, refreshCart],
  );

  const clearCart = useCallback(() => {
    cart.clear();
    refreshCart();
    void trackCartEvent({
      eventType: 'clear',
      cartItemCount: 0,
    });
  }, [cart, refreshCart]);

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
