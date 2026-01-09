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
 */
export const useRequireAdmin = () => {
  const { isAdmin, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/auth/login');
      } else if (!isAdmin) {
        // If not admin, redirect to customer domain
        // BUT: In localhost, just redirect to home
        if (isAdminDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
          window.location.href = 'https://milko.in';
        } else {
          router.push('/');
        }
      }
    }
  }, [isAdmin, isAuthenticated, loading, router]);

  return { isAdmin, isAuthenticated, loading };
};

