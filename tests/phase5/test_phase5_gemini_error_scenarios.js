import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

import { generateGeminiDispatchPlan } from '../../server/src/services/geminiPlannerService.js';
import { evaluateCandidateEligibility } from '../../server/src/services/candidateService.js';

async function testErrorScenarios() {
  console.log('====================================================');
  console.log('PHASE 5 — GEMINI ERROR & EDGE CASE SCENARIOS');
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

  // 1. Missing GEMINI_API_KEY
  console.log('--- SCENARIO 1: Missing GEMINI_API_KEY ---');
  const origKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const missingKeyRes = await generateGeminiDispatchPlan({
    requests: [],
    technicians: [],
  });
  assert(missingKeyRes.success === false, 'Returns success: false when API key missing');
  assert(
    missingKeyRes.error === 'Gemini API key is not configured',
    'Returns exact clean error "Gemini API key is not configured"'
  );

  // 2. Invalid GEMINI_API_KEY / API Failure
  console.log('\n--- SCENARIO 2: Invalid GEMINI_API_KEY / API Failure ---');
  process.env.GEMINI_API_KEY = 'invalid_dummy_gemini_api_key_12345';
  const invalidKeyRes = await generateGeminiDispatchPlan({
    requests: [
      {
        requestId: 'REQ-011',
        customer: 'Test Customer',
        requiredSkill: 'Electrical Repair',
        region: 'Central',
        priority: 'Critical',
      },
    ],
    technicians: [
      {
        technicianId: 'TECH-002',
        name: 'Rahul Sharma',
        skills: ['Electrical Repair'],
        status: 'Available',
      },
    ],
  });
  assert(invalidKeyRes.success === false, 'Returns success: false when API key is invalid or call fails');
  assert(
    invalidKeyRes.error.includes('Gemini API planning failed') || invalidKeyRes.error.includes('API key'),
    'Returns clean error without throwing or crashing server'
  );

  // 3. Scenario: No Eligible Technician Available (Skill or availability gap)
  console.log('\n--- SCENARIO 3: No Eligible Technician Available ---');
  const impossibleRequests = [
    {
      requestId: 'REQ-999',
      customer: 'Industrial Substation',
      requiredSkill: 'High Voltage Substation Transmission', // No tech has this skill
      region: 'North',
      priority: 'Critical',
      durationHours: 2,
      status: 'UNASSIGNED',
    },
  ];
  const technicians = [
    {
      technicianId: 'TECH-001',
      name: 'Alex Johnson',
      skills: ['AC Repair', 'HVAC'],
      status: 'Available',
    },
    {
      technicianId: 'TECH-002',
      name: 'Rahul Sharma',
      skills: ['Electrical Repair'],
      status: 'Available',
    },
  ];

  const eligibility = evaluateCandidateEligibility({
    requests: impossibleRequests,
    technicians,
    assignments: [],
  });

  assert(
    (eligibility.candidatesByRequest['REQ-999'] || []).length === 0,
    'No candidates found for request with unsatisfied skill requirement'
  );
  assert(
    eligibility.requestsWithoutCandidates.length === 1,
    'Request identified in requestsWithoutCandidates list'
  );
  assert(
    eligibility.requestsWithoutCandidates[0].reason.includes('No available technician with skill'),
    'Reason clearly indicates lack of qualified technician'
  );

  // 4. Scenario: All qualified technicians unavailable / on leave
  console.log('\n--- SCENARIO 4: All Qualified Technicians On Leave ---');
  const onLeaveTechnicians = [
    {
      technicianId: 'TECH-002',
      name: 'Rahul Sharma',
      skills: ['Electrical Repair'],
      status: 'On Leave', // On leave
    },
  ];
  const elecRequest = [
    {
      requestId: 'REQ-011',
      customer: 'Kartikey',
      requiredSkill: 'Electrical Repair',
      priority: 'Critical',
      durationHours: 2,
      status: 'UNASSIGNED',
    },
  ];
  const leaveEligibility = evaluateCandidateEligibility({
    requests: elecRequest,
    technicians: onLeaveTechnicians,
    assignments: [],
  });
  assert(
    (leaveEligibility.candidatesByRequest['REQ-011'] || []).length === 0,
    'On-leave technician correctly excluded from candidate pool'
  );

  // Restore env
  if (origKey) {
    process.env.GEMINI_API_KEY = origKey;
  } else {
    delete process.env.GEMINI_API_KEY;
  }

  console.log('\n====================================================');
  console.log(`EDGE CASE SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed === total) {
    console.log('ALL ERROR AND EDGE CASE SCENARIOS HANDLED CORRECTLY!');
  } else {
    process.exit(1);
  }
}

testErrorScenarios();
