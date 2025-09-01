const twilio = require("twilio");
const config = require("../../config");
const logger = require("../../utils/logger");
const {
  ServiceUnavailableError,
  BadRequestError,
} = require("../../utils/httpError");

class TwilioService {
  constructor() {
    this.accountSid = config.twilio.accountSid;
    this.authToken = config.twilio.authToken;
    this.phoneNumber = config.twilio.phoneNumber;

    this.client = twilio(this.accountSid, this.authToken);
  }

  /**
   * Send SMS using Twilio API
   * @param {string} toPhone - Recipient phone number
   * @param {string} message - Message content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Twilio message object
   */
  async sendSMS(toPhone, message, options = {}) {
    try {
      if (!toPhone || !message) {
        throw new BadRequestError("Phone number and message are required");
      }

      logger.info("Sending SMS via Twilio", {
        to: toPhone,
        from: this.phoneNumber,
        messageLength: message.length,
      });

      const messageData = {
        body: message,
        from: this.phoneNumber,
        to: toPhone,
        ...options,
      };

      const result = await this.client.messages.create(messageData);

      logger.info("SMS sent successfully", {
        messageSid: result.sid,
        to: toPhone,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error("Failed to send SMS via Twilio", {
        error: error.message,
        to: toPhone,
        from: this.phoneNumber,
      });

      if (error.code) {
        switch (error.code) {
          case 21211:
            throw new BadRequestError("Invalid phone number format");
          case 21214:
            throw new BadRequestError("Phone number is not mobile");
          case 21608:
            throw new BadRequestError("Message content is not allowed");
          case 21610:
            throw new BadRequestError("Message too long");
          default:
            throw new ServiceUnavailableError(`Twilio error: ${error.message}`);
        }
      }

      throw new ServiceUnavailableError("Failed to send SMS");
    }
  }

  /**
   * Create TwiML response for webhook
   * @param {string} message - Message content
   * @returns {string} - TwiML XML string
   */
  createTwiMLResponse(message) {
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(message);
    return twiml.toString();
  }

  /**
   * Test Twilio connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    try {
      // Try to get account info to test credentials
      await this.client.api.accounts(this.accountSid).fetch();
      logger.info("Twilio connection test successful");
      return true;
    } catch (error) {
      logger.error("Twilio connection test failed", { error: error.message });
      return false;
    }
  }
}

module.exports = new TwilioService();
