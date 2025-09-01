require("dotenv").config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/sms_engine",
  },

  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // AI API Configuration
  ai: {
    grok: {
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1/chat/completions",
      model: "grok-3-latest",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.openai.com/v1/audio/transcriptions",
      model: "whisper-1",
    },
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    currency: "usd",
  },

  // Application Configuration
  app: {
    freeSmsCredits: parseInt(process.env.FREE_SMS_CREDITS) || 9,
    maxSmsLength: parseInt(process.env.MAX_SMS_LENGTH) || 1600,
    paymentUrl: process.env.PAYMENT_URL || "https://payment.textile.fyi",
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
};

// Validation
const requiredFields = [
  "twilio.accountSid",
  "twilio.authToken",
  "twilio.phoneNumber",
  "ai.grok.apiKey",
  "ai.openai.apiKey",
  "stripe.secretKey",
];

requiredFields.forEach((field) => {
  const keys = field.split(".");
  let value = config;
  keys.forEach((key) => (value = value[key]));

  if (!value) {
    throw new Error(`Missing required configuration: ${field}`);
  }
});

module.exports = config;
