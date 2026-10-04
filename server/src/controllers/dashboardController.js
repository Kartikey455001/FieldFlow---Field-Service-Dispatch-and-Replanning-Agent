import ServiceRequest from '../models/ServiceRequest.js';
import Technician from '../models/Technician.js';
import ScheduleVersion from '../models/ScheduleVersion.js';
import Notification from '../models/Notification.js';

export async function getSummary(req, res, next) {
  try {
    const allRequests = await ServiceRequest.find({}).lean();
    const allTechnicians = await Technician.find({}).lean();
    const currentVersion = (await ScheduleVersion.findOne({ isCurrent: true }).lean()) || (await ScheduleVersion.findOne({}).sort({ versionNumber: -1 }).lean());
    const unreadNotifications = await Notification.countDocuments({ unread: true });

    const totalRequests = allRequests.length;
    const activeAssigned = allRequests.filter(
      (r) => r.status === 'ASSIGNED' || r.status === 'Scheduled' || r.status === 'Assigned'
    ).length;
    const completed = allRequests.filter(
      (r) => r.status === 'COMPLETED' || r.status === 'Completed' || r.isProtectedCompleted
    ).length;
    const unassigned = allRequests.filter(
      (r) => r.status === 'UNASSIGNED' || r.status === 'Unassigned'
    ).length;

    // Total assigned paired work orders (active assigned + completed = 8)
    const assigned = activeAssigned + completed;

    const activeTechs = allTechnicians.filter(
      (t) => t.status === 'Available' || t.status === 'AVAILABLE'
    ).length;

    res.json({
      success: true,
      totalRequests,
      assigned,
      unassigned,
      completed,
      technicians: {
        active: activeTechs,
        total: allTechnicians.length,
      },
      currentSchedule: currentVersion ? currentVersion.version.toUpperCase() : 'V3',
      currentVersionDetails: currentVersion,
      unreadNotifications,
    });
  } catch (error) {
    next(error);
  }
}
