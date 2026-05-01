const express = require('express');
const router = express.Router();
const { getUsageSummary, getUsageTimeline, getTopEndpoints } = require('../controllers/usageController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/summary', getUsageSummary);
router.get('/timeline', getUsageTimeline);
router.get('/top-endpoints', getTopEndpoints);

module.exports = router;
