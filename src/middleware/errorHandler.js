const logger = require("../utils/logger");
const { HttpError } = require("../utils/httpError");

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  let error = err;
  let statusCode = 500;
  let message = "Internal Server Error";
  let details = null;

  // Log the error
  logger.error("Unhandled error occurred", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Handle custom HTTP errors
  if (err instanceof HttpError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else {
    // Handle specific error types
    switch (err.name) {
      case "ValidationError":
        statusCode = 400;
        message = "Validation Error";
        details = err.message;
        break;

      case "CastError":
        statusCode = 400;
        message = "Invalid ID format";
        details = err.message;
        break;

      case "MongoError":
        if (err.code === 11000) {
          statusCode = 409;
          message = "Duplicate entry";
          details = "A record with this information already exists";
        } else {
          statusCode = 500;
          message = "Database Error";
          details = err.message;
        }
        break;

      case "SyntaxError":
        statusCode = 400;
        message = "Invalid JSON";
        details = err.message;
        break;

      case "MulterError":
        statusCode = 400;
        message = "File upload error";
        details = err.message;
        break;

      default:
        // For unknown errors, don't expose internal details in production
        if (process.env.NODE_ENV === "production") {
          message = "Something went wrong";
          details = null;
        } else {
          message = err.message;
          details = err.stack;
        }
    }
  }

  // Send error response
  const errorResponse = {
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    },
  };

  // Add details if available and in development
  if (details && process.env.NODE_ENV !== "production") {
    errorResponse.error.details = details;
  }

  // Add request ID if available
  if (req.id) {
    errorResponse.error.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for unmatched routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  logger.warn("Route not found", {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.status(404).json({
    error: {
      message: "Route not found",
      statusCode: 404,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    },
  });
}

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Wrapped function with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
