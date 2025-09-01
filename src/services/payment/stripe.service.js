const stripe = require("stripe");
const config = require("../../config");
const logger = require("../../utils/logger");
const {
  BadRequestError,
  ServiceUnavailableError,
} = require("../../utils/httpError");

class StripeService {
  constructor() {
    this.stripe = stripe(config.stripe.secretKey);
    this.currency = config.stripe.currency;
  }

  /**
   * Create or retrieve a customer
   * @param {string} customerId - Customer ID (phone number)
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Promise<Object>} - Stripe customer object
   */
  async createOrRetrieveCustomer(customerId, paymentMethodId) {
    try {
      let customer;

      try {
        // Try to retrieve existing customer
        customer = await this.stripe.customers.retrieve(customerId);
        logger.info("Retrieved existing Stripe customer", { customerId });
      } catch (error) {
        if (error.code === "resource_missing") {
          // Create new customer
          customer = await this.stripe.customers.create({
            id: customerId,
            payment_method: paymentMethodId,
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });
          logger.info("Created new Stripe customer", { customerId });
        } else {
          throw error;
        }
      }

      return customer;
    } catch (error) {
      logger.error("Failed to create or retrieve Stripe customer", {
        error: error.message,
        customerId,
      });
      throw new ServiceUnavailableError(
        "Failed to process customer information"
      );
    }
  }

  /**
   * Create a payment intent
   * @param {string} paymentMethodId - Payment method ID
   * @param {number} amount - Amount in dollars
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} - Payment intent object
   */
  async createPaymentIntent(paymentMethodId, amount, customerId) {
    try {
      const intent = await this.stripe.paymentIntents.create({
        payment_method: paymentMethodId,
        amount: Math.round(amount * 100), // Convert to cents
        currency: this.currency,
        customer: customerId,
        confirmation_method: "manual",
        confirm: true,
      });

      logger.info("Payment intent created successfully", {
        intentId: intent.id,
        amount,
        customerId,
      });

      return intent;
    } catch (error) {
      logger.error("Failed to create payment intent", {
        error: error.message,
        amount,
        customerId,
      });
      throw new ServiceUnavailableError("Failed to create payment intent");
    }
  }

  /**
   * Confirm a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Promise<Object>} - Confirmed payment intent
   */
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const intent = await this.stripe.paymentIntents.confirm(paymentIntentId);

      logger.info("Payment intent confirmed", {
        intentId: paymentIntentId,
        status: intent.status,
      });

      return intent;
    } catch (error) {
      logger.error("Failed to confirm payment intent", {
        error: error.message,
        paymentIntentId,
      });
      throw new ServiceUnavailableError("Failed to confirm payment");
    }
  }

  /**
   * Generate payment response based on intent status
   * @param {Object} intent - Stripe payment intent
   * @param {string} phoneNumber - Customer phone number
   * @param {number} credits - Credits purchased
   * @returns {Object} - Response object for client
   */
  generatePaymentResponse(intent, phoneNumber, credits) {
    try {
      if (
        intent.status === "requires_action" &&
        intent.next_action?.type === "use_stripe_sdk"
      ) {
        // Tell the client to handle the action
        return {
          requires_action: true,
          payment_intent_client_secret: intent.client_secret,
        };
      } else if (intent.status === "succeeded") {
        // Payment completed successfully
        logger.info("Payment succeeded", {
          intentId: intent.id,
          phoneNumber,
          credits,
        });

        return {
          success: true,
          message: "Payment completed successfully",
          intentId: intent.id,
        };
      } else {
        // Invalid status
        logger.warn("Invalid payment intent status", {
          intentId: intent.id,
          status: intent.status,
        });

        return {
          error: "Invalid PaymentIntent status",
          status: intent.status,
        };
      }
    } catch (error) {
      logger.error("Error generating payment response", {
        error: error.message,
        intentId: intent?.id,
      });
      throw new ServiceUnavailableError("Failed to process payment response");
    }
  }

  /**
   * Test Stripe connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    try {
      // Try to retrieve account information
      await this.stripe.accounts.retrieve();
      logger.info("Stripe connection test successful");
      return true;
    } catch (error) {
      logger.error("Stripe connection test failed", { error: error.message });
      return false;
    }
  }

  /**
   * Get Stripe account information
   * @returns {Promise<Object>} - Account information
   */
  async getAccountInfo() {
    try {
      const account = await this.stripe.accounts.retrieve();
      return {
        id: account.id,
        business_type: account.business_type,
        country: account.country,
        default_currency: account.default_currency,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      };
    } catch (error) {
      logger.error("Failed to get Stripe account info", {
        error: error.message,
      });
      return { error: "Failed to retrieve account information" };
    }
  }
}

module.exports = new StripeService();
