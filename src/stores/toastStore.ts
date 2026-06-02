'use client';

import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant, durationMs?: number) => number;
  success: (message: string, durationMs?: number) => number;
  error: (message: string, durationMs?: number) => number;
  info: (message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (message, variant = 'info', durationMs = 3500) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
    return id;
  },

  success: (message, durationMs) => get().push(message, 'success', durationMs),
  error: (message, durationMs = 5000) => get().push(message, 'error', durationMs),
  info: (message, durationMs) => get().push(message, 'info', durationMs),

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}));

export const toast = {
  success: (m: string, d?: number) => useToastStore.getState().success(m, d),
  error: (m: string, d?: number) => useToastStore.getState().error(m, d),
  info: (m: string, d?: number) => useToastStore.getState().info(m, d),
  dismiss: (id: number) => useToastStore.getState().dismiss(id)
};
