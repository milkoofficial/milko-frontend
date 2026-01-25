'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthResponse, User } from '@/types';
import { userStorage, tokenStorage, adminCookie } from '@/lib/utils/storage';
import { authApi } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (name: string, email: string, password: string) => Promise<AuthResponse>;
  loginWithGoogle: () => Promise<void>;
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

  // Initialize auth state from storage (and from token-only, e.g. after Google OAuth)
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = userStorage.get();
      const token = tokenStorage.get();

      if (token) {
        // Verify token with server and load user (works for email/password and Google OAuth).
        // For Google, we only have token in storage; storedUser is empty until we fetch.
        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
          userStorage.set(currentUser);
          console.log('[AUTH] User verified, role:', currentUser.role);
        } catch (error: any) {
          if (error?.response?.status === 401 || error?.status === 401) {
            console.warn('[AUTH] Token invalid, clearing auth data');
            setUser(null);
            userStorage.remove();
            tokenStorage.remove();
          } else if (storedUser) {
            console.warn('[AUTH] Failed to verify token, using stored user:', error);
            setUser(storedUser);
          }
        }
      } else if (storedUser) {
        userStorage.remove();
        setUser(null);
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // Sync admin cookie for coming-soon middleware: set when logged-in admin, clear otherwise
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isAdmin = user?.role?.toLowerCase() === 'admin';
    if (isAdmin) {
      adminCookie.set();
    } else {
      adminCookie.remove();
    }
  }, [user]);

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

  const loginWithGoogle = async () => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path && path !== '/auth/login' && path !== '/auth/signup') {
      localStorage.setItem('milko_return_after_auth', path);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
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
    loginWithGoogle,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

