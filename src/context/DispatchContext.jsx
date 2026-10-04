import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  SERVICE_REQUESTS,
  TECHNICIANS,
  SCHEDULE_VERSIONS,
  AUDIT_EVENTS,
  NOTIFICATIONS,
  DISPATCHER_PROFILE,
} from '../data/mockData';
import { validateStatusTransition, normalizeStatus } from '../utils/statusTransitions';
import { DispatchContext } from './context';
import {
  requestsApi,
  techniciansApi,
  assignmentsApi,
  plannerApi,
  scheduleApi,
  notificationsApi,
  auditApi,
} from '../api';

export function DispatchProvider({ children }) {
  const [requests, setRequests] = useState(SERVICE_REQUESTS);
  const [technicians, setTechnicians] = useState(TECHNICIANS);
  const [scheduleVersions, setScheduleVersions] = useState(SCHEDULE_VERSIONS);
  const [auditEvents, setAuditEvents] = useState(AUDIT_EVENTS);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Centralized source of truth for request stats (Requirement 1 & Dashboard API)
  const stats = useMemo(() => {
    const total = requests.length;
    const assigned = requests.filter(
      (r) => r.status === 'ASSIGNED' || r.status === 'Scheduled' || r.status === 'Assigned'
    ).length;
    const completed = requests.filter(
      (r) => r.status === 'COMPLETED' || r.status === 'Completed' || r.isProtectedCompleted
    ).length;
    const unassigned = requests.filter(
      (r) => r.status === 'UNASSIGNED' || r.status === 'Unassigned'
    ).length;
    const pendingApproval = requests.filter(
      (r) => r.status === 'PENDING_APPROVAL' || r.status === 'Pending Approval'
    ).length;
    const cancelled = requests.filter(
      (r) => r.status === 'CANCELLED' || r.status === 'Cancelled'
    ).length;

    // Do NOT count PENDING_APPROVAL as ASSIGNED.
    // Total assigned paired requests (active ASSIGNED + COMPLETED = 8 initially)
    const totalAssigned = assigned + completed;
    const unresolvedCount = unassigned + pendingApproval;

    return {
      total,
      assigned,
      completed,
      unassigned,
      pendingApproval,
      cancelled,
      totalAssigned,
      unresolvedCount,
    };
  }, [requests]);

  // Settings & Heuristics state
  const [settings, setSettings] = useState({
    autoReplanOnDelay: true,
    strictRegionBinding: false,
    maxTechnicianOvertimeHours: 2,
    defaultTimelineZoom: '1-Hour',
    soundAlerts: true,
    emailEmergencyAlerts: true,
  });

  // Dispatcher profile state
  const [profile, setProfile] = useState({
    name: DISPATCHER_PROFILE.name || 'Alex Rivera',
    email: DISPATCHER_PROFILE.email || 'alex.rivera@fieldflow.internal',
    role: DISPATCHER_PROFILE.role || 'Lead Operations Dispatcher',
    shift: DISPATCHER_PROFILE.shift || 'Shift A · 08:30 – 17:30',
  });

  // Replan alert state triggered by cancellation or emergency request
  const [replanAlert, setReplanAlert] = useState(null);

  // Mock Notification overlay / toast state
  const [mockNotificationToast, setMockNotificationToast] = useState(null);

  // Dispatcher answers to missing information questions
  const [dispatcherAnswers, setDispatcherAnswers] = useState({});

  // AI Plan State (Phase 5: Only populated by real Gemini API proposals)
  const [aiPlan, setAiPlan] = useState({
    planId: null,
    status: 'NO_PLAN',
    planSummary: null,
    confidenceScore: null,
    proposedAssignments: [],
    unassignedRequests: [],
    unassignedRequestsList: [],
    risks: [],
    tradeOffs: [],
    questions: [],
    missingInformation: [],
    whatChanged: [],
    analysisSummary: [],
    validation: null,
    metadata: null,
    isRevised: false,
    error: null,
  });

  // Refresh all state from MongoDB backend
  const refreshAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [reqs, techs, versions, notifs, logs, latestPlan] = await Promise.all([
        requestsApi.getRequests().catch(() => null),
        techniciansApi.getTechnicians().catch(() => null),
        scheduleApi.getVersions().catch(() => null),
        notificationsApi.getNotifications().catch(() => null),
        auditApi.getLogs().catch(() => null),
        plannerApi.getLatestPlan().catch(() => null),
      ]);

      if (reqs && reqs.length) {
        setRequests(
          reqs.map((r) => ({
            ...r,
            id: r.requestId || r.id,
            address: r.address || `${r.location || r.region}, Jaipur`,
          }))
        );
      }
      if (techs && techs.length) {
        setTechnicians(
          techs.map((t) => ({
            ...t,
            id: t.technicianId || t.id,
          }))
        );
      }
      if (versions && versions.length) {
        setScheduleVersions(
          versions.map((v) => ({
            ...v,
            id: v.versionId || v.id,
          }))
        );
      }
      if (notifs && notifs.length) {
        setNotifications(
          notifs.map((n) => ({
            ...n,
            id: n.notificationId || n.id,
            unread: n.unread !== undefined ? n.unread : !n.read,
          }))
        );
      }
      if (logs && logs.length) {
        setAuditEvents(
          logs.map((l) => ({
            ...l,
            id: l.auditId || l.id,
          }))
        );
      }
      if (latestPlan && latestPlan.planId) {
        setAiPlan({
          ...latestPlan,
          planSummary: latestPlan.plan?.planSummary || latestPlan.planSummary,
          proposedAssignments: latestPlan.plan?.assignments || latestPlan.proposedAssignments || [],
          unassignedRequests: latestPlan.plan?.unassignedRequests || latestPlan.unassignedRequests || [],
          unassignedRequestsList: latestPlan.plan?.unassignedRequests || latestPlan.unassignedRequestsList || latestPlan.unassignedRequests || [],
          risks: (latestPlan.plan?.risks || latestPlan.risks || []).map((r) =>
            typeof r === 'string' ? r : `${r.severity ? `[${r.severity}] ` : ''}${r.description || r.type}`
          ),
          tradeOffs: (latestPlan.plan?.tradeoffs || latestPlan.tradeOffs || []).map((t) =>
            typeof t === 'string' ? t : t.description
          ),
          questions: latestPlan.plan?.questions || latestPlan.questions || [],
          missingInformation: latestPlan.missingInformation || latestPlan.questions || latestPlan.plan?.questions || [],
          whatChanged: latestPlan.whatChanged || [],
          analysisSummary: latestPlan.analysisSummary || [],
          validation: latestPlan.validation,
          metadata: latestPlan.metadata,
          status: latestPlan.status || 'AWAITING_APPROVAL',
          error: null,
        });
      }
      setIsLoaded(true);
      setServerError(null);
    } catch (err) {
      console.warn('Backend sync warning, keeping memory cache:', err);
      setServerError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch live MongoDB state on mount
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // 1. Answer Missing Information Question
  const answerMissingInfoQuestion = async (questionId, selectedOption) => {
    const newAnswers = { ...dispatcherAnswers, [questionId]: selectedOption };
    setDispatcherAnswers(newAnswers);

    try {
      const plan = await plannerApi.generatePlan({
        triggerReason: `Dispatcher decision on ${questionId}`,
        dispatcherAnswers: newAnswers,
        settings,
      });

      setAiPlan({
        ...plan,
        status: 'AWAITING_APPROVAL',
        isRevised: true,
        missingInformation: (plan.missingInformation || []).map((q) =>
          q.id === questionId
            ? { ...q, selectedAnswer: selectedOption, status: 'Answered' }
            : q
        ),
      });

      const [logs, notifs] = await Promise.all([
        auditApi.getLogs().catch(() => null),
        notificationsApi.getNotifications().catch(() => null),
      ]);
      if (logs) setAuditEvents(logs);
      if (notifs) setNotifications(notifs);
    } catch (err) {
      console.error('Backend replanning with answered question failed:', err);
      setAiPlan((prev) => ({
        ...prev,
        error: err.message || 'Failed to regenerate plan proposal with Gemini.',
      }));
    }
  };

  // 2. Simulate Technician Cancellation
  const simulateTechnicianCancellation = async (techId, techName = 'Rahul Sharma') => {
    try {
      const res = await techniciansApi.updateAvailability(techId, 'UNAVAILABLE', `${techName} shift cancelled`);

      const [updatedTechs, updatedReqs, updatedLogs, updatedNotifs, planRes] = await Promise.all([
        techniciansApi.getTechnicians().catch(() => null),
        requestsApi.getRequests().catch(() => null),
        auditApi.getLogs().catch(() => null),
        notificationsApi.getNotifications().catch(() => null),
        plannerApi.generatePlan({ triggerReason: `Technician Cancellation Replan (${techName})` }).catch(() => null),
      ]);

      if (updatedTechs) setTechnicians(updatedTechs);
      if (updatedReqs) {
        setRequests(
          updatedReqs.map((r) => ({
            ...r,
            id: r.requestId || r.id,
            address: r.address || `${r.location || r.region}, Jaipur`,
          }))
        );
      }
      if (updatedLogs) setAuditEvents(updatedLogs);
      if (updatedNotifs) setNotifications(updatedNotifs);
      if (planRes) {
        setAiPlan({
          ...planRes,
          status: 'AWAITING_APPROVAL',
          isRevised: true,
        });
      }

      const affectedIds = res.affectedRequestIds || ['REQ-002', 'REQ-006'];
      setReplanAlert({
        required: true,
        triggerType: 'cancellation',
        message: `${techName} unavailable from 10:00. ${affectedIds.join(', ')} require(s) reassignment.`,
        affectedRequests: affectedIds,
      });

      setMockNotificationToast({
        title: 'Technician Unavailability',
        details: `${techName} unavailable from 10:00. ${affectedIds.join(', ')} requires reassignment.`,
        timestamp: 'Just now',
      });
    } catch (err) {
      console.warn('Backend simulate cancellation error, fallback local:', err);
      // Local fallback
      const updatedTechs = technicians.map((t) =>
        t.id === techId ? { ...t, status: 'Unavailable', availability: 'Cancelled Shift' } : t
      );
      setTechnicians(updatedTechs);

      const affected = requests.filter(
        (r) => r.assignedTechId === techId && r.status !== 'COMPLETED' && !r.isProtectedCompleted
      );
      const affectedIds = affected.map((r) => r.id);

      const updatedRequests = requests.map((r) => {
        if (affectedIds.includes(r.id)) {
          return {
            ...r,
            status: 'UNASSIGNED',
            needsReplanning: true,
            assignedTechId: null,
            assignedTechName: null,
            issueFlag: `Technician ${techName} cancelled shift`,
          };
        }
        return r;
      });
      setRequests(updatedRequests);

      setAiPlan((prev) => ({
        ...prev,
        error: `Technician ${techName} shift cancelled. Click "Generate AI Plan" to replan with Gemini.`,
      }));

      setReplanAlert({
        required: true,
        triggerType: 'cancellation',
        message: `${techName} unavailable from 10:00. ${affectedIds.join(', ')} require(s) reassignment.`,
        affectedRequests: affectedIds,
      });
    }
  };

  // 3. Emergency Request Flow
  const addEmergencyRequest = async (formData) => {
    try {
      const created = await requestsApi.createEmergencyRequest(formData);
      const formatted = {
        ...created,
        id: created.requestId || created.id,
        address: created.address || `${created.location || created.region}, Jaipur`,
      };

      setRequests((prev) => [formatted, ...prev.filter((r) => (r.requestId || r.id) !== formatted.id)]);

      const [logs, notifs, versions, planRes] = await Promise.all([
        auditApi.getLogs().catch(() => null),
        notificationsApi.getNotifications().catch(() => null),
        scheduleApi.getVersions().catch(() => null),
        plannerApi.generatePlan({ triggerReason: 'Emergency Request Replan' }).catch(() => null),
      ]);

      if (logs) setAuditEvents(logs);
      if (notifs) setNotifications(notifs);
      if (versions) setScheduleVersions(versions);
      if (planRes) {
        setAiPlan({
          ...planRes,
          status: 'AWAITING_APPROVAL',
          isRevised: true,
        });
      }

      setReplanAlert({
        required: true,
        triggerType: 'emergency',
        message: `Emergency request added: ${formatted.id} (${formatted.requiredSkill}, ${formatted.region}). Critical priority requires replanning.`,
        affectedRequests: [formatted.id],
      });

      setMockNotificationToast({
        title: 'Emergency Request Created',
        details: `Emergency ${formatted.id} added and schedule replanned.`,
        timestamp: 'Just now',
      });

      return formatted;
    } catch (err) {
      console.warn('Backend emergency request failed, local fallback:', err);
      const nextId = `REQ-0${requests.length + 1}`;
      const newReq = {
        id: nextId,
        customer: formData.customer || 'Emergency Incident Call',
        phone: formData.phone || '+91 99000 11223',
        location: formData.location || `${formData.region || 'Jaipur Central'}, MI Road`,
        region: formData.region || 'Jaipur Central',
        requiredSkill: formData.requiredSkill || 'Electrical Repair',
        priority: 'Critical',
        duration: formData.duration || '2 hours',
        durationHours: 2,
        preferredWindow: formData.preferredWindow || '15:00 - 17:00',
        startTime: null,
        endTime: null,
        status: 'UNASSIGNED',
        assignedTechId: null,
        assignedTechName: null,
        issueFlag: 'Critical emergency request awaiting dispatcher replan',
        notes: formData.notes || 'Emergency ticket logged for immediate dispatch triage.',
        address: `${formData.location || formData.region || 'Jaipur Central'}, Jaipur`,
      };

      const updatedRequests = [newReq, ...requests];
      setRequests(updatedRequests);

      setAiPlan((prev) => ({
        ...prev,
        error: `Emergency request ${newReq.id} created. Click "Generate AI Plan" to replan with Gemini.`,
      }));

      setReplanAlert({
        required: true,
        triggerType: 'emergency',
        message: `Emergency request added: ${newReq.id} (${newReq.requiredSkill}, ${newReq.region}). Critical priority requires replanning.`,
        affectedRequests: [newReq.id],
      });

      return newReq;
    }
  };

  // 4. Regular service request creation
  const createNewRequest = async (formData) => {
    try {
      const created = await requestsApi.createRequest(formData);
      const formatted = {
        ...created,
        id: created.requestId || created.id,
        address: created.address || `${created.location || created.region}, Jaipur`,
      };

      setRequests((prev) => [formatted, ...prev.filter((r) => (r.requestId || r.id) !== formatted.id)]);

      const [logs, notifs] = await Promise.all([
        auditApi.getLogs().catch(() => null),
        notificationsApi.getNotifications().catch(() => null),
      ]);
      if (logs) setAuditEvents(logs);
      if (notifs) setNotifications(notifs);

      return formatted;
    } catch (err) {
      console.warn('Backend create request failed, local fallback:', err);
      const nextId = `REQ-0${requests.length + 1}`;
      const newReq = {
        id: nextId,
        customer: formData.customer,
        phone: formData.phone || '+91 98290 12345',
        location: `${formData.region}, Sector 3`,
        region: formData.region,
        requiredSkill: formData.skill || formData.requiredSkill,
        priority: formData.priority || 'Normal',
        duration: formData.duration || '2 hours',
        durationHours: 2,
        preferredWindow: formData.preferredWindow || '10:00 - 13:00',
        startTime: null,
        endTime: null,
        status: 'Unassigned',
        assignedTechId: null,
        assignedTechName: null,
        notes: formData.notes || 'Standard ticket logged from web console.',
        address: `${formData.region}, Jaipur`,
      };

      setRequests((prev) => [newReq, ...prev]);
      return newReq;
    }
  };

  // 5. Generate AI Plan / Revised Plan
  const generateRevisedPlan = async (customTrigger = null) => {
    const triggerReason =
      customTrigger ||
      (replanAlert?.triggerType === 'cancellation'
        ? 'Technician Cancellation Replan'
        : replanAlert?.triggerType === 'emergency'
        ? 'Emergency Request Replan'
        : 'AI Optimization Run');

    try {
      const plan = await plannerApi.generatePlan({
        triggerReason,
        dispatcherAnswers,
        settings,
        isRevision: Boolean(customTrigger || replanAlert),
      });

      const updatedPlan = {
        ...plan,
        planSummary: plan.plan?.planSummary || plan.planSummary,
        proposedAssignments: plan.plan?.assignments || plan.proposedAssignments,
        unassignedRequests: plan.plan?.unassignedRequests || plan.unassignedRequests || [],
        unassignedRequestsList: plan.plan?.unassignedRequests || plan.unassignedRequests || [],
        risks: (plan.plan?.risks || plan.risks || []).map((r) =>
          typeof r === 'string' ? r : `${r.severity ? `[${r.severity}] ` : ''}${r.description || r.type}`
        ),
        tradeOffs: (plan.plan?.tradeoffs || plan.tradeOffs || []).map((t) =>
          typeof t === 'string' ? t : t.description
        ),
        questions: plan.plan?.questions || plan.questions || [],
        validation: plan.validation,
        metadata: plan.metadata,
        status: 'AWAITING_APPROVAL',
        isRevised: true,
        isStale: false,
        staleMessage: null,
      };

      setAiPlan(updatedPlan);

      const logs = await auditApi.getLogs().catch(() => null);
      if (logs) setAuditEvents(logs);

      return updatedPlan;
    } catch (err) {
      console.error('Gemini AI Planner failed:', err);
      const errorMsg = err.message || 'AI Dispatch Planner request failed.';
      setAiPlan({
        planId: null,
        status: 'ERROR',
        planSummary: null,
        confidenceScore: null,
        proposedAssignments: [],
        unassignedRequests: [],
        unassignedRequestsList: [],
        risks: [],
        tradeOffs: [],
        questions: [],
        missingInformation: [],
        whatChanged: [],
        analysisSummary: [],
        validation: null,
        metadata: null,
        isRevised: false,
        isStale: false,
        staleMessage: null,
        error: errorMsg,
      });
      return {
        success: false,
        error: errorMsg,
      };
    }
  };

  // 5b. Modify a proposed assignment in the pending AI plan proposal
  const modifyProposedAssignment = async (requestId, payload) => {
    if (!aiPlan.planId) {
      return { success: false, error: 'No active plan proposal to modify.' };
    }
    try {
      const res = await plannerApi.modifyProposedAssignment(aiPlan.planId, requestId, payload);
      if (res && res.success) {
        const updated = res.data || res.plan;
        setAiPlan((prev) => ({
          ...prev,
          ...updated,
          proposedAssignments: updated.proposedAssignments || prev.proposedAssignments,
          unassignedRequests: updated.unassignedRequests || prev.unassignedRequests,
          whatChanged: updated.whatChanged || prev.whatChanged,
          totalAssigned: updated.totalAssigned ?? prev.totalAssigned,
          totalUnassigned: updated.totalUnassigned ?? prev.totalUnassigned,
          validation: updated.validation || prev.validation,
          isStale: false,
        }));

        const logs = await auditApi.getLogs().catch(() => null);
        if (logs) setAuditEvents(logs);

        return { success: true, plan: updated };
      }
      return { success: false, error: res?.error?.message || 'Failed to modify proposed assignment' };
    } catch (err) {
      console.error('Modify proposed assignment error:', err);
      return { success: false, error: err.message || 'Constraint violation' };
    }
  };

  // 6. Approve AI Plan Flow (Transactional on backend)
  const approvePlan = async () => {
    try {
      const res = await plannerApi.approvePlan(aiPlan.planId, {
        approvedBy: profile.name,
        trigger: aiPlan.triggerReason || 'Dispatcher approved AI plan proposal',
        proposedAssignments: aiPlan.proposedAssignments,
      });

      if (res && res.success === false) {
        if (res.error?.code === 'PLAN_STALE') {
          setAiPlan((prev) => ({
            ...prev,
            isStale: true,
            staleMessage: res.error.message,
          }));
        }
        return {
          success: false,
          error: res.error?.message || res.message || 'Plan approval blocked.',
          isStale: res.error?.code === 'PLAN_STALE',
        };
      }

      // Atomically refetch all updated state from MongoDB
      const [freshReqs, freshTechs, freshVersions, freshLogs, freshNotifs] = await Promise.all([
        requestsApi.getRequests(),
        techniciansApi.getTechnicians(),
        scheduleApi.getVersions(),
        auditApi.getLogs(),
        notificationsApi.getNotifications(),
      ]);

      if (freshReqs) {
        setRequests(
          freshReqs.map((r) => ({
            ...r,
            id: r.requestId || r.id,
            address: r.address || `${r.location || r.region}, Jaipur`,
          }))
        );
      }
      if (freshTechs) {
        setTechnicians(
          freshTechs.map((t) => ({
            ...t,
            id: t.technicianId || t.id,
          }))
        );
      }
      if (freshVersions) {
        setScheduleVersions(
          freshVersions.map((v) => ({
            ...v,
            id: v.versionId || v.id,
          }))
        );
      }
      if (freshLogs) setAuditEvents(freshLogs);
      if (freshNotifs) setNotifications(freshNotifs);

      const versionLabel = res.version || res.data?.version || 'v4';

      setAiPlan((prev) => ({
        ...prev,
        status: 'CONFIRMED',
        approvedBy: profile.name,
        approvedAt: new Date().toISOString(),
        scheduleVersion: versionLabel,
        isStale: false,
      }));

      setReplanAlert(null);

      return { success: true, versionLabel };
    } catch (err) {
      console.error('Plan approval failed:', err);
      const isStale = err.message?.includes('stale') || err.message?.includes('Database schedule version changed');
      if (isStale) {
        setAiPlan((prev) => ({
          ...prev,
          isStale: true,
          staleMessage: 'Plan is stale. Database state changed after this proposal was generated.',
        }));
      }
      return {
        success: false,
        error: err.message || 'Cannot approve plan: Hard constraint violation detected.',
        isStale,
      };
    }
  };

  // 7. Reject AI Plan Flow
  const rejectPlan = async (rejectionReason = 'Dispatcher manual rejection') => {
    try {
      await plannerApi.rejectPlan(aiPlan.planId, {
        rejectedBy: profile.name,
        reason: rejectionReason,
      });

      setAiPlan((prev) => ({
        ...prev,
        status: 'Plan Rejected',
      }));

      const [logs, notifs] = await Promise.all([
        auditApi.getLogs().catch(() => null),
        notificationsApi.getNotifications().catch(() => null),
      ]);
      if (logs) setAuditEvents(logs);
      if (notifs) setNotifications(notifs);
    } catch (err) {
      console.warn('Backend plan rejection failed, local fallback:', err);
      setAiPlan((prev) => ({
        ...prev,
        status: 'Plan Rejected',
      }));
    }
  };

  // 8. Deterministic Manual Assignment Modification
  const modifyAssignment = async ({ requestId, technicianId, startTime, endTime }) => {
    const targetRequest = requests.find((r) => r.id === requestId || r.requestId === requestId);
    const targetTechnician = technicians.find((t) => t.id === technicianId || t.technicianId === technicianId);

    if (!targetRequest || !targetTechnician) {
      return {
        success: false,
        blockingReason: 'Request or technician not found.',
        checks: [],
      };
    }

    // Prevent modifying completed assignments (Hard constraint)
    if (targetRequest.status === 'COMPLETED' || targetRequest.status === 'Completed' || targetRequest.isProtectedCompleted) {
      return {
        success: false,
        blockingReason: `Cannot modify ${requestId}: Completed assignments are immutable and protected.`,
        checks: [],
      };
    }

    try {
      const res = await assignmentsApi.createAssignment({
        requestId: targetRequest.requestId || targetRequest.id,
        technicianId: targetTechnician.technicianId || targetTechnician.id,
        startTime,
        endTime,
        timeSlot: `${startTime} – ${endTime}`,
      });

      const [freshReqs, freshTechs, freshVersions, freshLogs, freshNotifs] = await Promise.all([
        requestsApi.getRequests(),
        techniciansApi.getTechnicians(),
        scheduleApi.getVersions(),
        auditApi.getLogs(),
        notificationsApi.getNotifications(),
      ]);

      if (freshReqs) {
        setRequests(
          freshReqs.map((r) => ({
            ...r,
            id: r.requestId || r.id,
            address: r.address || `${r.location || r.region}, Jaipur`,
          }))
        );
      }
      if (freshTechs) setTechnicians(freshTechs);
      if (freshVersions) setScheduleVersions(freshVersions);
      if (freshLogs) setAuditEvents(freshLogs);
      if (freshNotifs) setNotifications(freshNotifs);

      return {
        success: true,
        versionLabel: res.scheduleVersion || 'v4',
      };
    } catch (err) {
      return {
        success: false,
        blockingReason: err.message || 'Assignment violates scheduling constraints.',
        details: err.details || [],
      };
    }
  };

  // 9. Unassign a request
  const unassignRequest = async (requestId) => {
    const target = requests.find((r) => r.id === requestId || r.requestId === requestId);
    if (!target || target.status === 'COMPLETED' || target.status === 'Completed' || target.isProtectedCompleted) return false;

    try {
      await assignmentsApi.deleteAssignment(requestId);

      const [freshReqs, freshVersions, freshLogs, freshNotifs] = await Promise.all([
        requestsApi.getRequests(),
        scheduleApi.getVersions(),
        auditApi.getLogs(),
        notificationsApi.getNotifications(),
      ]);

      if (freshReqs) {
        setRequests(
          freshReqs.map((r) => ({
            ...r,
            id: r.requestId || r.id,
            address: r.address || `${r.location || r.region}, Jaipur`,
          }))
        );
      }
      if (freshVersions) setScheduleVersions(freshVersions);
      if (freshLogs) setAuditEvents(freshLogs);
      if (freshNotifs) setNotifications(freshNotifs);

      return true;
    } catch (err) {
      console.warn('Backend unassign failed, local fallback:', err);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'UNASSIGNED',
                assignedTechId: null,
                assignedTechName: null,
                startTime: null,
                endTime: null,
                needsReplanning: true,
              }
            : r
        )
      );
      return true;
    }
  };

  // 10. Service Request Lifecycle & State Machine Transitions
  const updateRequestStatus = async ({ requestId, newStatus, reason = '' }) => {
    const targetRequest = requests.find((r) => r.id === requestId || r.requestId === requestId);
    if (!targetRequest) {
      return { success: false, error: `Request ${requestId} not found.` };
    }

    const currentStatus = normalizeStatus(targetRequest.status);
    const targetStatus = normalizeStatus(newStatus);

    // Validate transition
    const validation = validateStatusTransition(currentStatus, targetStatus);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const res = await requestsApi.updateRequestStatus(requestId, targetStatus, reason);

      const [freshReqs, freshLogs, freshNotifs] = await Promise.all([
        requestsApi.getRequests(),
        auditApi.getLogs(),
        notificationsApi.getNotifications(),
      ]);

      if (freshReqs) {
        setRequests(
          freshReqs.map((r) => ({
            ...r,
            id: r.requestId || r.id,
            address: r.address || `${r.location || r.region}, Jaipur`,
          }))
        );
      }
      if (freshLogs) setAuditEvents(freshLogs);
      if (freshNotifs) setNotifications(freshNotifs);

      return { success: true, newStatus: res.status || targetStatus };
    } catch (err) {
      return { success: false, error: err.message || 'Status transition rejected.' };
    }
  };

  // 11. Rollback to an immutable schedule version
  const rollbackToVersion = async (versionLabel) => {
    try {
      const res = await scheduleApi.rollbackVersion(versionLabel, {
        performedBy: profile.name,
      });

      const [freshReqs, freshVersions, freshLogs, freshNotifs] = await Promise.all([
        requestsApi.getRequests(),
        scheduleApi.getVersions(),
        auditApi.getLogs(),
        notificationsApi.getNotifications(),
      ]);

      if (freshReqs) {
        setRequests(
          freshReqs.map((r) => ({
            ...r,
            id: r.requestId || r.id,
            address: r.address || `${r.location || r.region}, Jaipur`,
          }))
        );
      }
      if (freshVersions) setScheduleVersions(freshVersions);
      if (freshLogs) setAuditEvents(freshLogs);
      if (freshNotifs) setNotifications(freshNotifs);

      const newVersionLabel = res.version || res.data?.version || 'v4';
      return {
        success: true,
        message: `Rollback successful: Restored ${versionLabel} as new draft ${newVersionLabel}.`,
        versionLabel: newVersionLabel,
      };
    } catch (err) {
      return { success: false, message: err.message || `Rollback to ${versionLabel} failed.` };
    }
  };

  // 12. Notification management
  const markAllNotificationsAsRead = async () => {
    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.warn('Backend markAllRead warning:', err);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false, read: true })));
  };

  const toggleNotificationRead = async (id) => {
    const target = notifications.find((n) => n.id === id || n.notificationId === id);
    const targetId = target?.notificationId || target?.id || id;
    const isCurrentlyUnread = target ? (target.unread ?? !target.read) : true;

    try {
      if (isCurrentlyUnread) {
        await notificationsApi.markRead(targetId);
      } else {
        await notificationsApi.markUnread(targetId);
      }
    } catch (err) {
      console.warn('Backend notification toggle warning:', err);
    }

    setNotifications((prev) =>
      prev.map((n) =>
        (n.id === id || n.notificationId === id)
          ? { ...n, read: isCurrentlyUnread, unread: !isCurrentlyUnread }
          : n
      )
    );
  };

  // Explicitly reload latest AI plan proposal
  const loadLatestPlan = useCallback(async () => {
    try {
      const latestPlan = await plannerApi.getLatestPlan();
      if (latestPlan && latestPlan.planId) {
        setAiPlan({
          ...latestPlan,
          planSummary: latestPlan.plan?.planSummary || latestPlan.planSummary,
          proposedAssignments: latestPlan.plan?.assignments || latestPlan.proposedAssignments || [],
          unassignedRequests: latestPlan.plan?.unassignedRequests || latestPlan.unassignedRequests || [],
          unassignedRequestsList: latestPlan.plan?.unassignedRequests || latestPlan.unassignedRequestsList || latestPlan.unassignedRequests || [],
          risks: (latestPlan.plan?.risks || latestPlan.risks || []).map((r) =>
            typeof r === 'string' ? r : `${r.severity ? `[${r.severity}] ` : ''}${r.description || r.type}`
          ),
          tradeOffs: (latestPlan.plan?.tradeoffs || latestPlan.tradeOffs || []).map((t) =>
            typeof t === 'string' ? t : t.description
          ),
          questions: latestPlan.plan?.questions || latestPlan.questions || [],
          missingInformation: latestPlan.missingInformation || latestPlan.questions || latestPlan.plan?.questions || [],
          whatChanged: latestPlan.whatChanged || [],
          analysisSummary: latestPlan.analysisSummary || [],
          validation: latestPlan.validation,
          metadata: latestPlan.metadata,
          status: latestPlan.status || 'AWAITING_APPROVAL',
          error: null,
        });
        return latestPlan;
      }
      return null;
    } catch (err) {
      console.warn('Failed to load latest plan:', err);
      return null;
    }
  }, []);

  // Update Settings
  const updateSettings = (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Update Profile
  const updateProfile = (newProfile) => {
    setProfile((prev) => ({ ...prev, ...newProfile }));
  };

  return (
    <DispatchContext.Provider
      value={{
        stats,
        requests,
        technicians,
        scheduleVersions,
        auditEvents,
        notifications,
        replanAlert,
        aiPlan,
        settings,
        profile,
        dispatcherAnswers,
        mockNotificationToast,
        setMockNotificationToast,
        answerMissingInfoQuestion,
        simulateTechnicianCancellation,
        addEmergencyRequest,
        createNewRequest,
        generateRevisedPlan,
        approvePlan,
        rejectPlan,
        modifyAssignment,
        modifyProposedAssignment,
        unassignRequest,
        updateRequestStatus,
        rollbackToVersion,
        markAllNotificationsAsRead,
        toggleNotificationRead,
        updateSettings,
        updateProfile,
        dismissReplanAlert: () => setReplanAlert(null),
        dismissMockNotification: () => setMockNotificationToast(null),
        refreshAllData,
        loadLatestPlan,
        isLoading,
        isLoaded,
        serverError,
      }}
    >
      {children}
    </DispatchContext.Provider>
  );
}
