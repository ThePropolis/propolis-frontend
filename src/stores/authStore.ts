'use client';

import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface User {
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
}

interface JWTPayload {
  sub: string;
  full_name?: string;
  role?: string;
  avatar_url?: string | null;
  exp?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  init: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  updateUser: (patch: Partial<User>) => void;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    if (!decoded.exp) return false;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}

function extractUserFromToken(token: string): User | null {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    return {
      email: decoded.sub,
      full_name: decoded.full_name || '',
      role: decoded.role || 'guest',
      avatar_url: decoded.avatar_url ?? null
    };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  init: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      if (token) localStorage.removeItem('token');
      return;
    }
    const user = extractUserFromToken(token);
    if (!user) {
      localStorage.removeItem('token');
      return;
    }
    set({ user, token });

    // Start auto-refresh interval
    setInterval(async () => {
      const { token: t, user: u } = get();
      if (!t || !u) return;
      try {
        const decoded = jwtDecode<JWTPayload>(t);
        if (decoded.exp) {
          const timeUntilExpiry = decoded.exp * 1000 - Date.now();
          if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
            await get().refreshToken();
          }
        }
      } catch {
        // ignore
      }
    }, 60_000);
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        let data: { detail?: string } = {};
        try { data = await res.json(); } catch { /* ignore */ }
        throw new Error(data.detail || `Login failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const token: string = data.access_token;
      if (isTokenExpired(token)) throw new Error('Received expired token');
      const user = extractUserFromToken(token);
      if (!user) throw new Error('Invalid token format');
      localStorage.setItem('token', token);
      set({ user, token, loading: false, error: null });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      set({ loading: false, error: message });
      return false;
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    set({ user: null, token: null, loading: false, error: null });
  },

  checkAuth: async () => {
    const { token } = get();
    if (!token) return false;
    if (isTokenExpired(token)) {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
      return false;
    }
    set({ loading: true });
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Session expired');
      const userData = await res.json();
      const user: User = {
        email: userData.email || userData.sub || '',
        full_name: userData.full_name || '',
        role: userData.role || 'guest',
        avatar_url: userData.avatar_url ?? null
      };
      set({ user, loading: false, error: null });
      return true;
    } catch {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
      return false;
    }
  },

  updateUser: (patch) => {
    const { user } = get();
    if (!user) return;
    set({ user: { ...user, ...patch } });
  },

  refreshToken: async () => {
    const { token } = get();
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Token refresh failed');
      const data = await res.json();
      const newToken: string = data.access_token;
      if (isTokenExpired(newToken)) throw new Error('Received expired token');
      const user = extractUserFromToken(newToken);
      if (!user) throw new Error('Invalid token format');
      if (typeof window !== 'undefined') localStorage.setItem('token', newToken);
      set({ user, token: newToken });
      return true;
    } catch {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
      set({ user: null, token: null });
      return false;
    }
  },

  clearError: () => set({ error: null })
}));
