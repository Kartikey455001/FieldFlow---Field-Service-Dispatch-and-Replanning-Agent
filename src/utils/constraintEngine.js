// FieldFlow Deterministic Hard Constraint Engine
// Enforces non-negotiable physical, temporal, and operational field-service rules.
// AI planning layers may PROPOSE, but this engine deterministically VALIDATES.

export const REASON_CODES = {
  SKILL_MISMATCH: 'SKILL_MISMATCH',
  REGION_MISMATCH: 'REGION_MISMATCH',
  OUTSIDE_AVAILABILITY: 'OUTSIDE_AVAILABILITY',
  OUTSIDE_REQUEST_WINDOW: 'OUTSIDE_REQUEST_WINDOW',
  OVERLAPPING_ASSIGNMENT: 'OVERLAPPING_ASSIGNMENT',
  MAX_WORKLOAD_EXCEEDED: 'MAX_WORKLOAD_EXCEEDED',
  TECHNICIAN_UNAVAILABLE: 'TECHNICIAN_UNAVAILABLE',
  REQUEST_ALREADY_COMPLETED: 'REQUEST_ALREADY_COMPLETED',
  REQUEST_ALREADY_ASSIGNED: 'REQUEST_ALREADY_ASSIGNED',
  INVALID_DURATION: 'INVALID_DURATION',
  OUTSIDE_OPERATING_HOURS: 'OUTSIDE_OPERATING_HOURS',
};

/**
 * Converts a "HH:MM" 24h string into minutes from midnight.
 * @param {string} timeStr - "09:30"
 * @returns {number} 570
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Converts minutes from midnight into a formatted "HH:MM" 24h string.
 * @param {number} totalMinutes - 570
 * @returns {string} "09:30"
 */
