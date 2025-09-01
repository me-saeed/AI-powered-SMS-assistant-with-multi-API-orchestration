const express = require("express");
const router = express.Router();
const smsController = require("../controllers/sms.controller");
const { validateInbound } = require("../middleware/validateInbound");
const { rateLimit } = require("../middleware/rateLimit");

/**
 * @route POST /recieveSMS
 * @desc Handle incoming SMS from Twilio webhook
 * @access Public (Twilio webhook)
 */
router.post(
  "/recieveSMS",
  rateLimit,
  validateInbound,
  smsController.handleIncomingSMS.bind(smsController)
);

/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "SMS Engine",
    version: "1.0.0",
  });
});

/**
 * @route GET /status
 * @desc Service status and statistics
 * @access Public
 */
router.get("/status", async (req, res) => {
  try {
    const aiRouterService = require("../services/ai/router.service");
    const health = await aiRouterService.getProviderHealth();
    const stats = await aiRouterService.getProviderStats();

    res.status(200).json({
      status: "operational",
      timestamp: new Date().toISOString(),
      ai: {
        health,
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
