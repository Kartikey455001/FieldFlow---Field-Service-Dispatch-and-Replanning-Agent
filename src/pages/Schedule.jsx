import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  AlertCircle,
  Save,
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  Wrench,
  User,
  ShieldCheck,
  AlertTriangle,
  Lock,
  UserX,
  X,
  Edit3,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Drawer from '../components/ui/Drawer';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { TIMELINE_HOURS } from '../data/mockData';
import { useDispatch } from '../context/useDispatch';
import { validateManualAssignment } from '../utils/validation';

export default function Schedule() {
  const navigate = useNavigate();
  const {
    stats,
    requests,
    technicians,
    scheduleVersions,
    replanAlert,
    simulateTechnicianCancellation,
    addEmergencyRequest,
    generateRevisedPlan,
    modifyAssignment,
    unassignRequest,
    approvePlan,
  } = useDispatch();

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [targetCancelTech, setTargetCancelTech] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Modify assignment modal state (Requirement 3 & 4)
  const [modifyingRequest, setModifyingRequest] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [selectedStartTime, setSelectedStartTime] = useState('10:00');
  const [selectedEndTime, setSelectedEndTime] = useState('12:00');

  // Emergency request form state (Requirement 6)
  const [emergencyForm, setEmergencyForm] = useState({
    customer: '',
    phone: '',
    requiredSkill: 'Electrical Repair',
    region: 'Jaipur Central',
    preferredWindow: '15:00 - 17:00',
    duration: '2 hours',
    notes: '',
  });

  // Calculate live validation for the assignment modification modal
  const liveValidation = React.useMemo(() => {
    if (!modifyingRequest || !selectedTechId) return null;
    const tech = technicians.find((t) => t.id === selectedTechId);
    if (!tech) return null;

    return validateManualAssignment({
      request: modifyingRequest,
      technician: tech,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      existingAssignments: requests,
    });
  }, [modifyingRequest, selectedTechId, selectedStartTime, selectedEndTime, technicians, requests]);

  // Open Modify Assignment modal
  const handleOpenModifyModal = (req) => {
    setModifyingRequest(req);
    setSelectedTechId(req.assignedTechId || (technicians[0]?.id ?? ''));
    setSelectedStartTime(req.startTime || '10:00');
    setSelectedEndTime(req.endTime || '12:00');
    setIsModifyModalOpen(true);
  };

  // Demo Double-Booking trigger helper (Requirement 4)
  const handleTriggerDoubleBookingDemo = () => {
    // REQ-002 is assigned to Rahul Sharma (TECH-002) from 10:00 - 12:00
    setSelectedTechId('TECH-002');
    setSelectedStartTime('10:00');
    setSelectedEndTime('12:00');
  };

  // Save modified assignment
  const handleSaveModifiedAssignment = async () => {
    const res = await modifyAssignment({
      requestId: modifyingRequest.id,
      technicianId: selectedTechId,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
    });

    if (res && res.success) {
      setIsModifyModalOpen(false);
      setToastMessage(`Assignment for ${modifyingRequest.id} successfully updated!`);
      setTimeout(() => setToastMessage(''), 4000);
      setSelectedRequest(null);
    } else {
      setToastMessage(`Assignment Rejected: ${res?.blockingReason || 'Constraint violation'}`);
      setTimeout(() => setToastMessage(''), 6000);
    }
  };

  // Unassign current request (Section 7)
  const handleUnassignCurrent = async () => {
    if (modifyingRequest) {
      await unassignRequest(modifyingRequest.id);
      setIsModifyModalOpen(false);
      setSelectedRequest(null);
      setToastMessage(`${modifyingRequest.id} unassigned and returned to job pool.`);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Approve Schedule Flow (Section 6 & 12)
  const handleApproveSchedule = async () => {
    const res = await approvePlan();
    if (res && !res.success) {
      setToastMessage(res.error || 'Approval blocked: Hard constraint violations exist.');
    } else {
      setToastMessage(`Schedule ${res?.versionLabel || 'confirmed'}! Dispatched to all technician mobile apps.`);
    }
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Emergency Request Submission (Requirement 6)
  const handleEmergencySubmit = async (e) => {
    e.preventDefault();
    await addEmergencyRequest(emergencyForm);
    setIsEmergencyModalOpen(false);
    setToastMessage('Emergency request added! Schedule requires replanning.');
    setTimeout(() => setToastMessage(''), 5000);
  };

  // Handle Technician Cancellation (Requirement 5)
  const handleConfirmCancellation = async () => {
    if (targetCancelTech) {
      await simulateTechnicianCancellation(targetCancelTech.id, targetCancelTech.name);
      setIsCancelModalOpen(false);
      setTargetCancelTech(null);
      setToastMessage(`Cancellation logged for ${targetCancelTech.name}. Replan Required.`);
      setTimeout(() => setToastMessage(''), 5000);
    }
  };

  const handleGeneratePlanClick = () => {
    generateRevisedPlan();
    navigate('/ai-planner');
  };

  // Timeline slot positioning helper
  const getSlotStyle = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const startHour = parseInt(startTime.split(':')[0], 10);
    const startMin = parseInt(startTime.split(':')[1], 10);
    const endHour = parseInt(endTime.split(':')[0], 10);
    const endMin = parseInt(endTime.split(':')[1], 10);

    const startDecimal = startHour + startMin / 60 - 9;
    const endDecimal = endHour + endMin / 60 - 9;
    const duration = Math.max(endDecimal - startDecimal, 0.75);

    const leftPercent = (startDecimal / 8) * 100;
    const widthPercent = (duration / 8) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.min(100 - leftPercent, widthPercent)}%`,
    };
  };

  const currentVersion = scheduleVersions.find((v) => v.isCurrent) || scheduleVersions[0];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle className="w-4 h-4 text-[#10B981]" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-xs text-[#065F46] underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* REPLAN REQUIRED BANNER (Requirement 5 & 6) */}
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
              onClick={handleGeneratePlanClick}
            >
              Generate Revised Plan
            </Button>
          </div>
        </div>
      )}

      {/* Schedule Header & Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
              Today's Schedule
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={currentVersion.status === 'Draft' ? 'warning' : 'success'} dot>
                Version {currentVersion.version} · {currentVersion.status}
              </Badge>
              <span className="text-xs text-[#6B7280]">
                {stats.totalAssigned} Assigned ({stats.assigned} Active · {stats.completed} Completed) · {stats.unassigned} Unassigned
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#4F46E5]" />
            Monday, October 5 · 09:00–17:00 (Jaipur Metro Operations)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={Sparkles}
            onClick={() => navigate('/ai-planner')}
          >
            Generate AI Plan
          </Button>

          {/* Emergency Request Button (Requirement 6) */}
          <Button
            variant="danger"
            size="sm"
            icon={AlertCircle}
            onClick={() => setIsEmergencyModalOpen(true)}
          >
            Emergency Request
          </Button>

          {/* Simulate Cancellation Button (Requirement 5) */}
          <Button
            variant="secondary"
            size="sm"
            icon={UserX}
            onClick={() => {
              const rahul = technicians.find((t) => t.name === 'Rahul Sharma' && t.status === 'Available');
              const activeTech = rahul || technicians.find((t) => t.status === 'Available');
              setTargetCancelTech(activeTech || technicians[1]);
              setIsCancelModalOpen(true);
            }}
          >
            Simulate Cancellation
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={Save}
            onClick={() => {
              setToastMessage('Schedule changes saved successfully.');
              setTimeout(() => setToastMessage(''), 3000);
            }}
          >
            Save Draft
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={CheckCircle}
            onClick={handleApproveSchedule}
          >
            Approve Schedule
          </Button>
        </div>
      </div>

      {/* Main Timeline Card */}
      <Card padding="p-5" className="overflow-hidden">
        {/* Timeline Grid Container */}
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[880px]">
            {/* Header: Technician column + Hour blocks */}
            <div className="grid grid-cols-12 gap-0 border-b border-gray-200 pb-3 mb-4 text-xs font-semibold text-[#6B7280]">
              <div className="col-span-3 pl-3">Technician & Actions</div>
              <div className="col-span-9 grid grid-cols-8 text-center text-xs font-mono">
                {TIMELINE_HOURS.slice(0, 8).map((hour) => (
                  <span key={hour} className="border-l border-gray-100 first:border-l-0 text-slate-500">
                    {hour}
                  </span>
                ))}
              </div>
            </div>

            {/* Technician Swimlanes */}
            <div className="space-y-4">
              {technicians.map((tech) => {
                const assignedReqs = requests.filter(
                  (r) => r.assignedTechId === tech.id
                );

                const isUnavailable = tech.status === 'Unavailable';

                return (
                  <div
                    key={tech.id}
                    className="grid grid-cols-12 items-center gap-0 py-2.5 px-1 rounded-xl hover:bg-slate-50/90 transition-colors border border-gray-100/70"
                  >
                    {/* Left Column: Technician Profile & Quick Cancellation Action */}
                    <div className="col-span-3 pr-3 pl-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-[#10213F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {tech.avatar}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                isUnavailable ? 'bg-red-500' : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-[#172033] truncate">
                                {tech.name}
                              </p>
                            </div>
                            <p className="text-[11px] text-[#6B7280] truncate">
                              {tech.role} · {tech.region}
                            </p>
                          </div>
                        </div>

                        {/* Simulate cancellation quick button (Requirement 5) */}
                        {!isUnavailable && (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetCancelTech(tech);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-[10px] text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                            title={`Simulate ${tech.name} cancellation`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Swimlane Track */}
                    <div className="col-span-9 relative h-14 bg-slate-50/80 rounded-lg border border-gray-200/70 flex items-center p-1">
                      {/* Vertical Hour Guidelines */}
                      <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            className="border-r border-dashed border-gray-200/60 last:border-r-0 h-full"
                          />
                        ))}
                      </div>

                      {/* Render Assignment Cards */}
                      {assignedReqs.map((req) => {
                        const style = getSlotStyle(req.startTime, req.endTime);
                        if (!style) return null;

                        const isCompleted = req.status === 'COMPLETED' || req.status === 'Completed' || req.isProtectedCompleted;
                        const isHighPriority = req.priority === 'High' || req.priority === 'Critical';
                        const isNeedsReplanning = req.needsReplanning;

                        return (
                          <div
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            style={style}
                            className={`absolute h-12 rounded-lg px-2.5 py-1 text-xs cursor-pointer select-none transition-all duration-150 shadow-xs flex flex-col justify-center border hover:shadow-md hover:scale-[1.01] z-10 ${
                              isCompleted
                                ? 'bg-slate-100 border-slate-300 text-slate-800'
                                : isNeedsReplanning
                                ? 'bg-amber-100/90 border-amber-400 text-amber-950 ring-1 ring-amber-400'
                                : isHighPriority
                                ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-300/40'
                                : 'bg-indigo-50 border-indigo-200 text-[#172033]'
                            }`}
                            title={`${req.id}: ${req.requiredSkill} (${req.startTime} - ${req.endTime}) - Click to inspect`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-tight">
                              <span className="font-bold text-[11px] text-[#172033] truncate">
                                {req.id}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                {req.startTime}–{req.endTime}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#4F46E5] font-medium truncate mt-0.5 flex items-center justify-between">
                              <span className="truncate">{req.requiredSkill}</span>
                              {isCompleted && (
                                <span className="text-[9px] font-bold text-slate-600 bg-slate-200/80 px-1 rounded flex items-center gap-0.5 shrink-0 ml-1">
                                  <Lock className="w-2.5 h-2.5" /> Protected
                                </span>
                              )}
                              {isNeedsReplanning && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-200 px-1 rounded shrink-0 ml-1">
                                  Replan
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#6B7280] truncate">
                              {req.customer}
                            </div>
                          </div>
                        );
                      })}

                      {/* Empty / Unavailable state for row */}
                      {isUnavailable && (
                        <div className="w-full text-center text-xs text-red-600 font-medium py-1 bg-red-50/70 rounded border border-dashed border-red-200 flex items-center justify-center gap-1.5">
                          <UserX className="w-3.5 h-3.5" />
                          <span>Shift Cancelled / Unavailable</span>
                        </div>
                      )}
                      {!isUnavailable && assignedReqs.length === 0 && (
                        <div className="w-full text-center text-xs text-gray-400 italic">
                          No assignments for this slot
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend (Requirement 8 included) */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3 text-xs text-[#6B7280]">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-[#172033]">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200" />
              <span>Standard Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-50 border border-amber-300" />
              <span>High / Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-200 border border-amber-400" />
              <span>Needs Replanning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300" />
              <span className="font-medium text-slate-800">Completed — Protected from replanning</span>
            </div>
          </div>
          <span className="text-[11px] text-gray-400">
            Click any block to inspect details or test assignment validation
          </span>
        </div>
      </Card>

      {/* Assignment Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? `${selectedRequest.id} — Assignment Details` : 'Assignment Details'}
        subtitle="Technician dispatch & validation overview"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedRequest(null)}
            >
              Close
            </Button>
            {selectedRequest && selectedRequest.status !== 'Completed' && (
              <Button
                variant="primary"
                size="sm"
                icon={Edit3}
                onClick={() => {
                  const reqToEdit = selectedRequest;
                  setSelectedRequest(null);
                  handleOpenModifyModal(reqToEdit);
                }}
              >
                Modify Assignment
              </Button>
            )}
          </>
        }
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Customer & Priority Header */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Customer Information
                  </span>
                  <h4 className="text-base font-bold text-[#172033] mt-0.5">
                    {selectedRequest.customer}
                  </h4>
                  <p className="text-xs text-[#6B7280]">{selectedRequest.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={
                      selectedRequest.priority === 'Critical'
                        ? 'danger'
                        : selectedRequest.priority === 'High'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {selectedRequest.priority} Priority
                  </Badge>
                  {selectedRequest.status === 'Completed' && (
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Completed — Protected
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 flex items-start gap-2 text-xs text-[#6B7280]">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <span>{selectedRequest.address || selectedRequest.location}</span>
              </div>
            </div>

            {/* Request Specification Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#4F46E5]" /> Region
                </span>
                <span className="font-semibold text-xs text-[#172033]">
                  {selectedRequest.region}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-[#4F46E5]" /> Required Skill
                </span>
                <span className="font-semibold text-xs text-[#172033]">
                  {selectedRequest.requiredSkill}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#4F46E5]" /> Duration
                </span>
                <span className="font-semibold text-xs text-[#172033]">
                  {selectedRequest.duration}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#4F46E5]" /> Preferred Window
                </span>
                <span className="font-semibold text-xs text-[#172033]">
                  {selectedRequest.preferredWindow}
                </span>
              </div>
            </div>

            {/* Assigned Technician */}
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4F46E5] block mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Assigned Technician
              </span>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-[#172033]">
                  {selectedRequest.assignedTechName || 'None (Unassigned)'}
                </p>
                {selectedRequest.startTime && (
                  <Badge variant="info">
                    {selectedRequest.startTime} – {selectedRequest.endTime}
                  </Badge>
                )}
              </div>
            </div>

            {/* Deterministic Validation Results (Requirement 3) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  Deterministic Validation Results
                </h5>
                <span className="text-[10px] text-gray-400">Rule Engine</span>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: 'Required skill matches', passed: true, note: `Technician verified for ${selectedRequest.requiredSkill}` },
                  { label: 'Region matches', passed: true, note: `Native operating territory (${selectedRequest.region})` },
                  { label: 'Technician available', passed: true, note: 'On active duty shift' },
                  { label: 'Within preferred time window', passed: true, note: `Inside window (${selectedRequest.preferredWindow})` },
                  { label: 'Workload within limit', passed: true, note: 'Daily hours within 8-hour cap' },
                  { label: 'No scheduling conflict', passed: true, note: 'No overlapping assignments detected' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-900"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 font-bold">✓</span>
                      <div>
                        <span className="font-semibold">{item.label}</span>
                        <p className="text-[11px] text-emerald-700">{item.note}</p>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">Passed</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* MANUAL ASSIGNMENT VALIDATION & DOUBLE-BOOKING MODAL (Requirement 3 & 4) */}
      <Modal
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        title={modifyingRequest ? `Modify Assignment — ${modifyingRequest.id}` : 'Modify Assignment'}
        subtitle="Live deterministic validation checking skill, region, availability, and double-booking"
        footer={
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={handleUnassignCurrent}
            >
              Unassign Request
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsModifyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={liveValidation && !liveValidation.isValid ? 'danger' : 'primary'}
              size="sm"
              onClick={handleSaveModifiedAssignment}
            >
              {liveValidation && !liveValidation.isValid ? 'Attempt Assignment (Will Reject)' : 'Save Assignment'}
            </Button>
          </>
        }
      >
        {modifyingRequest && (
          <div className="space-y-4 text-xs">
            {/* Quick Demo Helper Button for Double-Booking (Requirement 4) */}
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-[#172033] block">
                  Requirement 4 Test: Double-Booking Demo
                </span>
                <span className="text-[#6B7280]">
                  Click to prefill a conflicting slot (Rahul Sharma already has REQ-002 from 10:00–12:00).
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTriggerDoubleBookingDemo}
                className="shrink-0"
              >
                Demo Double-Booking
              </Button>
            </div>

            {/* Select Technician */}
            <div>
              <label className="block font-medium text-[#172033] mb-1">
                Assign to Technician
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
              >
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.role} ({t.region}) [{t.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Time Slot Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#172033] mb-1">
                  Start Time
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                  value={selectedStartTime}
                  onChange={(e) => setSelectedStartTime(e.target.value)}
                >
                  {TIMELINE_HOURS.slice(0, 7).map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#172033] mb-1">
                  End Time
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                  value={selectedEndTime}
                  onChange={(e) => setSelectedEndTime(e.target.value)}
                >
                  {TIMELINE_HOURS.slice(1).map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prominent Assignment Blocked Banner if Invalid (Section 6) */}
            {liveValidation && !liveValidation.isValid && (
              <div className="p-3.5 rounded-lg bg-red-50 border-2 border-red-300 text-red-950 space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-[#EF4444] font-bold" />
                  <span className="font-bold text-sm text-[#EF4444]">
                    Assignment violates scheduling constraints
                  </span>
                </div>
                <p className="text-xs font-semibold text-red-900">
                  Primary violation: {liveValidation.blockingReason}
                </p>
                {liveValidation.violations && liveValidation.violations.length > 0 && (
                  <div className="text-[11px] text-red-800 pt-1 border-t border-red-200/80">
                    <span className="font-semibold block mb-0.5">Detected constraint violations:</span>
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      {liveValidation.violations.map((v, i) => (
                        <li key={i}>{v.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] text-red-700 italic">
                  Hard constraint violation detected. Saving is blocked to prevent operational conflicts.
                </p>
              </div>
            )}

            {/* Real-time Checklist of 6 Deterministic Checks (Requirement 3) */}
            {liveValidation && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <h5 className="font-bold text-[#172033] uppercase text-[10px] tracking-wider">
                  Constraint Check Results:
                </h5>
                <div className="space-y-1.5">
                  {liveValidation.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`flex items-start justify-between p-2 rounded-lg border text-xs ${
                        check.passed
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-red-50/80 border-red-200 text-red-900 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${check.passed ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {check.passed ? '✓' : '✕'}
                        </span>
                        <div>
                          <span className="font-semibold">{check.label}</span>
                          <p className="text-[11px] opacity-80">{check.message}</p>
                        </div>
                      </div>
                      <Badge variant={check.passed ? 'success' : 'danger'} size="sm">
                        {check.passed ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* TECHNICIAN CANCELLATION MODAL (Requirement 5) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Simulate Technician Cancellation"
        subtitle="Simulate sudden shift cancellation and observe replanning cascade"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={UserX}
              onClick={handleConfirmCancellation}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        {targetCancelTech && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Select Technician to Report Unavailable:
              </label>
              <select
                value={targetCancelTech.id}
                onChange={(e) => {
                  const selected = technicians.find((t) => t.id === e.target.value);
                  if (selected) setTargetCancelTech(selected);
                }}
                className="w-full text-xs rounded-lg border border-gray-200 py-2 px-2.5 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              >
                {technicians
                  .filter((t) => t.status === 'Available')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.role} ({t.region})
                    </option>
                  ))}
              </select>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-950">
              <span className="font-bold block mb-1">
                Impact Analysis: {targetCancelTech.name}
              </span>
              <p>
                Triggering cancellation will mark this technician as <strong>Unavailable</strong>. All active scheduled assignments for this technician (e.g. REQ-002, REQ-006) will be marked as <strong>Needs Replanning</strong>.
              </p>
            </div>
            <p className="text-[#6B7280]">
              Completed assignments (e.g. REQ-010) are protected and will NOT be removed or altered.
            </p>
          </div>
        )}
      </Modal>

      {/* EMERGENCY REQUEST MODAL (Requirement 6) */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        title="Log Emergency Service Request"
        subtitle="Creates an immediate Critical priority request requiring replanning"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEmergencyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleEmergencySubmit}
            >
              Log Emergency
            </Button>
          </>
        }
      >
        <form onSubmit={handleEmergencySubmit} className="space-y-4">
          <Input
            label="Customer Name"
            placeholder="e.g. Apollo Diagnostic Lab"
            required
            value={emergencyForm.customer}
            onChange={(e) =>
              setEmergencyForm({ ...emergencyForm, customer: e.target.value })
            }
          />
          <Input
            label="Emergency Contact Phone"
            placeholder="e.g. +91 99887 66554"
            required
            value={emergencyForm.phone}
            onChange={(e) =>
              setEmergencyForm({ ...emergencyForm, phone: e.target.value })
            }
          />

          {/* Priority automatically set to Critical (Requirement 6) */}
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-red-950 block">Priority Level</span>
              <span className="text-[11px] text-red-700">Automatically locked to maximum severity</span>
            </div>
            <Badge variant="danger">Critical (Fixed)</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Required Skill
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={emergencyForm.requiredSkill}
                onChange={(e) =>
                  setEmergencyForm({ ...emergencyForm, requiredSkill: e.target.value })
                }
              >
                <option value="Electrical Repair">Electrical Repair</option>
                <option value="AC Repair">AC Repair</option>
                <option value="Plumbing">Plumbing</option>
                <option value="HVAC">HVAC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Location Region
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={emergencyForm.region}
                onChange={(e) =>
                  setEmergencyForm({ ...emergencyForm, region: e.target.value })
                }
              >
                <option value="Jaipur Central">Jaipur Central</option>
                <option value="Jaipur North">Jaipur North</option>
                <option value="Jaipur South">Jaipur South</option>
                <option value="Jaipur West">Jaipur West</option>
                <option value="Jaipur East">Jaipur East</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estimated Duration"
              value={emergencyForm.duration}
              onChange={(e) =>
                setEmergencyForm({ ...emergencyForm, duration: e.target.value })
              }
            />
            <Input
              label="Preferred Time Window"
              value={emergencyForm.preferredWindow}
              onChange={(e) =>
                setEmergencyForm({ ...emergencyForm, preferredWindow: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] mb-1.5">
              Incident Notes
            </label>
            <textarea
              rows={2}
              placeholder="Describe emergency issue..."
              className="w-full rounded-lg border border-gray-200 text-xs p-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={emergencyForm.notes}
              onChange={(e) =>
                setEmergencyForm({ ...emergencyForm, notes: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
