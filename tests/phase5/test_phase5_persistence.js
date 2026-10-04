import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const API_BASE = 'http://localhost:5000/api';

async function runVerification() {
  console.log('================================================================');
  console.log('PHASE 5 FIX VERIFICATION: PERSIST GEMINI AI PLAN ACROSS REFRESH');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  try {
    // ----------------------------------------------------
    // STEP 1: Check Baseline State in MongoDB
    // ----------------------------------------------------
    console.log('--- STEP 1: Baseline MongoDB Verification ---');
    const initialAssignmentsRes = await fetch(`${API_BASE}/assignments`).then((r) => r.json());
    const initialAssignments = initialAssignmentsRes.data || initialAssignmentsRes;
    const initialCount = initialAssignments.length;
    console.log(`Baseline active assignments count in MongoDB: ${initialCount}`);

    // ----------------------------------------------------
    // STEP 2: Generate Gemini AI Plan Proposal
    // ----------------------------------------------------
    console.log('\n--- STEP 2: Generate Gemini AI Plan via POST /api/planner/generate ---');
    const genRes = await fetch(`${API_BASE}/planner/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Generate the optimal dispatch plan for today.' }),
    });
    const genData = await genRes.json();

    assert(genRes.status === 200, 'POST /api/planner/generate returned HTTP 200');
    assert(genData.success === true, 'Response has success: true');
    assert(Boolean(genData.planId), `Generated proposal has stable planId: ${genData.planId}`);
    assert(genData.status === 'AWAITING_APPROVAL' || genData.status === 'DRAFT', `Proposal status is ${genData.status}`);
    assert(Array.isArray(genData.proposedAssignments) && genData.proposedAssignments.length > 0, `Generated ${genData.proposedAssignments.length} proposed assignments`);
    assert(Boolean(genData.plan?.planSummary || genData.planSummary), 'Generated AI plan summary exists');

    const generatedPlanId = genData.planId;

    // ----------------------------------------------------
    // STEP 3: Confirm Assignments in DB UNCHANGED before approval
    // ----------------------------------------------------
    console.log('\n--- STEP 3: Verify MongoDB assignments collection UNCHANGED (No premature commit) ---');
    const assignmentsAfterGenRes = await fetch(`${API_BASE}/assignments`).then((r) => r.json());
    const assignmentsAfterGen = assignmentsAfterGenRes.data || assignmentsAfterGenRes;

    assert(
      assignmentsAfterGen.length === initialCount,
      `Live assignments collection count unchanged (${assignmentsAfterGen.length} === ${initialCount})`
    );
    const prematureAsg = assignmentsAfterGen.find((a) => a.reason?.includes(generatedPlanId));
    assert(!prematureAsg, 'No premature assignments committed to MongoDB assignments collection');

    // ----------------------------------------------------
    // STEP 4: Fetch Latest Proposal via GET /api/planner/latest (Simulating Page Refresh)
    // ----------------------------------------------------
    console.log('\n--- STEP 4: Simulate Page Refresh via GET /api/planner/latest ---');
    const refreshRes = await fetch(`${API_BASE}/planner/latest`);
    const refreshData = await refreshRes.json();

    assert(refreshRes.status === 200, 'GET /api/planner/latest returned HTTP 200');
    assert(refreshData.success === true, 'Refresh response has success: true');
    assert(refreshData.planId === generatedPlanId, `Reconstructed identical planId: ${refreshData.planId} === ${generatedPlanId}`);
    assert(
      refreshData.status === 'AWAITING_APPROVAL' || refreshData.status === 'DRAFT',
      `Reconstructed status is ${refreshData.status}`
    );
    assert(
      Boolean(refreshData.planSummary || refreshData.plan?.planSummary),
      'Reconstructed AI plan summary exists'
    );
    assert(
      Array.isArray(refreshData.proposedAssignments) && refreshData.proposedAssignments.length === genData.proposedAssignments.length,
      `Reconstructed ${refreshData.proposedAssignments.length} proposed assignments matching generation`
    );
    assert(
      Array.isArray(refreshData.unassignedRequests),
      'Reconstructed unassigned requests list'
    );
    assert(
      Array.isArray(refreshData.risks),
      'Reconstructed identified risks list'
    );
    assert(
      Boolean(refreshData.confidenceScore),
      `Reconstructed confidence score: ${refreshData.confidenceScore}`
    );
    assert(
      Boolean(refreshData.validation),
      'Reconstructed deterministic validation results'
    );

    // ----------------------------------------------------
    // STEP 5: Verify Proposals List endpoint GET /api/planner/proposals
    // ----------------------------------------------------
    console.log('\n--- STEP 5: Verify GET /api/planner/proposals and GET /api/planner/:planId ---');
    const listRes = await fetch(`${API_BASE}/planner/proposals`);
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /api/planner/proposals returned HTTP 200');
    assert(Array.isArray(listData.data), 'Proposals data is an array');
    const persistedProposal = listData.data.find((p) => p.planId === generatedPlanId);
    assert(Boolean(persistedProposal), `Plan ${generatedPlanId} exists in MongoDB PlanProposal collection`);

    const singleRes = await fetch(`${API_BASE}/planner/${generatedPlanId}`);
    const singleData = await singleRes.json();
    assert(singleRes.status === 200, `GET /api/planner/${generatedPlanId} returned HTTP 200`);
    assert(singleData.data?.planId === generatedPlanId, 'Single proposal retrieval matches planId');

    // ----------------------------------------------------
    // STEP 6: Dispatcher Approves Plan
    // ----------------------------------------------------
    console.log('\n--- STEP 6: Dispatcher Approval Flow via POST /api/planner/:planId/approve ---');
    const approveRes = await fetch(`${API_BASE}/planner/${generatedPlanId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvedBy: 'Alex Rivera',
        reason: 'Dispatcher approved verified AI plan proposal',
        proposedAssignments: genData.proposedAssignments,
      }),
    });
    const approveData = await approveRes.json();

    assert(approveRes.status === 200, 'POST approve endpoint returned HTTP 200');
    assert(approveData.success === true, 'Approval response has success: true');
    assert(approveData.status === 'CONFIRMED', 'Approval status is CONFIRMED');

    // ----------------------------------------------------
    // STEP 7: Verify Database Entities Created upon Approval
    // ----------------------------------------------------
    console.log('\n--- STEP 7: Verify Database Entities (Assignments, Versions, Approvals, Audits) ---');
    const [finalAsgsRes, finalVersRes, finalAuditRes] = await Promise.all([
      fetch(`${API_BASE}/assignments`).then((r) => r.json()),
      fetch(`${API_BASE}/schedules/versions`).then((r) => r.json()),
      fetch(`${API_BASE}/audit`).then((r) => r.json()),
    ]);
    const finalAsgs = finalAsgsRes.data || finalAsgsRes;
    const finalVers = finalVersRes.data || finalVersRes;
    const finalAudits = finalAuditRes.data || finalAuditRes;

    assert(finalAsgs.length >= genData.proposedAssignments.length, `Assignments committed to MongoDB (${finalAsgs.length} active assignments)`);
    assert(finalVers.length >= 4, `ScheduleVersion created and committed (${finalVers.length} total versions)`);
    const currentVersion = finalVers.find((v) => v.isCurrent);
    assert(Boolean(currentVersion), 'A version is marked current: true');
    const approvalAudit = finalAudits.find((a) => a.action === 'AI_PLAN_APPROVED');
    assert(Boolean(approvalAudit), 'AI_PLAN_APPROVED audit log entry created in MongoDB');

    // ----------------------------------------------------
    // STEP 8: Verify Plan Proposal Status Updated to CONFIRMED
    // ----------------------------------------------------
    console.log('\n--- STEP 8: Verify Plan Proposal Status Updated to CONFIRMED on Refresh ---');
    const refreshApprovedRes = await fetch(`${API_BASE}/planner/${generatedPlanId}`);
    const refreshApprovedData = await refreshApprovedRes.json();
    assert(
      refreshApprovedData.data?.status === 'CONFIRMED',
      `Persisted proposal status in MongoDB is CONFIRMED (${refreshApprovedData.data?.status})`
    );

    // ----------------------------------------------------
    // STEP 9: Test Rejection Flow on a New Plan
    // ----------------------------------------------------
    console.log('\n--- STEP 9: Test Rejection Flow (Status Updated to REJECTED) ---');
    const gen2Res = await fetch(`${API_BASE}/planner/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Generate another plan proposal to test rejection.' }),
    });
    const gen2Data = await gen2Res.json();
    const plan2Id = gen2Data.planId;
    assert(Boolean(plan2Id), `Generated second plan proposal: ${plan2Id}`);

    const rejectRes = await fetch(`${API_BASE}/planner/${plan2Id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rejectedBy: 'Alex Rivera',
        reason: 'Testing rejection state persistence',
      }),
    });
    const rejectData = await rejectRes.json();
    assert(rejectRes.status === 200, 'POST reject endpoint returned HTTP 200');
    assert(rejectData.status === 'REJECTED', 'Reject response status is REJECTED');

    const checkRejectedRes = await fetch(`${API_BASE}/planner/${plan2Id}`);
    const checkRejectedData = await checkRejectedRes.json();
    assert(
      checkRejectedData.data?.status === 'REJECTED',
      `Rejected proposal ${plan2Id} persisted as REJECTED in MongoDB (not silently deleted)`
    );

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
    console.log('================================================================');

    if (passed === total) {
      console.log('ALL PERSISTENCE AND RELOAD REQUIREMENTS VERIFIED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.error(`FAILED ${total - passed} TESTS!`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Verification failed with error:', err);
    process.exit(1);
  }
}

runVerification();
