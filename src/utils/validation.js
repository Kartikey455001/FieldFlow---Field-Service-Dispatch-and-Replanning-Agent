// Deterministic Frontend Validation Logic for FieldFlow Manual Assignment
// Powered by the central Deterministic Hard Constraint Engine

import {
  validateAssignment,
  REASON_CODES,
  timeStringToMinutes,
} from './constraintEngine.js';

export { REASON_CODES, validateAssignment };

/**
 * Validates whether assigning a request to a technician at a given time slot is valid.
 * 
 * @param {Object} params
 * @param {Object} params.request - The service request being assigned
 * @param {Object} params.technician - The target technician
 * @param {string} params.startTime - "HH:MM" (e.g. "10:00")
 * @param {string} params.endTime - "HH:MM" (e.g. "12:00")
 * @param {Array} params.existingAssignments - All current service requests with assigned technicians
 * @param {Object} params.options - Dispatcher overrides / settings (e.g. allowOvertime, allowCrossRegion)
 * @returns {Object} { isValid: boolean, checks: Array, blockingReason: string|null, violations: Array, reasons: Array }
 */
export function validateManualAssignment({
  request,
  technician,
  startTime,
  endTime,
  existingAssignments = [],
  options = {},
}) {
  const result = validateAssignment({
    request,
    technician,
    startTime,
    endTime,
    existingAssignments,
    options,
  });

  // Build the 6 standard UI check items for display in the checklist UI
  const checks = [];

  // 1. Skill Match
  const skillViolation = result.violations.find((v) => v.code === REASON_CODES.SKILL_MISMATCH);
  checks.push({
    id: 'skill',
    label: 'Required skill matches',
    passed: !skillViolation,
    message: skillViolation
      ? skillViolation.message
      : `Technician is certified in ${request?.requiredSkill || 'required skill'}`,
    isHardConstraint: true,
  });

  // 2. Region Match
  const regionViolation = result.violations.find((v) => v.code === REASON_CODES.REGION_MISMATCH);
  checks.push({
    id: 'region',
    label: 'Region matches',
    passed: !regionViolation,
    message: regionViolation
      ? regionViolation.message
      : `Territory match: ${request?.region || technician?.region}`,
    isHardConstraint: true,
  });

  // 3. Technician Availability
  const availViolation = result.violations.find(
    (v) =>
      v.code === REASON_CODES.TECHNICIAN_UNAVAILABLE ||
      v.code === REASON_CODES.OUTSIDE_AVAILABILITY
  );
  checks.push({
    id: 'availability',
    label: 'Technician available',
    passed: !availViolation,
    message: availViolation
      ? availViolation.message
      : `${technician?.name || 'Technician'} is on active duty`,
    isHardConstraint: true,
  });

  // 4. Preferred Time Window
  const windowViolation = result.violations.find((v) => v.code === REASON_CODES.OUTSIDE_REQUEST_WINDOW);
  checks.push({
    id: 'window',
    label: 'Within preferred time window',
    passed: !windowViolation,
    message: windowViolation
      ? windowViolation.message
      : 'Within customer preferred window',
    isHardConstraint: true,
  });

  // 5. Maximum Workload Limit
  const workloadViolation = result.violations.find((v) => v.code === REASON_CODES.MAX_WORKLOAD_EXCEEDED);
  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime);
  const durationHours = Math.max(0, (endMin - startMin) / 60);

  checks.push({
    id: 'workload',
    label: 'Workload within limit',
    passed: !workloadViolation,
    message: workloadViolation
      ? workloadViolation.message
      : `Job duration (+${durationHours}h) respects daily capacity limits`,
    isHardConstraint: true,
  });

  // 6. Double-Booking Conflict
  const conflictViolation = result.violations.find((v) => v.code === REASON_CODES.OVERLAPPING_ASSIGNMENT);
  checks.push({
    id: 'conflict',
    label: 'No scheduling conflict',
    passed: !conflictViolation,
    message: conflictViolation
      ? conflictViolation.message
      : 'No overlapping assignments for this slot',
    isHardConstraint: true,
  });

  const blockingReason = result.violations[0]?.message || null;

  return {
    isValid: result.valid,
    valid: result.valid,
    checks,
    blockingReason,
    violations: result.violations,
    warnings: result.warnings,
    reasons: result.reasons,
  };
}
