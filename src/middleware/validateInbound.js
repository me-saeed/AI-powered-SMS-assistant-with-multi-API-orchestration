const { BadRequestError } = require("../utils/httpError");
const logger = require("../utils/logger");

/**
 * Validate incoming SMS requests from Twilio
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateInbound(req, res, next) {
  try {
    // Check if request has required Twilio fields
    if (!req.body) {
      throw new BadRequestError("Request body is missing");
    }

    // Validate From field (phone number)
    if (!req.body.From) {
      throw new BadRequestError("From field is required");
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(req.body.From)) {
      throw new BadRequestError("Invalid phone number format");
    }

    // Check if request has either Body or MediaUrl0
    if (!req.body.Body && !req.body.MediaUrl0) {
      throw new BadRequestError(
        "Request must contain either text or audio content"
      );
    }

    // Validate Body length if present
    if (req.body.Body && req.body.Body.length > 1000) {
      throw new BadRequestError("Message body too long (max 1000 characters)");
    }

    // Validate MediaUrl0 if present
    if (req.body.MediaUrl0) {
      try {
        new URL(req.body.MediaUrl0);
      } catch (error) {
        throw new BadRequestError("Invalid media URL format");
      }
    }

    // Validate MediaContentType0 if present
    if (req.body.MediaUrl0 && !req.body.MediaContentType0) {
      logger.warn("Media URL present but no content type specified", {
        from: req.body.From,
        mediaUrl: req.body.MediaUrl0,
      });
    }

    logger.debug("Inbound SMS validation passed", {
      from: req.body.From,
      hasBody: !!req.body.Body,
      hasMedia: !!req.body.MediaUrl0,
      mediaType: req.body.MediaContentType0,
    });

    next();
  } catch (error) {
    logger.warn("Inbound SMS validation failed", {
      error: error.message,
      from: req.body?.From || "unknown",
      body: req.body,
    });

    if (error instanceof BadRequestError) {
      return res.status(400).json({
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    // For unexpected errors, return 500
    logger.error("Unexpected error in inbound validation", {
      error: error.message,
    });
    return res.status(500).json({
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = { validateInbound };
