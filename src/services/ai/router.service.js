const logger = require("../../utils/logger");
const grokService = require("./grok.service");
const openaiService = require("./openai.service");
const config = require("../../config");

class AIRouterService {
  constructor() {
    this.providers = {
      grok: grokService,
      openai: openaiService,
    };

    this.defaultProvider = "grok";
    this.fallbackProvider = "openai";
  }

  /**
   * Route message to appropriate AI service based on content analysis
   * @param {string} message - User message content
   * @param {Array} conversationHistory - Previous conversation context
   * @param {Object} options - Routing options
   * @returns {Promise<string>} - AI response
   */
  async routeMessage(message, conversationHistory = [], options = {}) {
    try {
      const provider = this.selectProvider(
        message,
        conversationHistory,
        options
      );

      logger.info("Routing message to AI provider", {
        provider,
        messageLength: message.length,
        historyLength: conversationHistory.length,
      });

      let response;

      switch (provider) {
        case "grok":
          response = await grokService.getConversationalResponse(
            message,
            conversationHistory,
            options
          );
          break;

        case "openai":
          throw new Error("OpenAI text processing not implemented yet");

        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }

      logger.info("AI response generated successfully", {
        provider,
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      logger.error("Primary AI provider failed, trying fallback", {
        error: error.message,
        fallbackProvider: this.fallbackProvider,
      });

      // Try fallback provider
      try {
        const fallbackResponse = await grokService.getConversationalResponse(
          message,
          conversationHistory,
          options
        );

        logger.info("Fallback AI provider succeeded", {
          provider: this.fallbackProvider,
          responseLength: fallbackResponse.length,
        });

        return fallbackResponse;
      } catch (fallbackError) {
        logger.error("All AI providers failed", {
          primaryError: error.message,
          fallbackError: fallbackError.message,
        });
        throw new Error("All AI services are currently unavailable");
      }
    }
  }

  /**
   * Select the best AI provider based on message characteristics
   * @param {string} message - User message
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} options - Additional options
   * @returns {string} - Selected provider name
   */
  selectProvider(message, conversationHistory, options) {
    // If provider is explicitly specified in options, use it
    if (options.provider && this.providers[options.provider]) {
      return options.provider;
    }

    // Analyze message characteristics
    const messageLength = message.length;
    const isComplex = this.isComplexMessage(message);
    const hasTechnicalTerms = this.hasTechnicalTerms(message);
    const conversationLength = conversationHistory.length;

    // Decision logic for provider selection
    if (isComplex || hasTechnicalTerms || conversationLength > 5) {
      // Use Grok for complex conversations or technical queries
      return "grok";
    }

    if (messageLength > 500) {
      // Use Grok for long messages
      return "grok";
    }

    // Default to Grok for most cases
    return this.defaultProvider;
  }

  /**
   * Determine if a message is complex
   * @param {string} message - Message to analyze
   * @returns {boolean} - True if message is complex
   */
  isComplexMessage(message) {
    const complexIndicators = [
      "explain",
      "how to",
      "what is",
      "why does",
      "analyze",
      "compare",
      "describe",
      "elaborate",
      "detailed",
      "comprehensive",
    ];

    const lowerMessage = message.toLowerCase();
    return complexIndicators.some((indicator) =>
      lowerMessage.includes(indicator)
    );
  }

  /**
   * Check if message contains technical terms
   * @param {string} message - Message to analyze
   * @returns {boolean} - True if message has technical terms
   */
  hasTechnicalTerms(message) {
    const technicalTerms = [
      "api",
      "database",
      "algorithm",
      "framework",
      "protocol",
      "architecture",
      "integration",
      "deployment",
      "optimization",
      "scalability",
    ];

    const lowerMessage = message.toLowerCase();
    return technicalTerms.some((term) => lowerMessage.includes(term));
  }

  /**
   * Get health status of all AI providers
   * @returns {Promise<Object>} - Health status of all providers
   */
  async getProviderHealth() {
    const health = {};

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        const isHealthy = await provider.testConnection();
        health[name] = {
          status: isHealthy ? "healthy" : "unhealthy",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        health[name] = {
          status: "error",
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return health;
  }

  /**
   * Get usage statistics from all providers
   * @returns {Promise<Object>} - Usage statistics
   */
  async getProviderStats() {
    const stats = {};

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        stats[name] = await provider.getUsageStats();
      } catch (error) {
        logger.error(`Failed to get stats for provider: ${name}`, {
          error: error.message,
        });
        stats[name] = { status: "error", error: error.message };
      }
    }

    return stats;
  }

  /**
   * Test all AI providers
   * @returns {Promise<Object>} - Test results
   */
  async testAllProviders() {
    const results = {};

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        results[name] = await provider.testConnection();
      } catch (error) {
        results[name] = false;
        logger.error(`Provider test failed: ${name}`, { error: error.message });
      }
    }

    return results;
  }
}

module.exports = new AIRouterService();
