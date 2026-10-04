import React, { useState } from 'react';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  CheckCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/common/EmptyState';
import { useDispatch } from '../context/useDispatch';

export default function Notifications() {
  const {
    notifications,
    markAllNotificationsAsRead,
    toggleNotificationRead,
  } = useDispatch();
  const [activeTab, setActiveTab] = useState('All');

  const tabs = [
    'All',
    'Assignments',
    'Schedule Updates',
    'System',
    'Emergency',
  ];

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'All') return true;
    return notif.type.toLowerCase() === activeTab.toLowerCase();
  });

  const markAllAsRead = () => {
    markAllNotificationsAsRead();
  };

  const toggleReadStatus = (id) => {
    toggleNotificationRead(id);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'danger':
        return <AlertCircle className="w-4 h-4 text-[#EF4444]" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#4F46E5]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
              Notification Center
            </h2>
            {unreadCount > 0 && (
              <Badge variant="danger" dot>
                {unreadCount} Unread
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Dispatch broadcasts, SLA triggers, and technician status changes.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-2 font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-[#4F46E5] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#172033] hover:bg-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <Card
              key={notif.id}
              padding="p-4"
              className={`transition-all duration-150 flex items-start gap-4 ${
                notif.unread
                  ? 'border-indigo-200 bg-indigo-50/20 shadow-xs'
                  : 'bg-white hover:bg-slate-50/50'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  notif.severity === 'danger'
                    ? 'bg-red-50'
                    : notif.severity === 'warning'
                    ? 'bg-amber-50'
                    : notif.severity === 'success'
                    ? 'bg-emerald-50'
                    : 'bg-indigo-50'
                }`}
              >
                {getSeverityIcon(notif.severity)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#172033]">
                      {notif.title}
                    </h4>
                    {notif.unread && (
                      <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#6B7280] font-mono shrink-0">
                    {notif.timestamp}
                  </span>
                </div>

                <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                  {notif.description}
                </p>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                    Category: {notif.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleReadStatus(notif.id)}
                    className="text-xs text-[#4F46E5] hover:underline font-medium"
                  >
                    {notif.unread ? 'Mark as read' : 'Mark as unread'}
                  </button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={Bell}
            title="No notifications in this category"
            description="You are all caught up with your operational alerts."
          />
        )}
      </div>
    </div>
  );
}
