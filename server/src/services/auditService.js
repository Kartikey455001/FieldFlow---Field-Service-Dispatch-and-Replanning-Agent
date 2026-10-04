import AuditLog from '../models/AuditLog.js';

export async function logAuditEvent({
  action,
  entityType = 'operations',
  entityId = null,
  entity = '',
  performedBy = 'AI Dispatch Engine',
  actor = null,
  actorType = 'system',
  source = null,
  before = null,
  previousState = null,
  after = null,
  newState = null,
  reason = null,
  requestId = null,
  affectedRequestId = null,
  affectedPlanVersion = null,
  category = 'operations',
  session = null,
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19);

  const resolvedActor = actor || performedBy || 'AI Dispatch Engine';
  const resolvedSource = source || (actorType === 'user' ? 'Dispatcher' : actorType === 'technician' ? 'Technician' : 'AI');

  const logEntry = new AuditLog({
    action,
    entityType,
    entityId: entityId || requestId || affectedRequestId,
    entity: entity || `${action} on ${entityId || requestId || 'system'}`,
    performedBy: resolvedActor,
    actor: resolvedActor,
    actorType,
    source: resolvedSource,
    before: before || previousState,
    previousState: previousState ? String(previousState) : null,
    after: after || newState,
    newState: newState ? String(newState) : null,
    reason,
    requestId: requestId || affectedRequestId,
    affectedRequestId: affectedRequestId || requestId,
    affectedPlanVersion,
    time: timeStr,
    timestamp: timestampStr,
    category,
  });

  if (session) {
    await logEntry.save({ session });
  } else {
    await logEntry.save();
  }

  return logEntry;
}
