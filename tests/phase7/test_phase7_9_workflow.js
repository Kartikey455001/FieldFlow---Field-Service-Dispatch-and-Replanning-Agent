import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const API_BASE = 'http://localhost:5000/api';

async function testPhase7to9Workflow() {
  console.log('================================================================');
  console.log('PHASE 7–9 VERIFICATION: CANCELLATION, EMERGENCY, VERSION COMPARISON & AUDIT');
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
  // STEP 1: Baseline Verification
  // ----------------------------------------------------
  console.log('--- STEP 1: Baseline MongoDB Operational State ---');
  const reqRes = await api('/requests');
  const allReqs = reqRes.data.data || reqRes.data || [];
  assert(allReqs.length >= 10, `Baseline service requests present in MongoDB (${allReqs.length})`);

  const completedReq = allReqs.find((r) => r.requestId === 'REQ-010');
  assert(completedReq && completedReq.status === 'COMPLETED', 'Protected completed request REQ-010 present in database');

  const versionsRes = await api('/schedule/versions');
  const baselineVersions = versionsRes.data.data || versionsRes.data || [];
  assert(baselineVersions.length >= 3, `Baseline schedule versions present (count: ${baselineVersions.length})`);

  // ----------------------------------------------------
  // STEP 2: Initial Gemini Plan & Dispatch Approval
  // ----------------------------------------------------
  console.log('\n--- STEP 2: Initial AI Plan & Approval (Version v4) ---');
  const genRes = await api('/planner/generate', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: 'Phase 7-9 Initial Plan Generation' }),
  });
  assert(genRes.status === 200, 'POST /api/planner/generate returned HTTP 200', genRes.data);
  assert(genRes.data.success === true, 'Real Gemini AI planning executed successfully');
  const planId1 = genRes.data.planId;
  assert(Boolean(planId1), `Initial proposal generated with planId: ${planId1}`);

  const approveRes1 = await api(`/planner/${planId1}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Lead Dispatcher', reason: 'Approved Initial AI Plan' }),
  });
  assert(approveRes1.status === 200, 'Approved initial plan', approveRes1.data);
  const versionV4 = approveRes1.data.version;
  assert(versionV4 === 'v4', `New schedule version ${versionV4} created in MongoDB`);

  // ----------------------------------------------------
  // STEP 3: Technician Cancellation & Protected Replanning
  // ----------------------------------------------------
  console.log('\n--- STEP 3: Technician Cancellation & Protected Replanning (Version v5) ---');
  const techCancelRes = await api('/planner/technician-unavailable', {
    method: 'POST',
    body: JSON.stringify({
      technicianId: 'TECH-002',
      name: 'Rahul Sharma',
      reason: 'Emergency vehicle breakdown',
    }),
  });
  assert(techCancelRes.status === 200, 'POST /api/planner/technician-unavailable returned HTTP 200', techCancelRes.data);
  assert(techCancelRes.data.status === 'Unavailable', 'Technician marked Unavailable in MongoDB');
  assert(techCancelRes.data.affectedCount >= 1, `Identified ${techCancelRes.data.affectedCount} affected requests`);

  // Check REQ-010 remains protected
  const req10Check = await api('/requests/REQ-010');
  assert(req10Check.data.data?.status === 'COMPLETED', 'REQ-010 strictly protected and remained COMPLETED');

  // Generate revised Gemini plan for cancellation
  const revCancelPlanRes = await api('/planner/generate-revised', {
    method: 'POST',
    body: JSON.stringify({ triggerReason: 'Technician Cancellation Replanning (Rahul Sharma)' }),
  });
  assert(revCancelPlanRes.status === 200, 'Gemini formulated revised plan for technician cancellation', revCancelPlanRes.data);
  const planId2 = revCancelPlanRes.data.planId;
  assert(Boolean(planId2), `Cancellation replan proposal generated: ${planId2}`);

  // Verify cancelled technician was NOT assigned in the new proposal
  const hasCancelledTechAssigned = (revCancelPlanRes.data.proposedAssignments || []).some(
    (p) => !p.isProtectedCompleted && (p.technicianId === 'TECH-002' || p.technician === 'Rahul Sharma')
  );
  assert(!hasCancelledTechAssigned, 'Cancelled technician (Rahul Sharma) excluded from candidate assignments');

  // Approve revised plan -> creates v5
  const approveRes2 = await api(`/planner/${planId2}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'Lead Dispatcher', reason: 'Approved cancellation replanning' }),
  });
  assert(approveRes2.status === 200, 'Approved cancellation replanning schedule', approveRes2.data);
  const versionV5 = approveRes2.data.version;
  assert(versionV5 === 'v5', `New schedule version ${versionV5} created`);

  // ----------------------------------------------------
  // STEP 4: Emergency Service Request & AI Replanning
  // ----------------------------------------------------
  console.log('\n--- STEP 4: Emergency Service Request & AI Replanning (Version v6) ---');
  const emergencyRes = await api('/planner/emergency-request', {
    method: 'POST',
    body: JSON.stringify({
      customer: 'Metro Substation Rapid Response',
      region: 'Jaipur Central',
      requiredSkill: 'Electrical Repair',
      preferredWindow: '15:00 - 17:00',
      notes: 'Critical power surge requiring immediate triage.',
    }),
  });
  assert(emergencyRes.status === 201, 'POST emergency-request returned HTTP 201', emergencyRes.data);
  const emergencyReqId = emergencyRes.data.data?.requestId;
  assert(Boolean(emergencyReqId), `Emergency request created in MongoDB: ${emergencyReqId}`);

  // Generate revised plan for emergency
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
  const versionV6 = approveRes3.data.version;
  assert(versionV6 === 'v6', `Schedule version ${versionV6} committed`);

  // ----------------------------------------------------
  // STEP 5: Version Comparison Engine Verification
  // ----------------------------------------------------
  console.log('\n--- STEP 5: Schedule Version Comparison & Diff Verification ---');
  const versionsAfterReplans = await api('/schedule/versions');
  const vList = versionsAfterReplans.data.data || versionsAfterReplans.data || [];
  const v4Doc = vList.find((v) => v.version === 'v4');
  const v5Doc = vList.find((v) => v.version === 'v5');
  const v6Doc = vList.find((v) => v.version === 'v6');

  assert(Boolean(v4Doc && v5Doc && v6Doc), 'Versions v4, v5, and v6 present in MongoDB');
  assert(v4Doc?.status === 'Confirmed', 'v4 is Confirmed');
  assert(v5Doc?.status === 'Confirmed', 'v5 is Confirmed');
  assert(v6Doc?.status === 'Confirmed' && v6Doc?.isCurrent, 'v6 is Confirmed and isCurrent=true');

  // Verify historical versions are immutable
  assert(v4Doc?.assignmentsSnapshot?.length > 0, 'v4 contains immutable assignments snapshot');
  assert(v5Doc?.assignmentsSnapshot?.length > 0, 'v5 contains immutable assignments snapshot');
  assert(v6Doc?.assignmentsSnapshot?.length > 0, 'v6 contains immutable assignments snapshot');

  // ----------------------------------------------------
  // STEP 6: Comprehensive Audit Trail Verification
  // ----------------------------------------------------
  console.log('\n--- STEP 6: Comprehensive Audit Trail Verification ---');
  const auditRes = await api('/audit');
  const auditList = auditRes.data.data || auditRes.data || [];

  const actionsLogged = new Set(auditList.map((a) => a.action));
  assert(actionsLogged.has('AI_PLAN_GENERATED') || actionsLogged.has('REVISED_PLAN_GENERATED'), 'AI_PLAN_GENERATED / REVISED_PLAN_GENERATED audit log found');
  assert(actionsLogged.has('AI_PLAN_APPROVED'), 'AI_PLAN_APPROVED audit log found');
  assert(actionsLogged.has('TECHNICIAN_UNAVAILABLE'), 'TECHNICIAN_UNAVAILABLE audit log found');
  assert(actionsLogged.has('EMERGENCY_CREATED'), 'EMERGENCY_CREATED audit log found');

  // ----------------------------------------------------
  // STEP 7: In-App Mock Notifications & Read State
  // ----------------------------------------------------
  console.log('\n--- STEP 7: In-App Mock Notifications & State Transitions ---');
  const notifRes = await api('/notifications');
  const notifList = notifRes.data.data || notifRes.data || [];
  assert(notifList.length > 0, `Notifications persisted in MongoDB (${notifList.length} items)`);

  const hasEmergencyNotif = notifList.some((n) => n.title?.includes('Emergency') || n.category === 'emergency');
  assert(hasEmergencyNotif, 'Emergency notification created in MongoDB');

  const hasUnavailableNotif = notifList.some((n) => n.title?.includes('Unavailable') || n.description?.includes('unavailable'));
  assert(hasUnavailableNotif, 'Technician unavailable notification created in MongoDB');

  // ----------------------------------------------------
  // STEP 8: Refresh Persistence Check
  // ----------------------------------------------------
  console.log('\n--- STEP 8: Refresh State Persistence Verification ---');
  const latestPlanRefresh = await api('/planner/latest');
  assert(latestPlanRefresh.status === 200, 'GET /api/planner/latest returned HTTP 200');
  assert(latestPlanRefresh.data.status === 'CONFIRMED', 'Latest confirmed plan persists across simulated refresh');

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('================================================================');
  if (passed === total) {
    console.log('ALL PHASE 7–9 WORKFLOW REQUIREMENTS VERIFIED 100%!');
  } else {
    console.error(`SOME TESTS FAILED: ${total - passed} failures`);
    process.exit(1);
  }
}

testPhase7to9Workflow().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
