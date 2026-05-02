const UsageLog = require('../models/UsageLog');
const ApiKey = require('../models/ApiKey');

// @route GET /api/usage/summary
// Returns total requests, errors, avg latency for the current user
exports.getUsageSummary = async (req, res) => {
  try {
    const { apiId, from, to } = req.query;

    const match = { userId: req.user._id };
    if (apiId) match.apiId = apiId;
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const [summary] = await UsageLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          successRequests: { $sum: { $cond: [{ $lt: ['$statusCode', 400] }, 1, 0] } },
          errorRequests: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
          avgLatency: { $avg: '$latency' },
          minLatency: { $min: '$latency' },
          maxLatency: { $max: '$latency' },
        },
      },
    ]);

    res.json({ success: true, data: summary || { totalRequests: 0, errorRequests: 0, avgLatency: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/usage/timeline
// Returns requests grouped by hour/day for charts
exports.getUsageTimeline = async (req, res) => {
  try {
    const { apiId, groupBy = 'day', days = 7 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const match = { userId: req.user._id, createdAt: { $gte: since } };
    if (apiId) match.apiId = apiId;

    const dateFormat = groupBy === 'hour' ? '%Y-%m-%dT%H:00' : '%Y-%m-%d';

    const timeline = await UsageLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          requests: { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
          avgLatency: { $avg: '$latency' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: timeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/usage/top-endpoints
exports.getTopEndpoints = async (req, res) => {
  try {
    const match = { userId: req.user._id };
    if (req.query.apiId) match.apiId = req.query.apiId;

    const endpoints = await UsageLog.aggregate([
      { $match: match },
      { $group: { _id: '$endpoint', count: { $sum: 1 }, avgLatency: { $avg: '$latency' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({ success: true, data: endpoints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};