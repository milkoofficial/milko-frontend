'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { authApi } from '@/lib/api';
import { tokenStorage } from '@/lib/utils/storage';

const RETURN_TO_KEY = 'milko_return_after_auth';

declare global {
  interface Window {
    onNativeGoogleLoginSuccess?: (idToken: string, returnTo?: string) => Promise<void>;
    onNativeGoogleLoginError?: (message?: string) => void;
  }
}

export default function NativeGoogleBridge() {
  useEffect(() => {
    window.onNativeGoogleLoginSuccess = async (idToken: string, returnTo?: string) => {
      try {
        if (!idToken) throw new Error('Missing Google idToken');

        const redirectPath =
          typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/';
        localStorage.setItem(RETURN_TO_KEY, redirectPath);

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('No Supabase session after Google token sign-in');

        try {
          const exchangeResult = await authApi.exchangeToken(accessToken);
          tokenStorage.set(exchangeResult.token);
        } catch {
          tokenStorage.set(accessToken);
        }

        window.location.href = redirectPath;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Native Google login could not be completed.';
        console.error('[NATIVE_GOOGLE_BRIDGE]', message);
        if (typeof window.onNativeGoogleLoginError === 'function') {
          window.onNativeGoogleLoginError(message);
        }
      }
    };

    return () => {
      delete window.onNativeGoogleLoginSuccess;
    };
  }, []);

  return null;
}
