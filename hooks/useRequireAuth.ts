'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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
        router.push('/');
      }
    }
  }, [isAdmin, isAuthenticated, loading, router]);

  return { isAdmin, isAuthenticated, loading };
};

