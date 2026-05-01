const mongoose = require('mongoose');

const apiSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'API name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    baseUrl: {
      type: String,
      required: [true, 'Base URL is required'],
      trim: true,
    },
    // Pricing config
    pricing: {
      freeLimit: { type: Number, default: 1000 },       // free requests per month
      pricePerHundred: { type: Number, default: 0.5 },  // ₹ per 100 requests after free tier
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Api', apiSchema);