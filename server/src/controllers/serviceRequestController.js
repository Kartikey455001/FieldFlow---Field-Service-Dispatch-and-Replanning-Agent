import ServiceRequest from '../models/ServiceRequest.js';
import { logAuditEvent } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';
import { validateStatusTransition, normalizeStatus, REQUEST_STATUSES } from '../utils/statusTransitions.js';

export async function getRequests(req, res, next) {
  try {
    const { search, priority, region, status, skill } = req.query;
    const filter = {};

    if (priority && priority !== 'All') {
      filter.priority = new RegExp(`^${priority}$`, 'i');
    }

    if (region && region !== 'All') {
      filter.region = new RegExp(region, 'i');
    }

    if (status && status !== 'All') {
      const norm = normalizeStatus(status);
      filter.status = new RegExp(`^${norm}$`, 'i');
    }

    if (skill && skill !== 'All') {
      filter.requiredSkill = new RegExp(skill, 'i');
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { requestId: searchRegex },
        { customer: searchRegex },
        { requiredSkill: searchRegex },
        { location: searchRegex },
        { region: searchRegex },
      ];
    }

    const requests = await ServiceRequest.find(filter).sort({ createdAt: 1 });
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
}

export async function getRequestById(req, res, next) {
  try {
    const { requestId } = req.params;
    const request = await ServiceRequest.findOne({
      $or: [{ requestId }, { _id: requestId.match(/^[0-9a-fA-F]{24}$/) ? requestId : null }],
    });

    if (!request) {
      return res.status(404).json({ success: false, message: `Request ${requestId} not found.`, code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

export async function createRequest(req, res, next) {
  try {
    const {
      customer,
      phone,
      region,
      requiredSkill,
      skill,
      priority,
      duration,
      durationHours,
      preferredWindow,
      location,
      notes,
    } = req.body;

    // Validate required fields
    if (!customer || !region || (!requiredSkill && !skill) || !priority || !preferredWindow) {
      return res.status(400).json({
        success: false,
        message: 'Missing required request fields: customer, region, skill, priority, and preferredWindow are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const count = await ServiceRequest.countDocuments();
    const nextId = `REQ-0${count + 1}`;

    const newRequest = new ServiceRequest({
      requestId: req.body.requestId || nextId,
      customer: customer.trim(),
      phone: phone || '+91 98290 12345',
      region: region.trim(),
      requiredSkill: (requiredSkill || skill).trim(),
      priority,
      duration: duration || '2 hours',
      durationHours: durationHours || 2,
      preferredWindow,
      location: location || `${region}, Jaipur`,
      address: location || `${region}, Jaipur`,
      notes: notes || 'Standard request logged via dispatch console.',
      status: 'UNASSIGNED',
    });

    await newRequest.save();

    await logAuditEvent({
      action: 'REQUEST_CREATED',
      entityType: 'request',
      entityId: newRequest.requestId,
      entity: `New service request ${newRequest.requestId} created for ${newRequest.customer} (${newRequest.region})`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      newState: 'UNASSIGNED',
      reason: `Logged new service request for ${newRequest.customer} (${newRequest.requiredSkill})`,
      requestId: newRequest.requestId,
    });

    await createNotification({
      title: 'Service Request Created',
      description: `Work order ${newRequest.requestId} (${newRequest.customer}) added to the queue.`,
      category: 'assignments',
      type: 'Assignments',
      severity: 'info',
      relatedEntity: newRequest.requestId,
    });

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    next(error);
  }
}

export async function createEmergencyRequest(req, res, next) {
  try {
    const {
      customer = 'Emergency Incident Call',
      phone = '+91 99000 11223',
      location,
      region = 'Jaipur Central',
      requiredSkill = 'Electrical Repair',
      duration = '2 hours',
      preferredWindow = '15:00 - 17:00',
      notes = 'Emergency ticket logged for immediate dispatch triage.',
    } = req.body;

    const count = await ServiceRequest.countDocuments();
    const nextId = `REQ-0${count + 1}`;

    const emergencyReq = new ServiceRequest({
      requestId: req.body.requestId || nextId,
      customer,
      phone,
      location: location || `${region}, MI Road`,
      address: location || `${region}, MI Road`,
      region,
      requiredSkill,
      priority: 'Critical', // Mandatory Critical priority
      duration,
      durationHours: 2,
      preferredWindow,
      status: 'UNASSIGNED',
      needsReplanning: true,
      issueFlag: 'Critical emergency request awaiting dispatcher replan',
      notes,
    });

    await emergencyReq.save();

    await logAuditEvent({
      action: 'EMERGENCY_CREATED',
      entityType: 'request',
      entityId: emergencyReq.requestId,
      entity: `Critical emergency request ${emergencyReq.requestId} logged for ${emergencyReq.region}`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      newState: 'Critical',
      reason: `Emergency triage: ${emergencyReq.requiredSkill} in ${emergencyReq.region}`,
      requestId: emergencyReq.requestId,
    });

    await createNotification({
      title: 'Emergency Request Created',
      description: `Emergency ${emergencyReq.requestId} (${emergencyReq.requiredSkill}, ${emergencyReq.region}) added. Replan required.`,
      category: 'emergency',
      type: 'Emergency',
      severity: 'danger',
      relatedEntity: emergencyReq.requestId,
    });

    res.status(201).json({
      success: true,
      data: emergencyReq,
      replanRequired: true,
      message: `Emergency request ${emergencyReq.requestId} created successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const request = await ServiceRequest.findOne({ requestId });

    if (!request) {
      return res.status(404).json({ success: false, message: `Request ${requestId} not found.`, code: 'NOT_FOUND' });
    }

    if (request.isProtectedCompleted || request.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Cannot modify completed request ${requestId}: Protected from modifications.`,
        code: 'REQUEST_ALREADY_COMPLETED',
      });
    }

    Object.assign(request, req.body);
    await request.save();

    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

export async function updateRequestStatus(req, res, next) {
  try {
    const { requestId } = req.params;
    const { newStatus, status, reason = '' } = req.body;
    const targetStatus = newStatus || status;

    if (!targetStatus) {
      return res.status(400).json({ success: false, message: 'newStatus is required.', code: 'VALIDATION_ERROR' });
    }

    const request = await ServiceRequest.findOne({ requestId });
    if (!request) {
      return res.status(404).json({ success: false, message: `Request ${requestId} not found.`, code: 'NOT_FOUND' });
    }

    const currentNorm = normalizeStatus(request.status);
    const targetNorm = normalizeStatus(targetStatus);

    const transitionCheck = validateStatusTransition(currentNorm, targetNorm);
    if (!transitionCheck.valid) {
      return res.status(400).json({
        success: false,
        message: transitionCheck.error,
        code: 'INVALID_STATUS_TRANSITION',
      });
    }

    const prevStatus = request.status;
    request.status = targetNorm;
    if (targetNorm === REQUEST_STATUSES.COMPLETED) {
      request.isProtectedCompleted = true;
    }
    if (targetNorm === REQUEST_STATUSES.UNASSIGNED) {
      request.assignedTechId = null;
      request.assignedTechnician = null;
      request.assignedTechName = null;
      request.startTime = null;
      request.endTime = null;
      request.needsReplanning = true;
    }

    await request.save();

    const specificAction =
      targetNorm === REQUEST_STATUSES.COMPLETED
        ? 'REQUEST_COMPLETED'
        : targetNorm === REQUEST_STATUSES.CANCELLED
        ? 'REQUEST_CANCELLED'
        : targetNorm === REQUEST_STATUSES.ASSIGNED
        ? 'REQUEST_ASSIGNED'
        : 'Request status changed';

    await logAuditEvent({
      action: specificAction,
      entityType: 'request',
      entityId: request.requestId,
      entity: `${request.requestId} transitioned from ${prevStatus} to ${targetNorm}${reason ? ` (${reason})` : ''}`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      previousState: prevStatus,
      newState: targetNorm,
      reason: reason || `Status transition from ${prevStatus} to ${targetNorm}`,
      requestId: request.requestId,
    });

    let notifTitle = 'Request Status Updated';
    let severity = 'info';
    if (targetNorm === REQUEST_STATUSES.COMPLETED) {
      notifTitle = 'Job Completed';
      severity = 'success';
    } else if (targetNorm === REQUEST_STATUSES.CANCELLED) {
      notifTitle = 'Request Cancelled';
      severity = 'warning';
    }

    await createNotification({
      title: notifTitle,
      description: `${request.requestId} (${request.customer}) is now ${targetNorm}.`,
      category: 'assignments',
      type: 'Assignments',
      severity,
      relatedEntity: request.requestId,
    });

    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

export async function deleteRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const request = await ServiceRequest.findOne({ requestId });

    if (!request) {
      return res.status(404).json({ success: false, message: `Request ${requestId} not found.`, code: 'NOT_FOUND' });
    }

    if (request.isProtectedCompleted || request.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete protected completed request.',
        code: 'PROTECTED_RESOURCE',
      });
    }

    await ServiceRequest.deleteOne({ requestId });
    res.json({ success: true, message: `Request ${requestId} deleted successfully.` });
  } catch (error) {
    next(error);
  }
}
