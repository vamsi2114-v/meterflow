const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema(
  {
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApiKey',
      required: true,
    },
    apiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Api',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    latency: {
      type: Number, // in milliseconds
      required: true,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
    // Auto-delete logs older than 90 days
    expireAfterSeconds: 90 * 24 * 60 * 60,
  }
);

// Indexes for fast analytics queries
usageLogSchema.index({ apiKeyId: 1, createdAt: -1 });
usageLogSchema.index({ apiId: 1, createdAt: -1 });
usageLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('UsageLog', usageLogSchema);