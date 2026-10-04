// FieldFlow Schedule Version Diff & Comparator Engine
// Computes deterministic differences between any two schedule version snapshots:
// ADDED, REMOVED, CHANGED, UNCHANGED, FLAGGED

/**
 * Compares two schedule versions based on their assignments snapshot.
 * 
 * @param {Object} fromVersion
 * @param {Object} toVersion
 * @returns {Object} comparisonResult
 */
export function compareScheduleVersions(fromVersion, toVersion) {
  if (!fromVersion || !toVersion) {
    return {
      fromVersion: fromVersion?.version || 'Unknown',
      toVersion: toVersion?.version || 'Unknown',
      changes: [],
      counts: { added: 0, removed: 0, changed: 0, unchanged: 0, flagged: 0 },
    };
  }

  const fromAssignments = fromVersion.assignmentsSnapshot || [];
  const toAssignments = toVersion.assignmentsSnapshot || [];

  const fromMap = new Map();
  fromAssignments.forEach((a) => fromMap.set(a.requestId || a.id, a));

  const toMap = new Map();
  toAssignments.forEach((a) => toMap.set(a.requestId || a.id, a));

  const allRequestIds = new Set([...fromMap.keys(), ...toMap.keys()]);
  const changes = [];

  let addedCount = 0;
  let removedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  let flaggedCount = 0;

  for (const reqId of allRequestIds) {
    const fromA = fromMap.get(reqId);
    const toA = toMap.get(reqId);

    const fromAssigned = fromA && fromA.status !== 'Unassigned' && (fromA.technician || fromA.assignedTechName);
    const toAssigned = toA && toA.status !== 'Unassigned' && (toA.technician || toA.assignedTechName);

    const serviceType = toA?.skill || fromA?.skill || toA?.requiredSkill || fromA?.requiredSkill || 'General Service';
    const customer = toA?.customer || fromA?.customer || 'Customer';

    const fromTech = fromAssigned ? (fromA.technician || fromA.assignedTechName) : 'Unassigned';
    const toTech = toAssigned ? (toA.technician || toA.assignedTechName) : 'Unassigned';

    const fromTime = fromAssigned ? (fromA.timeSlot || `${fromA.startTime} – ${fromA.endTime}`) : 'None';
    const toTime = toAssigned ? (toA.timeSlot || `${toA.startTime} – ${toA.endTime}`) : 'None';

    const fromStatus = fromA?.status || (fromAssigned ? 'ASSIGNED' : 'UNASSIGNED');
    const toStatus = toA?.status || (toAssigned ? 'ASSIGNED' : 'UNASSIGNED');

    // 1. Check if Flagged / Issue alert
    if (toA?.issueFlag || (!toAssigned && toA?.priority === 'Critical')) {
      flaggedCount++;
      changes.push({
        requestId: reqId,
        customer,
        serviceType,
        changeType: 'Flagged',
        description: toA?.issueFlag || 'Coverage or SLA constraint alert',
        from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
        to: { technician: toTech, timeWindow: toTime, status: toStatus },
        reason: toA?.issueFlag || toA?.reason || 'Requires dispatcher manual triage.',
      });
      continue;
    }

    // 2. Newly Added assignment
    if (!fromAssigned && toAssigned) {
      addedCount++;
      changes.push({
        requestId: reqId,
        customer,
        serviceType,
        changeType: 'Added',
        description: 'New assignment proposed in this revision',
        from: { technician: 'Unassigned', timeWindow: 'None', status: 'UNASSIGNED' },
        to: { technician: toTech, timeWindow: toTime, status: toStatus },
        reason: toA.reason || 'Accommodated in schedule optimization.',
      });
      continue;
    }

    // 3. Removed assignment (unassigned from previous)
    if (fromAssigned && !toAssigned) {
      removedCount++;
      changes.push({
        requestId: reqId,
        customer,
        serviceType,
        changeType: 'Removed',
        description: 'Deallocated / moved to unassigned pool',
        from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
        to: { technician: 'Unassigned', timeWindow: 'None', status: 'UNASSIGNED' },
        reason: toA?.reason || 'Technician unavailable or slot conflict.',
      });
      continue;
    }

    // 4. Changed assignment (different tech or time window or status)
    if (fromAssigned && toAssigned) {
      const isTechDifferent = fromTech !== toTech;
      const isTimeDifferent = fromTime !== toTime;
      const isStatusDifferent = fromStatus !== toStatus;

      if (isTechDifferent || isTimeDifferent || isStatusDifferent) {
        changedCount++;
        let reason = toA.reason;
        if (!reason) {
          if (isTechDifferent && isTimeDifferent) {
            reason = `Reallocated from ${fromTech} to ${toTech} (${toTime}) due to schedule replanning.`;
          } else if (isTechDifferent) {
            reason = `Technician changed from ${fromTech} to ${toTech} due to technician availability change.`;
          } else if (isTimeDifferent) {
            reason = `Time window shifted from ${fromTime} to ${toTime} to eliminate overlap.`;
          } else {
            reason = `Status transitioned from ${fromStatus} to ${toStatus}.`;
          }
        }

        changes.push({
          requestId: reqId,
          customer,
          serviceType,
          changeType: 'Changed',
          description: isTechDifferent ? 'Technician reassigned' : isTimeDifferent ? 'Time slot shifted' : 'Status updated',
          from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
          to: { technician: toTech, timeWindow: toTime, status: toStatus },
          reason,
        });
        continue;
      }

      // 5. Unchanged assignment
      unchangedCount++;
      changes.push({
        requestId: reqId,
        customer,
        serviceType,
        changeType: 'Unchanged',
        description: toA.isProtectedCompleted ? 'Protected completed assignment' : 'Assignment retained without modification',
        from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
        to: { technician: toTech, timeWindow: toTime, status: toStatus },
        reason: toA.isProtectedCompleted
          ? 'Completed job — strictly protected from replanning.'
          : 'Preserved in current schedule slot.',
      });
    }
  }

  // Sort changes: Flagged > Changed > Added > Removed > Unchanged
  const PRIORITY_ORDER = { Flagged: 0, Changed: 1, Added: 2, Removed: 3, Unchanged: 4 };
  changes.sort((a, b) => (PRIORITY_ORDER[a.changeType] ?? 5) - (PRIORITY_ORDER[b.changeType] ?? 5));

  return {
    fromVersion: fromVersion.version,
    toVersion: toVersion.version,
    changes,
    allRows: changes,
    counts: {
      added: addedCount,
      removed: removedCount,
      changed: changedCount,
      unchanged: unchangedCount,
      flagged: flaggedCount,
      ADDED: addedCount,
      REMOVED: removedCount,
      CHANGED: changedCount,
      UNCHANGED: unchangedCount,
      FLAGGED: flaggedCount,
    },
  };
}
