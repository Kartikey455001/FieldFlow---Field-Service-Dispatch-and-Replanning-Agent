import ScheduleVersion from '../models/ScheduleVersion.js';
import ServiceRequest from '../models/ServiceRequest.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

/**
 * Compare two schedule versions and generate categorized diff
 */
export function compareVersions(fromVer, toVer) {
  const fromAssignments = fromVer.assignmentsSnapshot || fromVer.assignments || [];
  const toAssignments = toVer.assignmentsSnapshot || toVer.assignments || [];

  const fromMap = new Map();
  fromAssignments.forEach((a) => fromMap.set(a.requestId || a.id, a));

  const toMap = new Map();
  toAssignments.forEach((a) => toMap.set(a.requestId || a.id, a));

  const allReqIds = Array.from(new Set([...fromMap.keys(), ...toMap.keys()]));
  const changes = [];

  const counts = {
    added: 0,
    removed: 0,
    changed: 0,
    flagged: 0,
    unchanged: 0,
    ADDED: 0,
    REMOVED: 0,
    CHANGED: 0,
    FLAGGED: 0,
    UNCHANGED: 0,
  };

  allReqIds.forEach((reqId) => {
    const fromA = fromMap.get(reqId);
    const toA = toMap.get(reqId);

    const serviceType = toA?.skill || fromA?.skill || 'General Service';
    const customer = toA?.customer || fromA?.customer || 'Customer';

    const fromTech = fromA?.technician || fromA?.assignedTechName || 'Unassigned';
    const toTech = toA?.technician || toA?.assignedTechName || 'Unassigned';

    const fromTime = fromA?.timeSlot || (fromA?.startTime ? `${fromA.startTime} – ${fromA.endTime}` : 'None');
    const toTime = toA?.timeSlot || (toA?.startTime ? `${toA.startTime} – ${toA.endTime}` : 'None');

    const fromStatus = fromA?.status || 'UNASSIGNED';
    const toStatus = toA?.status || 'UNASSIGNED';

    if (!fromA && toA) {
      counts.added++;
      counts.ADDED++;
      changes.push({
        requestId: reqId,
        serviceType,
        customer,
        changeType: 'Added',
        description: `New assignment added in ${toVer.version || 'new version'}`,
        from: { technician: 'None', timeWindow: 'None', status: 'None' },
        to: { technician: toTech, timeWindow: toTime, status: toStatus },
        reason: toA.reason || 'Added during optimization replanning run.',
      });
    } else if (fromA && !toA) {
      counts.removed++;
      counts.REMOVED++;
      changes.push({
        requestId: reqId,
        serviceType,
        customer,
        changeType: 'Removed',
        description: `Assignment removed in ${toVer.version || 'new version'}`,
        from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
        to: { technician: 'None', timeWindow: 'None', status: 'None' },
        reason: 'Removed from active scheduled roster.',
      });
    } else {
      const isTechDiff = fromTech !== toTech;
      const isTimeDiff = fromTime !== toTime;
      const isStatusDiff = fromStatus !== toStatus;
      const isFlagged = Boolean(toA.issueFlag || toA.needsReplanning);

      if (isFlagged && (fromTech === 'Unassigned' || toTech === 'Unassigned')) {
        counts.flagged++;
        counts.FLAGGED++;
        changes.push({
          requestId: reqId,
          serviceType,
          customer,
          changeType: 'Flagged',
          description: `Constraint risk flagged: ${toA.issueFlag || 'Unassigned coverage risk'}`,
          from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
          to: { technician: toTech, timeWindow: toTime, status: toStatus },
          reason: toA.issueFlag || toA.reason || 'Held in unassigned pool due to resource constraint.',
        });
      } else if (isTechDiff || isTimeDiff || isStatusDiff) {
        counts.changed++;
        counts.CHANGED++;
        let desc = 'Assignment updated';
        if (isTechDiff && isTimeDiff) desc = 'Technician changed & time shifted';
        else if (isTechDiff) desc = 'Technician reassigned';
        else if (isTimeDiff) desc = 'Time window shifted';

        changes.push({
          requestId: reqId,
          serviceType,
          customer,
          changeType: 'Changed',
          description: desc,
          from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
          to: { technician: toTech, timeWindow: toTime, status: toStatus },
          reason: toA.reason || `Schedule adjustment from ${fromVer.version} to ${toVer.version}.`,
        });
      } else {
        counts.unchanged++;
        counts.UNCHANGED++;
        changes.push({
          requestId: reqId,
          serviceType,
          customer,
          changeType: 'Unchanged',
          description: 'No modifications to this assignment',
          from: { technician: fromTech, timeWindow: fromTime, status: fromStatus },
          to: { technician: toTech, timeWindow: toTime, status: toStatus },
          reason: 'Stable schedule assignment retained.',
        });
      }
    }
  });

  return {
    fromVersion: fromVer.version,
    toVersion: toVer.version,
    counts,
    changes,
    allRows: changes,
  };
}

