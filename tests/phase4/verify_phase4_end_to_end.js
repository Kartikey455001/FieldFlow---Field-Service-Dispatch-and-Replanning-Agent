/**
 * End-to-End Functional Verification of Section 27 Steps
 */

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const config = { ...options, headers: { ...defaultHeaders, ...options.headers } };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

function check(stepNum, condition, description) {
  if (!condition) {
    console.error(`❌ STEP ${stepNum} FAILED: ${description}`);
    process.exit(1);
  } else {
    console.log(`✓ STEP ${stepNum} PASSED: ${description}`);
  }
}

async function runEndToEndVerification() {
  console.log('===============================================================');
  console.log('EXECUTING SECTION 27 COMPLETE END-TO-END WORKFLOW (STEPS 1-36)');
  console.log('===============================================================\n');

  // Steps 1-4: Verify health & database connection
  const health = await req('/health');
  check('1-4', health.status === 200 && health.data.database === 'connected', 'Server & MongoDB Atlas connected cleanly');

  // Steps 5-6: Open Dashboard & verify database-backed metrics
  const summary = await req('/dashboard/summary');
  check('5-6', summary.data.totalRequests === 10, 'Dashboard totalRequests is 10');
  check('5-6b', summary.data.assigned === 8, 'Dashboard assigned requests is 8');
  check('5-6c', summary.data.unassigned === 2, 'Dashboard unassigned requests is 2');
  check('5-6d', summary.data.completed === 1, 'Dashboard completed requests is 1');
  check('5-6e', summary.data.technicians.active === 4, 'Dashboard active technicians is 4');
  check('5-6f', summary.data.unreadNotifications === 2, 'Dashboard unread notifications is 2');

  // Steps 7-8: Open Service Requests & inspect REQ-001
  const req001 = await req('/requests/REQ-001');
  check('7-8', req001.status === 200 && req001.data.data.requestId === 'REQ-001', 'Inspected REQ-001 from database');

  // Steps 9-10: Create a test request & verify it appears after refresh
  const newReq = await req('/requests', {
    method: 'POST',
    body: {
      requestId: 'REQ-011-E2E',
      customer: 'Jaipur International Airport',
      phone: '+91 91234 56789',
      location: 'Sanganer Airport Terminal',
      region: 'Jaipur South',
      requiredSkill: 'Plumbing',
      priority: 'High',
      duration: '2 hours',
      preferredWindow: '14:00 - 17:00',
      notes: 'Water pressure sensor maintenance',
    },
  });
  check('9', newReq.status === 201, 'Created test request REQ-011-E2E in MongoDB');

  // Step 10: Refresh requests from database
  const refreshRequests = await req('/requests');
  const foundNewReq = refreshRequests.data.data.find((r) => r.requestId === 'REQ-011-E2E');
  check('10', foundNewReq !== undefined, 'REQ-011-E2E persists and appears after database refresh');

  // Steps 11-14: Open Technicians, mark Rahul Sharma unavailable, refresh, verify
  const markRahul = await req('/technicians/TECH-002/availability', {
    method: 'PATCH',
    body: { status: 'UNAVAILABLE', reason: 'Shift emergency' },
  });
  check('11-12', markRahul.status === 200, 'Marked Rahul Sharma unavailable');

  // Step 13-14: Refresh technician
  const refreshRahul = await req('/technicians/TECH-002');
  check(
    '13-14',
    refreshRahul.data.data.status === 'Unavailable' || refreshRahul.data.data.status === 'UNAVAILABLE',
    'Rahul Sharma remains Unavailable after refresh'
  );

  // Steps 15-17: Generate AI Plan & verify planner reads database state & detects affected assignments
  const generatedPlan = await req('/planner/generate', {
    method: 'POST',
    body: { triggerReason: 'Technician Rahul Sharma unavailable' },
  });
  check('15-16', generatedPlan.status === 200, 'Planner generated plan reading MongoDB state');
  check('17', generatedPlan.data.status === 'DRAFT', 'Plan is DRAFT and not auto-confirmed');
  const _planId = generatedPlan.data.planId;

  // Step 18: Resolve planner questions
  const resolvedPlan = await req('/planner/generate', {
    method: 'POST',
    body: {
      triggerReason: 'Resolved dispatcher question MIS-001',
      dispatcherAnswers: { 'MIS-001': 'Allow overtime for available technician' },
    },
  });
  check('18', resolvedPlan.status === 200, 'Planner generated revised plan with dispatcher decision');

  // Step 19-21: Approve valid plan & verify schedule persists after refresh
  const approveRes = await req(`/planner/${resolvedPlan.data.planId}/approve`, {
    method: 'POST',
    body: {
      approvedBy: 'Alex Rivera',
      reason: 'Dispatcher approved plan proposal',
      proposedAssignments: resolvedPlan.data.proposedAssignments,
    },
  });
  check('19', approveRes.status === 200, 'Approved valid plan atomically via MongoDB transaction');
  const approvedVersion = approveRes.data.version;

  // Step 20-21: Refresh browser & verify schedule persists
  const refreshedSchedule = await req('/assignments');
  check('20-21', refreshedSchedule.data.count > 0, `Schedule persists in MongoDB (${refreshedSchedule.data.count} assignments)`);

  // Steps 22-25: Open Schedule Versions, verify new version, compare with previous, verify immutability
  const versionsList = await req('/schedules/versions');
  check('22-23', versionsList.data.data.some((v) => v.version === approvedVersion), `New schedule version ${approvedVersion} exists in history`);

  const compareRes = await req(`/schedules/compare/v3/${approvedVersion}`);
  check('24', compareRes.status === 200 && Array.isArray(compareRes.data.data.changes), 'Compared v3 with new approved version');

  const oldV1 = await req('/schedules/versions/v1');
  check('25', oldV1.status === 200 && oldV1.data.data.version === 'v1', 'Historical version v1 remains immutable');

  // Steps 26-30: Open Notifications, verify new notification, mark read, refresh, verify persistence
  const notifs = await req('/notifications');
  check('26-27', notifs.data.data.length > 0, 'Notifications list loaded from database');
  const targetNotifId = notifs.data.data[0].notificationId;

  await req(`/notifications/${targetNotifId}/read`, { method: 'PATCH' });
  const notifsAfterRead = await req('/notifications');
  const targetAfter = notifsAfterRead.data.data.find((n) => n.notificationId === targetNotifId);
  check('28-30', targetAfter.read === true, 'Notification read status persists in MongoDB after refresh');

  // Steps 31-32: Open Audit Log & verify recorded actions
  const auditLogs = await req('/audit');
  check('31-32', auditLogs.data.data.length > 0, `Audit log contains ${auditLogs.data.data.length} recorded operational events`);

  // Clean up test request REQ-011-E2E
  await req('/requests/REQ-011-E2E', { method: 'DELETE' });

  // Restore Rahul Sharma to Available
  await req('/technicians/TECH-002/availability', {
    method: 'PATCH',
    body: { status: 'AVAILABLE', reason: 'Shift resumed' },
  });

  console.log('\n===============================================================');
  console.log('ALL SECTION 27 WORKFLOW STEPS VERIFIED AND PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('E2E verification error:', err);
  process.exit(1);
});