export function minutesToTimeString(totalMinutes) {
  const clamped = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Parses a window string like "09:00 - 12:00" or "09:00–12:00" into { startMin, endMin }.
 */
export function parseTimeWindow(windowStr) {
  if (!windowStr || typeof windowStr !== 'string') {
    return { startMin: 540, endMin: 1020 }; // Default: 09:00 - 17:00
  }
  const clean = windowStr.replace('–', '-');
  const parts = clean.split('-');
  if (parts.length === 2) {
    return {
      startMin: timeStringToMinutes(parts[0]),
      endMin: timeStringToMinutes(parts[1]),
    };
  }
  return { startMin: 540, endMin: 1020 };
}

/**
 * Deterministically checks interval overlap between two intervals [start1, end1] and [start2, end2].
 * Overlap condition: start1 < end2 && end1 > start2
 */
export function intervalsOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

/**
 * Core Deterministic Validation Engine
 * Validates a single proposed assignment against all 10 hard constraints.
 * 
 * @param {Object} params
 * @param {Object} params.request - The service request
 * @param {Object} params.technician - The target technician
 * @param {string} params.startTime - "HH:MM"
 * @param {string} params.endTime - "HH:MM"
 * @param {Array} params.existingAssignments - Array of all active requests in schedule
 * @param {Object} params.options - Optional rule overrides (from settings / dispatcher answers)
 * @param {boolean} params.options.allowOvertime - Allow max workload + allowed overtime
 * @param {number} params.options.maxOvertimeHours - Additional hours allowed if overtime approved
 * @param {boolean} params.options.allowCrossRegion - Allow adjacent region assignment
 * @returns {Object} { valid: boolean, violations: Array, warnings: Array, reasons: Array }
 */
export function validateAssignment(arg1, arg2, arg3, arg4 = [], arg5 = {}) {
  let request, technician, startTime, endTime, existingAssignments, options;

  if (arg1 && typeof arg1 === 'object' && ('request' in arg1 || 'technician' in arg1)) {
    request = arg1.request;
    technician = arg1.technician;
    startTime = arg1.startTime;
    endTime = arg1.endTime;
    existingAssignments = arg1.existingAssignments || [];
    options = arg1.options || {};

    if ((!startTime || !endTime) && arg1.timeSlot) {
      const parsed = parseTimeWindow(arg1.timeSlot);
      startTime = minutesToTimeString(parsed.startMin);
      endTime = minutesToTimeString(parsed.endMin);
    }
  } else {
    request = arg1;
    technician = arg2;
    existingAssignments = arg4 || [];
    options = arg5 || {};

    if (typeof arg3 === 'string') {
      const parsed = parseTimeWindow(arg3);
      startTime = minutesToTimeString(parsed.startMin);
      endTime = minutesToTimeString(parsed.endMin);
    } else if (arg3 && typeof arg3 === 'object') {
      startTime = arg3.startTime;
      endTime = arg3.endTime;
    }
  }

  const violations = [];
  const warnings = [];
  const reasons = [];

  if (!request) {
    return {
      valid: false,
      isValid: false,
      errors: ['Service request object is required.'],
      violations: [{ code: 'INVALID_REQUEST', message: 'Service request object is required.' }],
      warnings: [],
      reasons: ['Service request object is missing.'],
    };
  }

  if (!technician) {
    return {
      valid: false,
      isValid: false,
      errors: ['Target technician is required.'],
      violations: [{ code: 'INVALID_TECHNICIAN', message: 'Target technician is required.' }],
      warnings: [],
      reasons: ['Target technician is missing.'],
    };
  }

  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime);
  const slotDurationMin = endMin - startMin;

  // 1. Basic time interval validity (start < end)
  if (startMin >= endMin) {
    violations.push({
      code: REASON_CODES.INVALID_DURATION,
      message: `Invalid time interval: Start time (${startTime}) must be strictly earlier than end time (${endTime}).`,
    });
    reasons.push('Start time must be before end time.');
  }

  // Operating day boundary (standard shifts 09:00 - 17:00, with optional approved overtime)
  const DAY_START_MIN = 540; // 09:00
  const DAY_END_MIN = 1020;  // 17:00
  const isOvertimeAllowed = options.allowOvertime === true;
  const overtimeHours = options.maxOvertimeHours || 2;
  const effectiveDayEnd = isOvertimeAllowed ? DAY_END_MIN + overtimeHours * 60 : DAY_END_MIN;

  if (startMin < DAY_START_MIN || endMin > effectiveDayEnd) {
    violations.push({
      code: REASON_CODES.OUTSIDE_OPERATING_HOURS,
      message: `Assignment (${startTime}–${endTime}) falls outside standard dispatch operating hours (09:00–${isOvertimeAllowed ? minutesToTimeString(effectiveDayEnd) : '17:00'}).`,
    });
    reasons.push('Outside daily operating hours.');
  } else if (endMin > DAY_END_MIN && isOvertimeAllowed) {
    warnings.push({
      code: 'OVERTIME_WINDOW',
      message: `Assignment extends beyond standard 17:00 operating window into approved overtime (${startTime}–${endTime}).`,
    });
  }

  // 2. Request completion immutability (Hard Constraint 7)
  if (request.status === 'COMPLETED' || request.status === 'Completed' || request.isProtectedCompleted) {
    violations.push({
      code: REASON_CODES.REQUEST_ALREADY_COMPLETED,
      message: `Request ${request.id} is already Completed and is strictly protected from reassignment or replanning.`,
    });
    reasons.push('Request is already completed and protected.');
  }

  // 3. Technician availability status (Hard Constraint 1 & 9)
  const isTechnicianAvailable =
    technician.status === 'Available' &&
    technician.availability !== 'On Leave' &&
    technician.availability !== 'Cancelled Shift';

  if (!isTechnicianAvailable) {
    violations.push({
      code: REASON_CODES.TECHNICIAN_UNAVAILABLE,
      message: `Technician ${technician.name} is currently ${technician.status} (${technician.availability}).`,
    });
    reasons.push(`${technician.name} is unavailable / on leave.`);
  }

  // 4. Technician shift window (Hard Constraint 10)
  if (technician.availability && technician.availability.includes('-')) {
    const shift = parseTimeWindow(technician.availability);
    const maxShiftEnd = isOvertimeAllowed ? shift.endMin + overtimeHours * 60 : shift.endMin;
    if (startMin < shift.startMin || endMin > maxShiftEnd) {
      violations.push({
        code: REASON_CODES.OUTSIDE_AVAILABILITY,
        message: `Assignment (${startTime}–${endTime}) falls outside technician shift (${technician.availability}${isOvertimeAllowed ? ` + ${overtimeHours}h overtime` : ''}).`,
      });
      reasons.push(`Outside ${technician.name}'s working shift.`);
    } else if (endMin > shift.endMin && isOvertimeAllowed) {
      warnings.push({
        code: 'OVERTIME_SHIFT',
        message: `Technician ${technician.name} is scheduled for ${(endMin - shift.endMin) / 60} hour(s) of overtime beyond standard shift end.`,
      });
    }
  }

  // 5. Skill compatibility (Hard Constraint 2)
  const GENERIC_SKILL_WORDS = new Set(['repair', 'service', 'installation', 'expert', 'lead', 'specialist', 'general']);
  const reqSkillLower = (request.requiredSkill || '').toLowerCase().trim();
  const reqTokens = reqSkillLower.split(/[\s/-]+/).filter((t) => !GENERIC_SKILL_WORDS.has(t));
  const hasSkill = (technician.skills || []).some((skill) => {
    const sLower = skill.toLowerCase().trim();
    if (sLower === reqSkillLower || reqSkillLower.includes(sLower) || sLower.includes(reqSkillLower)) {
      return true;
    }
    const techTokens = sLower.split(/[\s/-]+/).filter((t) => !GENERIC_SKILL_WORDS.has(t));
    return reqTokens.some((t) => t.length >= 2 && techTokens.includes(t));
  });

  if (!hasSkill) {
    violations.push({
      code: REASON_CODES.SKILL_MISMATCH,
      message: `Skill mismatch: ${technician.name} lacks certified skill for "${request.requiredSkill}".`,
    });
    reasons.push(`${technician.name} is not certified for ${request.requiredSkill}.`);
  }

  // 6. Region compatibility (Hard Constraint 3)
  const isCrossRegionAllowed = options.allowCrossRegion === true;
  const isSameRegion =
    (technician.region || '').toLowerCase().trim() ===
    (request.region || '').toLowerCase().trim();

  if (!isSameRegion && !isCrossRegionAllowed) {
    violations.push({
      code: REASON_CODES.REGION_MISMATCH,
      message: `Region mismatch: Job is located in ${request.region}, but technician serves ${technician.region}.`,
    });
    reasons.push(`Region mismatch (${technician.region} vs ${request.region}).`);
  } else if (!isSameRegion && isCrossRegionAllowed) {
    warnings.push({
      code: 'CROSS_REGION_OVERRIDE',
      message: `Cross-region assignment permitted: Technician traveling from ${technician.region} to ${request.region}.`,
    });
  }

  // 7. Request preferred time window (Hard Constraint 4)
  if (request.preferredWindow) {
    const reqWindow = parseTimeWindow(request.preferredWindow);
    // Assignment must fit inside requested window
    if (startMin < reqWindow.startMin || endMin > reqWindow.endMin) {
      violations.push({
        code: REASON_CODES.OUTSIDE_REQUEST_WINDOW,
        message: `Outside time window: Assignment (${startTime}–${endTime}) falls outside customer window (${request.preferredWindow}).`,
      });
      reasons.push(`Outside customer window (${request.preferredWindow}).`);
    }
  }

  // 8. No overlapping assignments / No Double-Booking (Hard Constraint 6)
  // Exclude current request being edited
  const otherAssignmentsForTech = existingAssignments.filter(
    (a) =>
      a.id !== request.id &&
      a.assignedTechId === technician.id &&
      a.status !== 'UNASSIGNED' &&
      a.status !== 'Unassigned' &&
      a.status !== 'CANCELLED' &&
      a.status !== 'Cancelled' &&
      a.startTime &&
      a.endTime
  );

  let overlappingJob = null;
  for (const job of otherAssignmentsForTech) {
    const jobStart = timeStringToMinutes(job.startTime);
    const jobEnd = timeStringToMinutes(job.endTime);

    if (intervalsOverlap(startMin, endMin, jobStart, jobEnd)) {
      overlappingJob = job;
      break;
    }
  }

  if (overlappingJob) {
    const conflictMsg = `Cannot assign ${request.id} to ${technician.name}. Conflict: ${overlappingJob.id} is already scheduled from ${overlappingJob.startTime}–${overlappingJob.endTime}.`;
    violations.push({
      code: REASON_CODES.OVERLAPPING_ASSIGNMENT,
      message: conflictMsg,
    });
    reasons.push(conflictMsg);
  }

  // 9. Workload capacity check (Hard Constraint 5)
  const assignedMinutesFromList = otherAssignmentsForTech.reduce((sum, job) => {
    const jStart = timeStringToMinutes(job.startTime);
    const jEnd = timeStringToMinutes(job.endTime);
    return sum + Math.max(0, jEnd - jStart);
  }, 0);

  const existingWorkloadMin = Math.max(
    assignedMinutesFromList,
    (technician.currentWorkloadHours || 0) * 60
  );

  const baseMaxMinutes = (technician.maxWorkloadHours || 8) * 60;
  const overtimeAllowedMin = options.allowOvertime ? (options.maxOvertimeHours || 2) * 60 : 0;
  const totalAllowedMinutes = baseMaxMinutes + overtimeAllowedMin;

  const projectedTotalMinutes = existingWorkloadMin + slotDurationMin;

  if (projectedTotalMinutes > totalAllowedMinutes) {
    violations.push({
      code: REASON_CODES.MAX_WORKLOAD_EXCEEDED,
      message: `Maximum workload exceeded: Projected load of ${(projectedTotalMinutes / 60).toFixed(1)}h exceeds permitted cap of ${(totalAllowedMinutes / 60).toFixed(1)}h.`,
    });
    reasons.push(`Exceeds daily workload cap (${(totalAllowedMinutes / 60).toFixed(1)}h).`);
  } else if (projectedTotalMinutes > baseMaxMinutes) {
    warnings.push({
      code: 'OVERTIME_UTILIZED',
      message: `Overtime utilized: ${(projectedTotalMinutes / 60).toFixed(1)}h of ${(totalAllowedMinutes / 60).toFixed(1)}h max.`,
    });
  }

  const isValid = violations.length === 0;

  return {
    valid: isValid,
    isValid,
    errors: violations.map((v) => v.message || String(v)),
    violations,
    warnings,
    reasons,
    blockingReason: violations.length > 0 ? (violations[0].message || String(violations[0])) : null,
  };
}

