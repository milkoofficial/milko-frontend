import { STORAGE_KEYS } from './constants';
import { User } from '@/types';

/**
 * Token Management
 * Using httpOnly cookies would be more secure, but for simplicity
 * we'll use localStorage with proper XSS protection in production
 */
export const tokenStorage = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },
  set: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },
  remove: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },
};

/**
 * User Data Management
 */
export const userStorage = {
  get: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },
  set: (user: User): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  remove: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
};

/**
 * Clear all auth data
 */
export const clearAuth = (): void => {
  tokenStorage.remove();
  userStorage.remove();
};

