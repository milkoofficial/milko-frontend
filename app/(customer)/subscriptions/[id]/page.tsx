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

type BadgeVariant = 'active' | 'paused' | 'pending' | 'expired' | 'cancelled' | 'failed' | 'endingSoon';

function getStatusPresentation(
  sub: Subscription,
  completionRatio: number,
): { label: string; variant: BadgeVariant; showTick: boolean } {
  const end = new Date(sub.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDateOnly = new Date(end);
  endDateOnly.setHours(0, 0, 0, 0);
  const isExpiredByDate = endDateOnly < today;
  const isFullyUtilized = completionRatio >= 1;

  if (sub.status === 'cancelled' && !isFullyUtilized) {
    return { label: 'Cancelled', variant: 'cancelled', showTick: false };
  }
  if (sub.status === 'expired' || isExpiredByDate || isFullyUtilized) {
    return { label: 'Expired', variant: 'expired', showTick: false };
  }
  if (completionRatio >= 0.8) {
    return { label: 'Ending Soon', variant: 'endingSoon', showTick: false };
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
  const [showCancelTodayModal, setShowCancelTodayModal] = useState(false);
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);
  const [showRefundBreakup, setShowRefundBreakup] = useState(false);

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
  const subscriptionItemName = subscription.product?.name || 'this item';
  const formatInr = (value: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const start = dateOnly(new Date(subscription.startDate));
  const end = dateOnly(new Date(subscription.endDate));
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);
  // Only delivered (green) days are counted as used for refund calculation.
  const deliveredDays = subscription.deliverySchedules?.filter((d) => d.status === 'delivered').length ?? 0;
  const usedDays = Math.min(totalDays, Math.max(0, deliveredDays));
  const unusedDays = Math.max(0, totalDays - usedDays);
  const completionRatio = totalDays > 0 ? usedDays / totalDays : 0;
  const paid = Number(paidAmount) || 0;
  const unusedAmount = totalDays > 0 ? (paid / totalDays) * unusedDays : 0;
  const unusedAmountInr = formatInr(Math.max(0, unusedAmount));
  const status = getStatusPresentation(subscription, completionRatio);

  const badgeClass = {
    active: styles.statusBadgeActive,
    paused: styles.statusBadgePaused,
    pending: styles.statusBadgePending,
    expired: styles.statusBadgeExpired,
    cancelled: styles.statusBadgeCancelled,
    failed: styles.statusBadgeFailed,
    endingSoon: styles.statusBadgeEndingSoon,
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
          <h2 className={styles.sectionTitle}>
            {subscription.status === 'active' ? "Today's Item to deliver" : 'Product'}
          </h2>
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
          <h2 className={styles.sectionTitle}>Delivery address</h2>
          <div className={styles.deliveryAddressBlock}>
            {subscription.deliveryAddress ? (
              <>
                <p className={styles.deliveryAddressName}>{subscription.deliveryAddress.name}</p>
                <p className={styles.deliveryAddressLine}>{subscription.deliveryAddress.street}</p>
                <p className={styles.deliveryAddressLine}>
                  {subscription.deliveryAddress.city}, {subscription.deliveryAddress.state} {subscription.deliveryAddress.postalCode}
                </p>
                <p className={styles.deliveryAddressLine}>{subscription.deliveryAddress.country}</p>
                {subscription.deliveryAddress.phone ? (
                  <p className={styles.deliveryAddressLine}>Phone: {subscription.deliveryAddress.phone}</p>
                ) : null}
              </>
            ) : (
              <p className={styles.deliveryAddressLine}>No delivery address selected for this subscription.</p>
            )}
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
                onClick={() => {
                  setShowCancelTodayModal(true);
                }}
              >
                <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" stroke="#222222"></circle>
                  <path d="M5 2.80385C4.08789 3.33046 3.33046 4.08788 2.80385 5" stroke="#222222" strokeLinecap="round"></path>
                  <path d="M19 2.80385C19.9121 3.33046 20.6695 4.08788 21.1962 5" stroke="#222222" strokeLinecap="round"></path>
                  <path d="M12 6.5V11.75C12 11.8881 12.1119 12 12.25 12H16.5" stroke="#222222" strokeLinecap="round"></path>
                </svg>
                Cancel Today&apos;s Delivery
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busy}
                onClick={() => {
                  setShowRefundBreakup(false);
                  setShowCancelSubscriptionModal(true);
                }}
              >
                <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor"></circle>
                  <path d="M18 18L6 6" stroke="currentColor"></path>
                </svg>
                Cancel Subscription
              </button>
            </div>
          </section>
        )}

        {showCancelTodayModal && (
          <div
            className={styles.confirmOverlay}
            role="presentation"
            onClick={() => {
              if (!busy) setShowCancelTodayModal(false);
            }}
          >
            <div
              className={styles.confirmModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-today-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.confirmCloseBtn}
                aria-label="Close"
                disabled={busy}
                onClick={() => setShowCancelTodayModal(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className={styles.confirmIconWrap} aria-hidden="true">
                <svg
                  className={styles.confirmIcon}
                  viewBox="0 0 400 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M188.238 150.351C187.902 139.999 187.322 129.445 186.537 119.742" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M257.109 150.174C259.044 139.34 255.208 121.895 257.959 111.239" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M180.222 203.544C205.959 201.513 230.999 205.656 251.643 221.772" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M151.414 94.3317C159.018 93.0218 170.14 79.1169 179.734 81.2152C190.277 83.5213 201.918 93.332 205.241 94.3317" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M257.958 111.24C270.277 105.447 283.635 103.832 297.07 102.737" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M102 266.977C102 237.192 104.574 206.959 120.64 214.927C127.688 218.425 143.844 249.321 146.784 248.487C168.261 242.401 215.933 226.987 221.534 248.487C226.75 268.511 187.6 265.542 187.6 266.977C187.6 268.368 198.161 273.321 197.261 281.36C196.396 289.087 171.478 296.427 179.314 296.427C220.65 296.427 165.143 313.809 146.784 317.549C128.425 321.289 115.772 316.382 102 312.177" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
              </div>
              <h3 id="cancel-today-title" className={styles.confirmTitle}>
                Cancel today&apos;s delivery?
              </h3>
              <p className={styles.confirmText}>
                If you cancel today&apos;s delivery, {subscriptionItemName} will not be delivered today, and your
                subscription will be extended by one day at the end of the current period.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmProceedBtn}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      await subscriptionsApi.cancelToday(subscription.id);
                      setShowCancelTodayModal(false);
                      showToast("Today's delivery cancelled", 'success');
                      await fetchSubscription();
                    } catch (e) {
                      showToast((e as { message?: string })?.message || 'Failed to cancel today', 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Please wait...' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCancelSubscriptionModal && (
          <div
            className={styles.confirmOverlay}
            role="presentation"
            onClick={() => {
              if (!busy) setShowCancelSubscriptionModal(false);
            }}
          >
            <div
              className={`${styles.confirmModal} ${styles.confirmModalScrollable}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-subscription-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.confirmCloseBtn}
                aria-label="Close"
                disabled={busy}
                onClick={() => setShowCancelSubscriptionModal(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className={styles.confirmIconWrap} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.confirmIcon}>
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M303.126 136.208C281.015 132.778 265.08 104.845 246.318 98.0984C244.081 97.2946 232.069 107.635 229.8 109.141C197.375 130.656 162.319 147.633 129.719 168.977C122.439 173.743 85.8024 187.889 83.1465 196.481C82.674 198.014 82.5844 200.212 83.1465 200.322C91.5257 201.965 100.174 208.769 107.257 213.499C111.791 216.526 151.723 247.346 155.006 244.84C189.824 218.255 264.876 166.587 305.77 140.126" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M312.312 160.424C262.454 184.856 195.245 257.231 155.602 278.601C153.826 279.558 139.956 268.042 137.675 266.812C123.434 259.133 110.102 248.85 97.7998 237.996" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M317 184.071C304.217 178.343 169.407 306.551 156.375 300.919C143.344 295.288 116.401 273.745 100.319 261.358" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M188.842 155.443C219.671 118.612 245.085 191.932 193.136 184.294C182.431 182.721 176.52 159.313 184.875 153.304" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M119.806 192.842C125.346 200.295 129.325 195.187 139.627 187.5" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M263.16 144.401C268.505 140.996 264.15 143.816 264.15 137.28" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
              </div>

              <h3 id="cancel-subscription-title" className={styles.confirmTitle}>
                Cancel Subscription?
              </h3>

              <p className={styles.confirmText}>
                If you cancel this subscription, the unused amount will be transferred to your wallet. This wallet
                balance is non-withdrawable, but you can use it to buy another subscription or product.
              </p>
              <p className={styles.confirmTextStrong}>
                Your unused amount is ₹{unusedAmountInr}
              </p>
              <button
                type="button"
                className={styles.breakupToggle}
                onClick={() => setShowRefundBreakup((v) => !v)}
              >
                <span>Show Breakup amount</span>
                <svg
                  className={`${styles.breakupArrow} ${showRefundBreakup ? styles.breakupArrowOpen : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showRefundBreakup && (
                <div className={styles.breakupPanel}>
                  <p className={styles.breakupNote}>
                    Used days are counted only when delivery status is delivered (green).
                  </p>
                  <div className={styles.breakupRow}>
                    <span>Total subscription days</span>
                    <strong>{totalDays}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Used days</span>
                    <strong>{usedDays}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Unused days</span>
                    <strong>{unusedDays}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Total paid amount</span>
                    <strong>₹{formatInr(paid)}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Per day cost</span>
                    <strong>₹{formatInr(totalDays > 0 ? paid / totalDays : 0)}</strong>
                  </div>
                  <div className={`${styles.breakupRow} ${styles.breakupRowTotal}`}>
                    <span>Unused refund amount</span>
                    <strong>₹{unusedAmountInr}</strong>
                  </div>
                </div>
              )}

              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmDangerBtn}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      await subscriptionsApi.cancel(subscription.id);
                      setShowCancelSubscriptionModal(false);
                      showToast('Subscription cancelled', 'success');
                      await fetchSubscription();
                    } catch (e) {
                      showToast((e as { message?: string })?.message || 'Failed to cancel subscription', 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Please wait...' : 'Cancel now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
