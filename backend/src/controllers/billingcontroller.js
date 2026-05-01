const Razorpay = require('razorpay');
const crypto = require('crypto');
const Billing = require('../models/Billing');
const { calculateBilling, getUserBillingSummary } = require('../services/billingService');
const { addBillingJob } = require('../jobs/billingJob');

// Initialize lazily so .env is loaded first
const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @route GET /api/billing
// Get billing summary for current month
exports.getBillingSummary = async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const summary = await getUserBillingSummary(req.user._id, month);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/billing/history
exports.getBillingHistory = async (req, res) => {
  try {
    const records = await Billing.find({ userId: req.user._id })
      .populate('apiId', 'name')
      .sort({ month: -1 })
      .limit(12);
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/billing/calculate
// Trigger on-demand billing calculation for a specific API
exports.triggerCalculation = async (req, res) => {
  try {
    const { apiId } = req.body;
    if (!apiId) return res.status(400).json({ success: false, message: 'apiId required' });

    const month = new Date().toISOString().slice(0, 7);
    const result = await calculateBilling(req.user._id, apiId, month);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/billing/create-order
// Create a Razorpay order for a billing record
exports.createOrder = async (req, res) => {
  try {
    const { billingId } = req.body;
    const billing = await Billing.findOne({ _id: billingId, userId: req.user._id });

    if (!billing) return res.status(404).json({ success: false, message: 'Billing record not found' });
    if (billing.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });
    if (billing.amountDue <= 0) return res.status(400).json({ success: false, message: 'No amount due' });

    const order = await getRazorpay().orders.create({
      amount: Math.round(billing.amountDue * 100), // Razorpay uses paise
      currency: 'INR',
      receipt: `billing_${billingId}`,
      notes: { billingId: billingId.toString(), userId: req.user._id.toString() },
    });

    billing.razorpayOrderId = order.id;
    await billing.save();

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/billing/verify-payment
// Verify Razorpay payment signature and mark billing as paid
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billingId } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const billing = await Billing.findOneAndUpdate(
      { _id: billingId, userId: req.user._id },
      { status: 'paid', razorpayPaymentId: razorpay_payment_id, paidAt: new Date() },
      { new: true }
    );

    res.json({ success: true, message: 'Payment verified', data: billing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};