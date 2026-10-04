import mongoose from 'mongoose';

const scheduleVersionSchema = new mongoose.Schema(
  {
    versionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['Draft', 'Confirmed', 'Rejected', 'Draft (Pre-Decision Proposal)', 'DRAFT', 'CONFIRMED', 'REJECTED'],
      default: 'Draft',
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    createdAtString: {
      type: String,
      default: 'Today, Just now',
    },
    trigger: {
      type: String,
      default: '',
    },
    reason: {
      type: String,
      default: '',
    },
    planId: {
      type: String,
      default: null,
      index: true,
    },
    parentVersionId: {
      type: String,
      default: null,
    },
    parentVersion: {
      type: String,
      default: null,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    totalAssignments: {
      type: Number,
      default: 0,
    },
    unassignedCount: {
      type: Number,
      default: 0,
    },
    assignments: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    assignmentsSnapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    changes: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const ScheduleVersion = mongoose.models.ScheduleVersion || mongoose.model('ScheduleVersion', scheduleVersionSchema);
export default ScheduleVersion;
