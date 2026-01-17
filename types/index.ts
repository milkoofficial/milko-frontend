// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Product Types
export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariation {
  id: string;
  productId: string;
  size: string; // e.g., "0.5L", "1L", "2L", "5L"
  priceMultiplier: number;
  price?: number; // Actual price for this variation (overrides priceMultiplier if set)
  isAvailable: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId?: string;
  reviewerName: string;
  rating: number; // 1-5
  comment?: string;
  isApproved: boolean;
  userName?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  pricePerLitre: number;
  sellingPrice?: number | null;
  compareAtPrice?: number | null;
  imageUrl?: string;
  isActive: boolean;
  isMembershipEligible?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  categoryId?: string | null;
  suffixAfterPrice?: string;
  createdAt: string;
  updatedAt: string;
  // Extended fields (when fetched with details)
  images?: ProductImage[];
  variations?: ProductVariation[];
  reviews?: ProductReview[];
}

// Subscription Types
export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  product?: Product;
  litresPerDay: number;
  durationMonths: number;
  deliveryTime: string; // e.g., "08:00"
  status: 'pending' | 'active' | 'paused' | 'cancelled' | 'expired' | 'failed';
  startDate: string;
  endDate: string;
  razorpaySubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
  // Extended fields from joins (for admin view)
  userName?: string;
  userEmail?: string;
}

// Delivery Schedule Types
export interface DeliverySchedule {
  id: string;
  subscriptionId: string;
  deliveryDate: string; // YYYY-MM-DD
  status: 'pending' | 'delivered' | 'skipped' | 'cancelled';
  createdAt: string;
  // Extended fields from backend joins
  userId?: string;
  litresPerDay?: number;
  deliveryTime?: string;
  productName?: string;
  userName?: string;
  userEmail?: string;
}

// Paused Date Types
export interface PausedDate {
  id: string;
  subscriptionId: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Payment Types
export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  orderId: string;
}

export interface SubscriptionCreateRequest {
  productId: string;
  litresPerDay: number;
  durationMonths: number;
  deliveryTime: string;
}

// Address Types
export interface Address {
  id: string;
  userId: string;
  name: string; // Address name/label (e.g., "Home", "Office")
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}
