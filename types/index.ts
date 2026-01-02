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
export interface Product {
  id: string;
  name: string;
  description?: string;
  pricePerLitre: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
}

// Delivery Schedule Types
export interface DeliverySchedule {
  id: string;
  subscriptionId: string;
  deliveryDate: string; // YYYY-MM-DD
  status: 'pending' | 'delivered' | 'skipped' | 'cancelled';
  createdAt: string;
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

