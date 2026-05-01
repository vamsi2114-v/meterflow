const redis = require('../config/redis')

const rateLimiter = async (req, res, next) => {
  try {
    const apiKey = req.apiKey // set by your auth middleware
    if (!apiKey) return next()

    const limit = apiKey.rateLimit || 60 // requests per minute
    const redisKey = `rate:${apiKey.key}`

    const current = await redis.incr(redisKey)

    if (current === 1) {
      await redis.expire(redisKey, 60) // reset every 60 seconds
    }

    if (current > limit) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Max ${limit} requests/minute.`,
        retryAfter: await redis.ttl(redisKey),
      })
    }

    // Add rate limit headers so clients can see their usage
    res.setHeader('X-RateLimit-Limit', limit)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current))

    next()
  } catch (err) {
    console.error('Rate limiter error:', err)
    next() // fail open — don't block requests if Redis is down
  }
}

module.exports = rateLimiter