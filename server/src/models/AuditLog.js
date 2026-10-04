import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    auditId: {
      type: String,
      default: () => `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      default: 'operations',
      index: true,
    },
    entityId: {
      type: String,
      default: null,
      index: true,
    },
    entity: {
      type: String,
      default: '',
    },
    performedBy: {
      type: String,
      default: 'System',
    },
    actor: {
      type: String,
      default: 'AI Dispatch Engine',
    },
    actorType: {
      type: String,
      default: 'system',
    },
    source: {
      type: String,
      default: 'AI',
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
    requestId: {
      type: String,
      default: null,
      index: true,
    },
    affectedRequestId: {
      type: String,
      default: null,
      index: true,
    },
    affectedPlanVersion: {
      type: String,
      default: null,
    },
    time: {
      type: String,
      default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    timestamp: {
      type: String,
      default: () => new Date().toISOString().replace('T', ' ').substring(0, 19),
    },
    category: {
      type: String,
      default: 'operations',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret.auditId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
