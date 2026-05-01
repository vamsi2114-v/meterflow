const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    apiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Api',
      required: true,
    },
    month: {
      type: String, // Format: "2024-01"
      required: true,
    },
    totalRequests: {
      type: Number,
      default: 0,
    },
    freeRequests: {
      type: Number,
      default: 0,
    },
    billableRequests: {
      type: Number,
      default: 0,
    },
    amountDue: {
      type: Number, // in INR
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'waived'],
      default: 'pending',
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paidAt: Date,
  },
  { timestamps: true }
);

billingSchema.index({ userId: 1, month: -1 });
billingSchema.index({ userId: 1, apiId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Billing', billingSchema);