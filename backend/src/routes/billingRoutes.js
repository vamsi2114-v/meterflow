const express = require('express');
const router = express.Router();
const {
  getBillingSummary, getBillingHistory,
  triggerCalculation, createOrder, verifyPayment,
} = require('../controllers/billingController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getBillingSummary);
router.get('/history', getBillingHistory);
router.post('/calculate', triggerCalculation);
router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);

module.exports = router;
