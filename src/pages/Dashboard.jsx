import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  GitBranch,
  Plus,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Activity,
  Check,
} from 'lucide-react';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Drawer from '../components/ui/Drawer';
import { TIMELINE_HOURS } from '../data/mockData';
import { useDispatch } from '../context/useDispatch';
import { calculateTechnicianWorkloads } from '../utils/constraintEngine';

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    stats,
    requests,
    technicians,
    scheduleVersions,
    auditEvents,
    replanAlert,
    aiPlan,
    generateRevisedPlan,
    createNewRequest,
  } = useDispatch();

  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  // Needs Attention items
  const needsAttentionList = requests.filter(
    (req) => req.status === 'UNASSIGNED' || req.status === 'Unassigned' || req.needsReplanning
  );

  const currentVersion = scheduleVersions.find((v) => v.isCurrent) || scheduleVersions[0];
  const assignedCount = stats.totalAssigned;
  const unassignedCount = stats.unassigned;
  const completedCount = stats.completed;
  const availableTechs = technicians.filter((t) => t.status === 'Available').length;
  const criticalCount = requests.filter((r) => r.priority === 'Critical').length;

  const workloads = React.useMemo(() => {
    return calculateTechnicianWorkloads(technicians, requests);
  }, [technicians, requests]);

  const highWorkloadTechs = React.useMemo(() => {
    return Object.values(workloads).filter((w) => w.percentage >= 90);
  }, [workloads]);

  const unresolvedQuestionsCount = React.useMemo(() => {
    return (aiPlan.missingInformation || []).filter((q) => q.status !== 'Answered').length;
  }, [aiPlan]);

  // Form state for placeholder new request
  const [newRequestForm, setNewRequestForm] = useState({
    customer: '',
    phone: '',
    skill: 'AC Repair',
    region: 'Jaipur North',
    priority: 'Normal',
    preferredWindow: '10:00 - 13:00',
  });

  const handleCreateRequestSubmit = (e) => {
    e.preventDefault();
    createNewRequest(newRequestForm);
    setIsNewRequestModalOpen(false);
    setActionSuccessMessage('New service request created and queued successfully!');
    setTimeout(() => setActionSuccessMessage(''), 4000);
  };

  const getPriorityBadgeVariant = (priority) => {
    switch (priority) {
      case 'Critical':
        return 'danger';
      case 'High':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  // Convert time string "HH:MM" to slot index offset (09:00 is index 0)
  const getSlotStyle = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const startHour = parseInt(startTime.split(':')[0], 10);
    const startMin = parseInt(startTime.split(':')[1], 10);
    const endHour = parseInt(endTime.split(':')[0], 10);
    const endMin = parseInt(endTime.split(':')[1], 10);

    const startDecimal = startHour + startMin / 60 - 9;
    const endDecimal = endHour + endMin / 60 - 9;
    const duration = Math.max(endDecimal - startDecimal, 1);

    const leftPercent = (startDecimal / 8) * 100;
    const widthPercent = (duration / 8) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.min(100 - leftPercent, widthPercent)}%`,
    };
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {actionSuccessMessage && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Check className="w-4 h-4 text-[#10B981]" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage('')}
            className="text-xs text-[#065F46] underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Greeting & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
              Good morning, Alex
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Console
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Here's the dispatch overview for today.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => setIsNewRequestModalOpen(true)}
          >
            New Request
          </Button>
          <Button
            variant="primary"
            icon={Sparkles}
            onClick={() => navigate('/ai-planner')}
          >
            Generate AI Plan
          </Button>
        </div>
      </div>

      {/* REPLAN REQUIRED BANNER ON DASHBOARD (Requirement 5 & 6) */}
      {replanAlert && replanAlert.required && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-200/80 text-amber-900 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-900">
                  Replan Required
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                  {replanAlert.triggerType === 'cancellation' ? 'Technician Cancellation' : 'Emergency Request'}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                {replanAlert.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              onClick={() => {
                generateRevisedPlan();
                navigate('/ai-planner');
              }}
            >
              Generate Revised Plan
            </Button>
          </div>
        </div>
      )}

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Requests */}
        <Card padding="p-4" className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#6B7280]">Total Requests</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-[#4F46E5]">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] tracking-tight">
              {requests.length}
            </div>
            <div className="text-[11px] text-[#10B981] font-medium mt-1">
              Active Job Pool
            </div>
          </div>
        </Card>

        {/* Assigned */}
        <Card padding="p-4" className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#6B7280]">Assigned</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#10B981]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] tracking-tight">
              {assignedCount}
            </div>
            <div className="text-[11px] text-[#6B7280] mt-1">
              {stats.assigned} Active · {stats.completed} Completed
            </div>
          </div>
        </Card>

        {/* Unassigned */}
        <Card padding="p-4" className="flex flex-col justify-between border-amber-200/60 bg-amber-50/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#B45309]">Unassigned</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-[#F59E0B]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#92400E] tracking-tight">
              {unassignedCount}
            </div>
            <div className="text-[11px] font-semibold text-[#D97706] mt-1">
              {unassignedCount > 0 ? 'Needs attention' : 'All jobs queued'}
            </div>
          </div>
        </Card>

        {/* Completed */}
        <Card padding="p-4" className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#6B7280]">Completed</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] tracking-tight">
              {completedCount}
            </div>
            <div className="text-[11px] text-[#6B7280] mt-1">
              Protected from replanning
            </div>
          </div>
        </Card>

        {/* Available Technicians */}
        <Card padding="p-4" className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#6B7280]">Technicians</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] tracking-tight">
              {availableTechs} / {technicians.length}
            </div>
            <div className="text-[11px] text-[#6B7280] mt-1">
              {technicians.length - availableTechs} unavailable
            </div>
          </div>
        </Card>

        {/* Current Schedule */}
        <Card padding="p-4" className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#6B7280]">Current Schedule</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-[#4F46E5]">
              <GitBranch className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#4F46E5] tracking-tight">
              {currentVersion.version}
            </div>
            <div className="text-[11px] text-[#6B7280] mt-1">
              {currentVersion.status}
            </div>
          </div>
        </Card>
      </div>

      {/* Large Card: Today's Dispatch Overview (Timeline) */}
      <Card padding="p-5" className="overflow-hidden">
        <CardHeader
          title="Today's Dispatch Overview"
          subtitle="Real-time timeline across assigned technicians (09:00 – 17:00)"
          action={
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/schedule')}
            >
              Open Full Schedule
            </Button>
          }
        />

        {/* Timeline Visualization */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[760px]">
            {/* Hour Markers Header */}
            <div className="grid grid-cols-12 gap-0 border-b border-gray-200 pb-2 mb-3 text-[11px] font-semibold text-[#6B7280]">
              <div className="col-span-3 pl-2">Technician & Region</div>
              <div className="col-span-9 grid grid-cols-8 text-center">
                {TIMELINE_HOURS.slice(0, 8).map((hour) => (
                  <span key={hour} className="border-l border-gray-100 first:border-l-0 text-slate-500">
                    {hour}
                  </span>
                ))}
              </div>
            </div>

            {/* Technician Timeline Rows */}
            <div className="space-y-3">
              {technicians.map((tech) => {
                const assignedReqs = requests.filter(
                  (r) => r.assignedTechId === tech.id
                );

                return (
                  <div
                    key={tech.id}
                    className="grid grid-cols-12 items-center gap-0 py-2 rounded-lg hover:bg-slate-50/80 transition-colors border border-transparent hover:border-gray-100"
                  >
                    {/* Tech Column */}
                    <div className="col-span-3 pr-3 pl-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#10213F] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                          {tech.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#172033] truncate">
                            {tech.name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#6B7280] truncate">
                              {tech.region}
                            </span>
                            {tech.status === 'Unavailable' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-medium">
                                On Leave
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Slot Track */}
                    <div className="col-span-9 relative h-11 bg-slate-50/70 rounded-lg border border-gray-100 flex items-center">
                      {/* Grid background lines */}
                      <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            className="border-r border-dashed border-gray-200/60 last:border-r-0 h-full"
                          />
                        ))}
                      </div>

                      {/* Render scheduled assignments */}
                      {assignedReqs.map((req) => {
                        const style = getSlotStyle(req.startTime, req.endTime);
                        if (!style) return null;

                        const isCompleted = req.status === 'Completed';
                        const isHighPriority = req.priority === 'High';

                        return (
                          <div
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            style={style}
                            className={`absolute h-9 rounded-md px-2.5 py-1 text-xs cursor-pointer select-none transition-all shadow-sm flex flex-col justify-center border ${
                              isCompleted
                                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                                : isHighPriority
                                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                : 'bg-indigo-50 border-indigo-200 text-[#172033] hover:bg-indigo-100'
                            }`}
                            title={`${req.id}: ${req.requiredSkill} (${req.startTime} - ${req.endTime})`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <span className="font-semibold text-[11px] truncate">
                                {req.id}
                              </span>
                              <span className="text-[9px] opacity-75 font-mono">
                                {req.startTime}–{req.endTime}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-600 truncate mt-0.5">
                              {req.requiredSkill}
                            </span>
                          </div>
                        );
                      })}

                      {assignedReqs.length === 0 && (
                        <div className="w-full text-center text-[11px] text-gray-400 italic">
                          {tech.status === 'Unavailable'
                            ? 'Unavailable for today'
                            : 'No jobs currently assigned'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* 3-Column Bottom Section: Needs Attention, AI Insights, Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Needs Attention */}
        <Card padding="p-5" className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Needs Attention"
              subtitle="2 requests require immediate dispatcher intervention"
            />
            <div className="space-y-3">
              {needsAttentionList.map((req) => (
                <div
                  key={req.id}
                  className="p-3 rounded-lg border border-amber-200/80 bg-amber-50/30 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#172033]">
                          {req.id}
                        </span>
                        <Badge variant={getPriorityBadgeVariant(req.priority)} size="sm">
                          {req.priority}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-[#172033] mt-1">
                        {req.requiredSkill}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">
                        {req.region} · {req.preferredWindow}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedRequest(req)}
                    >
                      Review
                    </Button>
                  </div>
                  {req.issueFlag && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>{req.issueFlag}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 mt-2 border-t border-gray-100 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-[#4F46E5]"
              onClick={() => navigate('/requests')}
            >
              View all 10 service requests
            </Button>
          </div>
        </Card>

        {/* AI Dispatch Insights */}
        <Card padding="p-5" className="flex flex-col justify-between bg-gradient-to-br from-white to-indigo-50/30 border-indigo-100">
          <div>
            <CardHeader
              title="AI Dispatch Insights"
              subtitle="Real-time optimization heuristics"
              action={
                <span className="p-1 rounded bg-indigo-100 text-[#4F46E5]">
                  <Sparkles className="w-4 h-4" />
                </span>
              }
            />
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-indigo-100/80 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-[#172033]">
                  <span className="font-semibold">{unassignedCount} requests</span> currently unassigned ({criticalCount} marked Critical).
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-indigo-100/80 shadow-xs">
                <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-[#172033]">
                  {highWorkloadTechs.length > 0 ? (
                    <span>
                      <span className="font-semibold">{highWorkloadTechs.length} technician(s)</span> ({highWorkloadTechs.map(t => t.name).join(', ')}) near maximum workload cap.
                    </span>
                  ) : (
                    <span>All active technician workloads are within configured operating thresholds.</span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-indigo-100/80 shadow-xs">
                <Clock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs text-[#172033]">
                  <span className="font-semibold">{unresolvedQuestionsCount} unresolved constraint question(s)</span> awaiting dispatcher response before next replan.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-indigo-100/80">
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              className="w-full"
              onClick={() => navigate('/ai-planner')}
            >
              Review AI Plan
            </Button>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card padding="p-5" className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Recent Activity"
              subtitle="Latest dispatcher actions and audit events"
              action={<Activity className="w-4 h-4 text-[#6B7280]" />}
            />
            <div className="space-y-3.5">
              {auditEvents.slice(0, 4).map((evt) => (
                <div key={evt.id} className="flex items-start gap-3">
                  <div className="text-[11px] font-mono font-semibold text-[#4F46E5] bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                    {evt.time.split(' ')[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#172033] leading-snug">
                      {evt.action}
                    </p>
                    <p className="text-[11px] text-[#6B7280] truncate mt-0.5">
                      {evt.entity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 mt-2 border-t border-gray-100 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-[#6B7280]"
              onClick={() => navigate('/audit-log')}
            >
              View full audit history
            </Button>
          </div>
        </Card>
      </div>

      {/* New Request Modal */}
      <Modal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        title="Create New Service Request"
        subtitle="Log a customer service ticket for immediate or AI replanning"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewRequestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateRequestSubmit}
            >
              Create Request
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateRequestSubmit} className="space-y-4">
          <Input
            label="Customer Name"
            placeholder="e.g. Ramesh Chandra"
            required
            value={newRequestForm.customer}
            onChange={(e) =>
              setNewRequestForm({ ...newRequestForm, customer: e.target.value })
            }
          />
          <Input
            label="Contact Phone"
            placeholder="e.g. +91 98290 12345"
            value={newRequestForm.phone}
            onChange={(e) =>
              setNewRequestForm({ ...newRequestForm, phone: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Required Skill
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={newRequestForm.skill}
                onChange={(e) =>
                  setNewRequestForm({ ...newRequestForm, skill: e.target.value })
                }
              >
                <option value="AC Repair">AC Repair</option>
                <option value="Electrical Repair">Electrical Repair</option>
                <option value="Plumbing">Plumbing</option>
                <option value="HVAC">HVAC</option>
                <option value="AC Maintenance">AC Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Priority
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={newRequestForm.priority}
                onChange={(e) =>
                  setNewRequestForm({ ...newRequestForm, priority: e.target.value })
                }
              >
                <option value="Normal">Normal</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Region
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={newRequestForm.region}
                onChange={(e) =>
                  setNewRequestForm({ ...newRequestForm, region: e.target.value })
                }
              >
                <option value="Jaipur North">Jaipur North</option>
                <option value="Jaipur Central">Jaipur Central</option>
                <option value="Jaipur South">Jaipur South</option>
                <option value="Jaipur West">Jaipur West</option>
                <option value="Jaipur East">Jaipur East</option>
              </select>
            </div>
            <Input
              label="Preferred Window"
              placeholder="e.g. 10:00 - 13:00"
              value={newRequestForm.preferredWindow}
              onChange={(e) =>
                setNewRequestForm({ ...newRequestForm, preferredWindow: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>

      {/* Assignment Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest?.id || 'Assignment Details'}
        subtitle="Service Request & Validation Overview"
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedRequest(null)}
          >
            Close
          </Button>
        }
      >
        {selectedRequest && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs text-[#6B7280]">Customer</span>
                <p className="font-semibold text-base text-[#172033]">
                  {selectedRequest.customer}
                </p>
                <p className="text-xs text-[#6B7280]">{selectedRequest.phone}</p>
              </div>
              <Badge variant={getPriorityBadgeVariant(selectedRequest.priority)}>
                {selectedRequest.priority} Priority
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[#6B7280] block mb-0.5">Region</span>
                <span className="font-medium text-[#172033]">
                  {selectedRequest.region}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[#6B7280] block mb-0.5">Required Skill</span>
                <span className="font-medium text-[#172033]">
                  {selectedRequest.requiredSkill}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[#6B7280] block mb-0.5">Duration</span>
                <span className="font-medium text-[#172033]">
                  {selectedRequest.duration}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[#6B7280] block mb-0.5">Preferred Window</span>
                <span className="font-medium text-[#172033]">
                  {selectedRequest.preferredWindow}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs text-[#6B7280] block mb-1">
                Assigned Technician
              </span>
              <p className="font-semibold text-[#172033]">
                {selectedRequest.assignedTechName || (
                  <span className="text-amber-600">Unassigned</span>
                )}
              </p>
              {selectedRequest.startTime && (
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Scheduled Slot: {selectedRequest.startTime} – {selectedRequest.endTime}
                </p>
              )}
            </div>

            {/* Validation Section (Mock Visual) */}
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2.5">
                Deterministic Constraint Validation
              </h5>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs p-2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Skill Match
                  </span>
                  <span className="font-semibold">Verified</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Region Match
                  </span>
                  <span className="font-semibold">Verified</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Availability Slot
                  </span>
                  <span className="font-semibold">No Conflict</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Preferred Window
                  </span>
                  <span className="font-semibold">Within Window</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
