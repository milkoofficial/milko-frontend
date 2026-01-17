/**
 * Centralized API exports
 * Import all API services from here
 */
export { authApi } from './auth';
export { productsApi, adminProductsApi } from './products';
export { subscriptionsApi, adminSubscriptionsApi } from './subscriptions';
export { bannersApi, adminBannersApi } from './banners';
export type { Banner } from './banners';
export { contentApi, adminContentApi } from './content';
export type { SiteContent } from './content';
export { getAllCategories, createCategory, updateCategory, deleteCategory } from './categories';
export type { Category, CreateCategoryInput, UpdateCategoryInput } from './categories';
export { couponsApi, adminCouponsApi } from './coupons';
export type { Coupon, CreateCouponInput, UpdateCouponInput } from './coupons';
export { apiClient } from './client';

