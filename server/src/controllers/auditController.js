import AuditLog from '../models/AuditLog.js';

export async function getAuditLogs(req, res, next) {
  try {
    const { entityType, entityId, action, search } = req.query;
    const filter = {};

    if (entityType && entityType !== 'All') {
      filter.entityType = entityType;
    }
    if (entityId) {
      filter.$or = [{ entityId }, { requestId: entityId }, { affectedRequestId: entityId }];
    }
    if (action && action !== 'All') {
      filter.action = new RegExp(action, 'i');
    }
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { action: searchRegex },
        { entity: searchRegex },
        { actor: searchRegex },
        { reason: searchRegex },
        { requestId: searchRegex },
      ];
    }

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
}
