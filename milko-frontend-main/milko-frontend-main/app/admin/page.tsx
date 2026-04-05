'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminSubscriptionsApi, adminProductsApi } from '@/lib/api';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { Subscription, Product, User } from '@/types';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from './dashboard.module.css';
import adminStyles from './admin-styles.module.css';

interface DashboardStats {
  totalSales: number;
  totalSalesChange: number;
  orders: number;
  ordersChange: number;
  averageOrderValue: number;
  averageOrderValueChange: number;
  returningCustomers: number;
  returningCustomersChange: number;
  cartAbandonment: number;
  cartAbandonmentChange: number;
  productViews: number;
  productViewsChange: number;
}

interface CustomerInsight {
  newCustomers: number;
  vipCustomers: number;
  totalCustomers: number;
}

interface TopCustomer {
  id: string;
  name: string;
  email: string;
  orders: number;
  totalSpent: number;
  avatar?: string;
}

interface SalesData {
  date: string;
  sales: number;
}

function formatDashboardInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function productForSubscription(products: Product[], productId: string | number | undefined) {
  if (productId == null) return undefined;
  const id = String(productId);
  return products.find((p) => String(p.id) === id);
}

function removeRedundantPendingSubscriptions(subscriptions: Subscription[]): Subscription[] {
  const activeKeys = new Set(
    subscriptions
      .filter((s) => s.status === 'active')
      .map((s) => `${s.userId}::${s.productId}`),
  );

  return subscriptions.filter((s) => {
    if (s.status !== 'pending') return true;
    return !activeKeys.has(`${s.userId}::${s.productId}`);
  });
}

