const axios = require("axios");
const config = require("../../config");
const logger = require("../../utils/logger");
const {
  ServiceUnavailableError,
  BadRequestError,
} = require("../../utils/httpError");

class GrokService {
  constructor() {
    this.apiKey = config.ai.grok.apiKey;
    this.baseURL = config.ai.grok.baseURL;
    this.model = config.ai.grok.model;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  /**
   * Get response from Grok AI API
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options for the API call
   * @returns {Promise<string>} - AI response content
   */
  async getResponse(messages, options = {}) {
    try {
      logger.info("Sending request to Grok AI API", {
        messageCount: messages.length,
        model: this.model,
        options,
      });

      const requestPayload = {
        model: this.model,
        messages: messages,
        stream: false,
        temperature: options.temperature || 0,
        max_tokens: options.maxTokens || 2000,
        ...options,
      };

      const response = await this.client.post("", requestPayload);

      if (
        response.data &&
        response.data.choices &&
        response.data.choices.length > 0
      ) {
        const content = response.data.choices[0].message.content;

        logger.info("Successfully received response from Grok AI", {
          contentLength: content.length,
          model: this.model,
        });

        return content;
      } else {
        logger.error("Unexpected response structure from Grok AI", {
          responseData: response.data,
        });
        throw new BadRequestError("Invalid response structure from Grok AI");
      }
    } catch (error) {
      if (error.response) {
        // API responded with error status
        logger.error("Grok AI API error response", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });

        switch (error.response.status) {
          case 400:
            throw new BadRequestError("Invalid request to Grok AI API");
          case 401:
            throw new BadRequestError("Invalid Grok AI API key");
          case 429:
            throw new BadRequestError("Rate limit exceeded for Grok AI API");
          case 500:
            throw new ServiceUnavailableError(
              "Grok AI service temporarily unavailable"
            );
          default:
            throw new ServiceUnavailableError(
              `Grok AI API error: ${error.response.status}`
            );
        }
      } else if (error.request) {
        // Request was made but no response received
        logger.error("No response received from Grok AI API", {
          error: error.message,
        });
        throw new ServiceUnavailableError("No response from Grok AI API");
      } else {
        // Something else happened
        logger.error("Error setting up Grok AI API request", {
          error: error.message,
        });
        throw new ServiceUnavailableError(
          "Failed to communicate with Grok AI API"
        );
      }
    }
  }

  /**
   * Get response with conversation context
   * @param {string} userMessage - Current user message
   * @param {Array} conversationHistory - Previous conversation messages
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - AI response content
   */
  async getConversationalResponse(
    userMessage,
    conversationHistory = [],
    options = {}
  ) {
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant. Always reply using plain text only — no Markdown, no asterisks, no bullet points, and no special formatting. Keep your responses under 1600 characters. Write clearly and directly.",
      },
      ...conversationHistory,
      {
        role: "user",
        content: userMessage,
      },
    ];

    return this.getResponse(messages, options);
  }

  /**
   * Test the Grok AI API connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    try {
      const testMessage = [
        {
          role: "user",
          content: "Hello, this is a test message.",
        },
      ];

      await this.getResponse(testMessage, { maxTokens: 10 });
      logger.info("Grok AI API connection test successful");
      return true;
    } catch (error) {
      logger.error("Grok AI API connection test failed", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get API usage statistics (if available)
   * @returns {Promise<Object>} - Usage statistics
   */
  async getUsageStats() {
    try {
      // This would depend on what Grok AI provides for usage tracking
      // For now, return basic info
      return {
        model: this.model,
        baseURL: this.baseURL,
        status: "operational",
      };
    } catch (error) {
      logger.error("Failed to get Grok AI usage stats", {
        error: error.message,
      });
      return { status: "unknown" };
    }
  }
}

module.exports = new GrokService();
