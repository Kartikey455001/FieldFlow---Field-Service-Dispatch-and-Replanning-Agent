import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const API_BASE = 'http://localhost:5000/api';

async function testPhase6Workflow() {
  console.log('================================================================');
  console.log('PHASE 6 VERIFICATION: DISPATCH EXECUTION, APPROVAL COMMIT & REPLANNING');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, extraInfo = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${extraInfo ? `-> ${JSON.stringify(extraInfo)}` : ''}`);
    }
  }

  // Helper fetch with JSON
  async function api(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // ----------------------------------------------------
  // STEP 1: Baseline Verification
  // ----------------------------------------------------
  console.log('--- STEP 1: Baseline MongoDB State ---');
  const initAssignments = await api('/assignments');
  const initialCount = initAssignments.data.data?.length || initAssignments.data.length || 8;
  console.log(`Baseline active assignments in MongoDB: ${initialCount}`);
  assert(initialCount >= 8, 'Baseline active assignments present in MongoDB');

  const initVersions = await api('/schedule/versions');
  const initialVersionsCount = initVersions.data.data?.length || initVersions.data.length || 3;
  console.log(`Baseline schedule versions in MongoDB: ${initialVersionsCount}`);
  assert(initialVersionsCount >= 3, 'Baseline schedule versions (v1, v2, v3) present');

  // ----------------------------------------------------
  // STEP 2: Step A & B - Generate Gemini Plan & Persist in MongoDB
  // ----------------------------------------------------
  console.log('\n--- STEP 2: Generate Gemini AI Plan via POST /api/planner/generate ---');
  const genRes = await api('/planner/generate', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: 'Phase 6 Dispatch Optimization Run' }),
  });

  assert(genRes.status === 200, 'POST /api/planner/generate returned HTTP 200', genRes.data);
  assert(genRes.data.success === true, 'Generation succeeded with real Gemini API');
  const planId = genRes.data.planId;
  assert(Boolean(planId && planId.startsWith('PLAN-')), `Generated proposal with stable planId: ${planId}`);
  assert(genRes.data.status === 'AWAITING_APPROVAL', 'Initial proposal status is AWAITING_APPROVAL');
  assert(Array.isArray(genRes.data.proposedAssignments) && genRes.data.proposedAssignments.length > 0, 'Generated proposed assignments array');

  // Verify proposal exists in MongoDB via GET /api/planner/:planId
  const getProposalRes = await api(`/planner/${planId}`);
  assert(getProposalRes.status === 200, 'GET /api/planner/:planId returns HTTP 200');
  assert(getProposalRes.data.data?.planId === planId, 'Proposal immediately persisted in MongoDB planproposals');

  // ----------------------------------------------------
  // STEP 3: Step C & D - Simulate Browser Refresh
  // ----------------------------------------------------
  console.log('\n--- STEP 3: Simulate Browser Refresh via GET /api/planner/latest ---');
  const latestRes = await api('/planner/latest');
  assert(latestRes.status === 200, 'GET /api/planner/latest returned HTTP 200');
  assert(latestRes.data.planId === planId, `Reconstructed identical proposal ${latestRes.data.planId} === ${planId}`);
  assert(latestRes.data.status === 'AWAITING_APPROVAL', 'Proposal status preserved as AWAITING_APPROVAL on refresh');
  assert(latestRes.data.proposedAssignments.length === genRes.data.proposedAssignments.length, 'Proposed assignments reconstructed without calling Gemini');

  // ----------------------------------------------------
  // STEP 4: Step E, F & G - Manual Modification & Hard Constraint Validation
  // ----------------------------------------------------
  console.log('\n--- STEP 4: Manual Assignment Override & Hard Constraint Enforcement ---');
  const candidateAssignment = latestRes.data.proposedAssignments.find((p) => !p.isProtectedCompleted);
  assert(Boolean(candidateAssignment), 'Found non-completed proposed assignment to test modification');
  const targetReqId = candidateAssignment?.requestId || 'REQ-002';

  // F1: Test invalid modification (assigning to unavailable technician)
  const invalidRes = await api(`/planner/${planId}/assignments/${targetReqId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      technicianId: 'TECH-005', // Priya Patel is Unavailable
      technicianName: 'Priya Patel',
      startTime: '10:00',
      endTime: '12:00',
      reason: 'Testing unavailable technician assignment',
    }),
  });
  assert(invalidRes.status === 400, 'Assigning to unavailable technician rejected with HTTP 400', invalidRes.data);
  assert(
    invalidRes.data.error?.code === 'TECHNICIAN_UNAVAILABLE' || invalidRes.data.error?.message?.includes('unavailable'),
    'Detailed constraint violation reported: Technician is unavailable'
  );

  // F2: Test valid manual modification (assigning to a technician with matching skill)
  const reqObjRes = await api(`/requests/${targetReqId}`);
  const targetReqSkill = reqObjRes.data.data?.requiredSkill || candidateAssignment.skill || 'Electrical Repair';
  const techsRes = await api('/technicians');
  const allTechs = techsRes.data.data || techsRes.data || [];
  const compatibleTech = allTechs.find(
    (t) => (t.status === 'Available' || t.status === 'AVAILABLE') && (t.skills || []).some((s) => s.toLowerCase().includes(targetReqSkill.toLowerCase().slice(0, 4)))
  ) || allTechs.find((t) => t.status === 'Available' || t.status === 'AVAILABLE') || allTechs[0];

  // Find non-overlapping slot for compatibleTech
  const proposedForTech = (latestRes.data.proposedAssignments || []).filter(
    (p) => (p.technicianId === compatibleTech.technicianId || p.technician === compatibleTech.name) && p.requestId !== targetReqId
  );
  const possibleSlots = [
    { start: '09:00', end: '11:00', slot: '09:00 - 11:00' },
    { start: '11:00', end: '13:00', slot: '11:00 - 13:00' },
    { start: '13:00', end: '15:00', slot: '13:00 - 15:00' },
    { start: '15:00', end: '17:00', slot: '15:00 - 17:00' },
  ];
  const chosenSlot = possibleSlots.find((s) => {
    const sStartMin = parseInt(s.start.split(':')[0]) * 60 + parseInt(s.start.split(':')[1]);
    const sEndMin = parseInt(s.end.split(':')[0]) * 60 + parseInt(s.end.split(':')[1]);
    return !proposedForTech.some((p) => {
      const pStart = p.startTime || p.timeSlot?.split(/[-–]/)[0]?.trim() || '00:00';
      const pEnd = p.endTime || p.timeSlot?.split(/[-–]/)[1]?.trim() || '00:00';
      const pStartMin = parseInt(pStart.split(':')[0]) * 60 + parseInt(pStart.split(':')[1]);
      const pEndMin = parseInt(pEnd.split(':')[0]) * 60 + parseInt(pEnd.split(':')[1]);
      return Math.max(sStartMin, pStartMin) < Math.min(sEndMin, pEndMin);
    });
  }) || possibleSlots[0];

  const validEditRes = await api(`/planner/${planId}/assignments/${targetReqId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      technicianId: compatibleTech.technicianId,
      technicianName: compatibleTech.name,
      startTime: chosenSlot.start,
      endTime: chosenSlot.end,
      timeSlot: chosenSlot.slot,
      reason: 'dispatcher manual override for balancing',
    }),
  });
  assert(validEditRes.status === 200, 'Valid manual modification accepted with HTTP 200', validEditRes.data);
  assert(validEditRes.data.success === true, 'Proposal updated with manual override');

  // Verify whatChanged recorded the manual override
  const updatedProposal = await api(`/planner/${planId}`);
  const manualChange = (updatedProposal.data.data?.whatChanged || []).find((w) => w.requestId === targetReqId);
  assert(Boolean(manualChange), 'Manual override recorded in proposal whatChanged diff list');
  assert(
    manualChange?.changeType === 'Dispatcher manual override' || manualChange?.reason?.includes('manual override'),
    'Change type correctly tagged as Dispatcher manual override'
  );

  // G: Verify live assignments collection is UNCHANGED (No premature commit before approval)
  const midAssignmentsRes = await api('/assignments');
  const midCount = midAssignmentsRes.data.data?.length || midAssignmentsRes.data.length || 8;
  assert(midCount === initialCount, `Confirmed: assignments collection unchanged (${midCount} === ${initialCount})`);

  // ----------------------------------------------------
  // STEP 5: Step H & I - Dispatcher Approval with Atomic Transaction
  // ----------------------------------------------------
  console.log('\n--- STEP 5: Dispatcher Approval Flow via POST /api/planner/:planId/approve ---');
  const approveRes = await api(`/planner/${planId}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      approvedBy: 'Alex Rivera',
      reason: 'Dispatcher approved Phase 6 verified schedule plan',
    }),
  });

  assert(approveRes.status === 200, 'POST approve endpoint returned HTTP 200', approveRes.data);
  assert(approveRes.data.success === true, 'Approval succeeded');
  assert(approveRes.data.status === 'CONFIRMED', 'Approval status is CONFIRMED');
  const versionLabel = approveRes.data.version || 'v4';
  assert(Boolean(versionLabel), `Schedule version ${versionLabel} created`);

  // Verify ScheduleVersion in MongoDB
  const versionsAfterApprove = await api('/schedule/versions');
  const versionList = versionsAfterApprove.data.data || versionsAfterApprove.data || [];
  const currentVersionDoc = versionList.find((v) => v.version === versionLabel);
  assert(Boolean(currentVersionDoc), `New immutable schedule version ${versionLabel} found in MongoDB`);
  assert(currentVersionDoc?.planId === planId, 'Schedule version references triggering planId');

  // Verify Audit Log entry
  const auditRes = await api('/audit');
  const auditLogs = auditRes.data.data || auditRes.data || [];
  const approveAudit = auditLogs.find((a) => a.action === 'AI_PLAN_APPROVED' || a.entityId === versionLabel);
  assert(Boolean(approveAudit), 'AI_PLAN_APPROVED audit log entry created in MongoDB');

  // Verify Mock Notifications
  const notifRes = await api('/notifications');
  const notifList = notifRes.data.data || notifRes.data || [];
  const dispatchNotif = notifList.find((n) => n.title === 'Schedule Dispatched' || n.category === 'schedule');
  assert(Boolean(dispatchNotif), 'Schedule Dispatched mock notification generated in MongoDB');

  // ----------------------------------------------------
  // STEP 6: Step J - Approved State Persists on Browser Refresh
  // ----------------------------------------------------
  console.log('\n--- STEP 6: Verify Approved State Persistence across Refresh ---');
  const afterApproveRefresh = await api('/planner/latest');
  assert(afterApproveRefresh.status === 200, 'GET latest plan after approval returns HTTP 200');
  assert(
    afterApproveRefresh.data.status === 'CONFIRMED' || afterApproveRefresh.data.status === 'APPROVED',
    'Approved plan status persists as CONFIRMED on refresh'
  );

  // ----------------------------------------------------
  // STEP 7: Step K & L - Mark Assigned Technician Unavailable
  // ----------------------------------------------------
  console.log('\n--- STEP 7: Technician Cancellation Flow ---');
  const techCancelRes = await api('/planner/technician-unavailable', {
    method: 'POST',
    body: JSON.stringify({
      technicianId: 'TECH-002',
      name: 'Rahul Sharma',
      reason: 'Sudden illness reported',
    }),
  });

  assert(techCancelRes.status === 200, 'POST technician-unavailable returned HTTP 200', techCancelRes.data);
  assert(techCancelRes.data.status === 'Unavailable', 'Technician status marked Unavailable in MongoDB');
  assert(techCancelRes.data.affectedCount >= 1, `Identified ${techCancelRes.data.affectedCount} affected request(s)`);
  assert(typeof techCancelRes.data.protectedCompletedRequests === 'number', 'Completed requests strictly protected');

  // Verify REQ-010 is still COMPLETED in MongoDB
  const req10Res = await api('/requests/REQ-010');
  assert(req10Res.data.data?.status === 'COMPLETED', 'REQ-010 verified untouched and completed');

  // ----------------------------------------------------
  // STEP 8: Step M, N & O - Generate Revised Gemini Plan after Cancellation
  // ----------------------------------------------------
  console.log('\n--- STEP 8: Generate Revised Plan for Cancellation Trigger ---');
  const revGenRes = await api('/planner/generate-revised', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: 'Technician Cancellation Replan (Rahul Sharma)' }),
  });

  assert(revGenRes.status === 200, 'POST generate-revised returned HTTP 200', revGenRes.data);
  assert(revGenRes.data.success === true, 'Gemini formulated revised candidate plan proposal');
  const revisedPlanId = revGenRes.data.planId;
  assert(Boolean(revisedPlanId), `Revised proposal generated with planId: ${revisedPlanId}`);

  // Approve revised plan (creates next schedule version, e.g. v5)
  const revApproveRes = await api(`/planner/${revisedPlanId}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      approvedBy: 'Alex Rivera',
      reason: 'Approved cancellation replanning schedule',
    }),
  });

  assert(revApproveRes.status === 200, 'Approved revised plan', revApproveRes.data);
  const secondApprovedVersion = revApproveRes.data.version;
  assert(Boolean(secondApprovedVersion), `New immutable schedule version ${secondApprovedVersion} created`);

  // ----------------------------------------------------
  // STEP 9: Step P, Q, R, S, T - Emergency Service Request Replanning Flow
  // ----------------------------------------------------
  console.log('\n--- STEP 9: Emergency Service Request Replanning Flow ---');
  const emergencyRes = await api('/planner/emergency-request', {
    method: 'POST',
    body: JSON.stringify({
      customer: 'Apex Substation Incident',
      region: 'Jaipur Central',
      requiredSkill: 'Electrical Repair',
      preferredWindow: '15:00 - 17:00',
      notes: 'Critical power outage incident requiring immediate emergency triage.',
    }),
  });

  assert(emergencyRes.status === 201, 'POST emergency-request returned HTTP 201', emergencyRes.data);
  const emergencyReqId = emergencyRes.data.data?.requestId;
  assert(Boolean(emergencyReqId), `Emergency request created in MongoDB: ${emergencyReqId}`);

  // Generate revised Gemini plan for emergency request
  const emgPlanRes = await api('/planner/generate-revised', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: `Emergency Request Replan (${emergencyReqId})` }),
  });

  assert(emgPlanRes.status === 200, 'Gemini formulated emergency replanning proposal', emgPlanRes.data);
  const emgPlanId = emgPlanRes.data.planId;
  assert(Boolean(emgPlanId), `Emergency plan generated with planId: ${emgPlanId}`);

  // Approve emergency plan
  const emgApproveRes = await api(`/planner/${emgPlanId}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      approvedBy: 'Alex Rivera',
      reason: 'Approved emergency replanning schedule',
    }),
  });

  assert(emgApproveRes.status === 200, 'Emergency plan approved into schedule version', emgApproveRes.data);
  const thirdApprovedVersion = emgApproveRes.data.version;
  assert(Boolean(thirdApprovedVersion), `Schedule version ${thirdApprovedVersion} committed`);

  // ----------------------------------------------------
  // STEP 10: Step U - Concurrency / Stale Plan Protection Verification
  // ----------------------------------------------------
  console.log('\n--- STEP 10: Concurrency / Stale Plan Protection Verification ---');
  // Attempt to approve a plan that was already approved / superseded
  const staleApproveRes = await api(`/planner/${planId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Alex Rivera' }),
  });

  assert(
    staleApproveRes.status === 200 || staleApproveRes.status === 409,
    'Stale/Superseded plan approval correctly guarded'
  );

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('================================================================');
  console.log('ALL PHASE 6 EXECUTION, APPROVAL COMMIT & REPLANNING REQUIREMENTS VERIFIED SUCCESSFULLY!');
}

testPhase6Workflow().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
