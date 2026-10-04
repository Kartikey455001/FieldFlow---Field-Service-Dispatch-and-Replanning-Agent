/**
 * Candidate Service for FieldFlow AI Dispatch Planner
 * Performs deterministic technician eligibility, availability, conflict,
 * and workload checks before providing candidates to Gemini.
 */

import {
  matchesSkill,
  parseTimeWindow,
  OPERATING_HOURS,
  slotsOverlap,
} from './validationService.js';

function formatMinutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Computes busy time windows for a technician from their active assignments
 */
export function getTechnicianBusySlots(technicianId, assignments = []) {
  const busy = [];
  for (const a of assignments) {
    if (a.status === 'Cancelled' || a.status === 'CANCELLED') continue;
    const aTechId = a.technicianId || a.assignedTechId;
    if (aTechId !== technicianId) continue;

    const timeStr = a.timeSlot || (a.startTime && a.endTime ? `${a.startTime} - ${a.endTime}` : null);
    if (!timeStr) continue;

    const parsed = parseTimeWindow(timeStr);
    if (parsed) {
      busy.push({
        requestId: a.requestId,
        startMin: parsed.startMin,
        endMin: parsed.endMin,
        startTime: parsed.startStr,
        endTime: parsed.endStr,
      });
    }
  }
  return busy.sort((a, b) => a.startMin - b.startMin);
}

/**
 * Finds all available non-overlapping time windows of at least `durationMinutes`
 * between shift start and shift end.
 */
export function findFeasibleTimeSlots(busySlots, durationMinutes = 120, operatingWindow = OPERATING_HOURS) {
  const feasible = [];
  let currentStart = operatingWindow.startMinutes;
  const shiftEnd = operatingWindow.endMinutes;

  for (const busy of busySlots) {
    if (busy.startMin > currentStart) {
      const gap = busy.startMin - currentStart;
      if (gap >= durationMinutes) {
        // Can fit an assignment here
        const slotEnd = currentStart + durationMinutes;
        feasible.push({
          startMin: currentStart,
          endMin: slotEnd,
          timeSlot: `${formatMinutesToTime(currentStart)} - ${formatMinutesToTime(slotEnd)}`,
        });
      }
    }
    if (busy.endMin > currentStart) {
      currentStart = busy.endMin;
    }
  }

  // Check remaining gap until shift end
  if (shiftEnd - currentStart >= durationMinutes) {
    const slotEnd = currentStart + durationMinutes;
    feasible.push({
      startMin: currentStart,
      endMin: slotEnd,
      timeSlot: `${formatMinutesToTime(currentStart)} - ${formatMinutesToTime(slotEnd)}`,
    });
  }

  return feasible;
}

/**
 * Determine deterministic eligibility for all unassigned or replanning requests
 */
