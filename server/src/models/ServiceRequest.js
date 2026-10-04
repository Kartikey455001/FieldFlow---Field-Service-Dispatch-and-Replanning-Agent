import mongoose from 'mongoose';

const serviceRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customer: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    region: {
      type: String,
      required: true,
      trim: true,
    },
    requiredSkill: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ['Normal', 'Medium', 'High', 'Critical', 'NORMAL', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'Normal',
    },
    duration: {
      type: String,
      default: '2 hours',
    },
    durationHours: {
      type: Number,
      default: 2,
    },
    preferredWindow: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        'UNASSIGNED',
        'ASSIGNED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'BLOCKED',
        'PENDING_APPROVAL',
        'Unassigned',
        'Assigned',
        'In Progress',
        'Completed',
        'Cancelled',
        'Blocked',
        'Pending Approval',
        'Scheduled',
      ],
      default: 'UNASSIGNED',
    },
    assignedTechnician: {
      type: String,
      default: null,
    },
    assignedTechId: {
      type: String,
      default: null,
    },
    assignedTechName: {
      type: String,
      default: null,
    },
    startTime: {
      type: String,
      default: null,
    },
    endTime: {
      type: String,
      default: null,
    },
    isProtectedCompleted: {
      type: Boolean,
      default: false,
    },
    needsReplanning: {
      type: Boolean,
      default: false,
    },
    issueFlag: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret.requestId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const ServiceRequest = mongoose.models.ServiceRequest || mongoose.model('ServiceRequest', serviceRequestSchema);
export default ServiceRequest;