export const validateManualAssignment = validateAssignment;

/**
 * Calculates current workload statistics for all technicians.
 * @param {Array} technicians
 * @param {Array} assignments
 * @returns {Object} Map of techId -> { totalMinutes, totalHours, percentage, isOverloaded }
 */
export function calculateTechnicianWorkloads(technicians = [], assignments = []) {
  const result = {};

  for (const tech of technicians) {
    const assignedJobs = assignments.filter(
      (a) =>
        a.assignedTechId === tech.id &&
        a.status !== 'UNASSIGNED' &&
        a.status !== 'Unassigned' &&
        a.status !== 'CANCELLED' &&
        a.status !== 'Cancelled' &&
        a.startTime &&
        a.endTime
    );

    const totalMinutes = assignedJobs.reduce((sum, job) => {
      const s = timeStringToMinutes(job.startTime);
      const e = timeStringToMinutes(job.endTime);
      return sum + Math.max(0, e - s);
    }, 0);

    const maxMinutes = (tech.maxWorkloadHours || 8) * 60;
    const percentage = Math.min(100, Math.round((totalMinutes / maxMinutes) * 100));

    result[tech.id] = {
      technicianId: tech.id,
      name: tech.name,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      maxHours: tech.maxWorkloadHours || 8,
      percentage,
      isOverloaded: totalMinutes > maxMinutes,
      jobCount: assignedJobs.length,
    };
  }

  return result;
}
