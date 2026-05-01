const ApiKey = require('../models/ApiKey');
const Api = require('../models/Api');
const UsageLog = require('../models/UsageLog');
const redis = require('../config/redis');

// Gateway middleware: validate key, rate limit, log, forward
exports.gatewayMiddleware = async (req, res, next) => {
  const startTime = Date.now();

  // 1. Extract API key from header or query param
  const apiKey =
    req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key missing. Pass it as X-Api-Key header or ?api_key= query param.',
    });
  }

  try {
    // 2. Validate the key (use Redis cache to avoid DB hit every request)
    let keyData = await redis.get(`apikey:${apiKey}`);

    if (keyData) {
      keyData = JSON.parse(keyData);
    } else {
      const keyDoc = await ApiKey.findOne({ key: apiKey, status: 'active' })
        .populate('apiId')
        .lean();

      if (!keyDoc) {
        return res.status(401).json({ success: false, message: 'Invalid or revoked API key' });
      }

      keyData = keyDoc;
      // Cache for 5 minutes
      await redis.setex(`apikey:${apiKey}`, 300, JSON.stringify(keyData));
    }

    // 3. Rate limiting using Redis sliding window
    const rateLimitKey = `ratelimit:${apiKey}:${Math.floor(Date.now() / 60000)}`;
    const requests = await redis.incr(rateLimitKey);
    if (requests === 1) await redis.expire(rateLimitKey, 60);

    const limit = keyData.rateLimit || 60;
    if (requests > limit) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Max ${limit} requests/minute.`,
        retryAfter: 60,
      });
    }

    // 4. Attach key info to request for logging
    req.apiKeyData = keyData;
    req.gatewayStart = startTime;

    // 5. After response is sent, log usage asynchronously
    res.on('finish', async () => {
      try {
        const latency = Date.now() - startTime;
        await UsageLog.create({
          apiKeyId: keyData._id,
          apiId: keyData.apiId._id || keyData.apiId,
          userId: keyData.userId,
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          latency,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        // Increment monthly usage counter in Redis for fast billing
        const month = new Date().toISOString().slice(0, 7);
        await redis.incr(`usage:${keyData.userId}:${keyData.apiId._id || keyData.apiId}:${month}`);

        // Update lastUsedAt (debounced — only update DB every 5 mins)
        const lastUsedKey = `lastused:${keyData._id}`;
        const alreadyUpdated = await redis.get(lastUsedKey);
        if (!alreadyUpdated) {
          await ApiKey.findByIdAndUpdate(keyData._id, { lastUsedAt: new Date() });
          await redis.setex(lastUsedKey, 300, '1');
        }
      } catch (logErr) {
        console.error('Usage logging error:', logErr.message);
      }
    });

    next();
  } catch (error) {
    console.error('Gateway error:', error.message);
    res.status(500).json({ success: false, message: 'Gateway error' });
  }
};