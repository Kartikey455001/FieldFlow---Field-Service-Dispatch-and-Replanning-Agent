/**
 * Phase 4 Centralized Validation Service
 * Deterministically enforces all 8 hard constraints on the server.
 */

export const REASON_CODES = {
  SKILL_MISMATCH: 'SKILL_MISMATCH',
  TECHNICIAN_UNAVAILABLE: 'TECHNICIAN_UNAVAILABLE',
  OUTSIDE_AVAILABILITY: 'OUTSIDE_AVAILABILITY',
  OUTSIDE_OPERATING_HOURS: 'OUTSIDE_OPERATING_HOURS',
  REGION_MISMATCH: 'REGION_MISMATCH',
  OUTSIDE_REQUEST_WINDOW: 'OUTSIDE_REQUEST_WINDOW',
  OVERLAPPING_ASSIGNMENT: 'OVERLAPPING_ASSIGNMENT',
  MAX_WORKLOAD_EXCEEDED: 'MAX_WORKLOAD_EXCEEDED',
  REQUEST_ALREADY_COMPLETED: 'REQUEST_ALREADY_COMPLETED',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',
  TIME_PARSING_ERROR: 'TIME_PARSING_ERROR',
  TECHNICIAN_NOT_FOUND: 'TECHNICIAN_NOT_FOUND',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
};

export const OPERATING_HOURS = {
  start: '09:00',
  end: '17:00',
  startMinutes: 540,
  endMinutes: 1020,
};

export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function parseTimeWindow(windowStr) {
  if (!windowStr || typeof windowStr !== 'string') return null;
  const delimiter = windowStr.includes('–') ? '–' : windowStr.includes('-') ? '-' : null;
  if (!delimiter) return null;
  const [startStr, endStr] = windowStr.split(delimiter).map((s) => s.trim());
  const startMin = timeToMinutes(startStr);
  const endMin = timeToMinutes(endStr);
  if (startMin === null || endMin === null || startMin >= endMin) return null;
  return { startMin, endMin, startStr, endStr };
}

