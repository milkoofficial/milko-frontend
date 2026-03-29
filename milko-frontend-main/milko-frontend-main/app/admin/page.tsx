'use client';

import { useEffect, useState } from 'react';
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
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [subscriptionsData, setSubscriptionsData] = useState<Subscription[]>([]);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [activeMemberships, setActiveMemberships] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Recalculate sales data when period changes
    if (subscriptionsData.length > 0 && productsData.length > 0) {
      const newSalesData = generateSalesData(subscriptionsData, productsData, chartPeriod);
      setSalesData(newSalesData);
    }
  }, [chartPeriod, subscriptionsData, productsData]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [subscriptionsRes, productsRes, usersRes] = await Promise.all([
        adminSubscriptionsApi.getAll().catch(() => []),
        adminProductsApi.getAll().catch(() => []),
        apiClient.getInstance().get<{ success: boolean; data: User[] }>(API_ENDPOINTS.ADMIN.USERS.LIST).catch(() => ({ data: { data: [] } })),
      ]);

      const subscriptions: Subscription[] = subscriptionsRes || [];
      const products: Product[] = productsRes || [];
      const users: User[] = Array.isArray(usersRes.data.data) ? usersRes.data.data : [];

      // Calculate metrics
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      const totalSales = activeSubscriptions.reduce((sum, sub) => {
        const product = products.find(p => p.id === sub.productId);
        if (product) {
          const dailyCost = product.pricePerLitre * sub.litresPerDay;
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
            const product = products.find(p => p.id === sub.productId);
            if (product) {
              const dailyCost = product.pricePerLitre * sub.litresPerDay;
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
        cartAbandonment: 23.8, // Placeholder
        cartAbandonmentChange: -1.8,
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

  const generateSalesData = (subscriptions: Subscription[], products: Product[], period: 'daily' | 'weekly' | 'monthly'): SalesData[] => {
    const data: SalesData[] = [];
    const now = new Date();
    
    if (period === 'monthly') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthSubs = subscriptions.filter(s => {
          const subDate = new Date(s.createdAt);
          return subDate >= monthStart && subDate <= monthEnd;
        });
        
        const sales = monthSubs.reduce((sum, sub) => {
          const product = products.find(p => p.id === sub.productId);
          if (product) {
            const dailyCost = product.pricePerLitre * sub.litresPerDay;
            const monthlyCost = dailyCost * 30;
            return sum + (monthlyCost * sub.durationMonths);
          }
          return sum;
        }, 0);
        
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          sales: Math.round(sales),
        });
      }
    } else if (period === 'weekly') {
      // Last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        
        const weekSubs = subscriptions.filter(s => {
          const subDate = new Date(s.createdAt);
          return subDate >= weekStart && subDate < weekEnd;
        });
        
        const sales = weekSubs.reduce((sum, sub) => {
          const product = products.find(p => p.id === sub.productId);
          if (product) {
            const dailyCost = product.pricePerLitre * sub.litresPerDay;
            const monthlyCost = dailyCost * 30;
            return sum + (monthlyCost * sub.durationMonths);
          }
          return sum;
        }, 0);
        
        data.push({
          date: `Week ${8 - i}`,
          sales: Math.round(sales),
        });
      }
    } else {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(day.setHours(0, 0, 0, 0));
        const dayEnd = new Date(day.setHours(23, 59, 59, 999));
        
        const daySubs = subscriptions.filter(s => {
          const subDate = new Date(s.createdAt);
          return subDate >= dayStart && subDate <= dayEnd;
        });
        
        const sales = daySubs.reduce((sum, sub) => {
          const product = products.find(p => p.id === sub.productId);
          if (product) {
            const dailyCost = product.pricePerLitre * sub.litresPerDay;
            const monthlyCost = dailyCost * 30;
            return sum + (monthlyCost * sub.durationMonths);
          }
          return sum;
        }, 0);
        
        data.push({
          date: day.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: Math.round(sales),
        });
      }
    }
    
    return data;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMaxSales = () => {
    if (salesData.length === 0) return 10000;
    return Math.max(...salesData.map(d => d.sales));
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

  return (
    <div className={styles.dashboard}>
      <h1 className={adminStyles.adminPageTitle}>Dashboard</h1>

      {/* Top Row - KPIs */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Sales</div>
          <div className={styles.kpiValue}>
            {stats ? formatCurrency(stats.totalSales) : '₹0'}
          </div>
          <div className={styles.kpiChange}>
            <span className={styles.positiveChange}>
              ↑ +{stats?.totalSalesChange || 0}% This month
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Orders</div>
          <div className={styles.kpiValue}>{stats?.orders || 0}</div>
          <div className={styles.kpiChange}>
            <span className={styles.positiveChange}>
              ↑ +{stats?.ordersChange || 0}% This month
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Average Order Value</div>
          <div className={styles.kpiValue}>
            {stats ? formatCurrency(stats.averageOrderValue) : '₹0'}
          </div>
          <div className={styles.kpiChange}>
            <span className={styles.positiveChange}>
              ↑ +{stats?.averageOrderValueChange || 0}% This month
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row - Metrics */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Returning Customers</div>
          <div className={styles.metricValue}>{stats?.returningCustomers || 0}%</div>
          <div className={styles.metricChange}>
            <span className={styles.positiveChange}>
              ↑ +{stats?.returningCustomersChange || 0}% This month
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Cart Abandonment</div>
          <div className={styles.metricValue}>{stats?.cartAbandonment || 0}%</div>
          <div className={styles.metricChange}>
            <span className={styles.negativeChange}>
              ↓ {stats?.cartAbandonmentChange || 0}% This month
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Product Views</div>
          <div className={styles.metricValue}>
            {stats?.productViews.toLocaleString() || '0'}
          </div>
          <div className={styles.metricChange}>
            <span className={styles.positiveChange}>
              ↑ +{stats?.productViewsChange || 0}% This month
            </span>
          </div>
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
            </div>
          </div>
          <div className={styles.chartContainer}>
            <div className={styles.chartYAxis}>
              {[0, 2500, 5000, 7500, 10000].map((val) => (
                <div key={val} className={styles.yAxisLabel}>
                  {val.toLocaleString()}
                </div>
              ))}
            </div>
            <div className={styles.chartBars}>
              {salesData.map((data, index) => {
                const maxSales = getMaxSales();
                const height = maxSales > 0 ? (data.sales / maxSales) * 100 : 0;
                return (
                  <div key={index} className={styles.barWrapper}>
                    <div
                      className={styles.bar}
                      style={{ height: `${height}%` }}
                      title={`${data.date}: ${formatCurrency(data.sales)}`}
                    />
                    <div className={styles.barLabel}>{data.date}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right - Customer Insights */}
        <div className={styles.insightsColumn}>
          {/* Customer Insights */}
          <div className={styles.insightCard}>
            <h3>Customer Insights</h3>
            <div className={styles.insightItems}>
              <div className={styles.insightItem}>
                <div className={styles.insightIcon}>👤</div>
                <div>
                  <div className={styles.insightLabel}>New Customers</div>
                  <div className={styles.insightValue}>{customerInsights?.newCustomers || 0}</div>
                  <div className={styles.insightSubtext}>This week</div>
                </div>
              </div>
              <div className={styles.insightItem}>
                <div className={styles.insightIcon}>👑</div>
                <div>
                  <div className={styles.insightLabel}>Subscription Customers</div>
                  <div className={styles.insightValue}>{customerInsights?.vipCustomers || 0}</div>
                  <div className={styles.insightSubtext}>Active</div>
                </div>
              </div>
              <div className={styles.insightItem}>
                <div className={styles.insightIcon}>👥</div>
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

          {/* Active Memberships */}
          <div className={styles.insightCard}>
            <h3>Active Subscriptions</h3>
            <div className={styles.promotionItem}>
              <div className={styles.promotionInfo}>
                <div className={styles.promotionName}>Total Active</div>
                <div className={styles.promotionDetails}>{activeMemberships} active subscriptions</div>
              </div>
              <span className={styles.promotionBadge}>Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
