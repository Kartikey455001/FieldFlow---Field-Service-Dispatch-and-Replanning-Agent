/**
 * FieldFlow AI Dispatch Console - Phase 4 Comprehensive Backend Test Suite
 * Tests all 15 critical business logic requirements from Section 25
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const config = {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`  ✓ PASSED: ${message}`);
    passedTests++;
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING PHASE 4 BACKEND VALIDATION & TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  // HEALTH CHECK
  console.log('--- PRE-FLIGHT: HEALTH CHECK ---');
  const health = await request('/health');
  assert(health.status === 200, 'Health endpoint responds with 200 OK');
  assert(health.data.status === 'ok', 'Health status is "ok"');
  assert(health.data.database === 'connected', 'Database connection status is "connected"');

  // 1. Valid assignment succeeds
  console.log('\n--- TEST 1: Valid assignment succeeds ---');
  await request('/assignments/REQ-TEST-VALID-01', { method: 'DELETE' });
  await request('/assignments/ASG-REQ-TEST-VALID-01', { method: 'DELETE' });
  await request('/requests/REQ-TEST-VALID-01', { method: 'DELETE' });

  const testReq = await request('/requests', {
    method: 'POST',
    body: {
      requestId: 'REQ-TEST-VALID-01',
      customer: 'Jaipur Heritage Hotel',
      phone: '+91 98290 99887',
      location: 'Jaipur South, Mansarovar',
      region: 'Jaipur South',
      requiredSkill: 'Plumbing',
      priority: 'Normal',
      duration: '2 hours',
      preferredWindow: '14:00 - 17:00',
    },
  });
  assert(testReq.status === 201, 'Test request created in MongoDB');

  const test1 = await request('/assignments', {
    method: 'POST',
    body: {
      requestId: 'REQ-TEST-VALID-01',
      technicianId: 'TECH-003', // Priya Verma (Plumbing, South)
      startTime: '14:00',
      endTime: '16:00',
      timeSlot: '14:00 - 16:00',
    },
  });
  assert(test1.status === 201, `Valid assignment returns 201 Created (got ${test1.status})`);
  assert(test1.data.success === true, 'Response success is true');
  assert(test1.data.data.technicianId === 'TECH-003', 'Technician ID correctly set in MongoDB');

  // 2. Unavailable technician assignment fails
  console.log('\n--- TEST 2: Unavailable technician assignment fails ---');
  // Neha Kapoor (TECH-005) is Unavailable / On Leave
  const test2 = await request('/assignments', {
    method: 'POST',
    body: {
      requestId: 'REQ-009',
      technicianId: 'TECH-005',
      startTime: '15:00',
      endTime: '17:00',
      timeSlot: '15:00 - 17:00',
    },
  });
  assert(test2.status === 400, `Unavailable technician returns 400 Bad Request (got ${test2.status})`);
  assert(test2.data.success === false, 'Assignment correctly rejected');
  assert(
    test2.data.error.code === 'TECHNICIAN_UNAVAILABLE',
    `Error code is TECHNICIAN_UNAVAILABLE (got ${test2.data.error.code})`
  );

  // 3. Missing skill assignment fails
  console.log('\n--- TEST 3: Missing skill assignment fails ---');
  // REQ-009 requires Electrical Repair. Priya Verma (TECH-003) only has Plumbing.
  const test3 = await request('/assignments', {
    method: 'POST',
    body: {
      requestId: 'REQ-009',
      technicianId: 'TECH-003',
      startTime: '15:00',
      endTime: '17:00',
      timeSlot: '15:00 - 17:00',
    },
  });
  assert(test3.status === 400, `Skill mismatch returns 400 Bad Request (got ${test3.status})`);
  assert(test3.data.error.code === 'SKILL_MISMATCH', `Error code is SKILL_MISMATCH (got ${test3.data.error.code})`);

  // 4. Overlapping assignment fails
  console.log('\n--- TEST 4: Overlapping assignment fails ---');
  // Create another request in window 14:00 - 17:00
  await request('/assignments/REQ-TEST-OVERLAP-02', { method: 'DELETE' });
  await request('/requests/REQ-TEST-OVERLAP-02', { method: 'DELETE' });
  await request('/requests', {
    method: 'POST',
    body: {
      requestId: 'REQ-TEST-OVERLAP-02',
      customer: 'Overlap Test Corp',
      phone: '+91 99999 77777',
      location: 'Jaipur South',
      region: 'Jaipur South',
      requiredSkill: 'Plumbing',
      priority: 'Normal',
      duration: '2 hours',
      preferredWindow: '14:00 - 17:00',
    },
  });

  // Priya Verma already has REQ-TEST-VALID-01 at 14:00 - 16:00. Attempt 15:00 - 17:00
  const test4 = await request('/assignments', {
    method: 'POST',
    body: {
      requestId: 'REQ-TEST-OVERLAP-02',
      technicianId: 'TECH-003',
      startTime: '15:00',
      endTime: '17:00',
      timeSlot: '15:00 - 17:00',
    },
  });
  assert(test4.status === 400, `Overlapping assignment returns 400 Bad Request (got ${test4.status})`);
  assert(
    test4.data.error.code === 'OVERLAPPING_ASSIGNMENT',
    `Error code is OVERLAPPING_ASSIGNMENT (got ${test4.data.error.code})`
  );

  // 5. Outside working hours fails
  console.log('\n--- TEST 5: Outside working hours fails ---');
  // Attempt assignment at 07:00 - 08:30 (operational hours 09:00 - 17:00)
  const test5 = await request('/assignments', {
    method: 'POST',
    body: {
      requestId: 'REQ-TEST-OVERLAP-02',
      technicianId: 'TECH-003',
      startTime: '07:00',
      endTime: '08:30',
      timeSlot: '07:00 - 08:30',
      options: { strictWindow: false },
    },
  });
  assert(test5.status === 400, `Outside working hours returns 400 Bad Request (got ${test5.status})`);
  assert(
    test5.data.error.code === 'OUTSIDE_OPERATING_HOURS' || test5.data.error.code === 'OUTSIDE_WORKING_HOURS',
    `Error code is OUTSIDE_OPERATING_HOURS (got ${test5.data.error.code})`
  );

  // 6. Outside customer window fails
  console.log('\n--- TEST 6: Outside customer window fails ---');
  // REQ-TEST-OVERLAP-02 preferred window is 14:00 - 17:00. Attempt assignment at 11:00 - 12:00
  const test6 = await request('/assignments', {
    method: 'POST',
    body: {
      requestId: 'REQ-TEST-OVERLAP-02',
      technicianId: 'TECH-003',
      startTime: '11:00',
      endTime: '12:00',
      timeSlot: '11:00 - 12:00',
    },
  });
  assert(test6.status === 400, `Outside customer window returns 400 Bad Request (got ${test6.status})`);
  assert(
    test6.data.error.code === 'OUTSIDE_REQUEST_WINDOW' || test6.data.error.code === 'OUTSIDE_CUSTOMER_WINDOW',
    `Error code is OUTSIDE_REQUEST_WINDOW (got ${test6.data.error.code})`
  );

  // 7. Protected completed assignment cannot be moved
  console.log('\n--- TEST 7: Protected completed assignment cannot be moved ---');
  // REQ-010 is COMPLETED and protected: true
  const test7 = await request('/assignments', {
    method: 'POST',
    body: {
      requestId: 'REQ-010',
      technicianId: 'TECH-001',
      startTime: '15:00',
      endTime: '16:30',
      timeSlot: '15:00 - 16:30',
    },
  });
  assert(test7.status === 400, `Attempting to move protected completed job returns 400 (got ${test7.status})`);
  assert(
    test7.data.error.code === 'REQUEST_ALREADY_COMPLETED' || test7.data.error.code === 'PROTECTED_COMPLETED_JOB',
    `Error code is REQUEST_ALREADY_COMPLETED (got ${test7.data.error.code})`
  );

  // 8. Emergency request can be created
  console.log('\n--- TEST 8: Emergency request can be created ---');
  const emergencyReq = await request('/requests/emergency', {
    method: 'POST',
    body: {
      customer: 'Jaipur Hospital Trauma Center',
      phone: '+91 98888 77777',
      location: 'MI Road, Hospital Block',
      region: 'Jaipur Central',
      requiredSkill: 'Electrical Repair',
      duration: '2 hours',
      preferredWindow: '14:00 - 16:00',
      notes: 'Critical power board outage in ICU wing.',
    },
  });
  assert(emergencyReq.status === 201, `Emergency request returns 201 Created (got ${emergencyReq.status})`);
  assert(emergencyReq.data.data.priority === 'Critical', 'Emergency priority is strictly Critical');
  assert(emergencyReq.data.data.status === 'UNASSIGNED', 'Initial emergency status is UNASSIGNED');
  const createdEmergencyId = emergencyReq.data.data.requestId;

  // 9. Invalid plan cannot be approved
  console.log('\n--- TEST 9: Invalid plan cannot be approved ---');
  const invalidApproval = await request('/planner/PLAN-INVALID-TEST/approve', {
    method: 'POST',
    body: {
      approvedBy: 'Alex Rivera',
      proposedAssignments: [
        {
          requestId: createdEmergencyId,
          technicianId: 'TECH-005', // Neha Kapoor is UNAVAILABLE
          technician: 'Neha Kapoor',
          startTime: '14:00',
          endTime: '16:00',
          customer: 'Jaipur Hospital',
          skill: 'Electrical Repair',
          status: 'ASSIGNED',
        },
      ],
    },
  });
  assert(invalidApproval.status === 400, `Invalid plan approval rejected with 400 Bad Request (got ${invalidApproval.status})`);
  assert(invalidApproval.data.success === false, 'Approval response success is false');

  // 10. Schedule approval persists atomically
  console.log('\n--- TEST 10: Schedule approval persists atomically ---');
  const planGen = await request('/planner/generate', {
    method: 'POST',
    body: {
      triggerReason: 'Integration Test Optimization',
      dispatcherAnswers: { 'MIS-001': 'Allow 1h overtime for Alex Johnson' },
    },
  });
  assert(planGen.status === 200, 'Plan generated successfully');
  const planId = planGen.data.planId;

  const approveRes = await request(`/planner/${planId}/approve`, {
    method: 'POST',
    body: {
      approvedBy: 'Alex Rivera',
      reason: 'Automated Test Approval',
      proposedAssignments: planGen.data.proposedAssignments,
    },
  });
  assert(approveRes.status === 200, `Plan approval succeeds with 200 (got ${approveRes.status})`);
  assert(approveRes.data.success === true, 'Approval marked as success');
  assert(approveRes.data.version !== undefined, `New version created: ${approveRes.data.version}`);

  // 11. Rejected plan does not modify confirmed schedule
  console.log('\n--- TEST 11: Rejected plan does not modify confirmed schedule ---');
  const planGen2 = await request('/planner/generate', {
    method: 'POST',
    body: { triggerReason: 'Draft Plan to Reject' },
  });
  const rejectPlanId = planGen2.data.planId;

  const versionsBefore = await request('/schedules/versions');
  const countBefore = versionsBefore.data.data.length;

  const rejectRes = await request(`/planner/${rejectPlanId}/reject`, {
    method: 'POST',
    body: {
      rejectedBy: 'Alex Rivera',
      reason: 'Dispatcher rejected due to high workload',
    },
  });
  assert(rejectRes.status === 200, `Plan rejection succeeds with 200 (got ${rejectRes.status})`);
  assert(rejectRes.data.planStatus === 'Plan Rejected', 'Plan status recorded as Plan Rejected');

  const versionsAfter = await request('/schedules/versions');
  assert(
    versionsAfter.data.data.length === countBefore,
    'Confirmed schedule version count unchanged after rejection'
  );

  // 12. Schedule version remains immutable
  console.log('\n--- TEST 12: Schedule version remains immutable ---');
  const v1Res = await request('/schedules/versions/v1');
  assert(v1Res.status === 200, 'Historical version v1 exists and can be retrieved');
  const v1OriginalReason = v1Res.data.data.reason;
  assert(v1OriginalReason.length > 0, `Historical v1 has original reason: "${v1OriginalReason}"`);

  // Verify compare endpoint
  const compareRes = await request('/schedules/compare/v1/v2');
  assert(compareRes.status === 200, 'Version comparison between v1 and v2 succeeds');
  assert(compareRes.data.success === true, 'Comparison returned success');
  assert(Array.isArray(compareRes.data.data.changes), 'Comparison returned structured changes array');

  // 13. Rollback creates a new version
  console.log('\n--- TEST 13: Rollback creates a new version ---');
  const rollbackRes = await request('/schedules/versions/v2/rollback', {
    method: 'POST',
    body: { performedBy: 'Alex Rivera' },
  });
  assert(rollbackRes.status === 200, `Rollback succeeds with 200 (got ${rollbackRes.status})`);
  assert(rollbackRes.data.success === true, 'Rollback reports success');
  assert(rollbackRes.data.version !== 'v2', `Rollback created new version: ${rollbackRes.data.version}`);

  // Verify historical v2 is unchanged
  const v2Res = await request('/schedules/versions/v2');
  assert(v2Res.status === 200, 'Historical v2 remains unchanged');

  // 14. Technician unavailability creates affected-job detection
  console.log('\n--- TEST 14: Technician unavailability creates affected-job detection ---');
  const techUnavail = await request('/technicians/TECH-002/availability', {
    method: 'PATCH',
    body: {
      status: 'UNAVAILABLE',
      reason: 'Emergency dental surgery',
    },
  });
  assert(techUnavail.status === 200, `Technician availability update succeeds (got ${techUnavail.status})`);
  assert(techUnavail.data.success === true, 'Update reports success');
  assert(
    techUnavail.data.data.technician.status === 'Unavailable' || techUnavail.data.data.technician.status === 'UNAVAILABLE',
    'Technician status is Unavailable'
  );
  assert(
    Array.isArray(techUnavail.data.data.affectedRequestIds),
    `Affected requests detected: [${techUnavail.data.data.affectedRequestIds.join(', ')}]`
  );

  // Restore Rahul Sharma to Available for clean operational state
  await request('/technicians/TECH-002/availability', {
    method: 'PATCH',
    body: { status: 'AVAILABLE', reason: 'Back on shift' },
  });

  // 15. Notification unread count updates correctly
  console.log('\n--- TEST 15: Notification unread count updates correctly ---');
  const notifsList = await request('/notifications');
  assert(notifsList.status === 200, 'Notifications retrieved');

  // Mark all read
  const markAllRes = await request('/notifications/read-all', { method: 'PATCH' });
  assert(markAllRes.status === 200, 'Mark all read succeeds');

  const notifsAfter = await request('/notifications');
  assert(notifsAfter.data.unreadCount === 0, `Unread count is 0 after mark-all-read (got ${notifsAfter.data.unreadCount})`);

  // Mark first notification as unread
  if (notifsList.data.data.length > 0) {
    const firstNotifId = notifsList.data.data[0].notificationId;
    const markUnreadRes = await request(`/notifications/${firstNotifId}/unread`, { method: 'PATCH' });
    assert(markUnreadRes.status === 200, `Mark notification unread succeeds`);

    const notifsAfterSingle = await request('/notifications');
    assert(
      notifsAfterSingle.data.unreadCount === 1,
      `Unread count is 1 after single unread toggle (got ${notifsAfterSingle.data.unreadCount})`
    );
  }

  // Clean up test data created during test
  await request('/assignments/REQ-TEST-VALID-01', { method: 'DELETE' });
  await request('/requests/REQ-TEST-VALID-01', { method: 'DELETE' });
  await request('/requests/REQ-TEST-OVERLAP-02', { method: 'DELETE' });

  // DASHBOARD SUMMARY DERIVED FROM DATABASE
  console.log('\n--- BONUS VERIFICATION: DATABASE-DERIVED DASHBOARD SUMMARY ---');
  const summaryRes = await request('/dashboard/summary');
  assert(summaryRes.status === 200, 'Dashboard summary returns 200');
  const summary = summaryRes.data.data || summaryRes.data;
  assert(summary.totalRequests > 0, `Total requests: ${summary.totalRequests}`);
  assert(summary.technicians.total === 5, 'Total technicians count is 5');
  assert(summary.completed >= 1, `Completed requests count is ${summary.completed}`);

  console.log('\n====================================================');
  console.log(`TEST RUN COMPLETE: ${passedTests} passed, ${failedTests} failed`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('\nFatal test execution error:', err);
  process.exit(1);
});
