import ServiceRequest from '../models/ServiceRequest.js';
import Technician from '../models/Technician.js';

/**
 * Simulate technician cancellation or assignment cancellation without persisting
 */
export async function simulateCancellation({ technicianId, assignmentId, requestId }) {
  const technicians = await Technician.find({}).lean();
  const requests = await ServiceRequest.find({}).lean();
  // assignments are not needed for cancellation simulation (replaced by request filtering)

  let targetTech = null;
  let affectedReqIds = [];

  if (technicianId) {
    targetTech = technicians.find((t) => t.technicianId === technicianId || t.name === technicianId);
    if (!targetTech) {
      throw new Error(`Technician ${technicianId} not found.`);
    }

    // Find all active pending requests assigned to this technician
    const affected = requests.filter(
      (r) =>
        (r.assignedTechId === targetTech.technicianId || r.assignedTechnician === targetTech.name) &&
        r.status !== 'COMPLETED' &&
        r.status !== 'Completed' &&
        !r.isProtectedCompleted
    );

    affectedReqIds = affected.map((r) => r.requestId);
  } else if (assignmentId || requestId) {
    const targetReq = requests.find((r) => r.requestId === requestId || r.requestId === assignmentId);
    if (targetReq) {
      if (targetReq.isProtectedCompleted || targetReq.status === 'COMPLETED') {
        throw new Error(`Cannot cancel protected completed assignment: ${targetReq.requestId}`);
      }
      affectedReqIds = [targetReq.requestId];
      targetTech = technicians.find((t) => t.technicianId === targetReq.assignedTechId);
    }
  }

  // Virtual state with technician marked unavailable
  const updatedTechs = technicians.map((t) =>
    targetTech && t.technicianId === targetTech.technicianId
      ? { ...t, status: 'Unavailable', availability: 'Cancelled Shift' }
      : t
  );

  const updatedRequests = requests.map((r) => {
    if (affectedReqIds.includes(r.requestId)) {
      return {
        ...r,
        status: 'UNASSIGNED',
        needsReplanning: true,
        assignedTechId: null,
        assignedTechnician: null,
        assignedTechName: null,
        issueFlag: `Technician ${targetTech?.name || 'assigned staff'} cancelled shift`,
      };
    }
    return r;
  });

  return {
    success: true,
    technicianId: targetTech?.technicianId,
    technicianName: targetTech?.name,
    affectedRequests: affectedReqIds,
    replanRequired: true,
    message: `Technician ${targetTech?.name || 'Staff'} shift cancelled. ${affectedReqIds.length} request(s) unassigned. Click "Generate AI Plan" to replan with Gemini.`,
    beforeState: requests.filter((r) => affectedReqIds.includes(r.requestId)),
    updatedRequests: updatedRequests.filter((r) => affectedReqIds.includes(r.requestId)),
    updatedTechnicians: updatedTechs,
  };
}
