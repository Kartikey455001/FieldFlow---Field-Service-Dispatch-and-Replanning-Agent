import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'system',
      index: true,
    },
    type: {
      type: String,
      default: 'System',
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    unread: {
      type: Boolean,
      default: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'danger', 'success'],
      default: 'info',
    },
    relatedEntity: {
      type: String,
      default: null,
    },
    timestamp: {
      type: String,
      default: 'Just now',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret.notificationId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Keep read and unread synchronized
notificationSchema.pre('save', function (next) {
  if (this.isModified('read')) {
    this.unread = !this.read;
  } else if (this.isModified('unread')) {
    this.read = !this.unread;
  }
  if (typeof next === 'function') {
    next();
  }
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
