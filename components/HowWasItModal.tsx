'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import styles from './HowWasItModal.module.css';

type OrderForRating = { id: string; items?: { productId?: number | null }[] };

interface HowWasItModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderForRating | null;
  onSubmitSuccess: (qualityStars: number) => void;
}

const STAR_LABELS = [
  'Quality of the product',
  'Delivery agent behaviour',
  'On time delivery',
  'Value for money',
] as const;

const WO_OPTIONS = ['Yes', 'Maybe', 'No'] as const;

export default function HowWasItModal({ isOpen, onClose, order, onSubmitSuccess }: HowWasItModalProps) {
  const { showToast } = useToast();
  const [qualityStars, setQualityStars] = useState(0);
  const [deliveryAgentStars, setDeliveryAgentStars] = useState(0);
  const [onTimeStars, setOnTimeStars] = useState(0);
  const [valueForMoneyStars, setValueForMoneyStars] = useState(0);
  const [wouldOrderAgain, setWouldOrderAgain] = useState<'Yes' | 'Maybe' | 'No' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setQualityStars(0);
    setDeliveryAgentStars(0);
    setOnTimeStars(0);
    setValueForMoneyStars(0);
    setWouldOrderAgain(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!order?.id) return;
    if (qualityStars < 1 || qualityStars > 5 || deliveryAgentStars < 1 || deliveryAgentStars > 5 ||
        onTimeStars < 1 || onTimeStars > 5 || valueForMoneyStars < 1 || valueForMoneyStars > 5 ||
        !wouldOrderAgain) {
      showToast('Please rate all sections and choose Would you order again', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiClient.post<{ qualityStars: number }>(
        `/api/orders/${order.id}/detailed-feedback`,
        {
          qualityStars,
          deliveryAgentStars,
          onTimeStars,
          valueForMoneyStars,
          wouldOrderAgain,
        }
      );
      showToast('Thank you for your feedback!', 'success');
      onSubmitSuccess(data?.qualityStars ?? qualityStars);
      handleClose();
    } catch (e: unknown) {
      const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message?: string }).message) : 'Failed to submit';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const StarRow = (
    { value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }
  ) => (
    <div className={styles.starRow}>
      <div className={styles.subTitle}>{label}</div>
      <div className={styles.stars} role="group" aria-label={`${label}, ${value} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.star} ${value >= n ? styles.starActive : ''}`}
            onClick={() => onChange(n)}
            aria-pressed={value >= n}
            aria-label={`${n} star`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">×</button>
        <h2 className={styles.title}>How was it?</h2>

        {StarRow({ value: qualityStars, onChange: setQualityStars, label: 'Quality of the product' })}
        {StarRow({ value: deliveryAgentStars, onChange: setDeliveryAgentStars, label: 'Delivery agent behaviour' })}
        {StarRow({ value: onTimeStars, onChange: setOnTimeStars, label: 'On time delivery' })}
        {StarRow({ value: valueForMoneyStars, onChange: setValueForMoneyStars, label: 'Value for money' })}

        <div className={styles.starRow}>
          <div className={styles.subTitle}>Would you order again</div>
          <div className={styles.woRow} role="group" aria-label="Would you order again">
            {WO_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                className={`${styles.woBtn} ${wouldOrderAgain === o ? styles.woBtnActive : ''}`}
                onClick={() => setWouldOrderAgain(o)}
                aria-pressed={wouldOrderAgain === o}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
