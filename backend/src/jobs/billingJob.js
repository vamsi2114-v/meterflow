const { Queue, Worker } = require('bullmq');
const redis = require('../config/redis');
const { calculateBilling } = require('../services/billingService');
const User = require('../models/User');
const Api = require('../models/Api');

const QUEUE_NAME = 'billing';

// Create the queue
const billingQueue = new Queue(QUEUE_NAME, { connection: redis });

// Worker that processes billing jobs
const billingWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { userId, apiId, month } = job.data;
    console.log(`Processing billing: user=${userId} api=${apiId} month=${month}`);
    const result = await calculateBilling(userId, apiId, month);
    console.log(`Billing done: ₹${result.amountDue} due`);
    return result;
  },
  { connection: redis }
);

billingWorker.on('completed', (job) => {
  console.log(`Billing job ${job.id} completed`);
});

billingWorker.on('failed', (job, err) => {
  console.error(`Billing job ${job.id} failed:`, err.message);
});

// Schedule billing for ALL active users and APIs (run this monthly via cron)
exports.scheduleMonthlyBilling = async () => {
  const month = new Date().toISOString().slice(0, 7);
  const users = await User.find({});
  const apis = await Api.find({ isActive: true });

  for (const user of users) {
    for (const api of apis.filter((a) => a.userId.toString() === user._id.toString())) {
      await billingQueue.add(
        'monthly-billing',
        { userId: user._id.toString(), apiId: api._id.toString(), month },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      );
    }
  }

  console.log(`Scheduled billing jobs for ${month}`);
};

// Add a single billing job manually
exports.addBillingJob = async (userId, apiId) => {
  const month = new Date().toISOString().slice(0, 7);
  return billingQueue.add(
    'on-demand-billing',
    { userId, apiId, month },
    { attempts: 3 }
  );
};

exports.billingQueue = billingQueue;