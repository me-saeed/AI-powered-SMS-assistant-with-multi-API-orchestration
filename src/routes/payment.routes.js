const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { rateLimit } = require("../middleware/rateLimit");

/**
 * @route POST /checkBalance
 * @desc Check user's current credit balance
 * @access Public
 */
router.post(
  "/checkBalance",
  rateLimit,
  paymentController.checkBalance.bind(paymentController)
);

/**
 * @route POST /pay
 * @desc Process Stripe payment and add credits
 * @access Public
 */
router.post(
  "/pay",
  rateLimit,
  paymentController.processPayment.bind(paymentController)
);

/**
 * @route GET /config
 * @desc Get payment configuration for frontend
 * @access Public
 */
router.get(
  "/config",
  paymentController.getPaymentConfig.bind(paymentController)
);

/**
 * @route POST /history
 * @desc Get payment history for a user
 * @access Public
 */
router.post(
  "/history",
  rateLimit,
  paymentController.getPaymentHistory.bind(paymentController)
);

module.exports = router;
