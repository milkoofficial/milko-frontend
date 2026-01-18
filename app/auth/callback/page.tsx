'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { tokenStorage } from '@/lib/utils/storage';

const RETURN_TO_KEY = 'milko_return_after_auth';

/**
 * OAuth callback (e.g. Google). Supabase redirects here after sign-in.
 * We read the session, store the access_token, and redirect. AuthContext
 * will then load the user via /api/auth/me.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          setError('Could not complete sign in. Please try again.');
          return;
        }

        if (!session?.access_token) {
          setError('No session received. Please try again.');
          return;
        }

        tokenStorage.set(session.access_token);

        const returnTo = typeof window !== 'undefined'
          ? localStorage.getItem(RETURN_TO_KEY)
          : null;
        if (typeof window !== 'undefined' && returnTo) {
          localStorage.removeItem(RETURN_TO_KEY);
        }

        const path = (returnTo && returnTo.startsWith('/')) ? returnTo : '/';
        router.replace(path);
      } catch {
        if (mounted) setError('Something went wrong. Please try again.');
      }
    };

    run();
    return () => { mounted = false; };
  }, [router]);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ color: '#c33', marginBottom: '1rem' }}>{error}</p>
        <a
          href="/auth/login"
          style={{
            color: '#0070f3',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Back to Login
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#666',
      }}
    >
      <p>Completing sign in…</p>
    </div>
  );
}
