'use client';

import { useToastStore, type Toast } from '@/stores/toastStore';

const variantStyles = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600'
};

export function Toaster() {
  const toasts = useToastStore((s: { toasts: Toast[] }) => s.toasts);
  const dismiss = useToastStore((s: { dismiss: (id: number) => void }) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t: Toast) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${variantStyles[t.variant]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-white/70 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
