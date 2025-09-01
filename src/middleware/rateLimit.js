const rateLimit = require("express-rate-limit");
const config = require("../config");
const logger = require("../utils/logger");
const { TooManyRequestsError } = require("../utils/httpError");

/**
 * Rate limiting configuration
 */
const rateLimitConfig = {
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: "Too many requests from this IP, please try again later.",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      path: req.path,
    });

    res.status(429).json({
      error: "Too many requests from this IP, please try again later.",
      timestamp: new Date().toISOString(),
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    });
  },
  keyGenerator: (req) => {
    // Use phone number if available, otherwise fall back to IP
    return req.body?.From || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/health" || req.path === "/status";
  },
  onLimitReached: (req, res, options) => {
    logger.warn("Rate limit reached", {
      ip: req.ip,
      phone: req.body?.From,
      path: req.path,
      limit: options.max,
      windowMs: options.windowMs,
    });
  },
};

/**
 * Create rate limiter instance
 */
const limiter = rateLimit(rateLimitConfig);

/**
 * Custom rate limiting middleware with additional logging
 */
function customRateLimit(req, res, next) {
  // Apply the rate limiter
  limiter(req, res, (err) => {
    if (err) {
      logger.error("Rate limiting error", {
        error: err.message,
        ip: req.ip,
        phone: req.body?.From,
      });

      return res.status(500).json({
        error: "Rate limiting error",
        timestamp: new Date().toISOString(),
      });
    }

    // Add rate limit info to response headers
    if (res.getHeader("X-RateLimit-Limit")) {
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(Date.now() + config.rateLimit.windowMs).toISOString()
      );
    }

    next();
  });
}

module.exports = { rateLimit: customRateLimit };
