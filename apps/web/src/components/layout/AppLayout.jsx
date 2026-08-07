import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useUIStore } from '../../store/uiStore';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function AppLayout() {
  const { sidebarOpen, sidebarCollapsed, theme, setTheme } = useUIStore();
  const { refreshUser } = useAuthStore();

  useEffect(() => {
    // Apply saved theme on mount
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // Refresh user data
    refreshUser();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => useUIStore.getState().toggleSidebar()}
        />
      )}

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300`}>
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
