import mongoose from 'mongoose';
import ServiceRequest from '../models/ServiceRequest.js';
import Technician from '../models/Technician.js';
import Assignment from '../models/Assignment.js';
import ScheduleVersion from '../models/ScheduleVersion.js';
import Approval from '../models/Approval.js';
import PlanProposal from '../models/PlanProposal.js';
import { validateAssignment } from '../services/validationService.js';
import { logAuditEvent } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';
import { evaluateCandidateEligibility } from '../services/candidateService.js';
import { generateGeminiDispatchPlan } from '../services/geminiPlannerService.js';
import { validateAiPlanProposal } from '../services/planValidator.js';

// In-memory fallback map for active proposed plans
const activeProposedPlans = new Map();

/**
 * Generate a new AI Dispatch Plan using Gemini API
 * Live MongoDB state -> Candidate Filter -> Gemini -> PlanValidator -> PlanProposal (MongoDB)
 */
export async function generatePlan(req, res, next) {
  try {
    const {
      question,
      dispatcherQuestion,
      triggerReason = 'AI Dispatch Optimization',
      dispatcherAnswers = {},
      settings = {},
      isRevision = false,
    } = req.body;

    // 1. Fetch real current state from MongoDB
    const [requests, technicians, assignments, scheduleVersions] = await Promise.all([
      ServiceRequest.find({}).lean(),
      Technician.find({}).lean(),
      Assignment.find({}).lean(),
      ScheduleVersion.find({}).sort({ versionNumber: -1 }).lean(),
    ]);

    const currentVersion = scheduleVersions.find((v) => v.isCurrent) || scheduleVersions[0] || { version: 'v3', versionNumber: 3 };

    // 2. Perform deterministic candidate filtering before invoking Gemini
    const candidateInfo = evaluateCandidateEligibility({
      requests,
      technicians,
      assignments,
      settings,
      dispatcherAnswers,
    });

    // 3. Verify Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
      return res.status(400).json({
        success: false,
        error: 'Gemini API key is not configured',
      });
    }

    // 4. Invoke Gemini API via official @google/genai SDK
    const promptQuestion =
      question ||
      dispatcherQuestion ||
      (triggerReason ? `Generate the best feasible dispatch plan for ${triggerReason}.` : "Generate the best feasible dispatch plan for today's schedule.");

    const geminiResult = await generateGeminiDispatchPlan({
      requests,
      technicians,
      existingAssignments: assignments,
      eligibleCandidatesByRequest: candidateInfo.candidatesByRequest,
      scheduleVersion: currentVersion.version || 'v3',
      dispatcherQuestion: promptQuestion,
    });

    if (!geminiResult.success) {
      return res.status(502).json({
        success: false,
        error: geminiResult.error,
      });
    }

    const rawPlan = geminiResult.plan;
    const modelUsed = geminiResult.metadata?.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const generatedAt = geminiResult.metadata?.generatedAt || new Date().toISOString();

    // 5. Backend validation of the Gemini proposal — strictly enforces hard constraints
    const validation = validateAiPlanProposal({
      proposedAssignments: rawPlan.assignments || [],
      requests,
      technicians,
      existingAssignments: assignments,
      options: {
        dispatcherAnswers,
        allowOvertime: settings.autoAllowOvertime,
      },
    });

    const planId = `PLAN-${Date.now().toString().slice(-6)}`;

    // Deduplicate proposed assignments by requestId to prevent duplicate entries
    const seenReqIds = new Set();
    const deduplicatedAssignments = [];
    for (const v of validation.validatedAssignments) {
      if (seenReqIds.has(v.requestId)) continue;
      seenReqIds.add(v.requestId);

      const reqObj = requests.find((r) => r.requestId === v.requestId);
      const isCompleted = v.isProtectedCompleted || reqObj?.isProtectedCompleted || reqObj?.status === 'COMPLETED';

      deduplicatedAssignments.push({
        ...v,
        id: v.requestId,
        requestId: v.requestId,
        customer: v.customer || reqObj?.customer,
        skill: v.skill || reqObj?.requiredSkill,
        region: v.region || reqObj?.region,
        technician: v.technicianName,
        technicianName: v.technicianName,
        technicianId: v.technicianId,
        timeSlot: v.timeSlot || `${v.startTime} – ${v.endTime}`,
        startTime: v.startTime,
        endTime: v.endTime,
        status: isCompleted ? 'Completed' : 'ASSIGNED',
        isProtectedCompleted: isCompleted,
        reason: v.reason || 'Assigned by AI Dispatch Planner',
        confidence: v.confidence ? `${v.confidence}%` : '95%',
        score: v.confidence ? `${v.confidence}%` : '95%',
      });
    }

    // Merge unaffected existing active assignments (such as completed REQ-010 or unaffected confirmed assignments)
    // to preserve full schedule integrity without duplicating assignments
    const fullActiveAssignments = [...deduplicatedAssignments];
    for (const exist of assignments) {
      if (exist.status === 'Cancelled' || exist.status === 'CANCELLED') continue;
      if (seenReqIds.has(exist.requestId)) continue;
      if ((rawPlan.unassignedRequests || []).some((u) => u.requestId === exist.requestId)) continue;

      const reqObj = requests.find((r) => r.requestId === exist.requestId);
      const isCompleted = exist.isProtectedCompleted || reqObj?.isProtectedCompleted || reqObj?.status === 'COMPLETED';

      seenReqIds.add(exist.requestId);
      fullActiveAssignments.push({
        id: exist.requestId,
        requestId: exist.requestId,
        customer: exist.customer || reqObj?.customer,
        skill: exist.skill || reqObj?.requiredSkill,
        region: exist.region || reqObj?.region,
        technician: exist.technician || exist.technicianName,
        technicianName: exist.technician || exist.technicianName,
        technicianId: exist.technicianId || exist.assignedTechId,
        timeSlot: exist.timeSlot || `${exist.startTime} – ${exist.endTime}`,
        startTime: exist.startTime,
        endTime: exist.endTime,
        status: isCompleted ? 'Completed' : 'ASSIGNED',
        isProtectedCompleted: isCompleted,
        reason: isCompleted ? 'Protected completed assignment' : 'Existing confirmed assignment',
        confidence: '100%',
        score: '100%',
      });
    }

    const proposedAssignments = fullActiveAssignments;

    const risksList = (rawPlan.risks || []).map((r) =>
      typeof r === 'string' ? r : `${r.severity ? `[${r.severity}] ` : ''}${r.description || r.type}`
    );
    const tradeOffsList = (rawPlan.tradeoffs || []).map((t) =>
      typeof t === 'string' ? t : t.description
    );

    const questionsList = (rawPlan.questions || []).map((q, idx) => {
      const qText = typeof q === 'string' ? q : q.question || q.description || `Clarification item ${idx + 1}`;
      return {
        id: q.id || `MIS-${String(idx + 1).padStart(3, '0')}`,
        requestId: q.requestId || `REQ-0${idx + 1}`,
        question: qText,
        whyItMatters: q.whyItMatters || 'Resolving this uncertainty guides the AI algorithm to generate an optimal conflict-free schedule.',
        options: Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : ['Approve as proposed', 'Hold unassigned for next shift', 'Authorize 1-hour overtime'],
        status: q.status || 'Pending',
        selectedAnswer: q.selectedAnswer || null,
      };
    });

    // Build diff summary of what changed
    const whatChanged = proposedAssignments.map((p) => {
      const origAsg = assignments.find((a) => a.requestId === p.requestId);
      const previousTech = origAsg ? (origAsg.technicianName || origAsg.technician) : 'Unassigned';
      const previousTime = origAsg ? (origAsg.timeSlot || `${origAsg.startTime} - ${origAsg.endTime}`) : 'None';
      const previousStatus = origAsg ? origAsg.status : 'UNASSIGNED';

      let changeType = 'AI proposed change';
      if (triggerReason.toLowerCase().includes('emergency')) {
        changeType = 'Emergency replanning change';
      } else if (triggerReason.toLowerCase().includes('unavailable') || triggerReason.toLowerCase().includes('cancellation')) {
        changeType = 'Technician unavailability replanning';
      }

      return {
        requestId: p.requestId,
        customer: p.customer,
        serviceType: p.skill,
        previousTech,
        previousTime,
        previousStatus,
        newTech: p.technician,
        newTime: p.timeSlot,
        newStatus: p.status,
        changeType,
        reason: p.reason,
      };
    });

    const fullProposal = {
      planId,
      planSummary: rawPlan.planSummary,
      totalAssigned: proposedAssignments.length,
      totalUnassigned: (rawPlan.unassignedRequests || []).length,
      confidenceScore: '95%',
      status: 'AWAITING_APPROVAL',
      proposedAssignments,
      unassignedRequests: rawPlan.unassignedRequests || [],
      unassignedRequestsList: rawPlan.unassignedRequests || [],
      risks: risksList,
      tradeOffs: tradeOffsList,
      questions: questionsList,
      missingInformation: questionsList,
      analysisSummary: [
        rawPlan.planSummary,
        validation.valid ? 'Deterministic constraints verified: PASSED' : `Validation errors detected: ${validation.errors.length}`,
      ],
      whatChanged,
      triggerReason,
      validation: {
        valid: validation.valid,
        errors: validation.errors,
      },
      sourceRequestIds: requests.map((r) => r.requestId),
      metadata: {
        model: modelUsed,
        generatedAt,
        scheduleVersion: currentVersion.version || 'v3',
        baselineVersionNumber: currentVersion.versionNumber || 3,
        isRevision,
      },
    };

    // 6. Persist the complete proposal in MongoDB immediately
    try {
      await PlanProposal.create(fullProposal);
    } catch (persistErr) {
      console.error('[MongoDB Error] Failed to persist AI plan proposal:', persistErr);
      return res.status(500).json({
        success: false,
        error: `Database persistence failed for AI proposal: ${persistErr.message}`,
      });
    }

    // Cache in memory for fast fallback
    activeProposedPlans.set(planId, fullProposal);

    // 7. Audit Observability
    await logAuditEvent({
      action: isRevision ? 'REVISED_PLAN_GENERATED' : 'AI_PLAN_GENERATED',
      entityType: 'planner',
      entityId: planId,
      entity: `AI dispatch plan proposal ${planId} generated by ${modelUsed} (Persisted in MongoDB, No schedule commit). Schedule: ${currentVersion.version || 'v3'}. Proposal validated: ${validation.valid ? 'VALID' : 'INVALID'}.`,
      performedBy: `Gemini (${modelUsed})`,
      actorType: 'system',
      actor: 'Gemini AI Planner',
      source: 'AI',
      affectedPlanVersion: currentVersion.version || 'v3',
      newState: 'PROPOSAL_GENERATED',
      reason: triggerReason || 'AI Dispatch Optimization',
    });

    // 8. Structured JSON response
    res.json({
      success: true,
      plan: {
        planSummary: rawPlan.planSummary,
        assignments: proposedAssignments,
        unassignedRequests: rawPlan.unassignedRequests || [],
        risks: rawPlan.risks || [],
        tradeoffs: rawPlan.tradeoffs || [],
        questions: rawPlan.questions || [],
      },
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        validationErrors: validation.errors,
      },
      metadata: fullProposal.metadata,
      planId,
      status: 'AWAITING_APPROVAL',
      confidenceScore: '95%',
      totalAssigned: proposedAssignments.length,
      totalUnassigned: (rawPlan.unassignedRequests || []).length,
      assignedRequests: proposedAssignments.length,
      unassignedRequestsList: rawPlan.unassignedRequests || [],
      proposedAssignments,
      unassignedRequests: rawPlan.unassignedRequests || [],
      risks: risksList,
      tradeOffs: tradeOffsList,
      questions: questionsList,
      missingInformation: questionsList,
      whatChanged: fullProposal.whatChanged,
      analysisSummary: fullProposal.analysisSummary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve the latest persisted AI Plan proposal from MongoDB
 */
export async function getLatestPlan(req, res, next) {
  try {
    const { status, date } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }
    if (date) {
      query.workingDate = date;
    }

    const latestProposal = await PlanProposal.findOne(query).sort({ createdAt: -1 }).lean();

    if (!latestProposal) {
      return res.json({
        success: true,
        plan: null,
        message: 'No AI plan proposal found.',
      });
    }

    const normRisks = (latestProposal.risks || []).map((r) =>
      typeof r === 'string' ? r : `${r.severity ? `[${r.severity}] ` : ''}${r.description || r.type || JSON.stringify(r)}`
    );
    const normTradeoffs = (latestProposal.tradeOffs || []).map((t) =>
      typeof t === 'string' ? t : t.description || JSON.stringify(t)
    );
    const normQuestions = (latestProposal.questions || latestProposal.missingInformation || []).map((q, idx) => {
      const qText = typeof q === 'string' ? q : q.question || q.description || `Clarification item ${idx + 1}`;
      return {
        id: q.id || `MIS-${String(idx + 1).padStart(3, '0')}`,
        requestId: q.requestId || `REQ-0${idx + 1}`,
        question: qText,
        whyItMatters: q.whyItMatters || 'Resolving this uncertainty guides the AI algorithm to generate an optimal conflict-free schedule.',
        options: Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : ['Approve as proposed', 'Hold unassigned for next shift', 'Authorize 1-hour overtime'],
        status: q.status || 'Pending',
        selectedAnswer: q.selectedAnswer || null,
      };
    });

    return res.json({
      success: true,
      plan: {
        planSummary: latestProposal.planSummary,
        assignments: latestProposal.proposedAssignments || [],
        unassignedRequests: latestProposal.unassignedRequests || [],
        risks: normRisks,
        tradeoffs: normTradeoffs,
        questions: normQuestions,
      },
      validation: latestProposal.validation || { valid: true, errors: [] },
      metadata: latestProposal.metadata || {},
      planId: latestProposal.planId,
      status: latestProposal.status,
      confidenceScore: latestProposal.confidenceScore || '95%',
      totalAssigned: latestProposal.totalAssigned || latestProposal.proposedAssignments?.length || 0,
      totalUnassigned: latestProposal.totalUnassigned || latestProposal.unassignedRequests?.length || 0,
      assignedRequests: latestProposal.totalAssigned || latestProposal.proposedAssignments?.length || 0,
      unassignedRequestsList: latestProposal.unassignedRequestsList || latestProposal.unassignedRequests || [],
      proposedAssignments: latestProposal.proposedAssignments || [],
      unassignedRequests: latestProposal.unassignedRequests || [],
      risks: normRisks,
      tradeOffs: normTradeoffs,
      questions: normQuestions,
      missingInformation: normQuestions,
      whatChanged: latestProposal.whatChanged || [],
      analysisSummary: latestProposal.analysisSummary || [],
      triggerReason: latestProposal.triggerReason,
      sourceRequestIds: latestProposal.sourceRequestIds || [],
      data: latestProposal,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve all persisted AI Plan proposals
 */
export async function getProposals(req, res, next) {
  try {
    const proposals = await PlanProposal.find({}).sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      count: proposals.length,
      data: proposals,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve specific proposal by planId
 */
export async function getPlanById(req, res, next) {
  try {
    const { planId } = req.params;
    const proposal = await PlanProposal.findOne({ planId }).lean();
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: `Plan proposal ${planId} not found`,
      });
    }
    res.json({
      success: true,
      data: proposal,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/planner/:planId/assignments/:requestId
 * Dispatcher manual modification of a proposed assignment before approval
 * Validates against all 10 hard constraints, updates proposal only (no confirmed assignment commit)
 */
export async function modifyProposalAssignment(req, res, next) {
  try {
    const { planId, requestId } = req.params;
    const {
      technicianId,
      technicianName,
      technician,
      startTime,
      endTime,
      timeSlot,
      unassign = false,
      reason = 'dispatcher manual override',
    } = req.body;

    const proposal = await PlanProposal.findOne({ planId });
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Proposal ${planId} not found.` },
      });
    }

    if (proposal.status === 'CONFIRMED' || proposal.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        error: { code: 'PLAN_ALREADY_APPROVED', message: 'Cannot modify an already approved and dispatched plan.' },
      });
    }

    const [allRequests, allTechnicians, existingAssignments] = await Promise.all([
      ServiceRequest.find({}).lean(),
      Technician.find({}).lean(),
      Assignment.find({}).lean(),
    ]);

    const targetRequest = allRequests.find((r) => r.requestId === requestId || r.id === requestId);
    if (!targetRequest) {
      return res.status(404).json({
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: `Request ${requestId} not found in database.` },
      });
    }

    // Completed assignment protection (Rule: REQ-010 is immutable)
    if (targetRequest.isProtectedCompleted || targetRequest.status === 'COMPLETED' || targetRequest.status === 'Completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'COMPLETED_ASSIGNMENT_PROTECTED',
          message: `Request ${requestId} is COMPLETED and strictly protected from manual modifications.`,
        },
      });
    }

    const proposedAssignments = [...(proposal.proposedAssignments || [])];
    const unassignedRequests = [...(proposal.unassignedRequests || [])];
    const oldAsgIndex = proposedAssignments.findIndex((p) => p.requestId === requestId);
    const oldAssignment = oldAsgIndex >= 0 ? proposedAssignments[oldAsgIndex] : null;

    if (unassign) {
      // Remove from proposed assignments, place into unassignedRequests
      if (oldAsgIndex >= 0) {
        proposedAssignments.splice(oldAsgIndex, 1);
      }
      if (!unassignedRequests.some((u) => u.requestId === requestId)) {
        unassignedRequests.push({
          requestId,
          priority: targetRequest.priority,
          customer: targetRequest.customer,
          preferredWindow: targetRequest.preferredWindow,
          skill: targetRequest.requiredSkill,
          region: targetRequest.region,
          reason: reason || 'Unassigned by dispatcher override',
        });
      }

      // Record whatChanged
      proposal.whatChanged = [
        ...(proposal.whatChanged || []).filter((w) => w.requestId !== requestId),
        {
          requestId,
          customer: targetRequest.customer,
          serviceType: targetRequest.requiredSkill,
          previousTech: oldAssignment?.technician || oldAssignment?.technicianName || 'Unassigned',
          previousTime: oldAssignment?.timeSlot || 'None',
          newTech: 'Unassigned',
          newTime: 'None',
          changeType: 'Dispatcher manual override',
          reason: reason || 'dispatcher manual override',
        },
      ];
    } else {
      // Validate candidate technician and slot
      const targetTechName = technicianName || technician;
      const targetTechId = technicianId;
      const targetTech = allTechnicians.find(
        (t) => t.technicianId === targetTechId || t.name === targetTechName || t.id === targetTechId
      );

      if (!targetTech) {
        return res.status(400).json({
          success: false,
          error: { code: 'TECHNICIAN_NOT_FOUND', message: `Target technician not found.` },
        });
      }

      // Availability check: cannot assign to unavailable technician
      if (targetTech.status === 'Unavailable' || targetTech.status === 'UNAVAILABLE' || targetTech.status === 'On Leave') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TECHNICIAN_UNAVAILABLE',
            message: `Cannot assign ${requestId} to ${targetTech.name}: Technician is currently ${targetTech.status}.`,
          },
        });
      }

      const slotString = timeSlot || `${startTime} - ${endTime}`;
      const proposedNewAssignment = {
        requestId,
        technicianId: targetTech.technicianId,
        technicianName: targetTech.name,
        technician: targetTech.name,
        startTime: startTime || slotString.split(/[-–]/)[0]?.trim(),
        endTime: endTime || slotString.split(/[-–]/)[1]?.trim(),
        timeSlot: slotString,
        customer: targetRequest.customer,
        skill: targetRequest.requiredSkill,
        region: targetRequest.region,
        priority: targetRequest.priority,
        status: 'ASSIGNED',
        reason: reason || 'Dispatcher manual override',
      };

      // Test feasibility against all proposed assignments
      const candidateAssignments = proposedAssignments.filter((p) => p.requestId !== requestId).concat(proposedNewAssignment);

      const validation = validateAssignment(targetRequest, targetTech, slotString, candidateAssignments, {
        allowOvertime: true,
        allowCrossRegion: true,
        strictWindow: false,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: validation.violations[0]?.code || 'CONSTRAINT_VIOLATION',
            message: `Manual assignment invalid: ${validation.blockingReason}`,
            violations: validation.violations,
          },
        });
      }

      // Update proposed assignments array
      if (oldAsgIndex >= 0) {
        proposedAssignments[oldAsgIndex] = proposedNewAssignment;
      } else {
        proposedAssignments.push(proposedNewAssignment);
      }

      // Remove from unassigned if present
      const unassignedIdx = unassignedRequests.findIndex((u) => u.requestId === requestId);
      if (unassignedIdx >= 0) {
        unassignedRequests.splice(unassignedIdx, 1);
      }

      // Record whatChanged
      proposal.whatChanged = [
        ...(proposal.whatChanged || []).filter((w) => w.requestId !== requestId),
        {
          requestId,
          customer: targetRequest.customer,
          serviceType: targetRequest.requiredSkill,
          previousTech: oldAssignment?.technician || oldAssignment?.technicianName || 'Unassigned',
          previousTime: oldAssignment?.timeSlot || 'None',
          newTech: targetTech.name,
          newTime: slotString,
          changeType: 'Dispatcher manual override',
          reason: reason || 'dispatcher manual override',
        },
      ];
    }

    proposal.proposedAssignments = proposedAssignments;
    proposal.unassignedRequests = unassignedRequests;
    proposal.unassignedRequestsList = unassignedRequests;
    proposal.totalAssigned = proposedAssignments.length;
    proposal.totalUnassigned = unassignedRequests.length;

    // Re-run overall validator
    const overallValidation = validateAiPlanProposal({
      proposedAssignments,
      requests: allRequests,
      technicians: allTechnicians,
      existingAssignments,
    });

    proposal.validation = {
      valid: overallValidation.valid,
      errors: overallValidation.errors,
    };

    await proposal.save();

    await logAuditEvent({
      action: 'DISPATCHER_OVERRIDE',
      entityType: 'planner',
      entityId: planId,
      entity: `Dispatcher manually modified assignment ${requestId} in proposal ${planId}. Reason: ${reason}`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      reason,
    });

    res.json({
      success: true,
      message: `Assignment ${requestId} updated in proposal ${planId}.`,
      data: proposal,
      plan: proposal,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve AI Generated Plan with Transaction & Stale Check
 * Atomically commits to assignments, schedule version, approvals, audit logs, notifications
 */
export async function approvePlan(req, res, next) {
  const { planId } = req.params;
  const { approvedBy = 'Alex Rivera', reason = 'Dispatcher approved AI plan proposal', proposedAssignments: clientProposed } = req.body;

  try {
    let plan = await PlanProposal.findOne({ planId });
    if (!plan) {
      plan = activeProposedPlans.get(planId);
    }

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: `Plan proposal ${planId} not found in database.`,
        },
      });
    }

    if (plan.status === 'CONFIRMED' || plan.status === 'APPROVED') {
      const currentVer = await ScheduleVersion.findOne({ isCurrent: true }).lean();
      return res.json({
        success: true,
        status: 'CONFIRMED',
        version: currentVer?.version || 'v4',
        message: 'Plan is already approved.',
      });
    }

    let assignmentsToApply = clientProposed || plan.proposedAssignments || [];

    if (!assignmentsToApply || assignmentsToApply.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PLAN_EXPIRED',
          message: 'Plan proposal has no proposed assignments. Please generate a new AI plan proposal with Gemini.',
        },
      });
    }

    // 1. RE-READ LATEST STATE FROM MONGODB
    const [allRequests, allTechnicians, existingVersions] = await Promise.all([
      ServiceRequest.find({}).lean(),
      Technician.find({}).lean(),
      ScheduleVersion.find({}).sort({ versionNumber: -1 }).lean(),
    ]);

    const activeScheduleVersion = existingVersions.find((v) => v.isCurrent) || existingVersions[0] || { version: 'v3', versionNumber: 3 };

    // 2. CONCURRENCY / STALE PLAN PROTECTION (Section 11)
    const baselineVersion = plan.metadata?.scheduleVersion;
    if (baselineVersion && baselineVersion !== activeScheduleVersion.version) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'PLAN_STALE',
          message: `Plan is stale. Database schedule version changed from ${baselineVersion} to ${activeScheduleVersion.version} after this proposal was generated.`,
          recommendation: 'Generate Revised AI Plan',
        },
      });
    }

    // 3. RE-VALIDATE ALL HARD CONSTRAINTS BEFORE COMMITTING
    for (const proposed of assignmentsToApply) {
      if (proposed.isProtectedCompleted || proposed.status === 'Completed' || proposed.status === 'COMPLETED') {
        continue;
      }

      const reqObj = allRequests.find((r) => r.requestId === proposed.requestId);
      const techObj = allTechnicians.find(
        (t) => t.name === proposed.technician || t.name === proposed.technicianName || t.technicianId === proposed.technicianId
      );

      if (!reqObj || !techObj) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ASSIGNMENT',
            message: `Cannot approve plan: Missing request ${proposed.requestId} or technician ${proposed.technician || proposed.technicianName}.`,
          },
        });
      }

      if (techObj.status === 'Unavailable' || techObj.status === 'UNAVAILABLE' || techObj.status === 'On Leave') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TECHNICIAN_UNAVAILABLE',
            message: `Cannot approve plan: Technician ${techObj.name} is currently unavailable. Please regenerate plan.`,
          },
        });
      }

      const timeSlot = proposed.timeSlot || `${proposed.startTime} - ${proposed.endTime}`;
      const validation = validateAssignment(reqObj, techObj, timeSlot, assignmentsToApply, {
        allowOvertime: true,
        allowCrossRegion: true,
        strictWindow: false,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: validation.violations[0]?.code || 'ASSIGNMENT_CONFLICT',
            message: `Cannot approve plan: Hard constraint violation on ${proposed.requestId}: ${validation.blockingReason}`,
            details: validation.violations,
          },
        });
      }
    }

    // 4. ATOMIC DATABASE TRANSACTION (Section 1)
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // A. Upsert confirmed assignments
        for (const p of assignmentsToApply) {
          const startTime = p.startTime || p.timeSlot?.split(/[-–]/)[0]?.trim();
          const endTime = p.endTime || p.timeSlot?.split(/[-–]/)[1]?.trim();
          const isCompleted = p.isProtectedCompleted || p.status === 'Completed' || p.status === 'COMPLETED';

          await Assignment.findOneAndUpdate(
            { requestId: p.requestId },
            {
              assignmentId: p.id || `ASG-${p.requestId}`,
              requestId: p.requestId,
              technicianId: p.technicianId,
              technicianName: p.technician || p.technicianName,
              customer: p.customer,
              skill: p.skill,
              region: p.region,
              startTime,
              endTime,
              timeSlot: p.timeSlot || `${startTime} – ${endTime}`,
              status: isCompleted ? 'Completed' : 'Scheduled',
              protected: isCompleted,
              isProtectedCompleted: isCompleted,
              reason: p.reason || 'Approved in AI dispatch plan',
            },
            { upsert: true, session }
          );
        }

        // B. Update ServiceRequests collection
        for (const req of allRequests) {
          if (req.isProtectedCompleted || req.status === 'COMPLETED') continue;

          const proposed = assignmentsToApply.find((p) => p.requestId === req.requestId);
          if (proposed) {
            const tech = allTechnicians.find(
              (t) => t.name === proposed.technician || t.name === proposed.technicianName || t.technicianId === proposed.technicianId
            );
            await ServiceRequest.findOneAndUpdate(
              { requestId: req.requestId },
              {
                status: 'ASSIGNED',
                assignedTechId: tech?.technicianId || req.assignedTechId,
                assignedTechnician: proposed.technician || proposed.technicianName,
                assignedTechName: proposed.technician || proposed.technicianName,
                startTime: proposed.startTime,
                endTime: proposed.endTime,
                needsReplanning: false,
                issueFlag: null,
              },
              { session }
            );
          }
        }

        // C. Calculate and update Technician daily workloads
        for (const tech of allTechnicians) {
          const techAssignments = assignmentsToApply.filter(
            (p) => p.technician === tech.name || p.technicianName === tech.name || p.technicianId === tech.technicianId
          );
          let totalMinutes = 0;
          techAssignments.forEach((a) => {
            const s = a.startTime ? parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]) : 0;
            const e = a.endTime ? parseInt(a.endTime.split(':')[0]) * 60 + parseInt(a.endTime.split(':')[1]) : 0;
            if (e > s) totalMinutes += (e - s);
          });
          const hours = parseFloat((totalMinutes / 60).toFixed(1));
          await Technician.findOneAndUpdate(
            { technicianId: tech.technicianId },
            { currentWorkloadHours: hours, dailyWorkload: hours },
            { session }
          );
        }

        // D. Create immutable ScheduleVersion with parentVersion and planId
        const allVersions = await ScheduleVersion.find({}).sort({ versionNumber: -1 }).session(session);
        const maxVersionNum = allVersions.length > 0 ? Math.max(...allVersions.map((v) => v.versionNumber || 0)) : 3;
        const nextVersionLabel = `v${maxVersionNum + 1}`;
        const parentVersionLabel = activeScheduleVersion.version || `v${maxVersionNum}`;

        const assignmentsSnapshot = assignmentsToApply.map((p) => ({
          id: p.requestId,
          requestId: p.requestId,
          customer: p.customer,
          skill: p.skill,
          technician: p.technician || p.technicianName,
          assignedTechName: p.technician || p.technicianName,
          startTime: p.startTime,
          endTime: p.endTime,
          timeSlot: p.timeSlot,
          status: p.isProtectedCompleted || p.status === 'Completed' || p.status === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED',
          isProtectedCompleted: p.isProtectedCompleted || false,
          region: p.region,
          reason: p.reason,
        }));

        await ScheduleVersion.updateMany({}, { isCurrent: false }, { session });

        const newVersion = new ScheduleVersion({
          versionId: `VER-${Date.now()}`,
          version: nextVersionLabel,
          versionNumber: maxVersionNum + 1,
          status: 'Confirmed',
          createdBy: `${approvedBy} (Dispatcher)`,
          createdAtString: 'Today, Just now',
          reason: plan?.triggerReason || reason,
          trigger: plan?.triggerReason || 'Dispatcher approved AI plan proposal',
          planId,
          parentVersionId: activeScheduleVersion.versionId || `VER-${parentVersionLabel}`,
          parentVersion: parentVersionLabel,
          isCurrent: true,
          totalAssignments: assignmentsToApply.length,
          unassignedCount: allRequests.length - assignmentsToApply.length,
          assignmentsSnapshot,
          assignments: assignmentsSnapshot,
          changes: plan.whatChanged || [],
        });
        await newVersion.save({ session });

        // E. Create Approval record
        const newApproval = new Approval({
          approvalId: `APP-${Date.now()}`,
          versionId: nextVersionLabel,
          action: 'APPROVED',
          approvedBy,
          reason,
        });
        await newApproval.save({ session });

        // F. Update PlanProposal status in MongoDB
        await PlanProposal.findOneAndUpdate(
          { planId },
          {
            status: 'CONFIRMED',
            approvedBy,
            approvedAt: new Date(),
          },
          { session }
        );

        // G. Create AuditLog entry
        await logAuditEvent({
          action: 'AI_PLAN_APPROVED',
          entityType: 'schedule',
          entityId: nextVersionLabel,
          entity: `Schedule ${nextVersionLabel} approved and dispatched to technicians. Confirmed by ${approvedBy}. Plan: ${planId}. Parent version: ${parentVersionLabel}.`,
          performedBy: approvedBy,
          actorType: 'user',
          actor: approvedBy,
          source: 'Dispatcher',
          previousState: 'AWAITING_APPROVAL',
          newState: 'CONFIRMED',
          reason,
          affectedPlanVersion: nextVersionLabel,
          session,
        });

        // H. Create Mocked Notifications for all affected technicians
        for (const p of assignmentsToApply) {
          const techName = p.technician || p.technicianName;
          await createNotification({
            title: 'Assignment Confirmed',
            description: `Assignment ${p.requestId} (${p.customer}) confirmed for ${techName} at ${p.timeSlot}.`,
            category: 'assignments',
            type: 'Assignments',
            severity: 'info',
            relatedEntity: p.requestId,
            session,
          });
        }

        await createNotification({
          title: 'Schedule Dispatched',
          description: `Schedule ${nextVersionLabel} approved and dispatched to all technicians.`,
          category: 'schedule',
          type: 'Schedule Updates',
          severity: 'success',
          session,
        });
      });
    } finally {
      await session.endSession();
    }

    activeProposedPlans.delete(planId);

    const latestVersion = await ScheduleVersion.findOne({ isCurrent: true }).lean();

    res.json({
      success: true,
      status: 'CONFIRMED',
      version: latestVersion?.version || 'v4',
      scheduleVersion: latestVersion?.version || 'v4',
      data: latestVersion,
      message: `Plan approved successfully and schedule dispatched.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject AI Generated Plan
 */
export async function rejectPlan(req, res, next) {
  try {
    const { planId } = req.params;
    const { rejectedBy = 'Alex Rivera', reason = 'Dispatcher manual rejection' } = req.body;

    activeProposedPlans.delete(planId);

    await PlanProposal.findOneAndUpdate(
      { planId },
      {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
      }
    );

    await logAuditEvent({
      action: 'AI_PLAN_REJECTED',
      entityType: 'planner',
      entityId: planId,
      entity: `AI plan ${planId} rejected by dispatcher (${rejectedBy}). Reason: ${reason}`,
      performedBy: rejectedBy,
      actorType: 'user',
      actor: rejectedBy,
      source: 'Dispatcher',
      previousState: 'AWAITING_APPROVAL',
      newState: 'REJECTED',
      reason,
      affectedPlanVersion: planId,
    });

    await createNotification({
      title: 'AI Plan Rejected',
      description: `Plan proposal was rejected by ${rejectedBy} (${reason}). Ready to regenerate.`,
      category: 'system',
      type: 'System',
      severity: 'warning',
    });

    res.json({
      success: true,
      status: 'REJECTED',
      planStatus: 'Plan Rejected',
      message: `Plan proposal rejected. Active confirmed schedule remains untouched.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/planner/technician-unavailable
 * Mark technician unavailable and identify affected future requests
 */
export async function technicianUnavailable(req, res, next) {
  try {
    const { technicianId, name, reason = 'Technician reported unavailable' } = req.body;

    const tech = await Technician.findOne({
      $or: [{ technicianId }, { name: technicianId }, { name }],
    });

    if (!tech) {
      return res.status(404).json({
        success: false,
        error: `Technician ${technicianId || name} not found.`,
      });
    }

    const previousStatus = tech.status;
    tech.status = 'Unavailable';
    tech.availability = 'Cancelled Shift';
    await tech.save();

    // Identify affected non-completed requests
    const affectedRequests = await ServiceRequest.find({
      $or: [{ assignedTechId: tech.technicianId }, { assignedTechnician: tech.name }, { assignedTechName: tech.name }],
      status: { $nin: ['COMPLETED', 'Completed'] },
      isProtectedCompleted: { $ne: true },
    });

    const affectedIds = affectedRequests.map((r) => r.requestId);

    if (affectedIds.length > 0) {
      await ServiceRequest.updateMany(
        { requestId: { $in: affectedIds } },
        {
          $set: {
            status: 'UNASSIGNED',
            needsReplanning: true,
            assignedTechId: null,
            assignedTechnician: null,
            assignedTechName: null,
            issueFlag: `Technician ${tech.name} reported unavailable`,
          },
        }
      );
    }

    // Protect completed count
    const completedProtectedCount = await ServiceRequest.countDocuments({
      $and: [
        { $or: [{ assignedTechId: tech.technicianId }, { assignedTechnician: tech.name }] },
        { $or: [{ status: 'COMPLETED' }, { isProtectedCompleted: true }] },
      ],
    });

    if (previousStatus !== 'Unavailable') {
      await logAuditEvent({
        action: 'TECHNICIAN_UNAVAILABLE',
        entityType: 'technician',
        entityId: tech.technicianId,
        entity: `${tech.name} reported unavailable. Affected requests: ${affectedIds.join(', ') || 'None'}. Completed protected: ${completedProtectedCount}`,
        performedBy: tech.name,
        actorType: 'technician',
        actor: tech.name,
        source: 'Technician',
        previousState: previousStatus,
        newState: 'Unavailable',
        reason,
      });

      await createNotification({
        title: 'Technician Unavailable',
        description: `Technician ${tech.name} marked unavailable. ${affectedIds.length} request(s) require replanning.`,
        category: 'emergency',
        type: 'Emergency',
        severity: 'danger',
        relatedEntity: tech.technicianId,
      });
    }

    res.json({
      success: true,
      technician: tech,
      status: 'Unavailable',
      affectedRequests: affectedIds,
      affectedCount: affectedIds.length,
      protectedCompletedRequests: completedProtectedCount,
      replanRequired: true,
      message: `${tech.name} is now marked Unavailable. ${affectedIds.length} request(s) affected.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/planner/emergency-request
 * Create an emergency service request that requires immediate replanning
 */
export async function emergencyRequest(req, res, next) {
  try {
    const {
      customer = 'Emergency Incident Call',
      phone = '+91 99000 11223',
      location,
      region = 'Jaipur Central',
      requiredSkill = 'Electrical Repair',
      duration = '2 hours',
      preferredWindow = '15:00 - 17:00',
      notes = 'Emergency ticket logged for immediate dispatch triage.',
    } = req.body;

    const count = await ServiceRequest.countDocuments();
    const nextId = req.body.requestId || `REQ-0${count + 1}`;

    const emergencyReq = new ServiceRequest({
      requestId: nextId,
      customer,
      phone,
      location: location || `${region}, MI Road`,
      address: location || `${region}, MI Road`,
      region,
      requiredSkill,
      priority: 'Critical',
      duration,
      durationHours: 2,
      preferredWindow,
      status: 'UNASSIGNED',
      needsReplanning: true,
      issueFlag: 'Critical emergency request awaiting dispatcher replan',
      notes,
    });

    await emergencyReq.save();

    await logAuditEvent({
      action: 'EMERGENCY_CREATED',
      entityType: 'request',
      entityId: emergencyReq.requestId,
      entity: `Critical emergency request ${emergencyReq.requestId} logged for ${emergencyReq.region}`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      newState: 'Critical',
      reason: `Emergency triage: ${emergencyReq.requiredSkill} in ${emergencyReq.region}`,
      requestId: emergencyReq.requestId,
    });

    await createNotification({
      title: 'Emergency Request Created',
      description: `Emergency ${emergencyReq.requestId} (${emergencyReq.requiredSkill}, ${emergencyReq.region}) added. Replan required.`,
      category: 'emergency',
      type: 'Emergency',
      severity: 'danger',
      relatedEntity: emergencyReq.requestId,
    });

    res.status(201).json({
      success: true,
      data: emergencyReq,
      emergencyRequest: emergencyReq,
      replanRequired: true,
      message: `Emergency request ${emergencyReq.requestId} logged.`,
    });
  } catch (error) {
    next(error);
  }
}
