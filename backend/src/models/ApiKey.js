const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const apiKeySchema = new mongoose.Schema(
  {
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
    key: {
      type: String,
      default: () => `mf_${uuidv4().replace(/-/g, '')}`,
    },
    name: {
      type: String,
      default: 'Default Key',
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
    },
    // Rate limit per minute for this key
    rateLimit: {
      type: Number,
      default: 60,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for fast gateway lookups
apiKeySchema.index({ key: 1 });
apiKeySchema.index({ apiId: 1, userId: 1 });

module.exports = mongoose.model('ApiKey', apiKeySchema);