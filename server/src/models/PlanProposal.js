import mongoose from 'mongoose';

const planProposalSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'AWAITING_APPROVAL', 'CONFIRMED', 'APPROVED', 'REJECTED', 'Draft', 'Confirmed', 'Rejected', 'Plan Rejected'],
      default: 'AWAITING_APPROVAL',
      index: true,
    },
    workingDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
      index: true,
    },
    generatedAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    planSummary: {
      type: String,
      default: '',
    },
    confidenceScore: {
      type: String,
      default: '95%',
    },
    totalAssigned: {
      type: Number,
      default: 0,
    },
    totalUnassigned: {
      type: Number,
      default: 0,
    },
    proposedAssignments: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    unassignedRequests: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    unassignedRequestsList: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    risks: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    tradeOffs: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    questions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    missingInformation: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    whatChanged: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    analysisSummary: {
      type: [String],
      default: [],
    },
    triggerReason: {
      type: String,
      default: 'AI Dispatch Optimization',
    },
    validation: {
      type: mongoose.Schema.Types.Mixed,
      default: { valid: true, errors: [] },
    },
    sourceRequestIds: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    approvedBy: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: String,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret.planId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const PlanProposal = mongoose.models.PlanProposal || mongoose.model('PlanProposal', planProposalSchema);
export default PlanProposal;
