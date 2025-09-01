const logger = require("../utils/logger");
const config = require("../config");
const User = require("../models/User");
const stripeService = require("../services/payment/stripe.service");
const twilioService = require("../services/comms/twilio.service");
const { BadRequestError } = require("../utils/httpError");

class PaymentController {
  constructor() {
    this.paymentUrl = config.app.paymentUrl;
  }

  /**
   * Check user balance
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async checkBalance(req, res) {
    try {
      const { phNo } = req.body;

      if (!phNo) {
        throw new BadRequestError("Phone number is required");
      }

      logger.info("Checking user balance", { phoneNumber: phNo });

      const user = await User.findOne({ phNo: phNo });

      if (user) {
        return res.status(200).json({
          success: true,
          data: {
            phoneNumber: user.phNo,
            balance: user.blance,
            smsSent: user.smsSent,
            creditStatus: user.creditStatus,
            remainingCredits: user.remainingCredits,
          },
          message: "Balance retrieved successfully",
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
    } catch (error) {
      logger.error("Error checking user balance", {
        error: error.message,
        phoneNumber: req.body?.phNo,
      });

      if (error instanceof BadRequestError) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }

  /**
   * Process payment and add credits
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async processPayment(req, res) {
    try {
      logger.info("Payment processing started", {
        requestBody: req.body,
      });

      const {
        phNo,
        totalAmount,
        credit,
        payment_method_id,
        payment_intent_id,
      } = req.body;

      // Validate required fields
      if (!phNo || !totalAmount || !credit) {
        throw new BadRequestError(
          "Phone number, total amount, and credit are required"
        );
      }

      if (totalAmount <= 0 || credit <= 0) {
        throw new BadRequestError("Amount and credit must be positive numbers");
      }

      let intent;

      if (payment_method_id) {
        // Create new payment intent
        const customer = await stripeService.createOrRetrieveCustomer(
          phNo,
          payment_method_id
        );

        intent = await stripeService.createPaymentIntent(
          payment_method_id,
          totalAmount,
          customer.id
        );
      } else if (payment_intent_id) {
        // Confirm existing payment intent
        intent = await stripeService.confirmPaymentIntent(payment_intent_id);
      } else {
        throw new BadRequestError(
          "Payment method ID or payment intent ID is required"
        );
      }

      // Generate response based on intent status
      const response = stripeService.generatePaymentResponse(
        intent,
        phNo,
        credit
      );

      // If payment succeeded, add credits to user
      if (response.success) {
        await this.addCreditsToUser(phNo, credit);
      }

      return res.status(200).json(response);
    } catch (error) {
      logger.error("Payment processing failed", {
        error: error.message,
        requestBody: req.body,
      });

      if (error instanceof BadRequestError) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || "Payment processing failed",
      });
    }
  }

  /**
   * Add credits to user account
   * @param {string} phoneNumber - User's phone number
   * @param {number} credits - Credits to add
   * @returns {Promise<Object>} - Updated user object
   */
  async addCreditsToUser(phoneNumber, credits) {
    try {
      logger.info("Adding credits to user", {
        phoneNumber,
        credits,
      });

      let user = await User.findOne({ phNo: phoneNumber });
      let totalCredits;

      if (user) {
        // Update existing user
        totalCredits = parseInt(user.blance) + parseInt(credits);

        user = await User.findOneAndUpdate(
          { phNo: phoneNumber },
          {
            blance: totalCredits,
            smsSent: 0, // Reset SMS count for new purchase
            lastActivity: new Date(),
          },
          { new: true }
        );

        logger.info("Updated existing user credits", {
          phoneNumber,
          oldBalance: user.blance - credits,
          newBalance: totalCredits,
        });
      } else {
        // Create new user
        totalCredits = parseInt(credits);

        user = await User.create({
          phNo: phoneNumber,
          blance: totalCredits,
          smsSent: 0,
        });

        logger.info("Created new user with credits", {
          phoneNumber,
          credits: totalCredits,
        });
      }

      // Send confirmation SMS
      await this.sendPaymentConfirmationSMS(phoneNumber, totalCredits);

      return user;
    } catch (error) {
      logger.error("Failed to add credits to user", {
        error: error.message,
        phoneNumber,
        credits,
      });
      throw error;
    }
  }

  /**
   * Send payment confirmation SMS
   * @param {string} phoneNumber - User's phone number
   * @param {number} totalCredits - Total credits after purchase
   */
  async sendPaymentConfirmationSMS(phoneNumber, totalCredits) {
    try {
      const message = `Your purchase was successful! Your Textile account balance has been updated to ${totalCredits} credits.

You will receive a message when you have 10 credits remaining.

Reply ACCOUNT at any time to check your credits balance or manage your data.`;

      await twilioService.sendSMS(phoneNumber, message);

      logger.info("Payment confirmation SMS sent", {
        phoneNumber,
        totalCredits,
      });
    } catch (error) {
      logger.error("Failed to send payment confirmation SMS", {
        error: error.message,
        phoneNumber,
      });
      // Don't throw error here as it's not critical to the payment process
    }
  }

  /**
   * Get payment configuration for frontend
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getPaymentConfig(req, res) {
    try {
      const config = {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        currency: "usd",
        supportedPaymentMethods: ["card"],
      };

      return res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error("Failed to get payment configuration", {
        error: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve payment configuration",
      });
    }
  }

  /**
   * Get payment history for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getPaymentHistory(req, res) {
    try {
      const { phNo } = req.body;

      if (!phNo) {
        throw new BadRequestError("Phone number is required");
      }

      const user = await User.findOne({ phNo: phNo });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // For now, return basic user info
      // In a real application, you'd want to track payment transactions separately
      const paymentHistory = {
        phoneNumber: user.phNo,
        currentBalance: user.blance,
        totalSmsSent: user.smsSent,
        accountCreated: user.createdAt,
        lastActivity: user.lastActivity,
      };

      return res.status(200).json({
        success: true,
        data: paymentHistory,
        message: "Payment history retrieved successfully",
      });
    } catch (error) {
      logger.error("Error retrieving payment history", {
        error: error.message,
        phoneNumber: req.body?.phNo,
      });

      if (error instanceof BadRequestError) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
}

module.exports = new PaymentController();
