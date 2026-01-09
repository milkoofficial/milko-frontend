'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthResponse, User } from '@/types';
import { userStorage, tokenStorage } from '@/lib/utils/storage';
import { authApi } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (name: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = userStorage.get();
      const token = tokenStorage.get();

      if (storedUser && token) {
        // Use stored user immediately (don't wait for API call)
        setUser(storedUser);
        
        // Then verify token in background and update if needed
        // But don't clear storage if it fails - use stored user as fallback
        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
          userStorage.set(currentUser); // Update storage with fresh data
        } catch (error) {
          // Token might be invalid, but keep using stored user
          // Only clear if it's a 401 (unauthorized) error
          console.warn('[AUTH] Failed to verify token, using stored user:', error);
          // Don't clear storage - let user stay logged in with stored data
          // If token is truly invalid, API calls will fail and handle it
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setUser(response.user);
    
    // Always refresh user data from database to get correct role
    // This ensures we have the latest role even if login response had stale data
    let finalUser = response.user;
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      userStorage.set(currentUser);
      finalUser = currentUser;
      console.log('[AUTH] User data refreshed from database, role:', currentUser.role);
    } catch (error) {
      console.warn('[AUTH] Failed to refresh user data, using login response:', error);
      // Continue with login response user data
    }
    
    return { ...response, user: finalUser }; // Return updated user
  };

  const signup = async (name: string, email: string, password: string) => {
    const response = await authApi.signup(name, email, password);
    setUser(response.user);
    return response; // Return response for redirect logic
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      userStorage.set(currentUser);
    } catch (error) {
      // If refresh fails, user might be logged out
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role?.toLowerCase() === 'admin', // Case-insensitive comparison
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

