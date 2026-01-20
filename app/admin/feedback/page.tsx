'use client';

import { useEffect, useState } from 'react';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type FeedbackStats = {
  least: number;
  neutral: number;
  most: number;
  total: number;
  leastPct: number;
  neutralPct: number;
  mostPct: number;
};

/**
 * Admin Feedback Page
 * Shows emoji feedback counts and percentages (Least likely, Neutral, Most likely)
 */
export default function AdminFeedbackPage() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient.get<FeedbackStats>('/api/admin/feedback');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch feedback:', error);
        showToast((error as { message?: string })?.message || 'Failed to fetch feedback', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [showToast]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
      }}>
        <LoadingSpinnerWithText text="Loading feedback..." />
      </div>
    );
  }

  const s = stats || {
    least: 0, neutral: 0, most: 0, total: 0,
    leastPct: 0, neutralPct: 0, mostPct: 0,
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 className={adminStyles.adminPageTitle}>Feedback</h1>
      <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '2rem' }}>
        How likely are customers to recommend you? (From delivered order feedback)
      </p>

      <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>😔</span>
            <strong>Least likely</strong>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c' }}>{s.least}</div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{s.leastPct}%</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>😐</span>
            <strong>Neutral</strong>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#475569' }}>{s.neutral}</div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{s.neutralPct}%</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>😊</span>
            <strong>Most likely</strong>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>{s.most}</div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{s.mostPct}%</div>
        </div>
      </div>

      <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.9rem', color: '#475569' }}>
        <strong>Total responses:</strong> {s.total}
      </div>
    </div>
  );
}
