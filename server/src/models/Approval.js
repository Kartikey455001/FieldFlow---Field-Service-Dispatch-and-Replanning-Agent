import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema(
  {
    approvalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    versionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['APPROVED', 'REJECTED', 'Approved', 'Rejected'],
    },
    approvedBy: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      default: '',
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

const Approval = mongoose.models.Approval || mongoose.model('Approval', approvalSchema);
export default Approval;
