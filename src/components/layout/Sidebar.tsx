'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { routes, isActiveRoute } from '@/lib/data/routes';
import { useAuthStore } from '@/stores/authStore';

interface SidebarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Sidebar({ isSidebarOpen, onToggleSidebar }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const userName = user?.full_name || user?.email || 'Guest';
  const userRole = user?.role || 'User';
  const avatarUrl = user?.avatar_url;
  const initials = (userName || 'G')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const visibleRoutes = routes.filter(
    (r) => userRole && r.allowedRoles.includes(userRole as 'owner' | 'investor' | 'operator')
  );

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 p-6 flex justify-between items-center gap-2">
        <Link href="/">
          {isSidebarOpen && <img src="/logo.png" alt="Propolis" />}
        </Link>
        {isSidebarOpen && (
          <button
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            onClick={onToggleSidebar}
            aria-label="Close Sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {visibleRoutes.map((route) => {
            const active = isActiveRoute(pathname, route.path);
            return (
              <li key={route.path}>
                <Link
                  href={route.path}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-gray-100 text-gray-700"
                  style={active ? { backgroundColor: 'rgba(0,150,136,0.1)', color: 'var(--color-propolis-teal)' } : {}}
                >
                  <route.icon
                    className="h-5 w-5"
                    style={{ color: active ? 'var(--color-propolis-teal)' : '#6b7280' }}
                  />
                  {isSidebarOpen && <span>{route.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t border-gray-200 p-3">
        <Link
          href="/profile"
          className="group flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-100"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-xs font-semibold text-white">
              {initials || 'U'}
            </div>
          )}
          {isSidebarOpen && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">{userName}</div>
                <div className="truncate text-xs capitalize text-gray-500">{userRole}</div>
              </div>
              <UserIcon className="h-4 w-4 shrink-0 text-gray-400 opacity-0 transition group-hover:opacity-100" />
            </>
          )}
        </Link>

        {isSidebarOpen ? (
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center justify-center rounded-lg py-2 text-gray-600 transition hover:bg-red-50 hover:text-red-600"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