/**
 * Rollback to an immutable schedule version by copying its snapshot into a NEW draft version
 */
export async function rollbackToVersion(targetVersionId, performedBy = 'Dispatcher') {
  const targetVer = await ScheduleVersion.findOne({
    $or: [{ versionId: targetVersionId }, { version: targetVersionId }],
  });

  if (!targetVer) {
    throw new Error(`Schedule version ${targetVersionId} not found.`);
  }

  const allVersions = await ScheduleVersion.find({}).sort({ versionNumber: -1 });
  const maxVersionNum = allVersions.length > 0 ? Math.max(...allVersions.map((v) => v.versionNumber || 0)) : 3;
  const newVerNumber = maxVersionNum + 1;
  const newVersionLabel = `v${newVerNumber}`;

  // Copy snapshot into new immutable draft version
  const newVersion = new ScheduleVersion({
    versionId: `VER-${Date.now()}`,
    version: newVersionLabel,
    versionNumber: newVerNumber,
    status: 'Draft',
    createdBy: `${performedBy} (Rollback from ${targetVer.version})`,
    createdAtString: 'Today, Just now',
    reason: `Schedule rollback: Restored assignments snapshot from ${targetVer.version}`,
    trigger: `Rollback from ${targetVer.version}`,
    isCurrent: true,
    totalAssignments: targetVer.totalAssignments,
    unassignedCount: targetVer.unassignedCount,
    assignmentsSnapshot: targetVer.assignmentsSnapshot,
    assignments: targetVer.assignments,
  });

  await ScheduleVersion.updateMany({}, { isCurrent: false });
  await newVersion.save();

  // Restore snapshot to ServiceRequest collection
  const snapshotMap = new Map();
  (targetVer.assignmentsSnapshot || []).forEach((a) => snapshotMap.set(a.requestId || a.id, a));

  for (const [reqId, snap] of snapshotMap.entries()) {
    const isCompleted = snap.status === 'Completed' || snap.status === 'COMPLETED' || snap.isProtectedCompleted;
    const isUnassigned = !snap.technician || snap.technician === 'Unassigned' || snap.status === 'UNASSIGNED';

    await ServiceRequest.findOneAndUpdate(
      { requestId: reqId },
      {
        assignedTechName: isUnassigned ? null : snap.technician,
        assignedTechnician: isUnassigned ? null : snap.technician,
        startTime: snap.startTime || null,
        endTime: snap.endTime || null,
        status: isCompleted ? 'COMPLETED' : isUnassigned ? 'UNASSIGNED' : 'ASSIGNED',
        isProtectedCompleted: isCompleted,
        needsReplanning: isUnassigned,
      }
    );
  }

  // Create audit log
  await AuditLog.create({
    action: 'VERSION_ROLLBACK',
    entityType: 'schedule',
    entityId: newVersionLabel,
    entity: `Schedule rolled back from ${targetVer.version} into new draft version ${newVersionLabel}`,
    performedBy,
    actor: performedBy,
    actorType: 'user',
    source: 'Dispatcher',
    previousState: targetVer.version,
    newState: newVersionLabel,
    reason: `Dispatcher reverted schedule to ${targetVer.version} snapshot`,
    affectedPlanVersion: newVersionLabel,
  });

  // Create notification
  await Notification.create({
    notificationId: `NOTIF-${Date.now()}`,
    title: 'Schedule Rollback',
    description: `Active schedule reverted to snapshot ${targetVer.version}; new draft version ${newVersionLabel} created.`,
    category: 'schedule',
    type: 'Schedule Updates',
    severity: 'warning',
    unread: true,
  });

  return newVersion;
}
