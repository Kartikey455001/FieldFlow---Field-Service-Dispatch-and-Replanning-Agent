import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

import { evaluateCandidateEligibility } from '../../server/src/services/candidateService.js';
import { validateAiPlanProposal } from '../../server/src/services/planValidator.js';
import { buildPlanningPrompt, AI_PLAN_SCHEMA } from '../../server/src/services/geminiPlannerService.js';

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 5 — GEMINI AI DISPATCH PLANNER VERIFICATION');
  console.log('====================================================\n');

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
    // TEST 1: Real Database State Read (No Invention)
    // ----------------------------------------------------
    console.log('--- TEST 1: Real MongoDB State Verification ---');
    const [reqsRes, techsRes, asgsRes, versRes] = await Promise.all([
      fetch(`${API_BASE}/requests`).then((r) => r.json()),
      fetch(`${API_BASE}/technicians`).then((r) => r.json()),
      fetch(`${API_BASE}/assignments`).then((r) => r.json()),
      fetch(`${API_BASE}/schedules/versions`).then((r) => r.json()),
    ]);
    const requests = reqsRes.data || reqsRes;
    const technicians = techsRes.data || techsRes;
    const assignments = asgsRes.data || asgsRes;
    const versions = versRes.data || versRes;

    assert(requests.length >= 10, `Read ${requests.length} real service requests from MongoDB`);
    assert(technicians.length >= 5, `Read ${technicians.length} real technicians from MongoDB`);
    assert(assignments.length >= 7, `Read ${assignments.length} real assignments from MongoDB`);
    assert(versions.length >= 3, `Read ${versions.length} real schedule versions from MongoDB`);

    const req011 = requests.find((r) => r.requestId === 'REQ-011');
    assert(req011 !== undefined, 'Emergency request REQ-011 exists in real MongoDB state');
    if (req011) {
      assert(req011.priority === 'Critical', 'REQ-011 priority is Critical');
      assert(req011.requiredSkill.includes('Electrical'), 'REQ-011 requires Electrical skill');
    }

    const req010 = requests.find((r) => r.requestId === 'REQ-010');
    assert(req010 !== undefined, 'Completed request REQ-010 exists in real MongoDB state');
    if (req010) {
      assert(
        req010.status === 'COMPLETED' || req010.status === 'Completed' || req010.isProtectedCompleted,
        'REQ-010 is marked as Completed/Protected'
      );
    }

    // ----------------------------------------------------
    // TEST 2: Deterministic Candidate Filtering
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Deterministic Candidate Filtering ---');
    const candidateResult = evaluateCandidateEligibility({
      requests,
      technicians,
      assignments,
      settings: {},
      dispatcherAnswers: {},
    });

    assert(candidateResult.candidatesByRequest !== undefined, 'Candidate evaluation returned candidates map');
    
    // Check candidates for REQ-011 (Electrical, South, 15:00 - 17:00)
    const req011Candidates = candidateResult.candidatesByRequest['REQ-011'] || [];
    assert(req011Candidates.length > 0, `REQ-011 found ${req011Candidates.length} eligible candidates`);
    
    for (const cand of req011Candidates) {
      const tech = technicians.find((t) => t.technicianId === cand.technicianId);
      assert(
        cand.skills.some((s) => s.toLowerCase().includes('electrical')) ||
          tech.skills.some((s) => s.toLowerCase().includes('electrical')),
        `Candidate ${cand.technicianName} possesses certified Electrical skill`
      );
      assert(
        tech.status === 'Available' || tech.status === 'AVAILABLE',
        `Candidate ${cand.technicianName} has Available status (not on leave/unavailable)`
      );
      assert(
        cand.feasibleSlots.length > 0,
        `Candidate ${cand.technicianName} has feasible non-overlapping time slots: ${cand.feasibleSlots.join(', ')}`
      );
    }

    // Verify unavailable technician is excluded from candidates
    const unavailTech = technicians.find((t) => t.status === 'Unavailable' || t.status === 'On Leave');
    if (unavailTech) {
      const allCandidateTechIds = Object.values(candidateResult.candidatesByRequest)
        .flat()
        .map((c) => c.technicianId);
      assert(
        !allCandidateTechIds.includes(unavailTech.technicianId),
        `Unavailable technician ${unavailTech.name} (${unavailTech.status}) is strictly excluded from all candidate lists`
      );
    }

    // ----------------------------------------------------
    // TEST 3: Prompt Building & Schema Verification
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Gemini Prompt Construction & Schema ---');
    const prompt = buildPlanningPrompt({
      scheduleVersion: 'v3',
      requests,
      technicians,
      existingAssignments: assignments,
      eligibleCandidatesByRequest: candidateResult.candidatesByRequest,
      dispatcherQuestion: 'Generate optimal plan for today.',
    });

    assert(prompt.includes('CURRENT DISPATCH STATE'), 'Prompt includes CURRENT DISPATCH STATE section');
    assert(prompt.includes('REQ-011'), 'Prompt includes emergency request REQ-011');
    assert(prompt.includes('VALID DETERMINISTIC CANDIDATES'), 'Prompt includes VALID DETERMINISTIC CANDIDATES section');
    assert(prompt.includes('STRICTLY PROTECTED/COMPLETED'), 'Prompt flags completed protected assignments');
    assert(AI_PLAN_SCHEMA.required.includes('planSummary'), 'AI Plan Schema requires planSummary');
    assert(AI_PLAN_SCHEMA.required.includes('assignments'), 'AI Plan Schema requires assignments');
    assert(AI_PLAN_SCHEMA.required.includes('unassignedRequests'), 'AI Plan Schema requires unassignedRequests');
    assert(AI_PLAN_SCHEMA.required.includes('risks'), 'AI Plan Schema requires risks');
    assert(AI_PLAN_SCHEMA.required.includes('tradeoffs'), 'AI Plan Schema requires tradeoffs');
    assert(AI_PLAN_SCHEMA.required.includes('questions'), 'AI Plan Schema requires questions');

    // ----------------------------------------------------
    // TEST 4: Backend Deterministic Plan Validator
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Plan Validator Edge Cases & Hard Constraints ---');
    
    // Case 4A: Valid proposal
    const validProposal = [
      {
        requestId: 'REQ-011',
        technicianId: req011Candidates[0]?.technicianId || 'TECH-002',
        technicianName: req011Candidates[0]?.technicianName || 'Rahul Sharma',
        startTime: '12:00',
        endTime: '14:00',
        priority: 'Critical',
        reason: 'Optimal electrical technician with regional proximity and open slot',
      },
    ];
    const validCheck = validateAiPlanProposal({
      proposedAssignments: validProposal,
      requests,
      technicians,
      existingAssignments: assignments,
    });
    assert(validCheck.valid === true, 'Valid proposal passes backend validation');
    assert(validCheck.errors.length === 0, 'Valid proposal produces 0 validation errors');
    assert(validCheck.validatedAssignments[0]?.validationStatus === 'VALID', 'Assignment tagged VALID');

    // Case 4B: Reassigning protected completed job REQ-010 to a different tech
    const invalidProtectedProposal = [
      {
        requestId: 'REQ-010',
        technicianId: 'TECH-002',
        technicianName: 'Priya Patel',
        startTime: '09:00',
        endTime: '11:00',
        priority: 'Normal',
        reason: 'Reassign completed job',
      },
    ];
    const protectedCheck = validateAiPlanProposal({
      proposedAssignments: invalidProtectedProposal,
      requests,
      technicians,
      existingAssignments: assignments,
    });
    assert(protectedCheck.valid === false, 'Modifying protected completed REQ-010 fails validation');
    assert(
      protectedCheck.errors.some((e) => e.requestId === 'REQ-010' && e.reason.includes('COMPLETED')),
      'Validation error explicitly flags COMPLETED protected violation'
    );

    // Case 4C: Assigning an unavailable/on-leave technician
    if (unavailTech) {
      const invalidUnavailProposal = [
        {
          requestId: 'REQ-011',
          technicianId: unavailTech.technicianId,
          technicianName: unavailTech.name,
          startTime: '15:00',
          endTime: '17:00',
          priority: 'Critical',
          reason: 'Assigning tech on leave',
        },
      ];
      const unavailCheck = validateAiPlanProposal({
        proposedAssignments: invalidUnavailProposal,
        requests,
        technicians,
        existingAssignments: assignments,
      });
      assert(unavailCheck.valid === false, 'Assigning unavailable technician fails validation');
      assert(
        unavailCheck.errors.some((e) => e.reason.includes('UNAVAILABLE') || e.reason.includes('ON_LEAVE')),
        'Validation error flags unavailable technician'
      );
    }

    // Case 4D: Assigning a technician who lacks required skill
    const hvacTech = technicians.find((t) => t.skills.includes('HVAC') && !t.skills.includes('Electrical'));
    if (hvacTech) {
      const invalidSkillProposal = [
        {
          requestId: 'REQ-011', // requires Electrical
          technicianId: hvacTech.technicianId,
          technicianName: hvacTech.name,
          startTime: '15:00',
          endTime: '17:00',
          priority: 'Critical',
          reason: 'Assigning tech with wrong skill',
        },
      ];
      const skillCheck = validateAiPlanProposal({
        proposedAssignments: invalidSkillProposal,
        requests,
        technicians,
        existingAssignments: assignments,
      });
      assert(skillCheck.valid === false, 'Assigning technician with mismatched skill fails validation');
      assert(
        skillCheck.errors.some((e) => e.reason.includes('lacks required skill')),
        'Validation error flags missing skill requirement'
      );
    }

    // Case 4E: Outside operational hours
    const outsideHoursProposal = [
      {
        requestId: 'REQ-011',
        technicianId: 'TECH-001',
        technicianName: 'Rahul Sharma',
        startTime: '06:00',
        endTime: '08:00',
        priority: 'Critical',
        reason: 'Too early in morning',
      },
    ];
    const hoursCheck = validateAiPlanProposal({
      proposedAssignments: outsideHoursProposal,
      requests,
      technicians,
      existingAssignments: assignments,
    });
    assert(hoursCheck.valid === false, 'Proposed time outside operational hours (09:00 - 17:00) fails validation');

    // Case 4F: Overlapping schedule conflict with existing active assignment
    const existingAsg = assignments.find((a) => a.startTime && a.endTime);
    if (existingAsg) {
      const conflictProposal = [
        {
          requestId: 'REQ-011',
          technicianId: existingAsg.technicianId,
          technicianName: existingAsg.technicianName,
          startTime: existingAsg.startTime,
          endTime: existingAsg.endTime,
          priority: 'Critical',
          reason: 'Double booking conflict',
        },
      ];
      const conflictCheck = validateAiPlanProposal({
        proposedAssignments: conflictProposal,
        requests,
        technicians,
        existingAssignments: assignments,
      });
      assert(conflictCheck.valid === false, 'Proposed timeslot overlapping active assignment fails validation');
      assert(
        conflictCheck.errors.some((e) => e.reason.includes('conflict') || e.reason.includes('Overlaps')),
        'Validation error flags schedule collision'
      );
    }

    // ----------------------------------------------------
    // TEST 5: Missing Key Unit Verification
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Missing Key Clean Handling ---');
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const { generateGeminiDispatchPlan } = await import('../../server/src/services/geminiPlannerService.js');
    const missingKeyRes = await generateGeminiDispatchPlan({ requests: [], technicians: [] });
    assert(missingKeyRes.success === false, 'Returns success: false when API key is missing');
    assert(missingKeyRes.error.includes('Gemini API key is not configured'), 'Returns clean error when key missing');
    process.env.GEMINI_API_KEY = origKey;

    // ----------------------------------------------------
    // TEST 6: POST /api/planner/generate Real Gemini API Proposal Flow
    // ----------------------------------------------------
    console.log('\n--- TEST 6: POST /api/planner/generate Real Gemini API Proposal Flow ---');
    const realRes = await fetch(`${API_BASE}/planner/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Generate the best feasible dispatch plan for today.' }),
    });
    const realData = await realRes.json();

    assert(realRes.status === 200, 'Proposal endpoint returns HTTP 200 on live Gemini proposal generation');
    assert(realData.success === true, 'Proposal response has success: true');
    assert(realData.plan !== undefined, 'Proposal response contains structured plan object');
    assert(
      typeof realData.plan.planSummary === 'string' && realData.plan.planSummary.length > 10,
      `Proposal contains real Gemini planSummary (${realData.plan.planSummary.slice(0, 60)}...)`
    );
    assert(Array.isArray(realData.plan.assignments), 'Proposal contains assignments array');
    assert(realData.validation !== undefined, 'Proposal response contains validation object');
    assert(typeof realData.validation.valid === 'boolean', 'Proposal has deterministic validation status');
    assert(realData.metadata !== undefined, 'Proposal contains metadata with model and timestamp');
    assert(
      realData.metadata.model.includes('gemini'),
      `Proposal metadata reflects real Gemini model: ${realData.metadata.model}`
    );
    assert(realData.status === 'DRAFT' || realData.status === 'AWAITING_APPROVAL', 'Proposal status is explicitly DRAFT or AWAITING_APPROVAL');

    // ----------------------------------------------------
    // TEST 7: CRITICAL SAFETY RULE — ZERO DATABASE MUTATION
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Database Immutability Check (NO DB COMMIT) ---');
    const [reqsAfterRes, techsAfterRes, asgsAfterRes, versAfterRes] = await Promise.all([
      fetch(`${API_BASE}/requests`).then((r) => r.json()),
      fetch(`${API_BASE}/technicians`).then((r) => r.json()),
      fetch(`${API_BASE}/assignments`).then((r) => r.json()),
      fetch(`${API_BASE}/schedules/versions`).then((r) => r.json()),
    ]);
    const requestsAfter = reqsAfterRes.data || reqsAfterRes;
    const techniciansAfter = techsAfterRes.data || techsAfterRes;
    const assignmentsAfter = asgsAfterRes.data || asgsAfterRes;
    const versionsAfter = versAfterRes.data || versAfterRes;

    assert(requestsAfter.length === requests.length, `ServiceRequest count unchanged (${requestsAfter.length})`);
    assert(techniciansAfter.length === technicians.length, `Technician count unchanged (${techniciansAfter.length})`);
    assert(assignmentsAfter.length === assignments.length, `Assignment count unchanged (${assignmentsAfter.length})`);
    assert(versionsAfter.length === versions.length, `ScheduleVersion count unchanged (${versionsAfter.length})`);

    const req011After = requestsAfter.find((r) => r.requestId === 'REQ-011');
    assert(
      req011After.status === 'UNASSIGNED' || req011After.needsReplanning === true,
      'Emergency REQ-011 remains uncommitted in database (proposal only)'
    );

    // ----------------------------------------------------
    // TEST 8: Preserving Phase 4 Functionality
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Preserving Phase 4 Endpoints & Integrity ---');
    const [rRes, tRes, aRes, vRes, auditRes, notifRes] = await Promise.all([
      fetch(`${API_BASE}/requests`),
      fetch(`${API_BASE}/technicians`),
      fetch(`${API_BASE}/assignments`),
      fetch(`${API_BASE}/schedules/versions`),
      fetch(`${API_BASE}/audit`),
      fetch(`${API_BASE}/notifications`),
    ]);

    assert(rRes.status === 200, 'GET /api/requests is HTTP 200');
    assert(tRes.status === 200, 'GET /api/technicians is HTTP 200');
    assert(aRes.status === 200, 'GET /api/assignments is HTTP 200');
    assert(vRes.status === 200, 'GET /api/schedules/versions is HTTP 200');
    assert(auditRes.status === 200, 'GET /api/audit is HTTP 200');
    assert(notifRes.status === 200, 'GET /api/notifications is HTTP 200');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log('====================================================');

    if (passed === total) {
      console.log('ALL PHASE 5 REQUIREMENTS VERIFIED SUCCESSFULLY!');
    } else {
      console.error(`FAILED ${total - passed} TESTS!`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runTests();
