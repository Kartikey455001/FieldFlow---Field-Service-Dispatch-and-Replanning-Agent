/**
 * Plan Validator Service for FieldFlow AI Dispatch Planner
 * Validates every proposed assignment in an AI-generated plan against
 * all deterministic hard constraints before returning to frontend.
 * Pure validation — NEVER mutates the database.
 */

import {
  matchesSkill,
  parseTimeWindow,
  OPERATING_HOURS,
  slotsOverlap,
} from './validationService.js';

export function validateAiPlanProposal({
  proposedAssignments = [],
  requests = [],
  technicians = [],
  existingAssignments = [],
  options = {},
}) {
  const validationErrors = [];
  const validatedAssignments = [];
  const proposedTimeslotMap = new Map(); // Track multiple new proposals for same tech

  for (const item of proposedAssignments) {
    const reqId = item.requestId;
    const techId = item.technicianId;
    const reqObj = requests.find((r) => r.requestId === reqId || r.id === reqId);
    const techObj = technicians.find(
      (t) => t.technicianId === techId || t.id === techId || t.name === item.technicianName || t.name === item.technician
    );

    const assignmentErrors = [];

    // 1. Request existence check
    if (!reqObj) {
      const err = { requestId: reqId, reason: `Request ${reqId} does not exist in database.` };
      validationErrors.push(err);
      assignmentErrors.push(err.reason);
      continue;
    }

    // 2. Protected completed requests check (Rule: REQ-010 is immutable)
    const isCompleted =
      reqObj.status === 'COMPLETED' ||
      reqObj.status === 'Completed' ||
      reqObj.isProtectedCompleted ||
      item.isProtectedCompleted;

    if (isCompleted && item.technicianId && item.technicianName) {
      // If completed, only allowed if it keeps the original assigned technician and slot
      const origTechId = reqObj.assignedTechId;
      const origTechName = reqObj.assignedTechName || reqObj.assignedTechnician;
      const proposedTech = techObj?.technicianId || techId;
      if (origTechId && proposedTech !== origTechId && item.technicianName !== origTechName) {
        const err = {
          requestId: reqId,
          reason: `Request ${reqId} is COMPLETED and strictly protected from reassignment.`,
        };
        validationErrors.push(err);
        assignmentErrors.push(err.reason);
      }
    }

    // 3. Technician existence check
    if (!techObj) {
      const err = { requestId: reqId, reason: `Technician ${techId || item.technicianName} not found in database.` };
      validationErrors.push(err);
      assignmentErrors.push(err.reason);
      continue;
    }

    // 4. Technician availability check
    const isUnavailable =
      techObj.status === 'Unavailable' ||
      techObj.status === 'UNAVAILABLE' ||
      techObj.status === 'On Leave' ||
      techObj.status === 'ON_LEAVE';

    if (isUnavailable) {
      const err = {
        requestId: reqId,
        technicianId: techObj.technicianId,
        reason: `Technician ${techObj.name} is UNAVAILABLE / ON_LEAVE and cannot accept new assignments.`,
      };
      validationErrors.push(err);
      assignmentErrors.push(err.reason);
    }

    // 5. Skill compatibility check
    const reqSkill = reqObj.requiredSkill || reqObj.skill;
    if (!matchesSkill(reqSkill, techObj.skills || [])) {
      const err = {
        requestId: reqId,
        technicianId: techObj.technicianId,
        reason: `Technician ${techObj.name} lacks required skill: ${reqSkill}. Possessed: [${(techObj.skills || []).join(', ')}]`,
      };
      validationErrors.push(err);
      assignmentErrors.push(err.reason);
    }

    // 6. Time slot validation
    const timeStr = item.timeSlot || (item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : null);
    const parsedSlot = parseTimeWindow(timeStr);

    if (!parsedSlot) {
      const err = {
        requestId: reqId,
        reason: `Proposed timeslot "${timeStr}" is invalid. Expected format "HH:mm - HH:mm".`,
      };
      validationErrors.push(err);
      assignmentErrors.push(err.reason);
    } else {
      // 7. Operating hours check
      const allowOvertime = Boolean(
        options.allowOvertime ||
        options.dispatcherAnswers?.['MIS-001']?.toLowerCase().includes('overtime')
      );
      const shiftEnd = allowOvertime ? OPERATING_HOURS.endMinutes + 120 : OPERATING_HOURS.endMinutes;

      if (parsedSlot.startMin < OPERATING_HOURS.startMinutes || parsedSlot.endMin > shiftEnd) {
        const err = {
          requestId: reqId,
          reason: `Proposed time ${timeStr} is outside operational working hours (09:00 - ${allowOvertime ? '19:00' : '17:00'}).`,
        };
        validationErrors.push(err);
        assignmentErrors.push(err.reason);
      }

      // 7.1 Duration match check
      const reqDurationHours = reqObj.durationHours || (reqObj.duration?.includes('1.5') ? 1.5 : (reqObj.duration?.includes('3') ? 3 : 2));
      const reqDurationMins = Math.round(reqDurationHours * 60);
      const proposedMins = parsedSlot.endMin - parsedSlot.startMin;
      if (Math.abs(proposedMins - reqDurationMins) > 15) {
        const err = {
          requestId: reqId,
          reason: `Proposed duration of ${proposedMins} mins does not match request required duration of ${reqDurationMins} mins.`,
        };
        validationErrors.push(err);
        assignmentErrors.push(err.reason);
      }

      // 8. Overlapping assignments check against existing active database assignments
      const assignedTechId = techObj.technicianId || techObj.id;
      for (const exist of existingAssignments) {
        if (exist.status === 'Cancelled' || exist.status === 'CANCELLED') continue;
        if (exist.requestId === reqId) continue; // Skip same request being updated
        if (proposedAssignments.some((p) => p.requestId === exist.requestId)) continue; // Skip existing assignments being replanned in this proposal

        const existTechId = exist.technicianId || exist.assignedTechId;
        if (existTechId === assignedTechId) {
          const existSlot = parseTimeWindow(exist.timeSlot || `${exist.startTime} - ${exist.endTime}`);
          if (existSlot && slotsOverlap(parsedSlot.startMin, parsedSlot.endMin, existSlot.startMin, existSlot.endMin)) {
            const err = {
              requestId: reqId,
              technicianId: assignedTechId,
              reason: `Schedule conflict: Overlaps with existing assignment ${exist.requestId} (${existSlot.startStr} - ${existSlot.endStr}) for ${techObj.name}.`,
            };
            validationErrors.push(err);
            assignmentErrors.push(err.reason);
          }
        }
      }

      // 9. Overlapping assignments check among multiple proposals for same technician in this plan
      if (!proposedTimeslotMap.has(assignedTechId)) {
        proposedTimeslotMap.set(assignedTechId, []);
      }
      const prevProposed = proposedTimeslotMap.get(assignedTechId);
      for (const p of prevProposed) {
        if (p.requestId !== reqId && slotsOverlap(parsedSlot.startMin, parsedSlot.endMin, p.startMin, p.endMin)) {
          const err = {
            requestId: reqId,
            technicianId: assignedTechId,
            reason: `Self-conflict: Plan proposes multiple overlapping assignments (${reqId} and ${p.requestId}) for ${techObj.name}.`,
          };
          validationErrors.push(err);
          assignmentErrors.push(err.reason);
        }
      }
      prevProposed.push({
        requestId: reqId,
        startMin: parsedSlot.startMin,
        endMin: parsedSlot.endMin,
      });
    }

    validatedAssignments.push({
      ...item,
      technicianId: techObj ? techObj.technicianId : techId,
      technicianName: techObj ? techObj.name : item.technicianName,
      customer: reqObj.customer,
      skill: reqObj.requiredSkill,
      region: reqObj.region,
      startTime: parsedSlot ? parsedSlot.startStr : item.startTime,
      endTime: parsedSlot ? parsedSlot.endStr : item.endTime,
      timeSlot: parsedSlot ? `${parsedSlot.startStr} – ${parsedSlot.endStr}` : item.timeSlot,
      status: isCompleted ? 'Completed' : 'ASSIGNED',
      isProtectedCompleted: isCompleted,
      validationStatus: assignmentErrors.length === 0 ? 'VALID' : 'INVALID',
      validationErrors: assignmentErrors,
    });
  }

  return {
    valid: validationErrors.length === 0,
    errors: validationErrors,
    validationErrors,
    validatedAssignments,
  };
}

export default {
  validateAiPlanProposal,
};
