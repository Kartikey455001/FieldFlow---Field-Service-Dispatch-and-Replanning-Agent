import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Bell,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useDispatch } from '../../context/useDispatch';

export default function Sidebar({
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed,
  setIsCollapsed,
}) {
  const { notifications } = useDispatch();
  const unreadCount = notifications.filter((n) => n.unread).length;

  const mainNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Schedule', path: '/schedule', icon: Calendar },
    { name: 'Service Requests', path: '/requests', icon: ClipboardList },
    { name: 'Technicians', path: '/technicians', icon: Users },
    { name: 'AI Planner', path: '/ai-planner', icon: Sparkles, badge: 'AI' },
    { name: 'Schedule Versions', path: '/versions', icon: GitBranch },
    { name: 'Audit Log', path: '/audit-log', icon: ShieldCheck },
  ];

  const bottomNavItems = [
    {
      name: 'Notifications',
      path: '/notifications',
      icon: Bell,
      count: unreadCount,
    },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#10213F] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#1E293B] shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-[#4F46E5] text-white flex items-center justify-center shrink-0 shadow-md">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <span className="text-sm font-bold tracking-wider text-white uppercase block leading-tight">
                FieldFlow
              </span>
              <span className="text-[10px] text-indigo-300 font-medium tracking-wide">
                AI Dispatch Console
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A3258]"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-2 mb-2">
          {!isCollapsed && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Operations
            </span>
          )}
        </div>
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 group relative ${
                  isActive
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#162C52]'
                } ${isCollapsed ? 'justify-center px-2' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate flex-1">{item.name}</span>
                  )}
                  {!isCollapsed && item.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-3 border-t border-[#1E293B] space-y-1 shrink-0">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#162C52]'
                } ${isCollapsed ? 'justify-center px-2' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 group-hover:text-white'
                      }`}
                    />
                    {isCollapsed && item.count > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#EF4444]" />
                    )}
                  </div>
                  {!isCollapsed && (
                    <span className="truncate flex-1">{item.name}</span>
                  )}
                  {!isCollapsed && item.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#EF4444] text-white">
                      {item.count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Desktop Collapse Toggle */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden lg:flex w-full items-center gap-3 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-[#162C52] rounded-lg transition-colors mt-2 ${
            isCollapsed ? 'justify-center px-2' : ''
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#10213F]/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out border-r border-[#1E293B] ${
          isCollapsed ? 'w-20' : 'w-60'
        }`}
      >
        <div
          className={`fixed inset-y-0 left-0 ${
            isCollapsed ? 'w-20' : 'w-60'
          } transition-all duration-300 ease-in-out z-30`}
        >
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
