class HttpError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Predefined error types
class BadRequestError extends HttpError {
  constructor(message = "Bad Request", details = null) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", details = null) {
    super(message, 401, details);
  }
}

class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", details = null) {
    super(message, 403, details);
  }
}

class NotFoundError extends HttpError {
  constructor(message = "Not Found", details = null) {
    super(message, 404, details);
  }
}

class TooManyRequestsError extends HttpError {
  constructor(message = "Too Many Requests", details = null) {
    super(message, 429, details);
  }
}

class InternalServerError extends HttpError {
  constructor(message = "Internal Server Error", details = null) {
    super(message, 500, details);
  }
}

class ServiceUnavailableError extends HttpError {
  constructor(message = "Service Unavailable", details = null) {
    super(message, 503, details);
  }
}

module.exports = {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
};