/**
 * Admin Dashboard
 * Comprehensive overview with metrics, charts, and insights
 */
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [customerInsights, setCustomerInsights] = useState<CustomerInsight | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [customerRetention, setCustomerRetention] = useState(0);
  const [retentionChange, setRetentionChange] = useState(0);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [subscriptionsData, setSubscriptionsData] = useState<Subscription[]>([]);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [activeMemberships, setActiveMemberships] = useState(0);
  const [expiredMemberships, setExpiredMemberships] = useState(0);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [hoverBarIndex, setHoverBarIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const newSalesData = generateSalesData(subscriptionsData, productsData, chartPeriod);
    setSalesData(newSalesData);
    setSelectedBarIndex(null);
    setHoverBarIndex(null);
  }, [chartPeriod, subscriptionsData, productsData]);
  const [floatTip, setFloatTip] = useState<{
    left: number;
    top: number;
    transform: string;
    label: string;
  } | null>(null);
  const [tooltipPortalReady, setTooltipPortalReady] = useState(false);
  const chartBarsRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  useEffect(() => setTooltipPortalReady(true), []);

  const activeBarIndex = hoverBarIndex !== null ? hoverBarIndex : selectedBarIndex;

  const updateFloatTipPosition = useCallback(() => {
    if (activeBarIndex === null) {
      setFloatTip(null);
      return;
    }
    const barEl = barRefs.current.get(activeBarIndex);
    const row = salesData[activeBarIndex];
    if (!barEl || !row) {
      setFloatTip(null);
      return;
    }
    const rect = barEl.getBoundingClientRect();
    const label = formatDashboardInr(row.sales);
    const gutter = 8;
    const minTop = 6;
    const estHeight = 40;
    const spaceAbove = rect.top - minTop;
    const placeAbove = spaceAbove >= estHeight + gutter;
    const left = rect.left + rect.width / 2;
    if (placeAbove) {
      setFloatTip({
        left,
        top: rect.top - gutter,
        transform: 'translate(-50%, -100%)',
        label,
      });
    } else {
      setFloatTip({
        left,
        top: rect.bottom + gutter,
        transform: 'translate(-50%, 0)',
        label,
      });
    }
  }, [activeBarIndex, salesData]);

  useLayoutEffect(() => {
    updateFloatTipPosition();
  }, [updateFloatTipPosition]);

  useEffect(() => {
    if (activeBarIndex === null) return;
    const run = () => updateFloatTipPosition();
    window.addEventListener('scroll', run, true);
    window.addEventListener('resize', run);
    const el = chartBarsRef.current;
    el?.addEventListener('scroll', run, { passive: true });
    return () => {
      window.removeEventListener('scroll', run, true);
      window.removeEventListener('resize', run);
      el?.removeEventListener('scroll', run);
    };
  }, [activeBarIndex, updateFloatTipPosition]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [subscriptionsRes, productsRes, usersRes, cartAbandonmentRes] = await Promise.all([
        adminSubscriptionsApi.getAll().catch(() => []),
        adminProductsApi.getAll().catch(() => []),
        apiClient.getInstance().get<{ success: boolean; data: User[] }>(API_ENDPOINTS.ADMIN.USERS.LIST).catch(() => ({ data: { data: [] } })),
        apiClient.get<{ since: string; sessionsWithAdd: number; abandonedSessions: number; abandonmentRatePercent: number }>(
          '/admin/analytics/cart-abandonment?days=30'
        ).catch(() => ({
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          sessionsWithAdd: 0,
          abandonedSessions: 0,
          abandonmentRatePercent: 0,
        })),
      ]);

      const subscriptions: Subscription[] = removeRedundantPendingSubscriptions(subscriptionsRes || []);
      const products: Product[] = productsRes || [];
      const users: User[] = Array.isArray(usersRes.data.data) ? usersRes.data.data : [];

      // Calculate metrics
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      const totalSales = activeSubscriptions.reduce((sum, sub) => {
        const product = productForSubscription(products, sub.productId);
        if (product) {
          const dailyCost = (Number(product.pricePerLitre) || 0) * sub.litresPerDay;
          const monthlyCost = dailyCost * 30;
          return sum + (monthlyCost * sub.durationMonths);
        }
        return sum;
      }, 0);

      const orders = subscriptions.length;
      const averageOrderValue = orders > 0 ? totalSales / orders : 0;

      // Calculate returning customers (users with more than 1 subscription)
      const userSubscriptionCounts = subscriptions.reduce((acc, sub) => {
        acc[sub.userId] = (acc[sub.userId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const returningCustomersCount = Object.values(userSubscriptionCounts).filter(count => count > 1).length;
      const returningCustomersPercent = users.length > 0 ? (returningCustomersCount / users.length) * 100 : 0;

      // Customer insights
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const newCustomers = users.filter(u => new Date(u.createdAt) >= oneWeekAgo).length;
      
      // Membership customers (users with active subscriptions)
      const membershipCustomers = activeSubscriptions.length;

      // Top customers by subscription count
      const topCustomersData: TopCustomer[] = Object.entries(userSubscriptionCounts)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 3)
        .map(([userId, count]) => {
          const user = users.find(u => u.id === userId);
          if (!user) return null;
          const userSubs = subscriptions.filter(s => s.userId === userId);
          const userTotal = userSubs.reduce((sum, sub) => {
            const product = productForSubscription(products, sub.productId);
            if (product) {
              const dailyCost = (Number(product.pricePerLitre) || 0) * sub.litresPerDay;
              const monthlyCost = dailyCost * 30;
              return sum + (monthlyCost * sub.durationMonths);
            }
            return sum;
          }, 0);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            orders: count,
            totalSpent: userTotal,
          };
        })
        .filter(Boolean) as TopCustomer[];

      // Customer retention (simplified - users with active subscriptions)
      const activeUsers = new Set(activeSubscriptions.map(s => s.userId));
      const retentionPercent = users.length > 0 ? (activeUsers.size / users.length) * 100 : 0;

      // Store data for chart recalculation
      setSubscriptionsData(subscriptions);
      setProductsData(products);

      // Generate sales data for chart
      const salesChartData = generateSalesData(subscriptions, products, chartPeriod);

      // Set state
      setStats({
        totalSales,
        totalSalesChange: 12.5, // Placeholder - would need historical data
        orders,
        ordersChange: 8.2,
        averageOrderValue,
        averageOrderValueChange: 3.1,
        returningCustomers: Math.round(returningCustomersPercent),
        returningCustomersChange: 2.4,
        cartAbandonment: Number(cartAbandonmentRes?.abandonmentRatePercent ?? 0),
        cartAbandonmentChange: 0,
        productViews: 45210, // Placeholder
        productViewsChange: 15.3,
      });

      setCustomerInsights({
        newCustomers,
        vipCustomers: membershipCustomers,
        totalCustomers: users.length,
      });

      // Count active memberships
      setActiveMemberships(activeSubscriptions.length);
      setExpiredMemberships(subscriptions.filter((s) => s.status === 'expired').length);

      setTopCustomers(topCustomersData);
      setCustomerRetention(Math.round(retentionPercent));
      setRetentionChange(2.4); // Placeholder
      setSalesData(salesChartData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSalesData = (
    subscriptions: Subscription[],
    products: Product[],
    period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  ): SalesData[] => {
    const data: SalesData[] = [];
    const now = new Date();

    const calcSubscriptionSales = (subs: Subscription[]) => {
      return subs.reduce((sum, sub) => {
        const product = productForSubscription(products, sub.productId);
        if (product) {
          const dailyCost = (Number(product.pricePerLitre) || 0) * sub.litresPerDay;
          const monthlyCost = dailyCost * 30;
          const months = Number(sub.durationMonths) || 0;
          return sum + monthlyCost * months;
        }
        return sum;
      }, 0);
    };

    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    // Monday-based week start (local time)
    const startOfWeek = (d: Date) => {
      const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const day = date.getDay(); // 0 Sun .. 6 Sat
      const diff = (day + 6) % 7; // Monday=0 ... Sunday=6
      date.setDate(date.getDate() - diff);
      return date;
    };
    const endOfWeek = (weekStart: Date) => {
      const e = new Date(weekStart);
      e.setDate(e.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      return e;
    };

    const isDateInRange = (value: Date, from: Date, to: Date) => value >= from && value <= to;
    
    if (period === 'monthly') {
      // Rolling last 12 months (latest on right)
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = startOfMonth(d);
        const monthEnd = endOfMonth(d);

        const monthSubs = subscriptions.filter((s) => {
          const subDate = new Date(s.createdAt);
          return isDateInRange(subDate, monthStart, monthEnd);
        });

        const sales = calcSubscriptionSales(monthSubs);
        data.push({
          date: d.toLocaleDateString('en-US', { month: 'short' }),
          sales: Math.round(sales),
        });
      }
    } else if (period === 'yearly') {
      // Year totals (sum of all months). Show last 3 years including current.
      for (let i = 2; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

        const yearSubs = subscriptions.filter((s) => {
          const subDate = new Date(s.createdAt);
          return isDateInRange(subDate, yearStart, yearEnd);
        });

        const sales = calcSubscriptionSales(yearSubs);
        data.push({
          date: String(year),
          sales: Math.round(sales),
        });
      }
    } else if (period === 'weekly') {
      // Weekly: show up to last 4 weeks that fall in current month + 1 comparison week (previous week's bar).
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const weeksInMonth: Array<{ start: Date; end: Date }> = [];
      let ws = startOfWeek(monthStart);
      while (ws <= monthEnd) {
        const we = endOfWeek(ws);
        const intersects = we >= monthStart && ws <= monthEnd;
        if (intersects) weeksInMonth.push({ start: new Date(ws), end: we });
        ws = new Date(ws);
        ws.setDate(ws.getDate() + 7);
      }

      const lastWeeks = weeksInMonth.slice(Math.max(0, weeksInMonth.length - 4));
      const firstShown = lastWeeks[0]?.start;

      const compareWeek =
        firstShown != null
          ? {
              start: new Date(firstShown.getTime() - 7 * 24 * 60 * 60 * 1000),
              end: new Date(firstShown.getTime() - 1),
              isCompare: true as const,
            }
          : null;

      const finalWeeks: Array<{ start: Date; end: Date; isCompare?: true }> = [];
      if (compareWeek) finalWeeks.push(compareWeek);
      for (const w of lastWeeks) finalWeeks.push(w);

      for (const w of finalWeeks) {
        const weekSubs = subscriptions.filter((s) => {
          const subDate = new Date(s.createdAt);
          return isDateInRange(subDate, w.start, w.end);
        });
        const sales = calcSubscriptionSales(weekSubs);

        data.push({
          date: w.isCompare
            ? 'Prev wk'
            : w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sales: Math.round(sales),
        });
      }
    } else {
      // Daily: last 7 days (latest on right)
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);

        const daySubs = subscriptions.filter((s) => {
          const subDate = new Date(s.createdAt);
          return isDateInRange(subDate, dayStart, dayEnd);
        });

        const sales = calcSubscriptionSales(daySubs);
        data.push({
          date: day.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: Math.round(sales),
        });
      }
    }
    
    return data;
  };

  const formatCurrency = (amount: number) => formatDashboardInr(amount);

  const getMaxSales = () => {
    if (salesData.length === 0) return 10000;
    const max = Math.max(...salesData.map((d) => d.sales));
    if (max <= 0) return 10000;

    // Round up to a "nice" number for axis ticks
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const scaled = max / magnitude;
    const niceScaled = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return niceScaled * magnitude;
  };

  const getYAxisTicks = (): number[] => {
    const max = getMaxSales();
    const divisions = 4;
    return Array.from({ length: divisions + 1 }, (_, i) =>
      Math.round((max * (divisions - i)) / divisions),
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading dashboard..." />
      </div>
    );
  }

  const googleAnalyticsUrl = 'https://analytics.google.com/analytics/web/';

  return (
    <div className={styles.dashboard}>
      <h1 className={`${adminStyles.adminPageTitle} ${styles.mobileHideTitle}`}>Dashboard</h1>
      <p className={styles.statsMobileNote}>Respective to month</p>

      <div className={styles.statsDesktop}>
        {/* Top Row - KPIs */}
        <div className={styles.kpiRow}>
          <div className={styles.kpiCard}>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
            <div className={styles.kpiLabel}>Total Sales</div>
            <div className={styles.kpiValue}>
              {stats ? formatCurrency(stats.totalSales) : '₹0'}
            </div>
            <div className={styles.kpiChange}>
              <span className={styles.positiveChange}>
                +{stats?.totalSalesChange || 0}%
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
            <div className={styles.kpiLabel}>Orders</div>
            <div className={styles.kpiValue}>{stats?.orders || 0}</div>
            <div className={styles.kpiChange}>
              <span className={styles.positiveChange}>
                +{stats?.ordersChange || 0}%
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
            <div className={styles.kpiLabel}>Average Order Value</div>
            <div className={styles.kpiValue}>
              {stats ? formatCurrency(stats.averageOrderValue) : '₹0'}
            </div>
            <div className={styles.kpiChange}>
              <span className={styles.positiveChange}>
                +{stats?.averageOrderValueChange || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Middle Row - Metrics */}
        <div className={styles.metricsRow}>
          <div className={styles.metricCard}>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
            <div className={styles.metricLabel}>Returning Customers</div>
            <div className={styles.metricValue}>{stats?.returningCustomers || 0}%</div>
            <div className={styles.metricChange}>
              <span className={styles.positiveChange}>
                +{stats?.returningCustomersChange || 0}%
              </span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconDown}`} aria-hidden="true" />
            <div className={styles.metricLabel}>Cart Abandonment</div>
            <div className={styles.metricValue}>{stats?.cartAbandonment || 0}%</div>
            <div className={styles.metricChange}>
              <span className={styles.negativeChange}>
                -{stats?.cartAbandonmentChange || 0}%
              </span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
            <div className={styles.metricLabel}>Product Views</div>
            <a
              className={styles.metricReportLink}
              href={googleAnalyticsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="View full report in Google Analytics (Measurement ID: G-VP156V95WB)"
              title="Opens Google Analytics (Measurement ID: G-VP156V95WB)"
            >
              View full report
            </a>
          </div>
        </div>
      </div>

      {/* Mobile-only combined stats grid */}
      <div className={styles.statsMobile}>
        <div className={styles.kpiCard}>
          <div className={styles.statsMobileHeader}>
            <div className={styles.kpiLabel}>Total Sales</div>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
          </div>
          <div className={styles.kpiValue}>
            {stats ? formatCurrency(stats.totalSales) : '₹0'}
          </div>
          <div className={styles.kpiChange}>
            <span className={styles.positiveChange}>
              +{stats?.totalSalesChange || 0}%
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.statsMobileHeader}>
            <div className={styles.kpiLabel}>Orders</div>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
          </div>
          <div className={styles.kpiValue}>{stats?.orders || 0}</div>
          <div className={styles.kpiChange}>
            <span className={styles.positiveChange}>
              +{stats?.ordersChange || 0}%
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.statsMobileHeader}>
            <div className={styles.kpiLabel}>Average Order Value</div>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
          </div>
          <div className={styles.kpiValue}>
            {stats ? formatCurrency(stats.averageOrderValue) : '₹0'}
          </div>
          <div className={styles.kpiChange}>
            <span className={styles.positiveChange}>
              +{stats?.averageOrderValueChange || 0}%
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.statsMobileHeader}>
            <div className={styles.metricLabel}>Returning Customers</div>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
          </div>
          <div className={styles.metricValue}>{stats?.returningCustomers || 0}%</div>
          <div className={styles.metricChange}>
            <span className={styles.positiveChange}>
              +{stats?.returningCustomersChange || 0}%
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.statsMobileHeader}>
            <div className={styles.metricLabel}>Cart Abandonment</div>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconDown}`} aria-hidden="true" />
          </div>
          <div className={styles.metricValue}>{stats?.cartAbandonment || 0}%</div>
          <div className={styles.metricChange}>
            <span className={styles.negativeChange}>
              -{stats?.cartAbandonmentChange || 0}%
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.statsMobileHeader}>
            <div className={styles.metricLabel}>Product Views</div>
            <span className={`${styles.cardTopIcon} ${styles.cardTopIconSales}`} aria-hidden="true" />
          </div>
          <a
            className={styles.metricReportLink}
            href={googleAnalyticsUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="View full report in Google Analytics (Measurement ID: G-VP156V95WB)"
            title="Opens Google Analytics (Measurement ID: G-VP156V95WB)"
          >
            View full report
          </a>
        </div>
      </div>

      {/* Bottom Section - Chart and Insights */}
      <div className={styles.bottomSection}>
        {/* Left - Sales Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h2>Sales Analytics</h2>
            <div className={styles.chartFilters}>
              <button
                className={chartPeriod === 'daily' ? styles.activeFilter : styles.filterButton}
                onClick={() => setChartPeriod('daily')}
              >
                Daily
              </button>
              <button
                className={chartPeriod === 'weekly' ? styles.activeFilter : styles.filterButton}
                onClick={() => setChartPeriod('weekly')}
              >
                Weekly
              </button>
              <button
                className={chartPeriod === 'monthly' ? styles.activeFilter : styles.filterButton}
                onClick={() => setChartPeriod('monthly')}
              >
                Monthly
              </button>
              <button
                className={chartPeriod === 'yearly' ? styles.activeFilter : styles.filterButton}
                onClick={() => setChartPeriod('yearly')}
              >
                Yearly
              </button>
            </div>
          </div>
          <div className={styles.chartContainer}>
            <div className={styles.chartYAxis}>
              {getYAxisTicks().map((val, i) => (
                <div key={`${i}-${val}`} className={styles.yAxisLabel}>
                  {val.toLocaleString()}
                </div>
              ))}
            </div>
            <div ref={chartBarsRef} className={styles.chartBars}>
              {salesData.map((data, index) => {
                const maxSales = getMaxSales();
                const height = maxSales > 0 ? (data.sales / maxSales) * 100 : 0;
                const isSelected = selectedBarIndex === index;
                const valueLabel = formatCurrency(data.sales);
                return (
                  <div
                    key={index}
                    className={`${styles.barWrapper} ${isSelected ? styles.barWrapperSelected : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${data.date}, sales ${valueLabel}`}
                    aria-pressed={isSelected}
                    onMouseEnter={() => setHoverBarIndex(index)}
                    onMouseLeave={() => setHoverBarIndex(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBarIndex((i) => (i === index ? null : index));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedBarIndex((i) => (i === index ? null : index));
                      }
                    }}
                  >
                    <div className={styles.barStack}>
                      <div
                        ref={(el) => {
                          if (el) barRefs.current.set(index, el);
                          else barRefs.current.delete(index);
                        }}
                        className={styles.bar}
                        style={{ height: `${height}%` }}
                        title={`${data.date}: ${valueLabel}`}
                      />
                    </div>
                    <div className={styles.barLabel}>{data.date}</div>
                  </div>
                );
              })}
            </div>
            {tooltipPortalReady && floatTip
              ? createPortal(
                  <div
                    className={styles.barTooltipFloating}
                    style={{
                      left: floatTip.left,
                      top: floatTip.top,
                      transform: floatTip.transform,
                    }}
                    role="tooltip"
                  >
                    {floatTip.label}
                  </div>,
                  document.body,
                )
              : null}
          </div>
        </div>

        {/* Right - Customer Insights */}
        <div className={styles.insightsColumn}>
          {/* Customer Insights */}
          <div className={styles.insightCard}>
            <h3>Customer Insights</h3>
            <div className={styles.insightItems}>
              <div className={styles.insightItem}>
                <div className={styles.insightIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 12C14.7614 12 17 9.7614 17 7C17 4.2386 14.7614 2 12 2C9.2386 2 7 4.2386 7 7C7 9.7614 9.2386 12 12 12Z" />
                    <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" />
                  </svg>
                </div>
                <div>
                  <div className={styles.insightLabel}>New Customers</div>
                  <div className={styles.insightValue}>{customerInsights?.newCustomers || 0}</div>
                  <div className={styles.insightSubtext}>This week</div>
                </div>
              </div>
              <div className={styles.insightItem}>
                <div className={styles.insightIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z" />
                    <path d="M3 16H21" />
                  </svg>
                </div>
                <div>
                  <div className={styles.insightLabel}>Subscription Customers</div>
                  <div className={styles.insightValue}>{customerInsights?.vipCustomers || 0}</div>
                  <div className={styles.insightSubtext}>Active</div>
                </div>
              </div>
              <div className={styles.insightItem}>
                <div className={styles.insightIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 11C17.6569 11 19 9.6569 19 8C19 6.3431 17.6569 5 16 5C14.3431 5 13 6.3431 13 8C13 9.6569 14.3431 11 16 11Z" />
                    <path d="M8 11C9.65685 11 11 9.6569 11 8C11 6.3431 9.65685 5 8 5C6.34315 5 5 6.3431 5 8C5 9.6569 6.34315 11 8 11Z" />
                    <path d="M2 19C2 16.7909 4.23858 15 7 15H9" />
                    <path d="M22 19C22 16.7909 19.7614 15 17 15H15" />
                    <path d="M12 14C14.2091 14 16 12.2091 16 10C16 7.79086 14.2091 6 12 6C9.79086 6 8 7.79086 8 10C8 12.2091 9.79086 14 12 14Z" />
                  </svg>
                </div>
                <div>
                  <div className={styles.insightLabel}>Total Customers</div>
                  <div className={styles.insightValue}>{customerInsights?.totalCustomers || 0}</div>
                  <div className={styles.insightSubtext}>All time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Customers */}
          <div className={styles.insightCard}>
            <h3>Top Customers</h3>
            <div className={styles.topCustomersList}>
              {topCustomers.length > 0 ? (
                topCustomers.map((customer) => (
                  <div key={customer.id} className={styles.topCustomerItem}>
                    <div className={styles.customerAvatar}>
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.customerInfo}>
                      <div className={styles.customerName}>{customer.name}</div>
                      <div className={styles.customerDetails}>
                        {customer.orders} orders
                      </div>
                    </div>
                    <div className={styles.customerSpent}>
                      {formatCurrency(customer.totalSpent)}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noData}>No customer data available</div>
              )}
            </div>
          </div>

          {/* Customer Retention */}
          <div className={styles.insightCard}>
            <h3>Customer Retention</h3>
            <div className={styles.retentionContainer}>
              <div className={styles.retentionValue}>{customerRetention}%</div>
              <div className={styles.retentionBar}>
                <div
                  className={styles.retentionFill}
                  style={{ width: `${customerRetention}%` }}
                />
              </div>
              <div className={styles.retentionChange}>
                <span className={styles.positiveChange}>
                  +{retentionChange}% from last month
                </span>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className={styles.insightCard}>
            <h3>Subscription</h3>
            <div className={styles.promotionItem}>
              <div className={styles.promotionInfo}>
                <div className={styles.promotionName}>Total Active</div>
                <div className={styles.promotionDetails}>{activeMemberships} active subscriptions</div>
              </div>
              <span className={styles.promotionBadge}>Active</span>
            </div>
            <div className={styles.promotionItem}>
              <div className={styles.promotionInfo}>
                <div className={styles.promotionName}>Total Expired</div>
                <div className={styles.promotionDetails}>{expiredMemberships} expired subscriptions</div>
              </div>
              <span className={styles.promotionBadgeExpired}>Expired</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
