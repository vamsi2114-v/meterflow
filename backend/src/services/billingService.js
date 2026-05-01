const Billing = require('../models/Billing');
const Api = require('../models/Api');
const UsageLog = require('../models/UsageLog');
const redis = require('../config/redis');

// Calculate and upsert a billing record for a user+api for current month
exports.calculateBilling = async (userId, apiId, month) => {
  const api = await Api.findById(apiId);
  if (!api) throw new Error('API not found');

  // Try Redis counter first (fast path)
  let totalRequests;
  const redisKey = `usage:${userId}:${apiId}:${month}`;
  const cached = await redis.get(redisKey);

  if (cached) {
    totalRequests = parseInt(cached, 10);
  } else {
    // Fall back to counting from DB
    const [startDate, endDate] = getMonthRange(month);
    totalRequests = await UsageLog.countDocuments({
      userId,
      apiId,
      createdAt: { $gte: startDate, $lte: endDate },
    });
  }

  const freeLimit = api.pricing.freeLimit || 1000;
  const freeRequests = Math.min(totalRequests, freeLimit);
  const billableRequests = Math.max(0, totalRequests - freeLimit);
  const amountDue = (billableRequests / 100) * api.pricing.pricePerHundred;

  // Upsert billing record
  const billing = await Billing.findOneAndUpdate(
    { userId, apiId, month },
    { totalRequests, freeRequests, billableRequests, amountDue },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return billing;
};

// Get billing summary for a user across all APIs for a month
exports.getUserBillingSummary = async (userId, month) => {
  const records = await Billing.find({ userId, month }).populate('apiId', 'name');
  const totalAmount = records.reduce((sum, r) => sum + r.amountDue, 0);
  return { records, totalAmount, month };
};

// Helper: get start and end Date for a "YYYY-MM" month string
function getMonthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59, 999);
  return [start, end];
}