export function slotsOverlap(startA, endA, startB, endB) {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

const GENERIC_WORDS = new Set([
  'repair',
  'repairs',
  'service',
  'servicing',
  'maintenance',
  'installation',
  'lead',
  'expert',
  'specialist',
  'general',
  'technician',
  'work',
  'fix',
  'fitting',
]);

export function matchesSkill(requiredSkill, technicianSkills) {
  if (!requiredSkill) return true;
  if (!Array.isArray(technicianSkills) || technicianSkills.length === 0) return false;

  const reqNorm = requiredSkill.toLowerCase().trim();
  const techSkillsNorm = technicianSkills.map((s) => s.toLowerCase().trim());

  // 1. Exact match
  if (techSkillsNorm.includes(reqNorm)) return true;

  // 2. Exact word boundaries
  for (const skill of techSkillsNorm) {
    if (skill.includes(reqNorm) || reqNorm.includes(skill)) {
      return true;
    }
  }

  // 3. Domain token overlap
  const reqWords = reqNorm
    .split(/[\s,/-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !GENERIC_WORDS.has(w));

  for (const skill of techSkillsNorm) {
    const techWords = skill
      .split(/[\s,/-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 1 && !GENERIC_WORDS.has(w));

    const common = reqWords.filter((w) => techWords.includes(w));
    if (common.length > 0) return true;
  }

  return false;
}

/**
 * Validates assignment against all 8 hard constraints.
 */
export function validateAssignment(request, technician, timeSlot, existingAssignments = [], options = {}) {
  // Support object signature
  if (request && typeof request === 'object' && !technician && !timeSlot) {
    const params = request;
    request = params.request;
    technician = params.technician;
    timeSlot = params.timeSlot || (params.startTime && params.endTime ? `${params.startTime} - ${params.endTime}` : null);
    existingAssignments = params.existingAssignments || [];
    options = params.options || {};
  }

  const violations = [];
  const warnings = [];
  const errors = [];
  const reasons = [];

  // Check existence
  if (!request) {
    errors.push('Request does not exist.');
    return {
      valid: false,
      isValid: false,
      errors,
      violations: [{ code: REASON_CODES.REQUEST_NOT_FOUND, message: 'Request not found.' }],
      warnings,
      reasons: ['Request not found.'],
      blockingReason: 'Request not found.',
    };
  }

  if (!technician) {
    errors.push('Technician does not exist.');
    return {
      valid: false,
      isValid: false,
      errors,
      violations: [{ code: REASON_CODES.TECHNICIAN_NOT_FOUND, message: 'Technician not found.' }],
      warnings,
      reasons: ['Technician not found.'],
      blockingReason: 'Technician not found.',
    };
  }

  // 1. Completed assignment protection
  const isReqCompleted =
    request.status === 'COMPLETED' ||
    request.status === 'Completed' ||
    request.isProtectedCompleted ||
    request.protected;

  if (isReqCompleted) {
    const msg = `Request ${request.requestId || request.id} is marked COMPLETED and is protected from modification.`;
    violations.push({ code: REASON_CODES.REQUEST_ALREADY_COMPLETED, message: msg });
    errors.push(msg);
    reasons.push(msg);
  }

  // Terminal cancelled request
  if (request.status === 'CANCELLED' || request.status === 'Cancelled') {
    const msg = `Request ${request.requestId || request.id} is cancelled and cannot be assigned.`;
    violations.push({ code: REASON_CODES.REQUEST_CANCELLED, message: msg });
    errors.push(msg);
    reasons.push(msg);
  }

  // 2. Technician operational availability
  const isTechAvailable =
    technician.status === 'Available' ||
    technician.status === 'AVAILABLE';

  if (!isTechAvailable) {
    const msg = `Technician ${technician.name} is ${technician.status} (${technician.availability || 'Off duty'}).`;
    violations.push({ code: REASON_CODES.TECHNICIAN_UNAVAILABLE, message: msg });
    errors.push(msg);
    reasons.push(msg);
  }

  // Parse assignment times
  let parsedSlot = null;
  if (timeSlot) {
    parsedSlot = parseTimeWindow(timeSlot);
  }

  if (!parsedSlot) {
    const msg = `Invalid or missing assignment time slot: "${timeSlot}". Format: "HH:MM - HH:MM".`;
    violations.push({ code: REASON_CODES.TIME_PARSING_ERROR, message: msg });
    errors.push(msg);
    reasons.push(msg);
  }

  // 3. Skill compatibility
  const reqSkill = request.requiredSkill || request.skill;
  const techSkills = technician.skills || [];
  if (!matchesSkill(reqSkill, techSkills)) {
    const msg = `Technician ${technician.name} lacks required skill: ${reqSkill}. Skills: [${techSkills.join(', ')}].`;
    violations.push({ code: REASON_CODES.SKILL_MISMATCH, message: msg });
    errors.push(msg);
    reasons.push(msg);
  }

  if (parsedSlot) {
    const allowOvertime = Boolean(options.allowOvertime);
    const maxOvertimeHours = options.maxOvertimeHours !== undefined ? options.maxOvertimeHours : 2;
    const maxShiftEndMin = allowOvertime
      ? OPERATING_HOURS.endMinutes + maxOvertimeHours * 60
      : OPERATING_HOURS.endMinutes;

    // 4. Operating hours & shift window
    if (parsedSlot.startMin < OPERATING_HOURS.startMinutes || parsedSlot.endMin > maxShiftEndMin) {
      const msg = `Assignment ${timeSlot} falls outside operational window (09:00–${allowOvertime ? '19:00' : '17:00'}).`;
      violations.push({ code: REASON_CODES.OUTSIDE_OPERATING_HOURS, message: msg });
      errors.push(msg);
      reasons.push(msg);
    }

    // 5. Preferred customer window
    const prefWindow = request.preferredWindow;
    if (prefWindow) {
      const parsedPref = parseTimeWindow(prefWindow);
      if (parsedPref) {
        const strictWindow = options.strictWindow !== undefined ? options.strictWindow : true;
        if (strictWindow) {
          if (parsedSlot.startMin < parsedPref.startMin || parsedSlot.endMin > parsedPref.endMin) {
            const msg = `Assignment ${timeSlot} falls outside customer's preferred window: ${prefWindow}.`;
            violations.push({ code: REASON_CODES.OUTSIDE_REQUEST_WINDOW, message: msg });
            errors.push(msg);
            reasons.push(msg);
          }
        }
      }
    }

    // 6. Overlapping assignments / Double booking
    const techId = technician.technicianId || technician.id;
    const reqId = request.requestId || request.id;

    for (const other of existingAssignments) {
      const otherReqId = other.requestId || other.id;
      if (otherReqId === reqId) continue;

      const otherTechId = other.technicianId || other.assignedTechId;
      const otherTechName = other.technicianName || other.assignedTechName || other.technician;

      const isSameTech =
        (techId && otherTechId && String(otherTechId) === String(techId)) ||
        (otherTechName && otherTechName === technician.name);

      if (!isSameTech) continue;

      const otherStatus = other.status;
      if (otherStatus === 'CANCELLED' || otherStatus === 'Cancelled' || otherStatus === 'UNASSIGNED') continue;

      const otherWindowStr = other.timeSlot || (other.startTime && other.endTime ? `${other.startTime} - ${other.endTime}` : null);
      if (!otherWindowStr) continue;

      const parsedOther = parseTimeWindow(otherWindowStr);
      if (parsedOther && slotsOverlap(parsedSlot.startMin, parsedSlot.endMin, parsedOther.startMin, parsedOther.endMin)) {
        const msg = `Double-booking: Overlaps with ${otherReqId} (${otherWindowStr}) for ${technician.name}.`;
        violations.push({ code: REASON_CODES.OVERLAPPING_ASSIGNMENT, message: msg });
        errors.push(msg);
        reasons.push(msg);
      }
    }

    // 7. Workload capacity limit (8 hours standard cap)
    const assignmentMinutes = parsedSlot.endMin - parsedSlot.startMin;
    let existingAssignedMinutes = 0;

    for (const other of existingAssignments) {
      const otherReqId = other.requestId || other.id;
      if (otherReqId === reqId) continue;

      const otherTechId = other.technicianId || other.assignedTechId;
      const otherTechName = other.technicianName || other.assignedTechName || other.technician;
      const isSameTech =
        (techId && otherTechId && String(otherTechId) === String(techId)) ||
        (otherTechName && otherTechName === technician.name);

      if (!isSameTech) continue;

      const otherStatus = other.status;
      if (otherStatus === 'CANCELLED' || otherStatus === 'Cancelled' || otherStatus === 'UNASSIGNED') continue;

      const otherWindowStr = other.timeSlot || (other.startTime && other.endTime ? `${other.startTime} - ${other.endTime}` : null);
      if (otherWindowStr) {
        const parsedOther = parseTimeWindow(otherWindowStr);
        if (parsedOther) {
          existingAssignedMinutes += Math.max(0, parsedOther.endMin - parsedOther.startMin);
        }
      }
    }

    const baselineMinutes = Math.max(
      existingAssignedMinutes,
      (technician.currentWorkloadHours || technician.dailyWorkload || 0) * 60
    );
    const totalMinutesWithNew = baselineMinutes + assignmentMinutes;
    const maxWorkloadMinutes = (technician.maxWorkloadHours || 8) * 60;

    if (totalMinutesWithNew > maxWorkloadMinutes && !allowOvertime) {
      const msg = `Daily workload limit exceeded: ${(totalMinutesWithNew / 60).toFixed(1)}h exceeds ${technician.maxWorkloadHours || 8}h limit for ${technician.name}.`;
      violations.push({ code: REASON_CODES.MAX_WORKLOAD_EXCEEDED, message: msg });
      errors.push(msg);
      reasons.push(msg);
    }
  }

  // 8. Regional boundary check
  const strictRegion = options.strictRegionBinding !== undefined ? options.strictRegionBinding : false;
  const allowCrossRegion = options.allowCrossRegion !== undefined ? options.allowCrossRegion : !strictRegion;

  if (request.region && technician.region && !allowCrossRegion) {
    const reqReg = request.region.toLowerCase().replace('jaipur', '').trim();
    const techReg = technician.region.toLowerCase().replace('jaipur', '').trim();
    if (reqReg && techReg && reqReg !== techReg) {
      const msg = `Regional mismatch: Request in ${request.region}, but technician assigned to ${technician.region}.`;
      violations.push({ code: REASON_CODES.REGION_MISMATCH, message: msg });
      errors.push(msg);
      reasons.push(msg);
    }
  }

  const isValid = violations.length === 0;

  return {
    valid: isValid,
    isValid,
    violations,
    errors,
    warnings,
    reasons,
    blockingReason: violations.length > 0 ? violations[0].message : null,
  };
}
