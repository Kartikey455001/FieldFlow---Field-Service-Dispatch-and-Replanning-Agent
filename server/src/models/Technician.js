import mongoose from 'mongoose';

const technicianSchema = new mongoose.Schema(
  {
    technicianId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    region: {
      type: String,
      required: true,
      trim: true,
    },
    skills: {
      type: [String],
      required: true,
      default: [],
    },
    status: {
      type: String,
      required: true,
      default: 'Available',
      enum: ['Available', 'Unavailable', 'On Leave', 'AVAILABLE', 'UNAVAILABLE', 'ON_LEAVE'],
    },
    availability: {
      type: String,
      default: '09:00 - 17:00',
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
    },
    dailyWorkload: {
      type: Number,
      default: 0,
    },
    currentWorkloadHours: {
      type: Number,
      default: 0,
    },
    maxWorkloadHours: {
      type: Number,
      default: 8,
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    jobsToday: {
      type: Number,
      default: 0,
    },
    completedJobsToday: {
      type: Number,
      default: 0,
    },
    avatar: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret.technicianId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Technician = mongoose.models.Technician || mongoose.model('Technician', technicianSchema);
export default Technician;
