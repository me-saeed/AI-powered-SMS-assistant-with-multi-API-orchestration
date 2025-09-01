const logger = require("../utils/logger");
const config = require("../config");
const User = require("../models/User");
const Message = require("../models/Message");
const RemainingMessage = require("../models/RemainingMessage");
const twilioService = require("../services/comms/twilio.service");
const aiRouterService = require("../services/ai/router.service");
const audioInboundService = require("../services/ingest/audioInbound.service");
const { BadRequestError, ForbiddenError } = require("../utils/httpError");

class SMSController {
  constructor() {
    this.freeSmsCredits = config.app.freeSmsCredits;
    this.maxSmsLength = config.app.maxSmsLength;
    this.paymentUrl = config.app.paymentUrl;
  }

  /**
   * Handle incoming SMS
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleIncomingSMS(req, res) {
    try {
      logger.info("Processing incoming SMS", {
        from: req.body.From,
        bodyLength: req.body.Body ? req.body.Body.length : 0,
      });

      // Process audio if present
      const { transcript, usedAudio } =
        await audioInboundService.handleAudioInbound(req);

      if (transcript === "audio too large") {
        return this.sendTwiMLResponse(
          res,
          "Your audio is too large. Please send a shorter clip."
        );
      }

      // Combine text and transcript
      let userMessage = (req.body.Body || "").trim();
      if (usedAudio && transcript) {
        userMessage = userMessage ? `${userMessage} ${transcript}` : transcript;
      }

      if (!userMessage) {
        return this.sendTwiMLResponse(
          res,
          "Please send a text message or audio clip."
        );
      }

      // Process the message
      await this.processUserMessage(req.body.From, userMessage, res);
    } catch (error) {
      logger.error("Error handling incoming SMS", {
        error: error.message,
        from: req.body.From,
      });

      this.sendTwiMLResponse(
        res,
        "Sorry, something went wrong. Please try again later."
      );
    }
  }

  /**
   * Process user message and generate response
   * @param {string} phoneNumber - User's phone number
   * @param {string} message - User's message
   * @param {Object} res - Express response object
   */
  async processUserMessage(phoneNumber, message, res) {
    try {
      // Handle special commands
      const commandResult = await this.handleSpecialCommands(
        phoneNumber,
        message,
        res
      );
      if (commandResult) return;

      // Check user and manage credits
      const user = await this.manageUserCredits(phoneNumber);
      if (!user) {
        return this.sendTwiMLResponse(
          res,
          "Account blocked. Please contact support."
        );
      }

      // Generate AI response
      const aiResponse = await this.generateAIResponse(phoneNumber, message);

      // Handle long responses
      const finalResponse = await this.handleLongResponse(
        phoneNumber,
        aiResponse
      );

      // Send response
      this.sendTwiMLResponse(res, finalResponse);

      // Send notification messages if needed
      await this.sendNotificationMessages(phoneNumber, user);
    } catch (error) {
      logger.error("Error processing user message", {
        error: error.message,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Handle special commands
   * @param {string} phoneNumber - User's phone number
   * @param {string} message - User's message
   * @param {Object} res - Express response object
   * @returns {boolean} - True if command was handled
   */
  async handleSpecialCommands(phoneNumber, message, res) {
    const lowerMessage = message.toLowerCase().trim();

    switch (lowerMessage) {
      case "stop":
        this.sendTwiMLResponse(
          res,
          "You have opted-in to receive messages from Textile."
        );
        return true;

      case "account":
        const user = await User.findOne({ phNo: phoneNumber });
        const credits = user ? user.blance : 0;
        const accountMessage =
          `You have ${credits} credits remaining.\n` +
          "Reply DELETE HISTORY to delete all your message records.\n" +
          "Reply DELETE ACCOUNT to delete your account and all data.";
        this.sendTwiMLResponse(res, accountMessage);
        return true;

      case "delete history":
        await Message.deleteUserMessages(phoneNumber);
        this.sendTwiMLResponse(res, "Your message history has been deleted.");
        return true;

      case "delete account":
        await User.deleteOne({ phNo: phoneNumber });
        await Message.deleteUserMessages(phoneNumber);
        await RemainingMessage.deleteMany({ phone: phoneNumber });
        this.sendTwiMLResponse(
          res,
          "Your account and all related data have been deleted."
        );
        return true;

      case "more":
        const remainingMsg = await RemainingMessage.getLatestRemainingMessage(
          phoneNumber
        );
        const result = remainingMsg
          ? remainingMsg.content
          : "You do not have any previous SMS";
        this.sendTwiMLResponse(res, result);
        return true;

      default:
        return false;
    }
  }

  /**
   * Manage user credits and create new users
   * @param {string} phoneNumber - User's phone number
   * @returns {Object|null} - User object or null if blocked
   */
  async manageUserCredits(phoneNumber) {
    let user = await User.findOne({ phNo: phoneNumber });

    if (!user) {
      // Create new user
      user = await User.create({
        phNo: phoneNumber,
        blance: this.freeSmsCredits,
        smsSent: 1,
      });
      logger.info("New user created", {
        phoneNumber,
        credits: this.freeSmsCredits,
      });
      return user;
    }

    // Update existing user
    if (user.blance <= 0) {
      logger.warn("User blocked due to insufficient credits", { phoneNumber });
      return null;
    }

    // Consume credit
    user.consumeCredit();
    await user.save();

    logger.info("User credit consumed", {
      phoneNumber,
      remainingCredits: user.blance,
      totalSMS: user.smsSent,
    });

    return user;
  }

  /**
   * Generate AI response using conversation history
   * @param {string} phoneNumber - User's phone number
   * @param {string} message - User's message
   * @returns {Promise<string>} - AI response
   */
  async generateAIResponse(phoneNumber, message) {
    // Save user message
    await Message.create({
      phone: phoneNumber,
      role: "user",
      content: message,
    });

    // Get conversation history
    const conversationHistory = await Message.getConversationHistory(
      phoneNumber,
      10
    );
    const formattedHistory = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get AI response
    const aiResponse = await aiRouterService.routeMessage(
      message,
      formattedHistory
    );

    // Save AI response
    await Message.create({
      phone: phoneNumber,
      role: "assistant",
      content: aiResponse,
    });

    return aiResponse;
  }

  /**
   * Handle long responses by splitting them
   * @param {string} phoneNumber - User's phone number
   * @param {string} response - AI response
   * @returns {string} - Final response to send
   */
  async handleLongResponse(phoneNumber, response) {
    if (response.length <= this.maxSmsLength) {
      return response;
    }

    // Split response
    const allowedLength = this.maxSmsLength - 34; // Account for "....Reply MORE to continue reading"
    const truncatedResponse = response.substring(0, allowedLength);
    const remainingText = response.substring(allowedLength);

    // Save remaining text
    await RemainingMessage.createRemainingMessage(phoneNumber, remainingText);

    return truncatedResponse + "....Reply MORE to continue reading";
  }

  /**
   * Send notification messages based on user status
   * @param {string} phoneNumber - User's phone number
   * @param {Object} user - User object
   */
  async sendNotificationMessages(phoneNumber, user) {
    // Send welcome message for new users
    if (user.smsSent === 1) {
      setTimeout(async () => {
        try {
          await this.sendWelcomeMessage(phoneNumber);
        } catch (error) {
          logger.error("Failed to send welcome message", {
            error: error.message,
            phoneNumber,
          });
        }
      }, 1000);
    }

    // Send low balance warning
    if (user.blance === 10) {
      setTimeout(async () => {
        try {
          await this.sendLowBalanceMessage(phoneNumber);
        } catch (error) {
          logger.error("Failed to send low balance message", {
            error: error.message,
            phoneNumber,
          });
        }
      }, 1000);
    }

    // Send excess usage message
    if (user.blance < 2) {
      setTimeout(async () => {
        try {
          await this.sendExcessUsageMessage(phoneNumber);
        } catch (error) {
          logger.error("Failed to send excess usage message", {
            error: error.message,
            phoneNumber,
          });
        }
      }, 1000);
    }
  }

  /**
   * Send welcome message
   * @param {string} phoneNumber - User's phone number
   */
  async sendWelcomeMessage(phoneNumber) {
    const message =
      `Welcome to Textile! You have ${this.freeSmsCredits}/10 trial credits remaining. ` +
      `You can buy more at ${this.paymentUrl}/${phoneNumber}\n` +
      "Textile uses AI to answer anything, generate images, or display data.\n" +
      "Reply ACCOUNT at any time to check your credits balance or manage your data.";

    await twilioService.sendSMS(phoneNumber, message);
    logger.info("Welcome message sent", { phoneNumber });
  }

  /**
   * Send low balance message
   * @param {string} phoneNumber - User's phone number
   */
  async sendLowBalanceMessage(phoneNumber) {
    const message = `You've used all but 10 Textile credits.\nPurchase more at ${this.paymentUrl}/${phoneNumber}`;
    await twilioService.sendSMS(phoneNumber, message);
    logger.info("Low balance message sent", { phoneNumber });
  }

  /**
   * Send excess usage message
   * @param {string} phoneNumber - User's phone number
   */
  async sendExcessUsageMessage(phoneNumber) {
    const message = `You have used up 10/10 trial credits. Purchase more at ${this.paymentUrl}/${phoneNumber}`;
    await twilioService.sendSMS(phoneNumber, message);
    logger.info("Excess usage message sent", { phoneNumber });
  }

  /**
   * Send TwiML response
   * @param {Object} res - Express response object
   * @param {string} message - Message content
   */
  sendTwiMLResponse(res, message) {
    const twiml = twilioService.createTwiMLResponse(message);
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml);
  }
}

module.exports = new SMSController();
