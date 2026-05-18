'use client';

import { useAuthStore } from '@/stores/authStore';

export function ProfileInfo() {
  const user = useAuthStore((s) => s.user);
  const userName = user?.full_name || 'Guest';
  const userRole = user?.role || 'User';

  return (
    <div className="flex items-center gap-2">
      <div>
        <div className="font-medium">{userName}</div>
        <div className="text-end text-xs text-gray-500">{userRole}</div>
      </div>
    </div>
  );
}
