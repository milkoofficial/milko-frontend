'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { subscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import styles from './page.module.css';

type CalendarCell = {
  date: Date;
  inMonth: boolean;
  inSubscriptionRange: boolean;
  isToday: boolean;
};

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCalendarDayClassName(
  cell: CalendarCell,
  dateRange: { start: Date; end: Date },
  scheduleByDate: Map<string, 'pending' | 'delivered' | 'skipped' | 'cancelled'>,
  pausedDateSet: Set<string>,
  css: {
    dayCell: string;
    dayMuted: string;
    dayOutOfRange: string;
    dayDelivered: string;
    dayPending: string;
    dayCancelled: string;
    dayPaused: string;
    dayToday: string;
  },
): string {
  const parts: string[] = [css.dayCell];
  if (!cell.inMonth) {
    parts.push(css.dayMuted);
    return parts.join(' ');
  }

  const currentOnly = dateOnly(cell.date);
  const key = formatDateKey(cell.date);
  const inRange = currentOnly >= dateRange.start && currentOnly <= dateRange.end;

  if (!inRange) {
    parts.push(css.dayOutOfRange);
    if (cell.isToday) parts.push(css.dayToday);
    return parts.join(' ');
  }

  const st = scheduleByDate.get(key);
  if (st === 'delivered') {
    parts.push(css.dayDelivered);
  } else if (st === 'cancelled' || st === 'skipped') {
    parts.push(css.dayCancelled);
  } else if (st === 'pending') {
    parts.push(css.dayPending);
  } else if (pausedDateSet.has(key)) {
    parts.push(css.dayPaused);
  } else {
    parts.push(css.dayPending);
  }

  if (cell.isToday) parts.push(css.dayToday);
  return parts.join(' ');
}

function fmtFullDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
}

function startOfMonth(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), 1);
}

function dateOnly(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), input.getDate());
}

function addDays(input: Date, days: number) {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

function buildCalendarCells(month: Date, rangeStart: Date, rangeEnd: Date): CalendarCell[] {
  const firstDay = startOfMonth(month);
  const weekStartsOn = 0;
  const gridStart = addDays(firstDay, -(firstDay.getDay() - weekStartsOn + 7) % 7);
  const today = dateOnly(new Date());
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const current = addDays(gridStart, i);
    const currentOnly = dateOnly(current);
    cells.push({
      date: current,
      inMonth: current.getMonth() === month.getMonth(),
      inSubscriptionRange: currentOnly >= rangeStart && currentOnly <= rangeEnd,
      isToday: currentOnly.getTime() === today.getTime(),
    });
  }

  return cells;
}

type BadgeVariant = 'active' | 'paused' | 'pending' | 'expired' | 'cancelled' | 'failed';