export function evaluateCandidateEligibility({
  requests = [],
  technicians = [],
  assignments = [],
  settings = {},
  dispatcherAnswers = {},
}) {
  const candidatesByRequest = {};
  const unassignedRequests = [];
  const requestsWithoutCandidates = [];

  // Identify requests that require planning
  const pendingRequests = requests.filter((r) => {
    const isCompleted = r.status === 'COMPLETED' || r.status === 'Completed' || r.isProtectedCompleted;
    if (isCompleted) return false;
    if (r.status === 'CANCELLED' || r.status === 'Cancelled') return false;
    return (
      r.status === 'UNASSIGNED' ||
      r.status === 'Unassigned' ||
      r.status === 'PENDING_APPROVAL' ||
      r.needsReplanning === true
    );
  });

  // Calculate existing workloads per technician
  const technicianWorkloadMap = new Map();
  for (const t of technicians) {
    const techId = t.technicianId || t.id;
    let workloadHours = 0;
    const techAssignments = assignments.filter(
      (a) =>
        (a.technicianId === techId || a.assignedTechId === techId) &&
        a.status !== 'Cancelled' &&
        a.status !== 'CANCELLED'
    );
    for (const a of techAssignments) {
      const slot = parseTimeWindow(a.timeSlot || `${a.startTime} - ${a.endTime}`);
      if (slot) {
        workloadHours += (slot.endMin - slot.startMin) / 60;
      }
    }
    technicianWorkloadMap.set(techId, workloadHours);
  }

  for (const req of pendingRequests) {
    const reqId = req.requestId || req.id;
    unassignedRequests.push(req);

    // Duration in minutes
    const durationHours = req.durationHours || (req.duration?.includes('1.5') ? 1.5 : 2);
    const durationMin = Math.round(durationHours * 60);

    // Customer preferred window
    const prefWindow = parseTimeWindow(req.preferredWindow);

    // Eligible candidates for this request
    const eligibleList = [];

    for (const tech of technicians) {
      const techId = tech.technicianId || tech.id;

      // 1. Availability check: Tech must be Available
      const isAvailable =
        tech.status === 'Available' ||
        tech.status === 'AVAILABLE' ||
        tech.availability?.toLowerCase().includes('09:00');
      if (tech.status === 'Unavailable' || tech.status === 'UNAVAILABLE' || tech.status === 'On Leave') {
        continue;
      }
      if (!isAvailable) {
        continue;
      }

      // 2. Skill check: Tech must possess certified required skill
      const reqSkill = req.requiredSkill || req.skill;
      if (!matchesSkill(reqSkill, tech.skills || [])) {
        continue;
      }

      // 3. Workload capacity check
      const currentWorkload = technicianWorkloadMap.get(techId) || 0;
      const maxWorkload = tech.maxWorkloadHours || 8;
      const allowOvertime = Boolean(
        settings.autoAllowOvertime ||
        dispatcherAnswers['MIS-001']?.toLowerCase().includes('overtime') ||
        dispatcherAnswers['MIS-001']?.toLowerCase().includes('amit patel') ||
        dispatcherAnswers['MIS-001']?.toLowerCase().includes('alex johnson')
      );
      const effectiveCap = allowOvertime ? maxWorkload + 2 : maxWorkload;

      if (currentWorkload + durationHours > effectiveCap) {
        continue;
      }

      // 4. Region check
      const isStrictRegion = settings.strictRegionBinding === true;
      if (isStrictRegion && tech.region !== req.region) {
        continue;
      }

      // 5. Operating hours & schedule conflict checks
      const busySlots = getTechnicianBusySlots(techId, assignments);
      const operatingWindow = {
        ...OPERATING_HOURS,
        endMinutes: allowOvertime ? OPERATING_HOURS.endMinutes + 120 : OPERATING_HOURS.endMinutes,
      };

      const feasibleSlots = findFeasibleTimeSlots(busySlots, durationMin, operatingWindow);

      // Check if any feasible slot aligns with preferred customer window
      const compliantSlots = [];
      const nonCompliantSlots = [];

      for (const slot of feasibleSlots) {
        if (prefWindow) {
          const overlapsPref = slotsOverlap(slot.startMin, slot.endMin, prefWindow.startMin, prefWindow.endMin);
          const withinPref = slot.startMin >= prefWindow.startMin && slot.endMin <= prefWindow.endMin;
          if (withinPref || overlapsPref) {
            compliantSlots.push(slot);
          } else {
            nonCompliantSlots.push(slot);
          }
        } else {
          compliantSlots.push(slot);
        }
      }

      const availableSlots = compliantSlots.length > 0 ? compliantSlots : nonCompliantSlots;

      if (availableSlots.length > 0) {
        eligibleList.push({
          technicianId: techId,
          technicianName: tech.name,
          role: tech.role,
          region: tech.region,
          skills: tech.skills,
          rating: tech.rating,
          currentWorkloadHours: currentWorkload,
          maxWorkloadHours: maxWorkload,
          remainingCapacityHours: Math.max(0, effectiveCap - currentWorkload),
          isRegionMatch: tech.region === req.region,
          feasibleSlots: availableSlots.map((s) => s.timeSlot),
          preferredWindowCompliant: compliantSlots.length > 0,
        });
      }
    }

    // Sort eligible candidates: prefer region match, preferred window compliance, then lower workload
    eligibleList.sort((a, b) => {
      if (a.preferredWindowCompliant !== b.preferredWindowCompliant) {
        return a.preferredWindowCompliant ? -1 : 1;
      }
      if (a.isRegionMatch !== b.isRegionMatch) {
        return a.isRegionMatch ? -1 : 1;
      }
      return a.currentWorkloadHours - b.currentWorkloadHours;
    });

    candidatesByRequest[reqId] = eligibleList;

    if (eligibleList.length === 0) {
      requestsWithoutCandidates.push({
        requestId: reqId,
        customer: req.customer,
        requiredSkill: req.requiredSkill,
        region: req.region,
        priority: req.priority,
        reason: `No available technician with skill "${req.requiredSkill}" has feasible capacity without hard constraint conflicts.`,
      });
    }
  }

  return {
    pendingRequests,
    candidatesByRequest,
    unassignedRequests,
    requestsWithoutCandidates,
    technicianWorkloadMap: Object.fromEntries(technicianWorkloadMap),
  };
}

export default {
  evaluateCandidateEligibility,
  getTechnicianBusySlots,
  findFeasibleTimeSlots,
};
