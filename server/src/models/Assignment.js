import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    technicianId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    technicianName: {
      type: String,
      trim: true,
    },
    customer: {
      type: String,
      trim: true,
    },
    skill: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    date: {
      type: String,
      default: '2026-10-05',
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    timeSlot: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Valid', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ASSIGNED'],
      default: 'Scheduled',
    },
    protected: {
      type: Boolean,
      default: false,
    },
    isProtectedCompleted: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret.assignmentId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
export default Assignment;
