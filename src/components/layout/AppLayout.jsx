import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useDispatch } from '../../context/useDispatch';

export default function AppLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { mockNotificationToast, dismissMockNotification } = useDispatch();

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex relative">
      {/* Sidebar Navigation */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setIsMobileOpen(true)} />

        {/* Global Mock Notification Event Toast (Requirement 9) */}
        {mockNotificationToast && (
          <div className="fixed top-20 right-6 z-50 max-w-md w-full bg-[#10213F] text-white p-4 rounded-xl shadow-2xl border border-indigo-400/40 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      {mockNotificationToast.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {mockNotificationToast.timestamp}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white mt-1">
                    {mockNotificationToast.details}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Logged in Audit Trail and sent to field technician mobile app.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissMockNotification}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                aria-label="Dismiss simulated notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
