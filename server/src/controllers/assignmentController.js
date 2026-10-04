import Assignment from '../models/Assignment.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Technician from '../models/Technician.js';
import ScheduleVersion from '../models/ScheduleVersion.js';
import { validateAssignment } from '../services/validationService.js';
import { logAuditEvent } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';

export async function getAssignments(req, res, next) {
  try {
    const { technicianId, date } = req.query;
    const filter = {};
    if (technicianId) filter.technicianId = technicianId;
    if (date) filter.date = date;

    const assignments = await Assignment.find(filter).sort({ startTime: 1 });
    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    next(error);
  }
}

export async function createAssignment(req, res, next) {
  try {
    const { requestId, technicianId, startTime, endTime, timeSlot, date = '2026-10-05', options = {} } = req.body;

    const targetRequest = await ServiceRequest.findOne({ requestId });
    const targetTechnician = await Technician.findOne({
      $or: [{ technicianId }, { name: technicianId }],
    });

    if (!targetRequest) {
      return res.status(404).json({
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: `Request ${requestId} not found.` },
      });
    }

    if (!targetTechnician) {
      return res.status(404).json({
        success: false,
        error: { code: 'TECHNICIAN_NOT_FOUND', message: `Technician ${technicianId} not found.` },
      });
    }

    const effectiveTimeSlot = timeSlot || `${startTime} - ${endTime}`;
    const existingAssignments = await Assignment.find({ date, status: { $ne: 'Cancelled' } }).lean();

    // Call Phase 3 deterministic validation engine
    const validation = validateAssignment(
      targetRequest.toObject ? targetRequest.toObject() : targetRequest,
      targetTechnician.toObject ? targetTechnician.toObject() : targetTechnician,
      effectiveTimeSlot,
      existingAssignments,
      options
    );

    if (!validation.isValid) {
      // Record rejected assignment in audit log
      await logAuditEvent({
        action: 'Constraint violation rejected',
        entityType: 'assignment',
        entityId: targetRequest.requestId,
        entity: `Rejected assignment of ${targetRequest.requestId} to ${targetTechnician.name}: ${validation.blockingReason}`,
        performedBy: 'Constraint Engine',
        actorType: 'system',
        actor: 'Constraint Engine',
        requestId: targetRequest.requestId,
        reason: validation.blockingReason,
      });

      return res.status(400).json({
        success: false,
        error: {
          code: validation.violations[0]?.code || 'ASSIGNMENT_CONFLICT',
          message: validation.blockingReason || 'Assignment violates scheduling constraints.',
          details: validation.violations,
        },
      });
    }

    // Save valid assignment
    const assignmentId = req.body.assignmentId || `ASG-${targetRequest.requestId}`;

    const newAssignment = await Assignment.findOneAndUpdate(
      { assignmentId },
      {
        assignmentId,
        requestId: targetRequest.requestId,
        technicianId: targetTechnician.technicianId,
        technicianName: targetTechnician.name,
        customer: targetRequest.customer,
        skill: targetRequest.requiredSkill,
        region: targetRequest.region,
        date,
        startTime: startTime || effectiveTimeSlot.split(/[-–]/)[0].trim(),
        endTime: endTime || effectiveTimeSlot.split(/[-–]/)[1].trim(),
        timeSlot: `${startTime} – ${endTime}`,
        status: 'Scheduled',
        protected: targetRequest.isProtectedCompleted || false,
        reason: 'Manual dispatcher assignment approved.',
      },
      { upsert: true, new: true }
    );

    // Update Request status
    targetRequest.status = 'ASSIGNED';
    targetRequest.assignedTechId = targetTechnician.technicianId;
    targetRequest.assignedTechnician = targetTechnician.name;
    targetRequest.assignedTechName = targetTechnician.name;
    targetRequest.startTime = newAssignment.startTime;
    targetRequest.endTime = newAssignment.endTime;
    targetRequest.needsReplanning = false;
    targetRequest.issueFlag = null;
    await targetRequest.save();

    // Create a new Schedule Version snapshot (Requirement 15)
    const allVersions = await ScheduleVersion.find({}).sort({ versionNumber: -1 });
    const maxNum = allVersions.length > 0 ? Math.max(...allVersions.map((v) => v.versionNumber || 0)) : 3;
    const newVersionLabel = `v${maxNum + 1}`;

    const allRequests = await ServiceRequest.find({}).lean();
    const assignmentsSnapshot = allRequests.map((r) => ({
      id: r.requestId,
      requestId: r.requestId,
      customer: r.customer,
      skill: r.requiredSkill,
      technician: r.assignedTechName || 'Unassigned',
      startTime: r.startTime,
      endTime: r.endTime,
      timeSlot: r.startTime ? `${r.startTime} – ${r.endTime}` : 'None',
      status: r.status,
      isProtectedCompleted: r.isProtectedCompleted || false,
      region: r.region,
      reason: r.issueFlag || r.notes,
    }));

    await ScheduleVersion.updateMany({}, { isCurrent: false });
    const newVersion = new ScheduleVersion({
      versionId: `VER-${Date.now()}`,
      version: newVersionLabel,
      versionNumber: maxNum + 1,
      status: 'Confirmed',
      createdBy: 'Dispatcher',
      createdAtString: 'Today, Just now',
      reason: `Manual Assignment: ${targetRequest.requestId} to ${targetTechnician.name}`,
      trigger: `Manual Assignment: ${targetRequest.requestId}`,
      isCurrent: true,
      totalAssignments: allRequests.filter((r) => r.status === 'ASSIGNED' || r.status === 'COMPLETED').length,
      unassignedCount: allRequests.filter((r) => r.status === 'UNASSIGNED').length,
      assignmentsSnapshot,
    });
    await newVersion.save();

    // Audit Log & Notification
    await logAuditEvent({
      action: 'MANUAL_OVERRIDE',
      entityType: 'assignment',
      entityId: newAssignment.assignmentId,
      entity: `Assigned ${targetRequest.requestId} to ${targetTechnician.name} (${newAssignment.startTime}–${newAssignment.endTime})`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      requestId: targetRequest.requestId,
      newState: targetTechnician.name,
      reason: `Manual dispatcher assignment. Schedule ${newVersionLabel} recorded.`,
      affectedPlanVersion: newVersionLabel,
    });

    await createNotification({
      title: 'Assignment Confirmed',
      description: `${targetRequest.requestId} assigned to ${targetTechnician.name} (${newAssignment.startTime}–${newAssignment.endTime}). Schedule ${newVersionLabel} recorded.`,
      category: 'assignments',
      type: 'Assignments',
      severity: 'success',
      relatedEntity: newAssignment.assignmentId,
    });

    res.status(201).json({
      success: true,
      data: newAssignment,
      scheduleVersion: newVersionLabel,
      message: `Assignment created and validated successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAssignment(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const { technicianId, startTime, endTime, timeSlot, options = {} } = req.body;

    const assignment = await Assignment.findOne({ assignmentId });
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Assignment ${assignmentId} not found.` },
      });
    }

    if (assignment.protected || assignment.status === 'Completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REQUEST_ALREADY_COMPLETED',
          message: `Cannot modify completed assignment ${assignmentId}: Protected from modification.`,
        },
      });
    }

    const targetRequest = await ServiceRequest.findOne({ requestId: assignment.requestId });
    const targetTechnician = await Technician.findOne({
      $or: [{ technicianId: technicianId || assignment.technicianId }, { name: technicianId || assignment.technicianName }],
    });

    const effectiveTimeSlot = timeSlot || `${startTime || assignment.startTime} - ${endTime || assignment.endTime}`;
    const existingAssignments = await Assignment.find({
      assignmentId: { $ne: assignmentId },
      status: { $ne: 'Cancelled' },
    }).lean();

    const validation = validateAssignment(
      targetRequest.toObject ? targetRequest.toObject() : targetRequest,
      targetTechnician.toObject ? targetTechnician.toObject() : targetTechnician,
      effectiveTimeSlot,
      existingAssignments,
      options
    );

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: validation.violations[0]?.code || 'ASSIGNMENT_CONFLICT',
          message: validation.blockingReason,
          details: validation.violations,
        },
      });
    }

    const prevTech = assignment.technicianName;
    assignment.technicianId = targetTechnician.technicianId;
    assignment.technicianName = targetTechnician.name;
    assignment.startTime = startTime || assignment.startTime;
    assignment.endTime = endTime || assignment.endTime;
    assignment.timeSlot = `${assignment.startTime} – ${assignment.endTime}`;
    await assignment.save();

    if (targetRequest) {
      targetRequest.assignedTechId = targetTechnician.technicianId;
      targetRequest.assignedTechnician = targetTechnician.name;
      targetRequest.assignedTechName = targetTechnician.name;
      targetRequest.startTime = assignment.startTime;
      targetRequest.endTime = assignment.endTime;
      await targetRequest.save();
    }

    await logAuditEvent({
      action: 'REQUEST_REASSIGNED',
      entityType: 'assignment',
      entityId: assignment.assignmentId,
      entity: `${assignment.requestId} reassigned from ${prevTech} to ${targetTechnician.name}`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      requestId: assignment.requestId,
      previousState: prevTech,
      newState: targetTechnician.name,
      reason: `Dispatcher modified assignment: ${assignment.startTime}–${assignment.endTime}`,
    });

    res.json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
}

export async function deleteAssignment(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findOne({
      $or: [{ assignmentId }, { requestId: assignmentId }],
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Assignment ${assignmentId} not found.` },
      });
    }

    if (assignment.protected || assignment.status === 'Completed') {
      return res.status(400).json({
        success: false,
        error: { code: 'PROTECTED_RESOURCE', message: 'Cannot unassign a completed protected job.' },
      });
    }

    await Assignment.deleteOne({ assignmentId: assignment.assignmentId });

    // Update request to unassigned
    await ServiceRequest.findOneAndUpdate(
      { requestId: assignment.requestId },
      {
        status: 'UNASSIGNED',
        assignedTechId: null,
        assignedTechnician: null,
        assignedTechName: null,
        startTime: null,
        endTime: null,
        needsReplanning: true,
      }
    );

    await logAuditEvent({
      action: 'REQUEST_UNASSIGNED',
      entityType: 'assignment',
      entityId: assignment.assignmentId,
      entity: `${assignment.requestId} unassigned from ${assignment.technicianName} and moved to backlog.`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      requestId: assignment.requestId,
    });

    res.json({ success: true, message: `Assignment ${assignmentId} removed and request returned to queue.` });
  } catch (error) {
    next(error);
  }
}
