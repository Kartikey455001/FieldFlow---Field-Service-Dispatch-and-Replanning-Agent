import Technician from '../models/Technician.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Assignment from '../models/Assignment.js';
import { logAuditEvent } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';

export async function getTechnicians(req, res, next) {
  try {
    const { region, status, search } = req.query;
    const filter = {};

    if (region && region !== 'All') {
      filter.region = new RegExp(region, 'i');
    }

    if (status && status !== 'All') {
      filter.status = new RegExp(`^${status}$`, 'i');
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { role: searchRegex },
        { skills: searchRegex },
        { region: searchRegex },
      ];
    }

    const technicians = await Technician.find(filter).sort({ name: 1 });
    res.json({ success: true, count: technicians.length, data: technicians });
  } catch (error) {
    next(error);
  }
}

export async function getTechnicianById(req, res, next) {
  try {
    const { technicianId } = req.params;
    const technician = await Technician.findOne({
      $or: [{ technicianId }, { name: technicianId }],
    });

    if (!technician) {
      return res.status(404).json({ success: false, message: `Technician ${technicianId} not found.`, code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: technician });
  } catch (error) {
    next(error);
  }
}

export async function createTechnician(req, res, next) {
  try {
    const { name, role, region, skills, workingHours, avatar } = req.body;

    if (!name || !role || !region) {
      return res.status(400).json({
        success: false,
        message: 'Name, role, and region are required fields.',
        code: 'VALIDATION_ERROR',
      });
    }

    const count = await Technician.countDocuments();
    const technicianId = req.body.technicianId || `TECH-00${count + 1}`;

    const newTech = new Technician({
      technicianId,
      name: name.trim(),
      role: role.trim(),
      region: region.trim(),
      skills: Array.isArray(skills) ? skills : [skills || 'General Maintenance'],
      workingHours: workingHours || { start: '09:00', end: '17:00' },
      avatar: avatar || name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
      status: 'Available',
      availability: '09:00 - 17:00',
    });

    await newTech.save();

    await logAuditEvent({
      action: 'TECHNICIAN_CREATED',
      entityType: 'technician',
      entityId: newTech.technicianId,
      entity: `Technician ${newTech.name} added to roster (${newTech.region})`,
      performedBy: 'Dispatcher',
      actorType: 'user',
      actor: 'Dispatcher',
      source: 'Dispatcher',
      newState: 'Available',
      reason: `Staff onboarding: ${newTech.name} (${newTech.role})`,
    });

    res.status(201).json({ success: true, data: newTech });
  } catch (error) {
    next(error);
  }
}

export async function updateTechnician(req, res, next) {
  try {
    const { technicianId } = req.params;
    const technician = await Technician.findOne({
      $or: [{ technicianId }, { name: technicianId }],
    });

    if (!technician) {
      return res.status(404).json({ success: false, message: `Technician ${technicianId} not found.`, code: 'NOT_FOUND' });
    }

    Object.assign(technician, req.body);
    await technician.save();

    res.json({ success: true, data: technician });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/technicians/:technicianId/availability
 * Mark technician unavailable or update availability status
 */
export async function updateAvailability(req, res, next) {
  try {
    const { technicianId } = req.params;
    const { status = 'Unavailable', availability = 'Cancelled Shift', reason = 'Shift cancelled' } = req.body;

    const technician = await Technician.findOne({
      $or: [{ technicianId }, { name: technicianId }],
    });

    if (!technician) {
      return res.status(404).json({ success: false, message: `Technician ${technicianId} not found.`, code: 'NOT_FOUND' });
    }

    const previousStatus = technician.status;
    technician.status = status;
    technician.availability = availability;
    await technician.save();

    let affectedIds = [];

    // If becoming unavailable, identify and unassign affected pending jobs (protect completed REQ-010)
    if (status === 'Unavailable' || status === 'UNAVAILABLE' || status === 'On Leave' || status === 'ON_LEAVE') {
      const affectedRequests = await ServiceRequest.find({
        $or: [{ assignedTechId: technician.technicianId }, { assignedTechnician: technician.name }, { assignedTechName: technician.name }],
        status: { $nin: ['COMPLETED', 'Completed'] },
        isProtectedCompleted: { $ne: true },
      });

      affectedIds = affectedRequests.map((r) => r.requestId);

      if (affectedIds.length > 0) {
        await ServiceRequest.updateMany(
          { requestId: { $in: affectedIds } },
          {
            $set: {
              status: 'UNASSIGNED',
              needsReplanning: true,
              assignedTechId: null,
              assignedTechnician: null,
              assignedTechName: null,
              issueFlag: `Technician ${technician.name} reported ${status.toLowerCase()}`,
            },
          }
        );

        await Assignment.updateMany(
          { requestId: { $in: affectedIds } },
          {
            $set: {
              status: 'Cancelled',
              reason: `Technician ${technician.name} became unavailable`,
            },
          }
        );
      }
    }

    // Create Audit Log
    await logAuditEvent({
      action: 'TECHNICIAN_UNAVAILABLE',
      entityType: 'technician',
      entityId: technician.technicianId,
      entity: `${technician.name} reported ${status}. Affected requests: ${affectedIds.join(', ') || 'None'}`,
      performedBy: technician.name,
      actorType: 'technician',
      actor: technician.name,
      source: 'Technician',
      previousState: previousStatus,
      newState: status,
      reason: `${technician.name} reported ${status}. ${reason}`,
    });

    // Create Notification
    await createNotification({
      title: 'Technician Unavailability',
      description: `${technician.name} is now ${status}. ${affectedIds.length > 0 ? `${affectedIds.join(', ')} require(s) reassignment.` : 'No active shifts affected.'}`,
      category: 'emergency',
      type: 'Emergency',
      severity: 'danger',
      relatedEntity: technician.technicianId,
    });

    res.json({
      success: true,
      data: {
        technician,
        status: technician.status,
        affectedAssignments: affectedIds,
        affectedRequestIds: affectedIds,
      },
      technician,
      status: technician.status,
      affectedAssignments: affectedIds,
      affectedRequests: affectedIds,
      affectedRequestIds: affectedIds,
      replanRequired: affectedIds.length > 0,
      message: `${technician.name} status updated to ${status}.`,
    });
  } catch (error) {
    next(error);
  }
}
