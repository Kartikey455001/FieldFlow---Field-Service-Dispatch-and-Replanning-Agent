import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Dashboard from '../pages/Dashboard';
import Schedule from '../pages/Schedule';
import ServiceRequests from '../pages/ServiceRequests';
import Technicians from '../pages/Technicians';
import AIPlanner from '../pages/AIPlanner';
import ScheduleVersions from '../pages/ScheduleVersions';
import AuditLog from '../pages/AuditLog';
import Notifications from '../pages/Notifications';
import Settings from '../pages/Settings';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Default route redirects to dashboard */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="requests" element={<ServiceRequests />} />
        <Route path="technicians" element={<Technicians />} />
        <Route path="ai-planner" element={<AIPlanner />} />
        <Route path="versions" element={<ScheduleVersions />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        {/* Fallback to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
