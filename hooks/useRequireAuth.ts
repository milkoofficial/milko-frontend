'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminDomain } from '@/lib/utils/domain';

/**
 * Hook to protect routes - redirects to login if not authenticated
 */
export const useRequireAuth = () => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  return { isAuthenticated, loading };
};

/**
 * Hook to protect admin routes - redirects to home if not admin
 * CRITICAL SECURITY: This is the main protection against unauthorized admin access
 */
export const useRequireAdmin = () => {
  const { isAdmin, isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // SECURITY: Check authentication first
      if (!isAuthenticated || !user) {
        console.warn('[SECURITY] Unauthenticated access attempt to admin route');
        router.push('/auth/login');
        return;
      }

      // SECURITY: Double-check role from user object (don't trust isAdmin alone)
      const userRole = user?.role?.toLowerCase();
      const isActuallyAdmin = userRole === 'admin';
      
      if (!isActuallyAdmin || !isAdmin) {
        // Log security attempt for monitoring
        console.warn('[SECURITY] Non-admin user attempted to access admin panel:', {
          userId: user?.id,
          email: user?.email,
          role: user?.role,
          isAdmin: isAdmin,
          isActuallyAdmin: isActuallyAdmin,
          timestamp: new Date().toISOString()
        });
        
        // If not admin, redirect to customer domain
        // BUT: In localhost, just redirect to home
        if (isAdminDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
          window.location.href = 'https://milko.in';
        } else {
          router.push('/');
        }
      }
    }
  }, [isAdmin, isAuthenticated, loading, router, user]);

  return { isAdmin, isAuthenticated, loading };
};

