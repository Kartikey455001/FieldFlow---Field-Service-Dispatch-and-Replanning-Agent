// FieldFlow Deterministic Service Request Lifecycle & State Machine
// Formally governs state transitions across all service requests.

export const REQUEST_STATUSES = {
  NEW: 'NEW',
  UNASSIGNED: 'UNASSIGNED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EMERGENCY: 'EMERGENCY',
  BLOCKED: 'BLOCKED',
};

// Formal State Transitions Matrix
export const ALLOWED_TRANSITIONS = {
  NEW: ['UNASSIGNED', 'CANCELLED'],
  UNASSIGNED: ['ASSIGNED', 'PENDING_APPROVAL', 'EMERGENCY', 'BLOCKED', 'CANCELLED'],
  PENDING_APPROVAL: ['ASSIGNED', 'UNASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'UNASSIGNED', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'BLOCKED', 'CANCELLED'],
  COMPLETED: [], // Strictly Terminal & Immutable
  CANCELLED: ['UNASSIGNED'], // Can be reopened into unassigned pool
  EMERGENCY: ['ASSIGNED', 'UNASSIGNED', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['UNASSIGNED', 'ASSIGNED', 'CANCELLED'],
};

/**
 * Validates whether transitioning from currentStatus to nextStatus is allowed.
 */
export function validateStatusTransition(currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) {
    return { valid: false, error: 'Current and next status are required.' };
  }

  const currentNorm = normalizeStatus(currentStatus);
  const nextNorm = normalizeStatus(nextStatus);

  if (currentNorm === nextNorm) {
    return { valid: true };
  }

  // Completed jobs are strictly immutable
  if (currentNorm === REQUEST_STATUSES.COMPLETED) {
    return {
      valid: false,
      error: `Cannot transition request from COMPLETED. Completed requests are permanently protected and immutable.`,
    };
  }

  const allowed = ALLOWED_TRANSITIONS[currentNorm] || [];
  if (!allowed.includes(nextNorm)) {
    return {
      valid: false,
      error: `Invalid status transition: Cannot change from ${currentNorm} to ${nextNorm}. Allowed next transitions are: ${allowed.join(', ') || 'None'}.`,
    };
  }

  return { valid: true };
}

/**
 * Normalizes any legacy or UI status string into standard uppercase status.
 */
export function normalizeStatus(status) {
  if (!status) return REQUEST_STATUSES.UNASSIGNED;
  const clean = status.trim().toUpperCase().replace(/[\s-]/g, '_');
  if (clean === 'SCHEDULED') return REQUEST_STATUSES.ASSIGNED;
  if (clean in REQUEST_STATUSES) return clean;
  return clean;
}
