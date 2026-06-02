'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { isRouteAllowed, roleLandingPage, type Role } from '@/lib/data/routes';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster } from '@/components/ui/Toaster';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, init, checkAuth } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const isLoginPage = pathname === '/login';

  // Initialise auth from localStorage on first render
  useEffect(() => {
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle resize
  useEffect(() => {
    function handleResize() {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      setIsSidebarOpen(desktop);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auth guard + route check
  useEffect(() => {
    const run = async () => {
      if (isLoginPage) {
        setAuthChecked(true);
        return;
      }
      await checkAuth();
      setAuthChecked(true);
    };
    run();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authChecked) return;
    if (isLoginPage) return;

    const role = user?.role as Role | undefined;
    if (!role) {
      router.replace('/login');
      return;
    }
    if (!isRouteAllowed(pathname, role)) {
      router.replace(roleLandingPage[role]);
    }
  }, [authChecked, user, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSidebar = () => setIsSidebarOpen((v) => !v);
  const isAuthenticated = !!user;

  if (!authChecked && !isLoginPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600 mx-auto" />
          <p>Checking authentication…</p>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return (
      <>
        <Toaster />
        {children}
      </>
    );
  }

  return (
    <div className="relative flex h-screen bg-gray-50">
      {isAuthenticated && (
        <>
          <div
            className="sidebar-container fixed z-20 h-full overflow-hidden transition-all duration-300 ease-in-out"
            style={{ width: isSidebarOpen ? '16rem' : '0' }}
          >
            <div className="h-full w-64 bg-white shadow-md">
              <Sidebar isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />
            </div>
          </div>
          {!isDesktop && isSidebarOpen && (
            <button
              className="bg-opacity-30 fixed inset-0 z-10 bg-black"
              onClick={toggleSidebar}
              aria-label="Close sidebar overlay"
            />
          )}
        </>
      )}

      <div
        className="z-0 flex flex-1 flex-col overflow-hidden transition-all duration-300"
        style={{ marginLeft: isSidebarOpen && isDesktop && isAuthenticated ? '16rem' : '0' }}
      >
        <Header isDesktop={isDesktop} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-scroll bg-white p-6">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}
