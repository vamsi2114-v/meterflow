const express = require('express');
const router = express.Router();
const { gatewayMiddleware } = require('../middleware/gatewayMiddleware');
const { proxyRequest } = require('../controllers/gatewayController');

// All gateway requests go through key validation + rate limiting first
// Example: POST /gateway/API_ID/your/endpoint
router.all('/:apiId/*', gatewayMiddleware, proxyRequest);

module.exports = router;
