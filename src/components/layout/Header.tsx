'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getRouteByPath } from '@/lib/data/routes';
import { ProfileInfo } from './ProfileInfo';

interface HeaderProps {
  isDesktop: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Header({ isDesktop, isSidebarOpen, onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const currentRoute = getRouteByPath(pathname) ?? {
    name: 'Unknown',
    description: 'Page not found',
    icon: null
  };

  return (
    <header className="bg-gray-50s py-6 px-6">
      <div className="mx-auto w-full" style={{ maxWidth: '1400px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {(!isDesktop || !isSidebarOpen) && (
              <button className="p-2 rounded text-gray-700 hover:bg-gray-100" onClick={onToggleSidebar} aria-label="Toggle Sidebar">
                <Menu className="text-gray-800" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-3 mb-1">
                {currentRoute.icon && (
                  <currentRoute.icon className="w-8 h-8" style={{ color: 'var(--color-propolis-teal)' }} />
                )}
                <h1 className="text-4xl font-bold" style={{ color: 'var(--color-propolis-teal)' }}>
                  {currentRoute.name}
                </h1>
              </div>
              <p className="text-gray-500">{currentRoute.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ProfileInfo />
          </div>
        </div>
      </div>
    </header>
  );
}
