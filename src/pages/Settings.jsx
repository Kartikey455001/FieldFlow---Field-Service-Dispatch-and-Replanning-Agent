import React, { useState } from 'react';
import {
  User,
  Sliders,
  Bell,
  Check,
  Save,
} from 'lucide-react';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Avatar from '../components/common/Avatar';
import { DISPATCHER_PROFILE } from '../data/mockData';
import { useDispatch } from '../context/useDispatch';

export default function Settings() {
  const {
    settings: contextSettings,
    profile: contextProfile,
    updateSettings,
    updateProfile,
  } = useDispatch();

  const [profile, setProfile] = useState({
    name: contextProfile?.name || DISPATCHER_PROFILE.name,
    email: contextProfile?.email || DISPATCHER_PROFILE.email,
    role: contextProfile?.role || DISPATCHER_PROFILE.role,
    shift: contextProfile?.shift || DISPATCHER_PROFILE.shift,
  });

  const [preferences, setPreferences] = useState({
    autoReplanOnDelay: contextSettings?.autoReplanOnDelay ?? true,
    strictRegionBinding: contextSettings?.strictRegionBinding ?? false,
    maxTechnicianOvertimeHours: contextSettings?.maxTechnicianOvertimeHours ?? 2,
    defaultTimelineZoom: contextSettings?.defaultTimelineZoom || '1-Hour',
    soundAlerts: contextSettings?.soundAlerts ?? true,
    emailEmergencyAlerts: contextSettings?.emailEmergencyAlerts ?? true,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings(preferences);
    updateProfile(profile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Toast Notification */}
      {savedSuccess && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Check className="w-4 h-4 text-[#10B981]" />
            <span>Settings saved successfully. Replanning heuristics updated.</span>
          </div>
          <button
            onClick={() => setSavedSuccess(false)}
            className="text-xs text-[#065F46] underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
          Console Settings
        </h2>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
          Manage dispatcher credentials, replanning heuristics, and notification thresholds.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Profile */}
        <Card padding="p-5">
          <CardHeader
            title="Dispatcher Profile"
            subtitle="Personnel information and duty shift details"
            action={<User className="w-4 h-4 text-[#4F46E5]" />}
          />

          <div className="flex items-center gap-4 pb-4 mb-4 border-b border-gray-100">
            <Avatar name={profile.name} initials="AR" size="xl" status="available" />
            <div>
              <h4 className="text-sm font-bold text-[#172033]">{profile.name}</h4>
              <p className="text-xs text-[#6B7280]">{profile.role}</p>
              <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1 inline-block">
                On Active Duty
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
            <Input
              label="Official Email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
            <Input
              label="Designation / Role"
              value={profile.role}
              onChange={(e) => setProfile({ ...profile, role: e.target.value })}
            />
            <Input
              label="Scheduled Shift"
              value={profile.shift}
              onChange={(e) => setProfile({ ...profile, shift: e.target.value })}
            />
          </div>
        </Card>

        {/* Section 2: Application Preferences */}
        <Card padding="p-5">
          <CardHeader
            title="Application & Dispatch Heuristics"
            subtitle="Rules guiding AI suggestions and scheduling constraints"
            action={<Sliders className="w-4 h-4 text-[#4F46E5]" />}
          />

          <div className="space-y-4 text-xs">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.autoReplanOnDelay}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    autoReplanOnDelay: e.target.checked,
                  })
                }
                className="mt-0.5 rounded text-[#4F46E5] focus:ring-[#4F46E5] h-4 w-4"
              />
              <div>
                <span className="font-semibold text-[#172033] block">
                  Automatic Draft Replanning on Delay
                </span>
                <span className="text-[#6B7280]">
                  Generate a draft schedule v+1 when a technician logs 30+ minutes delay.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.strictRegionBinding}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    strictRegionBinding: e.target.checked,
                  })
                }
                className="mt-0.5 rounded text-[#4F46E5] focus:ring-[#4F46E5] h-4 w-4"
              />
              <div>
                <span className="font-semibold text-[#172033] block">
                  Strict Geographic Partitioning
                </span>
                <span className="text-[#6B7280]">
                  Disallow cross-region dispatch unless explicitly overridden by dispatcher.
                </span>
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Max Allowable Overtime (Hours)
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                  value={preferences.maxTechnicianOvertimeHours}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      maxTechnicianOvertimeHours: Number(e.target.value),
                    })
                  }
                >
                  <option value={0}>0 hours (Strict 8h max)</option>
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours (Standard)</option>
                  <option value={3}>3 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Timeline Time Resolution
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                  value={preferences.defaultTimelineZoom}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      defaultTimelineZoom: e.target.value,
                    })
                  }
                >
                  <option value="30-Min">30-Minute Blocks</option>
                  <option value="1-Hour">1-Hour Blocks (Default)</option>
                  <option value="2-Hour">2-Hour Blocks</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: Notification Preferences */}
        <Card padding="p-5">
          <CardHeader
            title="Notification Alerts"
            subtitle="Configure what alerts trigger immediate dispatcher attention"
            action={<Bell className="w-4 h-4 text-[#4F46E5]" />}
          />

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="font-semibold text-[#172033] block">
                  Audible Alarm on Emergency Requests
                </span>
                <span className="text-[#6B7280]">
                  Play alert sound when a Critical priority ticket is logged.
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.soundAlerts}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    soundAlerts: e.target.checked,
                  })
                }
                className="rounded text-[#4F46E5] focus:ring-[#4F46E5] h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="font-semibold text-[#172033] block">
                  Broadcast Emergency SMS to Field Supervisors
                </span>
                <span className="text-[#6B7280]">
                  Automatically forward unassigned critical tickets.
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailEmergencyAlerts}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    emailEmergencyAlerts: e.target.checked,
                  })
                }
                className="rounded text-[#4F46E5] focus:ring-[#4F46E5] h-4 w-4"
              />
            </label>
          </div>
        </Card>

        {/* Form Submission */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" variant="primary" icon={Save}>
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
}