function getStatusPresentation(sub: Subscription): { label: string; variant: BadgeVariant; showTick: boolean } {
  const end = new Date(sub.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDateOnly = new Date(end);
  endDateOnly.setHours(0, 0, 0, 0);
  const isExpiredByDate = endDateOnly < today;

  if (sub.status === 'cancelled') {
    return { label: 'Cancelled', variant: 'cancelled', showTick: false };
  }
  if (sub.status === 'expired' || isExpiredByDate) {
    return { label: 'Expired', variant: 'expired', showTick: false };
  }
  if (sub.status === 'paused') {
    return { label: 'Paused', variant: 'paused', showTick: false };
  }
  if (sub.status === 'pending') {
    return { label: 'Pending', variant: 'pending', showTick: false };
  }
  if (sub.status === 'failed') {
    return { label: 'Failed', variant: 'failed', showTick: false };
  }
  return { label: 'Active', variant: 'active', showTick: true };
}

export default function SubscriptionDetailsPage() {
  const params = useParams();
  const subscriptionId = params?.id as string;
  const { showToast } = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchSubscription = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError('');
    try {
      const data = await subscriptionsApi.getById(subscriptionId);
      setSubscription(data);
    } catch (e) {
      const message = (e as { message?: string })?.message || 'Failed to load subscription details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const dateRange = useMemo(() => {
    if (!subscription) return null;
    return {
      start: dateOnly(new Date(subscription.startDate)),
      end: dateOnly(new Date(subscription.endDate)),
    };
  }, [subscription]);

  const calendarMonths = useMemo(() => {
    if (!dateRange) return [];
    const startMonth = startOfMonth(dateRange.start);
    const endMonth = startOfMonth(dateRange.end);
    if (
      startMonth.getFullYear() === endMonth.getFullYear()
      && startMonth.getMonth() === endMonth.getMonth()
    ) {
      return [startMonth];
    }
    return [startMonth, endMonth];
  }, [dateRange]);

  const scheduleByDate = useMemo(() => {
    const m = new Map<string, 'pending' | 'delivered' | 'skipped' | 'cancelled'>();
    subscription?.deliverySchedules?.forEach((s) => {
      m.set(s.deliveryDate, s.status);
    });
    return m;
  }, [subscription]);

  const pausedDateSet = useMemo(
    () => new Set(subscription?.pausedDates ?? []),
    [subscription],
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loading}>Loading subscription details...</div>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className={styles.container}>
        <div className={styles.stateInner}>
          <div className={styles.error}>{error || 'Subscription not found'}</div>
          <Link href="/subscriptions" className={styles.backLink}>← Back to subscriptions</Link>
        </div>
      </div>
    );
  }

  const orderId = subscription.razorpaySubscriptionId || subscription.id;
  const paidAmount = subscription.totalAmountPaid ?? subscription.totalAmount ?? 0;
  const canManage = subscription.status === 'active' || subscription.status === 'paused';
  const autoPayConnected = Boolean(subscription.razorpaySubscriptionId);
  const status = getStatusPresentation(subscription);

  const badgeClass = {
    active: styles.statusBadgeActive,
    paused: styles.statusBadgePaused,
    pending: styles.statusBadgePending,
    expired: styles.statusBadgeExpired,
    cancelled: styles.statusBadgeCancelled,
    failed: styles.statusBadgeFailed,
  }[status.variant];

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>{subscription.product?.name || 'Subscription'}</h1>
          <div className={`${styles.statusBadge} ${badgeClass}`}>
            {status.showTick && (
              <svg className={styles.statusBadgeTick} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path fillRule="evenodd" clipRule="evenodd" d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="currentColor" />
              </svg>
            )}
            {status.label}
          </div>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaText}>
            {subscription.litresPerDay}L/day
          </span>
          <span className={styles.metaMuted}>
            {' • '}
            Ends {fmtFullDate(subscription.endDate)}
            {' • '}
            ₹{Number(paidAmount).toFixed(2)}
          </span>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Product</h2>
          <div className={styles.productRow}>
            <div className={styles.productThumb}>
              {subscription.product?.imageUrl ? (
                <img src={subscription.product.imageUrl} alt="" />
              ) : (
                <span className={styles.productThumbPlaceholder} aria-hidden>🥛</span>
              )}
            </div>
            <div>
              <p className={styles.productBlockName}>{subscription.product?.name || 'Product'}</p>
              <p className={styles.productBlockMeta}>
                {subscription.litresPerDay}L/day • Delivery {subscription.deliveryTime}
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Subscription details</h2>
          <div className={styles.detailsGrid}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Delivery start</span>
              <span className={styles.detailValue}>{fmtFullDate(subscription.startDate)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Expiry</span>
              <span className={styles.detailValue}>{fmtFullDate(subscription.endDate)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Purchased / renewed</span>
              <span className={styles.detailValue}>{fmtFullDate(subscription.purchasedAt || subscription.createdAt)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Delivery time</span>
              <span className={styles.detailValue}>{subscription.deliveryTime}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order ID</span>
              <button
                type="button"
                className={styles.copyValueBtn}
                onClick={() => {
                  navigator.clipboard.writeText(String(orderId)).then(() => showToast('Copied!', 'success')).catch(() => {});
                }}
              >
                {orderId}
              </button>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Total paid</span>
              <span className={styles.detailValue}>₹{Number(paidAmount).toFixed(2)}</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Delivery calendar</h2>
          <div className={styles.calendarHint} role="list" aria-label="Calendar legend">
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotDelivered}`} aria-hidden />
              Delivered
            </span>
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotScheduled}`} aria-hidden />
              Scheduled
            </span>
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotCancelled}`} aria-hidden />
              Cancelled / skipped
            </span>
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotPaused}`} aria-hidden />
              Paused day
            </span>
          </div>
          <div className={styles.calendarList}>
            {dateRange && calendarMonths.map((month) => {
              const cells = buildCalendarCells(month, dateRange.start, dateRange.end);
              return (
                <div key={`${month.getFullYear()}-${month.getMonth()}`} className={styles.calendarCard}>
                  <div className={styles.calendarMonth}>
                    {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </div>
                  <div className={styles.weekLabels}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className={styles.calendarGrid}>
                    {cells.map((cell) => (
                      <div
                        key={cell.date.toISOString()}
                        className={getCalendarDayClassName(
                          cell,
                          dateRange,
                          scheduleByDate,
                          pausedDateSet,
                          {
                            dayCell: styles.dayCell,
                            dayMuted: styles.dayMuted,
                            dayOutOfRange: styles.dayOutOfRange,
                            dayDelivered: styles.dayDelivered,
                            dayPending: styles.dayPending,
                            dayCancelled: styles.dayCancelled,
                            dayPaused: styles.dayPaused,
                            dayToday: styles.dayToday,
                          },
                        )}
                        title={
                          cell.inMonth && cell.inSubscriptionRange
                            ? (() => {
                                const k = formatDateKey(cell.date);
                                const st = scheduleByDate.get(k);
                                if (st === 'delivered') return 'Delivered';
                                if (st === 'cancelled' || st === 'skipped') return 'Delivery cancelled / skipped';
                                if (st === 'pending') return 'Scheduled (not delivered yet)';
                                if (pausedDateSet.has(k)) return 'Paused (no delivery)';
                                return 'Scheduled';
                              })()
                            : undefined
                        }
                      >
                        {cell.date.getDate()}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>AutoPay (Razorpay)</h2>
          <p className={styles.autoPayText}>
            {autoPayConnected
              ? 'AutoPay reference is linked for this subscription.'
              : 'AutoPay is not linked yet for this subscription.'}
          </p>
          <div className={styles.autoPayActions}>
            <a
              href="https://razorpay.com/"
              target="_blank"
              rel="noreferrer"
              className={styles.autoPayButton}
            >
              Set AutoPay with Razorpay
            </a>
          </div>
        </section>

        {canManage && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Manage</h2>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy}
                onClick={async () => {
                  try {
                    setBusy(true);
                    await subscriptionsApi.cancelToday(subscription.id);
                    showToast("Today's delivery cancelled", 'success');
                    await fetchSubscription();
                  } catch (e) {
                    showToast((e as { message?: string })?.message || 'Failed to cancel today', 'error');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel Today&apos;s Delivery
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busy}
                onClick={async () => {
                  try {
                    setBusy(true);
                    await subscriptionsApi.cancel(subscription.id);
                    showToast('Subscription cancelled', 'success');
                    await fetchSubscription();
                  } catch (e) {
                    showToast((e as { message?: string })?.message || 'Failed to cancel subscription', 'error');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel Subscription
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
