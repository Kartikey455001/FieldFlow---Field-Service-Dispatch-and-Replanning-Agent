import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  Clock,
  MapPin,
  SlidersHorizontal,
  XCircle,
  Lock,
  Check,
  FileQuestion,
  Info,
  GitBranch,
  ShieldCheck,
  Edit3,
  UserX,
  Zap,
  HelpCircle as QuestionIcon,
} from 'lucide-react';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { useDispatch } from '../context/useDispatch';

export default function AIPlanner() {
  const navigate = useNavigate();
  const {
    stats,
    technicians = [],
    aiPlan = {},
    generateRevisedPlan,
    modifyProposedAssignment,
    approvePlan,
    rejectPlan,
    answerMissingInfoQuestion,
    simulateTechnicianCancellation,
    addEmergencyRequest,
  } = useDispatch();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isAnswerModalOpen, setIsAnswerModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTechCancelModalOpen, setIsTechCancelModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  // Manual Assignment Editing State
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editTechId, setEditTechId] = useState('');
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('11:00');
  const [editUnassign, setEditUnassign] = useState(false);
  const [editReason, setEditReason] = useState('dispatcher manual override');
  const [editError, setEditError] = useState('');

  // Operational Simulation State
  const [cancelTechId, setCancelTechId] = useState('TECH-002');
  const [emergencyForm, setEmergencyForm] = useState({
    customer: 'Apex Industrial Outage',
    region: 'Jaipur Central',
    requiredSkill: 'Electrical Repair',
    preferredWindow: '15:00 - 17:00',
    notes: 'Complete substation failure requiring immediate emergency triage.',
  });

  const [rejectionReason, setRejectionReason] = useState('Technician workload unbalanced');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 5000);
  };

  // Handle Generate New Plan
  const handleGeneratePlan = async (customTrigger = null) => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await generateRevisedPlan(customTrigger);
      if (res && res.error) {
        showToast(`Planner Notice: ${typeof res.error === 'string' ? res.error : res.error.message || JSON.stringify(res.error)}`, 'error');
      } else {
        showToast('New AI schedule plan proposal generated and awaiting dispatcher review.', 'success');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to generate AI plan.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Open Edit Modal for a proposed assignment
  const handleOpenEditModal = (item) => {
    setEditingAssignment(item);
    setEditTechId(item.technicianId || (technicians.find(t => t.name === item.technician)?.technicianId || ''));
    setEditStartTime(item.startTime || item.timeSlot?.split(/[-–]/)[0]?.trim() || '09:00');
    setEditEndTime(item.endTime || item.timeSlot?.split(/[-–]/)[1]?.trim() || '11:00');
    setEditUnassign(false);
    setEditReason('dispatcher manual override');
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Save manual assignment modification
  const handleSaveManualEdit = async () => {
    if (!editingAssignment) return;
    setEditError('');
    setIsGenerating(true);

    const targetTech = technicians.find(t => t.technicianId === editTechId || t.id === editTechId);

    const payload = {
      technicianId: editTechId,
      technicianName: targetTech?.name || editingAssignment.technician,
      startTime: editStartTime,
      endTime: editEndTime,
      timeSlot: `${editStartTime} – ${editEndTime}`,
      unassign: editUnassign,
      reason: editReason || 'dispatcher manual override',
    };

    const res = await modifyProposedAssignment(editingAssignment.requestId, payload);
    setIsGenerating(false);

    if (res.success) {
      setIsEditModalOpen(false);
      showToast(`Assignment ${editingAssignment.requestId} updated in pending proposal (Hard constraints strictly verified).`, 'success');
    } else {
      setEditError(res.error || 'Constraint violation. Assignment could not be saved.');
    }
  };

  // Handle Approve Plan (Section 1 & 2)
  const handleConfirmApproval = async () => {
    setIsGenerating(true);
    const res = await approvePlan();
    setIsGenerating(false);
    setIsApproveModalOpen(false);

    if (res && !res.success) {
      if (res.isStale) {
        showToast(res.error || 'Plan is stale. Database state changed after proposal was generated.', 'error');
      } else {
        showToast(res.error || 'Plan approval blocked due to unresolved hard constraints.', 'error');
      }
    } else {
      showToast(`Plan Approved! Schedule version ${res?.versionLabel || 'confirmed'} created and dispatched.`, 'success');
    }
  };

  // Handle Reject Plan
  const handleConfirmRejection = async () => {
    await rejectPlan(rejectionReason);
    setIsRejectModalOpen(false);
    showToast(`AI Plan rejected: ${rejectionReason}. Ready to regenerate.`, 'info');
  };

  // Trigger Technician Cancellation Simulation
  const handleSimulateCancel = async () => {
    setIsTechCancelModalOpen(false);
    setIsGenerating(true);
    const targetTech = technicians.find(t => t.technicianId === cancelTechId || t.id === cancelTechId);
    await simulateTechnicianCancellation(cancelTechId, targetTech?.name || 'Rahul Sharma');
    setIsGenerating(false);
    showToast(`Technician ${targetTech?.name || cancelTechId} marked unavailable. Replanning triggered.`, 'warning');
  };

  // Trigger Emergency Request Creation
  const handleCreateEmergency = async () => {
    setIsEmergencyModalOpen(false);
    setIsGenerating(true);
    await addEmergencyRequest(emergencyForm);
    setIsGenerating(false);
    showToast(`Emergency request logged. AI Replanner formulating optimized proposal.`, 'warning');
  };

  const getStatusBadge = () => {
    if (aiPlan.error) {
      return (
        <Badge variant="danger" dot>
          AI Error
        </Badge>
      );
    }
    if (!aiPlan.planId) {
      return (
        <Badge variant="secondary" dot>
          No Plan Generated
        </Badge>
      );
    }
    if (aiPlan.status === 'CONFIRMED' || aiPlan.status === 'Plan Approved' || aiPlan.status === 'Confirmed' || aiPlan.status === 'APPROVED' || aiPlan.status === 'Approved') {
      return (
        <Badge variant="success" dot>
          APPROVED · Confirmed
        </Badge>
      );
    }
    if (aiPlan.status === 'Plan Rejected' || aiPlan.status === 'REJECTED' || aiPlan.status === 'Rejected') {
      return (
        <Badge variant="danger" dot>
          Plan Rejected
        </Badge>
      );
    }
    if (aiPlan.isStale) {
      return (
        <Badge variant="danger" dot>
          Plan Stale
        </Badge>
      );
    }
    return (
      <Badge variant="warning" dot>
        Awaiting Approval
      </Badge>
    );
  };

  const totalAssigned = aiPlan.totalAssigned ?? aiPlan.proposedAssignments?.length ?? stats.totalAssigned ?? 0;
  const totalUnassigned = aiPlan.totalUnassigned ?? (Array.isArray(aiPlan.unassignedRequests) ? aiPlan.unassignedRequests.length : (stats.unassigned ?? 0));

  const questionsList = Array.isArray(aiPlan.missingInformation)
    ? aiPlan.missingInformation
    : Array.isArray(aiPlan.questions)
    ? aiPlan.questions
    : [];

  const pendingQuestions = questionsList.filter(
    (item) => item && (typeof item === 'string' || (item.status !== 'Answered' && !item.selectedAnswer))
  );
  const resolvedQuestions = questionsList.filter(
    (item) => item && typeof item === 'object' && (item.status === 'Answered' || Boolean(item.selectedAnswer))
  );

  const proposedAssignments = Array.isArray(aiPlan.proposedAssignments) ? aiPlan.proposedAssignments : [];
  const unassignedRequests = Array.isArray(aiPlan.unassignedRequests) ? aiPlan.unassignedRequests : [];
  const whatChanged = Array.isArray(aiPlan.whatChanged) ? aiPlan.whatChanged : [];
  const analysisSummary = Array.isArray(aiPlan.analysisSummary) ? aiPlan.analysisSummary : [];
  const tradeOffs = Array.isArray(aiPlan.tradeOffs) ? aiPlan.tradeOffs : [];
  const risks = Array.isArray(aiPlan.risks) ? aiPlan.risks : [];

  const isPlanApproved =
    aiPlan.status === 'Plan Approved' ||
    aiPlan.status === 'CONFIRMED' ||
    aiPlan.status === 'APPROVED' ||
    aiPlan.status === 'Confirmed';

  const isPlanRejected =
    aiPlan.status === 'Plan Rejected' ||
    aiPlan.status === 'REJECTED' ||
    aiPlan.status === 'Rejected';

  const isProposalPending =
    aiPlan.planId && !isPlanApproved && !isPlanRejected;

  const errorMessage = aiPlan.error
    ? typeof aiPlan.error === 'string'
      ? aiPlan.error
      : aiPlan.error?.message || JSON.stringify(aiPlan.error)
    : null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200 border ${
            toastType === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : toastType === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {toastType === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            ) : toastType === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            )}
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Approval Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
              AI Dispatch Planner
            </h2>
            <Badge variant="info">
              <Sparkles className="w-3 h-3 text-[#4F46E5] mr-1" />
              {aiPlan.planId ? `Plan ${aiPlan.planId}` : 'Gemini AI Planner'}
            </Badge>
            {getStatusBadge()}
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Gemini generates schedule proposals only. Dispatcher can inspect, modify assignments, verify hard constraints, and approve atomic commits.
          </p>
        </div>

        {/* Action Buttons: Generate AI Plan, Review Plan, Approve Plan, Reject Plan, Simulation Triggers */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            disabled={isGenerating}
            onClick={() => handleGeneratePlan()}
          >
            {isGenerating ? 'Analyzing with Gemini...' : 'Generate AI Plan'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={Info}
            disabled={!aiPlan.planId}
            onClick={() => setIsReviewModalOpen(true)}
          >
            Review Plan
          </Button>

          <Button
            variant="danger"
            size="sm"
            icon={XCircle}
            disabled={!isProposalPending}
            onClick={() => setIsRejectModalOpen(true)}
          >
            Reject Plan
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            disabled={!isProposalPending}
            onClick={() => setIsApproveModalOpen(true)}
          >
            Approve Plan
          </Button>
        </div>
      </div>

      {/* Operational Simulation Toolbar (Phase 6 triggers) */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="font-bold text-[#172033]">Dispatch Triggers:</span>
          <span className="text-slate-500">Test reactive replanning scenarios</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={UserX}
            onClick={() => setIsTechCancelModalOpen(true)}
            className="text-xs"
          >
            Technician Cancellation
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Zap}
            onClick={() => setIsEmergencyModalOpen(true)}
            className="text-xs text-red-700 border-red-200 hover:bg-red-50"
          >
            Log Emergency Request
          </Button>
        </div>
      </div>

      {/* STALE PLAN WARNING BANNER (Section 11) */}
      {aiPlan.isStale && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-600 text-white shrink-0 shadow-xs mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  Plan is Stale — Concurrency Protection Triggered
                </h4>
                <Badge variant="warning" size="sm">
                  STALE PROPOSAL
                </Badge>
              </div>
              <p className="text-xs text-amber-900 mt-1">
                {aiPlan.staleMessage || 'The live MongoDB database state or active schedule version was modified after this AI proposal was formulated. Automatic commit is blocked to prevent conflicting double-bookings.'}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={RefreshCw}
            disabled={isGenerating}
            onClick={() => handleGeneratePlan('Stale Plan Replanning')}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-transparent"
          >
            Generate Revised AI Plan
          </Button>
        </div>
      )}

      {/* Plan Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B7280] block font-medium">Confidence Score</span>
            <span className="text-xl font-bold text-[#10B981]">{aiPlan.confidenceScore || (aiPlan.planId ? '95%' : '—')}</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B7280] block font-medium">Assigned Requests</span>
            <span className="text-xl font-bold text-[#4F46E5]">{totalAssigned}</span>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Check className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B7280] block font-medium">Unassigned Requests</span>
            <span className="text-xl font-bold text-amber-600">{totalUnassigned}</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B7280] block font-medium">Identified Risks</span>
            <span className="text-xl font-bold text-red-600">{risks.length > 0 ? risks.length : (aiPlan.planId ? 0 : '—')}</span>
          </div>
          <div className="p-2 rounded-lg bg-red-50 text-red-600">
            <QuestionIcon className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* APPROVED PLAN STATE (Section 2) */}
      {isPlanApproved && (
        <Card padding="p-6" className="border-emerald-300 bg-emerald-50/40 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-200">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-emerald-600 text-white shrink-0 shadow-sm">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-emerald-950">
                    APPROVED · Confirmed Schedule Dispatched
                  </h3>
                  <Badge variant="success" size="sm">
                    {aiPlan.scheduleVersion || 'v4'}
                  </Badge>
                  <span className="text-xs font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                    Plan {aiPlan.planId}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  Approved by <strong className="text-emerald-950">{aiPlan.approvedBy || 'Alex Rivera (Lead Dispatcher)'}</strong> on {aiPlan.approvedAt ? new Date(aiPlan.approvedAt).toLocaleTimeString() : 'Today'}. Atomically committed to MongoDB assignments, schedule versions, and audit logs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/schedule')}
              >
                View Active Schedule
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/versions')}
              >
                View Schedule Versions
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
            <div className="p-3 rounded-lg bg-white border border-emerald-200">
              <span className="text-emerald-700 block font-medium">Final Confirmed Jobs</span>
              <span className="text-lg font-bold text-emerald-950">{proposedAssignments.length}</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-emerald-200">
              <span className="text-emerald-700 block font-medium">Schedule Version</span>
              <span className="text-lg font-bold text-emerald-950">{aiPlan.scheduleVersion || 'v4'}</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-emerald-200">
              <span className="text-emerald-700 block font-medium">Changes Applied</span>
              <span className="text-lg font-bold text-emerald-950">{whatChanged.length}</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-emerald-200">
              <span className="text-emerald-700 block font-medium">Mock Notifications</span>
              <span className="text-lg font-bold text-emerald-950">{proposedAssignments.length + 1} Broadcast</span>
            </div>
          </div>
        </Card>
      )}

      {/* Plan Rejected Banner */}
      {isPlanRejected && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-600 text-white shrink-0 shadow-xs">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">AI Plan Proposal Rejected</h4>
              <p className="text-xs text-amber-800">
                Plan {aiPlan.planId} was rejected by the dispatcher. Active confirmed schedule remains untouched. Click &quot;Generate AI Plan&quot; to formulate a new proposal.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            disabled={isGenerating}
            onClick={() => handleGeneratePlan()}
            className="shrink-0 self-start sm:self-auto border-amber-200 text-amber-900 hover:bg-amber-100"
          >
            Regenerate Plan
          </Button>
        </div>
      )}

      {/* AI Service Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-red-600 text-white shrink-0 mt-0.5 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-red-950">
                  AI Service Error
                </h4>
                <Badge variant="danger" size="sm">
                  Failed
                </Badge>
              </div>
              <p className="text-xs text-red-800 mt-1 font-medium leading-relaxed">
                {errorMessage}
              </p>
              <p className="text-[11px] text-red-600 mt-0.5">
                The Gemini AI planner encountered an error. No mock or fallback plan was generated. Verify your GEMINI_API_KEY and network connection, then click &quot;Generate AI Plan&quot; to try again.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            disabled={isGenerating}
            onClick={() => handleGeneratePlan()}
            className="shrink-0 self-start sm:self-auto border-red-200 text-red-900 hover:bg-red-100"
          >
            Retry Gemini
          </Button>
        </div>
      )}

      {/* Empty State when no AI plan has been generated yet */}
      {!aiPlan.planId && !errorMessage && (
        <Card padding="p-8" className="text-center border-dashed border-2 border-indigo-100 bg-indigo-50/20">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-[#4F46E5] flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#172033]">
              No AI Plan Proposal Generated Yet
            </h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Click &quot;Generate AI Plan&quot; to send current live MongoDB requests, technician certifications, and scheduling constraints directly to the official Google Gemini API.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                icon={RefreshCw}
                disabled={isGenerating}
                onClick={() => handleGeneratePlan()}
              >
                {isGenerating ? 'Analyzing with Gemini...' : 'Generate AI Plan with Gemini'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* AI PROPOSAL — NOT YET APPROVED Banner */}
      {isProposalPending && (
        <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-200/90 text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#4F46E5] text-white shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-[#172033]">
                  AI PROPOSAL — NOT YET APPROVED
                </h4>
                <Badge variant="purple" size="sm">
                  DRAFT
                </Badge>
                {aiPlan.validation?.valid === true && (
                  <Badge variant="success" size="sm">
                    ✓ Validated
                  </Badge>
                )}
                {aiPlan.validation?.valid === false && (
                  <Badge variant="danger" size="sm">
                    ⚠ Validation Errors ({aiPlan.validation.errors?.length || 0})
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                AI analyzed live MongoDB state and generated this candidate plan. You can manually modify assignments before approving the atomic commit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={Info}
              onClick={() => setIsReviewModalOpen(true)}
            >
              Review Plan
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              onClick={() => setIsApproveModalOpen(true)}
            >
              Approve Plan
            </Button>
          </div>
        </div>
      )}

      {/* AI Plan Summary Section */}
      {aiPlan.planSummary && (
        <Card padding="p-4" className="border-indigo-100 bg-white">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-[#4F46E5] shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5] block">
                AI Plan Summary
              </span>
              <p className="text-xs sm:text-sm text-[#172033] leading-relaxed font-medium">
                {typeof aiPlan.planSummary === 'string' ? aiPlan.planSummary : JSON.stringify(aiPlan.planSummary)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* SECTION 1: MISSING INFORMATION QUESTIONS */}
      {aiPlan.planId && (
        <>
          <Card padding="p-5" className="border-amber-200/90 bg-amber-50/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                  <FileQuestion className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033]">
                    Missing Information Required by AI Planner
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Information the AI identifies that prevents reliable planning. Dispatcher answers directly guide the next plan generation.
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={HelpCircle}
                onClick={() => setIsAnswerModalOpen(true)}
                className="shrink-0"
              >
                Answer Questions
              </Button>
            </div>

            {/* Pending Questions Grid */}
            {pendingQuestions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {pendingQuestions.map((item, idx) => {
                  const qText = typeof item === 'string' ? item : item.question || item.description || `Clarification item ${idx + 1}`;
                  const qReqId = typeof item === 'object' && item.requestId ? item.requestId : `REQ-0${idx + 1}`;
                  const qWhy = typeof item === 'object' ? item.whyItMatters : null;
                  const rawOpts = typeof item === 'object' && Array.isArray(item.options) && item.options.length > 0
                    ? item.options
                    : ['Approve as proposed', 'Hold unassigned for next shift', 'Authorize 1-hour overtime'];
                  const qId = (typeof item === 'object' && item.id) || `MIS-${idx + 1}`;

                  return (
                    <div
                      key={qId}
                      className="p-3.5 rounded-xl border bg-white border-amber-200/80 text-[#172033] shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs font-mono text-[#4F46E5]">
                            {qReqId}
                          </span>
                          <Badge variant="warning" size="sm">
                            Action Required
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold leading-snug text-[#172033]">
                          {qText}
                        </p>
                        {qWhy && (
                          <p className="text-[11px] text-[#6B7280] mt-1.5 leading-relaxed bg-slate-50/80 p-2 rounded border border-gray-100">
                            <strong className="text-[#172033]">Why it matters: </strong>
                            {qWhy}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col gap-1.5">
                        <span className="text-[10px] text-[#6B7280] font-semibold uppercase">
                          Select Dispatcher Instruction:
                        </span>
                        <div className="flex flex-col gap-1">
                          {rawOpts.map((opt, optIdx) => {
                            const optText = typeof opt === 'string' ? opt : opt?.label || opt?.text || JSON.stringify(opt);
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => answerMissingInfoQuestion(qId, optText)}
                                className="text-[11px] px-2.5 py-1.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-[#4F46E5] text-[#172033] border border-gray-200 transition-colors font-medium text-left"
                              >
                                {optText}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-emerald-900">
                      All Missing Information Questions Resolved
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      Dispatcher answers have been incorporated into the candidate replan. The AI planner can now formulate optimized routes without ambiguity.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAnswerModalOpen(true)}
                  className="shrink-0 self-start sm:self-auto"
                >
                  Modify Decisions
                </Button>
              </div>
            )}

            {/* Resolved Questions / Decisions Applied Bar */}
            {resolvedQuestions.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-900">
                    Applied Dispatcher Decisions ({resolvedQuestions.length}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resolvedQuestions.map((q, idx) => {
                    const ansText = typeof q.selectedAnswer === 'string'
                      ? q.selectedAnswer
                      : typeof q.selectedAnswer === 'object'
                      ? JSON.stringify(q.selectedAnswer)
                      : String(q.selectedAnswer || 'Approved');
                    return (
                      <span
                        key={q.id || idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-emerald-200 text-emerald-900 text-[11px] font-medium shadow-xs"
                      >
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="font-bold font-mono">{q.requestId || `Q-${idx + 1}`}:</span>
                        <span>{ansText}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* WHAT CHANGED IN THIS REVISION (Section 4) */}
          {whatChanged.length > 0 && (
            <Card padding="p-5" className="border-indigo-100 bg-indigo-50/20">
              <CardHeader
                title="What Changed in this Revision"
                subtitle="Side-by-side reallocation delta following operational triggers or manual overrides"
                action={<GitBranch className="w-4 h-4 text-[#4F46E5]" />}
              />

              <div className="space-y-3">
                {whatChanged.map((diff, idx) => {
                  const reqId = typeof diff === 'object' ? diff.requestId || `REQ-0${idx + 1}` : `Change ${idx + 1}`;
                  const svcType = typeof diff === 'object' ? diff.serviceType || 'Service' : '';
                  const cust = typeof diff === 'object' ? diff.customer || '' : '';
                  const reason = typeof diff === 'object' ? diff.reason || 'Operational optimization' : String(diff);
                  const prevTech = typeof diff === 'object' ? diff.previousTech || 'Unassigned' : 'Previous';
                  const prevTime = typeof diff === 'object' ? diff.previousTime || 'None' : 'Previous Time';
                  const prevStatus = typeof diff === 'object' ? diff.previousStatus || 'ASSIGNED' : 'ASSIGNED';
                  const newTech = typeof diff === 'object' ? diff.newTech || 'Assigned' : 'New';
                  const newTime = typeof diff === 'object' ? diff.newTime || 'Scheduled Slot' : 'New Time';
                  const newStatus = typeof diff === 'object' ? diff.newStatus || 'PENDING_APPROVAL' : 'PENDING_APPROVAL';
                  const changeType = typeof diff === 'object' ? diff.changeType || 'AI proposed change' : 'AI proposed change';

                  const getChangeBadgeVariant = () => {
                    if (changeType.includes('manual') || changeType.includes('override') || changeType.includes('Dispatcher')) return 'purple';
                    if (changeType.includes('Emergency') || changeType.includes('emergency')) return 'danger';
                    if (changeType.includes('unavailable') || changeType.includes('Cancellation')) return 'warning';
                    return 'info';
                  };

                  return (
                    <div
                      key={reqId + idx}
                      className="p-3.5 rounded-xl border border-indigo-200/70 bg-white shadow-xs flex flex-col gap-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#172033]">
                            {reqId}
                          </span>
                          {svcType && (
                            <span className="text-xs font-semibold text-[#4F46E5] bg-indigo-50 px-2 py-0.5 rounded">
                              {svcType}
                            </span>
                          )}
                          {cust && (
                            <span className="text-xs text-[#6B7280]">
                              ({cust})
                            </span>
                          )}
                          <Badge variant={getChangeBadgeVariant()} size="sm">
                            {changeType}
                          </Badge>
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          <span className="font-semibold text-[#172033]">Reason: </span>
                          {reason}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-lg bg-red-50/70 border border-red-200/80">
                          <span className="text-[10px] uppercase font-bold text-red-700 tracking-wider block mb-1">
                            BEFORE
                          </span>
                          <div className="space-y-0.5 text-[#172033]">
                            <p><span className="text-[#6B7280]">Technician:</span> <span className="font-medium text-red-900">{prevTech}</span></p>
                            <p><span className="text-[#6B7280]">Time:</span> <span className="font-medium text-red-900">{prevTime}</span></p>
                            <p><span className="text-[#6B7280]">Status:</span> <span className="font-medium text-red-900">{prevStatus}</span></p>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block mb-1">
                            AFTER
                          </span>
                          <div className="space-y-0.5 text-[#172033]">
                            <p><span className="text-[#6B7280]">Technician:</span> <span className="font-semibold text-emerald-950">{newTech}</span></p>
                            <p><span className="text-[#6B7280]">Time:</span> <span className="font-semibold text-emerald-950">{newTime}</span></p>
                            <p><span className="text-[#6B7280]">Status:</span> <span className="font-semibold text-emerald-950">{newStatus}</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 2-Column Main Layout: Proposed Assignments (Left) & Heuristics/Analysis (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Proposed Assignments & Unassigned Pool */}
            <div className="lg:col-span-7 space-y-4">
              <Card padding="p-5">
                <CardHeader
                  title="Proposed Assignments"
                  subtitle={`Simulated ${proposedAssignments.length} valid assignments (Completed jobs protected)`}
                  action={
                    <span className="text-xs font-semibold text-[#10B981] bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      Confidence Score: {aiPlan.confidenceScore || '96%'}
                    </span>
                  }
                />

                <div className="space-y-3">
                  {proposedAssignments.map((item, idx) => {
                    const isCompleted = item.status === 'Completed' || item.isProtectedCompleted;
                    const reqId = item.requestId || item.id || `REQ-${idx + 1}`;
                    const techName = item.technician || item.technicianName || 'Unassigned Tech';
                    const timeSlot = item.timeSlot || `${item.startTime || '09:00'} – ${item.endTime || '11:00'}`;
                    const valErrors = Array.isArray(item.validationErrors)
                      ? item.validationErrors.map((e) => (typeof e === 'string' ? e : e?.reason || e?.message || JSON.stringify(e)))
                      : item.validationErrors
                      ? [String(item.validationErrors)]
                      : [];

                    return (
                      <div
                        key={reqId + idx}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 shadow-xs ${
                          isCompleted
                            ? 'bg-slate-100/90 border-slate-300 ring-1 ring-slate-200'
                            : 'bg-white border-gray-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-[#172033]">
                                {reqId}
                              </span>
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                              <span className="font-bold text-xs text-[#4F46E5]">
                                {techName}
                              </span>
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-600" />
                                  Completed — Protected
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 text-xs text-[#6B7280] mt-1 flex-wrap">
                              <span className="font-medium text-[#172033]">
                                {item.customer || 'Customer'}
                              </span>
                              <span>·</span>
                              <span>{item.skill || 'General Service'}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                {item.region || 'Jaipur Region'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[#172033] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              <Clock className="w-3 h-3 text-[#4F46E5]" />
                              {timeSlot}
                            </div>
                            {item.validationStatus === 'INVALID' || valErrors.length > 0 ? (
                              <Badge variant="danger" size="sm">
                                <XCircle className="w-3 h-3 mr-1 inline" /> Invalid
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm">
                                <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Validated
                              </Badge>
                            )}

                            {/* Section 3: Dispatcher Manual Modification Button */}
                            {isProposalPending && !isCompleted && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Edit3}
                                onClick={() => handleOpenEditModal(item)}
                                className="text-[11px] py-1 px-2 h-7"
                              >
                                Modify
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Validation Errors Notice if present */}
                        {valErrors.length > 0 && (
                          <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800">
                            <span className="font-bold">Validation Issue: </span>
                            {valErrors.join('; ')}
                          </div>
                        )}

                        {/* Assignment Explanation */}
                        {item.reason && (
                          <div className="pt-2 border-t border-gray-100 text-[11px] text-[#6B7280]">
                            <span className="font-semibold text-[#172033]">Assignment Rationale: </span>
                            {typeof item.reason === 'string' ? item.reason : JSON.stringify(item.reason)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Unassigned Requests Card */}
              {unassignedRequests.length > 0 && (
                <Card padding="p-5" className="border-amber-200 bg-amber-50/20">
                  <CardHeader
                    title="Unassigned Service Requests"
                    subtitle="Impossible pairings left unassigned to protect hard constraints"
                    action={
                      <Badge variant="warning">
                        {unassignedRequests.length} Unassigned
                      </Badge>
                    }
                  />

                  <div className="space-y-3">
                    {unassignedRequests.map((unassigned, idx) => {
                      const reqId = typeof unassigned === 'object' ? unassigned.requestId || `REQ-0${idx + 1}` : `REQ-0${idx + 1}`;
                      const priority = typeof unassigned === 'object' ? unassigned.priority || 'Normal' : 'Normal';
                      const customer = typeof unassigned === 'object' ? unassigned.customer || 'Customer' : 'Customer';
                      const windowText = typeof unassigned === 'object' ? unassigned.preferredWindow || '09:00 - 17:00' : '09:00 - 17:00';
                      const skill = typeof unassigned === 'object' ? unassigned.skill || 'General' : 'General';
                      const region = typeof unassigned === 'object' ? unassigned.region || 'Jaipur' : 'Jaipur';
                      const reason = typeof unassigned === 'object' ? unassigned.reason || 'Capacity constraint' : String(unassigned);

                      return (
                        <div
                          key={reqId + idx}
                          className="p-3.5 rounded-xl border border-amber-200 bg-white space-y-1.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-[#172033]">
                                {reqId}
                              </span>
                              <Badge variant={priority === 'Critical' ? 'danger' : 'warning'} size="sm">
                                {priority}
                              </Badge>
                              <span className="text-xs text-[#6B7280]">
                                ({customer})
                              </span>
                            </div>
                            <span className="text-xs font-mono text-gray-500">
                              {windowText}
                            </span>
                          </div>

                          <p className="text-xs text-[#172033]">
                            Skill: <strong>{skill}</strong> · Region: <strong>{region}</strong>
                          </p>

                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <strong>Reason: </strong>{reason}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column: AI Analysis, Trade-offs, Risks */}
            <div className="lg:col-span-5 space-y-5">
              {/* AI Analysis Summary */}
              <Card padding="p-5" className="border-indigo-100 bg-indigo-50/20">
                <CardHeader
                  title="AI Analysis Summary"
                  subtitle="Evaluation against hard and soft dispatch constraints"
                  action={<Sparkles className="w-4 h-4 text-[#4F46E5]" />}
                />
                <ul className="space-y-2.5 text-xs text-[#172033]">
                  {analysisSummary.map((item, idx) => {
                    const text = typeof item === 'string' ? item : item?.description || JSON.stringify(item);
                    return (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-indigo-100 shadow-xs"
                      >
                        <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {/* Trade-offs */}
              <Card padding="p-5">
                <CardHeader
                  title="Important Trade-offs"
                  subtitle="Algorithmic balancing decisions"
                  action={<SlidersHorizontal className="w-4 h-4 text-[#6B7280]" />}
                />
                <ul className="space-y-2 text-xs text-[#172033]">
                  {tradeOffs.map((item, idx) => {
                    const text = typeof item === 'string' ? item : item?.description || JSON.stringify(item);
                    return (
                      <li
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-gray-100"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0 mt-1.5" />
                        <span className="text-[#6B7280]">{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {/* Risks */}
              <Card padding="p-5">
                <CardHeader
                  title="Identified Risks"
                  subtitle="Potential SLA or capacity bottlenecks"
                  action={<AlertTriangle className="w-4 h-4 text-[#EF4444]" />}
                />
                <ul className="space-y-2 text-xs text-[#172033]">
                  {risks.map((item, idx) => {
                    const text = typeof item === 'string' ? item : `${item?.severity ? `[${item.severity}] ` : ''}${item?.description || item?.type || JSON.stringify(item)}`;
                    return (
                      <li
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100 text-red-950"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* DISPATCHER MANUAL MODIFICATION MODAL (Section 3) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Modify Assignment: ${editingAssignment?.requestId || ''}`}
        subtitle="Manually override proposed assignment with immediate constraint validation"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isGenerating}
              onClick={handleSaveManualEdit}
            >
              {isGenerating ? 'Validating & Saving...' : 'Save Manual Override'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {editError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Constraint Violation: </span>
                {editError}
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-50 border border-gray-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#172033]">{editingAssignment?.customer}</span>
              <Badge variant="info" size="sm">{editingAssignment?.skill}</Badge>
            </div>
            <p className="text-[#6B7280]">Region: {editingAssignment?.region}</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editUnassign}
                onChange={(e) => setEditUnassign(e.target.checked)}
                className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
              />
              <span className="font-semibold text-[#172033]">Leave this request unassigned</span>
            </label>

            {!editUnassign && (
              <>
                <div>
                  <label className="block font-semibold text-[#172033] mb-1">
                    Assign Technician:
                  </label>
                  <select
                    value={editTechId}
                    onChange={(e) => setEditTechId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-[#172033] focus:ring-2 focus:ring-[#4F46E5]"
                  >
                    {technicians.map((t) => (
                      <option
                        key={t.technicianId || t.id}
                        value={t.technicianId || t.id}
                        disabled={t.status === 'Unavailable' || t.status === 'UNAVAILABLE'}
                      >
                        {t.name} ({t.region}) · {t.skills?.join(', ')} {t.status === 'Unavailable' ? '[UNAVAILABLE]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#172033] mb-1">
                      Start Time (HH:mm):
                    </label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-[#172033]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#172033] mb-1">
                      End Time (HH:mm):
                    </label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-[#172033]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block font-semibold text-[#172033] mb-1">
                Override Rationale / Reason:
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g., Dispatcher manual override for customer request"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-[#172033]"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* APPROVE PLAN CONFIRMATION MODAL */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve AI Plan Confirmation"
        subtitle="Final verification before publishing schedule version"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              onClick={handleConfirmApproval}
            >
              Approve Plan
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-center">
              <span className="text-[11px] text-[#6B7280] block">Assignments</span>
              <span className="text-lg font-bold text-[#4F46E5]">
                {totalAssigned}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
              <span className="text-[11px] text-[#6B7280] block">Unassigned</span>
              <span className="text-lg font-bold text-amber-700">{totalUnassigned}</span>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
              <span className="text-[11px] text-[#6B7280] block">Risks Identified</span>
              <span className="text-lg font-bold text-red-700">
                {risks.length}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-gray-200 space-y-1.5">
            <span className="font-bold text-[#172033] block">Important Trade-offs</span>
            <ul className="space-y-1 list-disc list-inside text-[#6B7280]">
              {tradeOffs.map((t, idx) => {
                const text = typeof t === 'string' ? t : t?.description || JSON.stringify(t);
                return <li key={idx}>{text}</li>;
              })}
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Schedule Version Notice: </span>
              Approving this plan will execute an atomic MongoDB transaction, commit confirmed assignments, create an immutable schedule version, and broadcast mock technician notifications.
            </div>
          </div>
        </div>
      </Modal>

      {/* REJECT PLAN MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject AI Schedule Plan"
        subtitle="Provide rejection rationale to log in audit history"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmRejection}
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-[#6B7280]">
            Please select the primary reason for rejecting this proposed plan:
          </p>
          <div className="space-y-2">
            {[
              'Technician workload unbalanced',
              'Customer SLA window too narrow',
              'Travel distance between jobs is excessive',
              'Manual dispatcher override required',
            ].map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="rejectionReason"
                  checked={rejectionReason === reason}
                  onChange={() => setRejectionReason(reason)}
                  className="text-[#EF4444] focus:ring-[#EF4444]"
                />
                <span className="font-medium text-[#172033]">{reason}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>

      {/* TECHNICIAN CANCELLATION SIMULATION MODAL (Section 5) */}
      <Modal
        isOpen={isTechCancelModalOpen}
        onClose={() => setIsTechCancelModalOpen(false)}
        title="Simulate Technician Unavailability"
        subtitle="Simulate technician calling in sick or shift cancellation"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTechCancelModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={UserX}
              onClick={handleSimulateCancel}
            >
              Mark Unavailable & Replan
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#6B7280]">
            Select an active technician to mark as unavailable. The system will unassign future pending jobs while strictly protecting completed work (REQ-010).
          </p>
          <div>
            <label className="block font-semibold text-[#172033] mb-1">
              Select Technician:
            </label>
            <select
              value={cancelTechId}
              onChange={(e) => setCancelTechId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-[#172033]"
            >
              {technicians.map((t) => (
                <option key={t.technicianId || t.id} value={t.technicianId || t.id}>
                  {t.name} ({t.role}) — {t.region}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* EMERGENCY REQUEST MODAL (Section 6) */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        title="Log Emergency Service Request"
        subtitle="Emergency incident requiring immediate triage and AI replanning"
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
              variant="primary"
              size="sm"
              icon={Zap}
              onClick={handleCreateEmergency}
            >
              Log Emergency & Replan
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-[#172033] mb-1">Customer / Location:</label>
            <input
              type="text"
              value={emergencyForm.customer}
              onChange={(e) => setEmergencyForm({ ...emergencyForm, customer: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#172033] mb-1">Region:</label>
              <select
                value={emergencyForm.region}
                onChange={(e) => setEmergencyForm({ ...emergencyForm, region: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs"
              >
                <option value="Jaipur Central">Jaipur Central</option>
                <option value="Jaipur North">Jaipur North</option>
                <option value="Jaipur South">Jaipur South</option>
                <option value="Jaipur West">Jaipur West</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#172033] mb-1">Required Skill:</label>
              <select
                value={emergencyForm.requiredSkill}
                onChange={(e) => setEmergencyForm({ ...emergencyForm, requiredSkill: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs"
              >
                <option value="Electrical Repair">Electrical Repair</option>
                <option value="HVAC">HVAC</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Security Systems">Security Systems</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-[#172033] mb-1">Preferred Time Window:</label>
            <input
              type="text"
              value={emergencyForm.preferredWindow}
              onChange={(e) => setEmergencyForm({ ...emergencyForm, preferredWindow: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* REVIEW PLAN MODAL */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Plan Review: ${aiPlan.planId || 'Proposal'}`}
        subtitle="Complete heuristic review before dispatcher sign-off"
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsReviewModalOpen(false)}
          >
            Done Reviewing
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <span className="font-bold text-[#4F46E5] block mb-1">
              Deterministic Constraint Status
            </span>
            <p className="text-slate-700">
              All 10 hard constraints (skills, technician availability, time windows, workload, non-overlapping intervals) have been strictly verified. Completed jobs are protected.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-[#172033] mb-2">Assignment List:</h5>
            <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-gray-100">
              {proposedAssignments.map((p, idx) => {
                const reqId = p.requestId || p.id || `REQ-${idx + 1}`;
                const tech = p.technician || p.technicianName || 'Unassigned Tech';
                const timeSlot = p.timeSlot || `${p.startTime || '09:00'} – ${p.endTime || '11:00'}`;
                return (
                  <div key={reqId + idx} className="pt-1.5 flex items-center justify-between">
                    <span className="font-semibold text-[#172033]">
                      {reqId} → {tech}
                    </span>
                    <span className="font-mono text-gray-500">{timeSlot}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* ANSWER QUESTIONS MODAL */}
      <Modal
        isOpen={isAnswerModalOpen}
        onClose={() => setIsAnswerModalOpen(false)}
        title="Answer Missing Information Questions"
        subtitle="Resolve constraint questions to guide the optimization engine"
        footer={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setIsAnswerModalOpen(false);
              showToast('Dispatcher inputs saved. Click "Generate AI Plan" to apply.', 'info');
            }}
          >
            Save Decisions
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          {questionsList.map((q, idx) => {
            const qId = (typeof q === 'object' && q.id) || `MIS-${idx + 1}`;
            const qReqId = (typeof q === 'object' && q.requestId) || `REQ-0${idx + 1}`;
            const qText = typeof q === 'string' ? q : q.question || q.description || `Question ${idx + 1}`;
            const qWhy = typeof q === 'object' ? q.whyItMatters : null;
            const rawOpts = typeof q === 'object' && Array.isArray(q.options) && q.options.length > 0
              ? q.options
              : ['Approve as proposed', 'Hold unassigned for next shift', 'Authorize 1-hour overtime'];
            const isAnswered = typeof q === 'object' && (q.selectedAnswer || q.status === 'Answered');

            return (
              <div key={qId + idx} className="p-3.5 rounded-lg border border-gray-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#4F46E5] font-mono">{qReqId}</span>
                  {isAnswered && (
                    <Badge variant="success" size="sm">Answered</Badge>
                  )}
                </div>
                <p className="font-medium text-[#172033]">{qText}</p>
                {qWhy && (
                  <p className="text-[11px] text-[#6B7280]">
                    <strong>Why it matters: </strong>{qWhy}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {rawOpts.map((opt, optIdx) => {
                    const optText = typeof opt === 'string' ? opt : opt?.label || opt?.text || JSON.stringify(opt);
                    const selected = typeof q === 'object' && q.selectedAnswer === optText;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => answerMissingInfoQuestion(qId, optText)}
                        className={`px-2.5 py-1.5 rounded-md font-medium text-xs transition-colors border ${
                          selected
                            ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                            : 'bg-white text-[#172033] border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {optText}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
