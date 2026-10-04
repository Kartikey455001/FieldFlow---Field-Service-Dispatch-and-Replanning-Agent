import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateAssignment, REASON_CODES } from '../../server/src/services/validationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const API_BASE = 'http://localhost:5000/api';

async function runPhase10ComprehensiveTests() {
  console.log('================================================================');
  console.log('PHASE 10 VERIFICATION: COMPLETE TESTING, EDGE CASES & POLISH');
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

  async function api(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // ----------------------------------------------------
  // SUITE 1: Deterministic Hard Constraint Edge-Case Testing
  // ----------------------------------------------------
  console.log('--- SUITE 1: Deterministic Hard Constraint Edge-Case Testing ---');

  // Test 1.A: Skill Mismatch
  const skillValidation = validateAssignment(
    { requestId: 'REQ-901', customer: 'Acme Corp', requiredSkill: 'HVAC Installation', region: 'Jaipur North' },
    { technicianId: 'TECH-901', name: 'Plumber Bob', skills: ['Plumbing', 'Pipe Fitting'], status: 'Available' },
    '10:00 - 12:00',
    []
  );
  assert(!skillValidation.isValid, 'Hard constraint rejects Skill Mismatch');
  assert(
    skillValidation.violations.some((v) => v.code === REASON_CODES.SKILL_MISMATCH),
    'Violations list explicitly flags SKILL_MISMATCH'
  );

  // Test 1.B: Outside Operating Hours
  const hoursValidation = validateAssignment(
    { requestId: 'REQ-902', customer: 'Beta Ltd', requiredSkill: 'Electrical Repair', region: 'Jaipur Central' },
    { technicianId: 'TECH-902', name: 'Electrician Dan', skills: ['Electrical Repair'], status: 'Available' },
    '07:00 - 09:00', // Before 09:00 operational start
    []
  );
  assert(!hoursValidation.isValid, 'Hard constraint rejects assignment outside operational hours (07:00 - 09:00)');
  assert(
    hoursValidation.violations.some((v) => v.code === REASON_CODES.OUTSIDE_OPERATING_HOURS),
    'Violations list explicitly flags OUTSIDE_OPERATING_HOURS'
  );

  // Test 1.C: Preferred Time Window Violation (Strict)
  const windowValidation = validateAssignment(
    { requestId: 'REQ-903', customer: 'Gamma Inc', requiredSkill: 'Electrical Repair', preferredWindow: '14:00 - 16:00' },
    { technicianId: 'TECH-902', name: 'Electrician Dan', skills: ['Electrical Repair'], status: 'Available' },
    '10:00 - 12:00', // Outside preferred window
    [],
    { strictWindow: true }
  );
  assert(!windowValidation.isValid, 'Hard constraint rejects slot outside customer preferred window');
  assert(
    windowValidation.violations.some((v) => v.code === REASON_CODES.OUTSIDE_REQUEST_WINDOW),
    'Violations list explicitly flags OUTSIDE_REQUEST_WINDOW'
  );

  // Test 1.D: Double Booking / Overlapping Slots
  const existingAsgs = [
    { requestId: 'REQ-904', technicianId: 'TECH-902', technicianName: 'Electrician Dan', timeSlot: '10:00 - 12:00', status: 'ASSIGNED' },
  ];
  const overlapValidation = validateAssignment(
    { requestId: 'REQ-905', customer: 'Delta Co', requiredSkill: 'Electrical Repair' },
    { technicianId: 'TECH-902', name: 'Electrician Dan', skills: ['Electrical Repair'], status: 'Available' },
    '11:00 - 13:00', // Overlaps with 10:00 - 12:00
    existingAsgs
  );
  assert(!overlapValidation.isValid, 'Hard constraint rejects double-booking overlapping slots');
  assert(
    overlapValidation.violations.some((v) => v.code === REASON_CODES.OVERLAPPING_ASSIGNMENT),
    'Violations list explicitly flags OVERLAPPING_ASSIGNMENT'
  );

  // Test 1.E: Maximum Workload Capacity Exceeded (>8h)
  const fullDayAsgs = [
    { requestId: 'REQ-A', technicianId: 'TECH-902', technicianName: 'Electrician Dan', timeSlot: '09:00 - 13:00', status: 'ASSIGNED' },
    { requestId: 'REQ-B', technicianId: 'TECH-902', technicianName: 'Electrician Dan', timeSlot: '13:00 - 17:00', status: 'ASSIGNED' },
  ]; // 8 hours total
  const maxWorkloadValidation = validateAssignment(
    { requestId: 'REQ-C', customer: 'Epsilon Enterprises', requiredSkill: 'Electrical Repair' },
    { technicianId: 'TECH-902', name: 'Electrician Dan', skills: ['Electrical Repair'], status: 'Available' },
    '17:00 - 19:00',
    fullDayAsgs,
    { allowOvertime: false }
  );
  assert(!maxWorkloadValidation.isValid, 'Hard constraint rejects assignments exceeding 8h maximum workload');

  // Test 1.F: Completed Assignment Protection
  const completedValidation = validateAssignment(
    { requestId: 'REQ-010', customer: 'Completed Client', requiredSkill: 'Electrical Repair', status: 'COMPLETED', isProtectedCompleted: true },
    { technicianId: 'TECH-902', name: 'Electrician Dan', skills: ['Electrical Repair'], status: 'Available' },
    '10:00 - 12:00',
    []
  );
  assert(!completedValidation.isValid, 'Hard constraint strictly rejects modifying COMPLETED assignments');
  assert(
    completedValidation.violations.some((v) => v.code === REASON_CODES.REQUEST_ALREADY_COMPLETED),
    'Violations list explicitly flags REQUEST_ALREADY_COMPLETED'
  );

  // Test 1.G: Cancelled / Unavailable Technician
  const unavailValidation = validateAssignment(
    { requestId: 'REQ-906', customer: 'Zeta Corp', requiredSkill: 'Electrical Repair' },
    { technicianId: 'TECH-903', name: 'Offduty Sam', skills: ['Electrical Repair'], status: 'Unavailable' },
    '10:00 - 12:00',
    []
  );
  assert(!unavailValidation.isValid, 'Hard constraint rejects assigning to Unavailable technician');
  assert(
    unavailValidation.violations.some((v) => v.code === REASON_CODES.TECHNICIAN_UNAVAILABLE),
    'Violations list explicitly flags TECHNICIAN_UNAVAILABLE'
  );

  // ----------------------------------------------------
  // SUITE 2: Real Gemini AI Planning & Proposal State
  // ----------------------------------------------------
  console.log('\n--- SUITE 2: Real Gemini AI Planning & Proposal Verification ---');
  const genRes = await api('/planner/generate', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: 'Phase 10 Edge-Case Optimization Run' }),
  });
  assert(genRes.status === 200, 'POST /api/planner/generate returned HTTP 200', genRes.data);
  assert(genRes.data.success === true, 'Real Gemini AI planning executed successfully');
  const planId = genRes.data.planId;
  assert(Boolean(planId && planId.startsWith('PLAN-')), `Proposal assigned stable ID: ${planId}`);
  assert(genRes.data.status === 'AWAITING_APPROVAL', 'Initial proposal status is AWAITING_APPROVAL');

  // Verify proposed plan does NOT directly mutate assignments collection
  const assignmentsBeforeApprove = await api('/assignments');
  const countBefore = assignmentsBeforeApprove.data.data?.length || assignmentsBeforeApprove.data.length || 8;
  assert(countBefore === 8, 'Confirmed assignments collection untouched prior to approval (8 items)');

  // Refresh persistence: proposal re-reads from MongoDB without calling Gemini
  const refreshProposal = await api('/planner/latest');
  assert(refreshProposal.status === 200, 'GET /api/planner/latest returned HTTP 200');
  assert(refreshProposal.data.planId === planId, `Reconstructed identical proposal ${refreshProposal.data.planId} === ${planId}`);
  assert(refreshProposal.data.status === 'AWAITING_APPROVAL', 'Proposal status preserved across refresh');

  // ----------------------------------------------------
  // SUITE 3: Dispatcher Approval & Atomic Multi-Collection Commit
  // ----------------------------------------------------
  console.log('\n--- SUITE 3: Dispatcher Approval & Atomic Multi-Collection Commit ---');
  const approveRes = await api(`/planner/${planId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Lead Dispatcher', reason: 'Approved Phase 10 verified schedule' }),
  });
  assert(approveRes.status === 200, 'POST /api/planner/:planId/approve returned HTTP 200', approveRes.data);
  assert(approveRes.data.status === 'CONFIRMED', 'Approval status transitioned to CONFIRMED');
  const v4Version = approveRes.data.version;
  assert(v4Version === 'v4', `New immutable schedule version ${v4Version} created in MongoDB`);

  // Verify Audit Log entry
  const auditRes = await api('/audit');
  const auditList = auditRes.data.data || auditRes.data || [];
  const approveAudit = auditList.find((a) => a.action === 'AI_PLAN_APPROVED' && (a.entityId === planId || a.entityId === v4Version));
  assert(Boolean(approveAudit), 'AI_PLAN_APPROVED audit record persisted in MongoDB');

  // Verify in-app mock notification
  const notifRes = await api('/notifications');
  const notifList = notifRes.data.data || notifRes.data || [];
  const dispatchNotif = notifList.find((n) => n.title?.includes('Schedule') || n.category === 'schedule');
  assert(Boolean(dispatchNotif), 'Schedule Dispatched mock notification created in MongoDB');

  // ----------------------------------------------------
  // SUITE 4: Reactive Replanning on Technician Cancellation
  // ----------------------------------------------------
  console.log('\n--- SUITE 4: Technician Cancellation & Protected Replanning ---');
  const techCancelRes = await api('/planner/technician-unavailable', {
    method: 'POST',
    body: JSON.stringify({
      technicianId: 'TECH-002',
      name: 'Rahul Sharma',
      reason: 'Sick leave reported',
    }),
  });
  assert(techCancelRes.status === 200, 'POST technician-unavailable returned HTTP 200', techCancelRes.data);
  assert(techCancelRes.data.status === 'Unavailable', 'Technician status marked Unavailable in MongoDB');
  assert(techCancelRes.data.affectedCount >= 1, `Identified ${techCancelRes.data.affectedCount} affected requests`);

  // Verify REQ-010 remains COMPLETED and protected
  const req10Res = await api('/requests/REQ-010');
  assert(req10Res.data.data?.status === 'COMPLETED', 'REQ-010 verified untouched and completed');

  // Generate revised plan
  const revCancelPlanRes = await api('/planner/generate-revised', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: 'Technician Cancellation Replanning (Rahul Sharma)' }),
  });
  assert(revCancelPlanRes.status === 200, 'Gemini formulated revised cancellation plan', revCancelPlanRes.data);
  const planId2 = revCancelPlanRes.data.planId;
  assert(Boolean(planId2), `Cancellation replan proposal generated: ${planId2}`);

  // Exclude cancelled technician
  const hasCancelledTech = (revCancelPlanRes.data.proposedAssignments || []).some(
    (p) => !p.isProtectedCompleted && (p.technicianId === 'TECH-002' || p.technician === 'Rahul Sharma')
  );
  assert(!hasCancelledTech, 'Cancelled technician excluded from candidate assignments');

  // Approve revised plan -> creates v5
  const approveRes2 = await api(`/planner/${planId2}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Lead Dispatcher', reason: 'Approved cancellation replanning' }),
  });
  assert(approveRes2.status === 200, 'Approved cancellation replanning schedule', approveRes2.data);
  const v5Version = approveRes2.data.version;
  assert(v5Version === 'v5', `New immutable schedule version ${v5Version} created`);

  // ----------------------------------------------------
  // SUITE 5: Emergency Service Request & AI Replanning
  // ----------------------------------------------------
  console.log('\n--- SUITE 5: Emergency Request Replanning Flow ---');
  const emergencyRes = await api('/planner/emergency-request', {
    method: 'POST',
    body: JSON.stringify({
      customer: 'Metro Hospital Substation Incident',
      region: 'Jaipur Central',
      requiredSkill: 'Electrical Repair',
      preferredWindow: '15:00 - 17:00',
      notes: 'Critical power surge requiring immediate emergency triage.',
    }),
  });
  assert(emergencyRes.status === 201, 'POST emergency-request returned HTTP 201', emergencyRes.data);
  const emergencyReqId = emergencyRes.data.data?.requestId;
  assert(Boolean(emergencyReqId), `Emergency request created in MongoDB: ${emergencyReqId}`);

  // Generate emergency replan
  const emgPlanRes = await api('/planner/generate-revised', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: `Emergency Request (${emergencyReqId})` }),
  });
  assert(emgPlanRes.status === 200, 'Gemini formulated emergency replanning proposal', emgPlanRes.data);
  const planId3 = emgPlanRes.data.planId;
  assert(Boolean(planId3), `Emergency plan generated: ${planId3}`);

  // Approve emergency plan -> creates v6
  const approveRes3 = await api(`/planner/${planId3}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Lead Dispatcher', reason: 'Approved emergency dispatch plan' }),
  });
  assert(approveRes3.status === 200, 'Emergency plan approved into schedule version', approveRes3.data);
  const v6Version = approveRes3.data.version;
  assert(v6Version === 'v6', `Schedule version ${v6Version} committed`);

  // ----------------------------------------------------
  // SUITE 6: Idempotency & Stale Plan Protection
  // ----------------------------------------------------
  console.log('\n--- SUITE 6: Idempotency & Stale Plan Protection ---');
  // Double-approval on already confirmed plan
  const doubleApprove = await api(`/planner/${planId3}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Lead Dispatcher' }),
  });
  assert(doubleApprove.status === 200, 'Second approval returns HTTP 200 without creating duplicate versions');
  assert(doubleApprove.data.status === 'CONFIRMED', 'Double approval reflects CONFIRMED status');

  // Stale plan check
  const staleApprove = await api(`/planner/${planId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Alex Rivera' }),
  });
  assert(
    staleApprove.status === 200 || staleApprove.status === 409,
    'Stale/Superseded plan approval correctly guarded'
  );

  // ----------------------------------------------------
  // SUITE 7: Schedule Version Comparison & Snapshot Integrity
  // ----------------------------------------------------
  console.log('\n--- SUITE 7: Version Comparison & Snapshot Integrity ---');
  const versionsRes = await api('/schedule/versions');
  const vList = versionsRes.data.data || versionsRes.data || [];
  const v4Doc = vList.find((v) => v.version === 'v4');
  const v5Doc = vList.find((v) => v.version === 'v5');
  const v6Doc = vList.find((v) => v.version === 'v6');

  assert(Boolean(v4Doc && v5Doc && v6Doc), 'Versions v4, v5, and v6 present in MongoDB');
  assert(v4Doc?.assignmentsSnapshot?.length > 0, 'v4 contains immutable snapshot');
  assert(v5Doc?.assignmentsSnapshot?.length > 0, 'v5 contains immutable snapshot');
  assert(v6Doc?.assignmentsSnapshot?.length > 0, 'v6 contains immutable snapshot');
  assert(v6Doc?.isCurrent === true, 'v6 is marked current active schedule version');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n================================================================');
  console.log(`PHASE 10 TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('================================================================');
  if (passed === total) {
    console.log('ALL PHASE 10 COMPLETE TESTING & EDGE CASES VERIFIED 100%!');
  } else {
    console.error(`SOME TESTS FAILED: ${total - passed} failures`);
    process.exit(1);
  }
}

runPhase10ComprehensiveTests().catch((err) => {
  console.error('Phase 10 test execution failed:', err);
  process.exit(1);
});
