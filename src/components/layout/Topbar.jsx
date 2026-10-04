import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, Calendar as CalendarIcon } from 'lucide-react';
import Avatar from '../common/Avatar';
import { DISPATCHER_PROFILE } from '../../data/mockData';
import { useDispatch } from '../../context/useDispatch';

const PAGE_META = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: "Here's the dispatch overview for today.",
  },
  '/schedule': {
    title: "Today's Schedule",
    subtitle: 'Monday, October 5 · 09:00–17:00',
  },
  '/requests': {
    title: 'Service Requests',
    subtitle: 'Manage, track, and prioritize incoming customer jobs',
  },
  '/technicians': {
    title: 'Technicians',
    subtitle: 'Monitor roster, skills, regions, and current workload',
  },
  '/ai-planner': {
    title: 'AI Dispatch Planner',
    subtitle: 'Simulate and review optimized assignment plans',
  },
  '/versions': {
    title: 'Schedule Versions',
    subtitle: 'Audit changes and compare schedule revisions',
  },
  '/audit-log': {
    title: 'Audit Log',
    subtitle: 'Trace system events, manual overrides, and AI decisions',
  },
  '/notifications': {
    title: 'Notifications',
    subtitle: 'System updates, cancellations, and operational alerts',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Dispatch console configuration and preferences',
  },
};

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentMeta = PAGE_META[location.pathname] || {
    title: 'FieldFlow',
    subtitle: 'AI Dispatch Console',
  };

  const { notifications } = useDispatch();
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="h-16 bg-white border-b border-gray-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-soft">
      {/* Left: Mobile Toggle & Page Headings */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-[#172033] hover:bg-gray-100 focus:outline-none"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="truncate">
          <h1 className="text-base sm:text-lg font-bold text-[#172033] tracking-tight leading-tight truncate">
            {currentMeta.title}
          </h1>
          <p className="text-xs text-[#6B7280] hidden sm:block truncate mt-0.5">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Date, Notifications, Dispatcher Profile */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Date display */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200/80 text-xs font-medium text-[#172033]">
          <CalendarIcon className="w-3.5 h-3.5 text-[#4F46E5]" />
          <span>{DISPATCHER_PROFILE.dateString}</span>
        </div>

        {/* Notifications Icon with Unread Dot */}
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-gray-500 hover:text-[#172033] hover:bg-gray-100 transition-colors focus:outline-none"
          aria-label={`Notifications (${unreadCount} unread)`}
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-white" />
          )}
        </button>

        {/* Vertical Divider */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Dispatcher Profile */}
        <div className="flex items-center gap-2.5 pl-1">
          <Avatar
            name="Alex"
            initials="AL"
            size="sm"
            status="available"
            className="ring-1 ring-gray-200"
          />
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-[#172033] leading-tight">
              Alex
            </div>
            <div className="text-[11px] text-[#6B7280]">Dispatcher</div>
          </div>
        </div>
      </div>
    </header>
  );
}
