# SMS Engine - AI-Powered SMS Service

A production-ready, enterprise-grade SMS engine that integrates with Grok AI and OpenAI Whisper to provide intelligent SMS responses with audio transcription capabilities.

## 🚀 Features

- **AI-Powered Responses**: Integration with Grok AI for intelligent conversation handling
- **Audio Transcription**: OpenAI Whisper integration for voice-to-text conversion
- **Smart Routing**: Intelligent AI provider selection based on message characteristics
- **Credit Management**: User credit system with trial credits and Stripe payment integration
- **Payment Processing**: Secure Stripe integration for credit purchases
- **Multi-Modal Support**: Handle both text and audio messages seamlessly
- **Production Ready**: Comprehensive error handling, logging, and monitoring
- **Scalable Architecture**: Clean separation of concerns with service-oriented design

## 🏗️ Architecture

```
src/
├── app.js                 # Main Express application
├── config/               # Configuration management
│   └── index.js         # Centralized config with validation
├── controllers/          # Business logic controllers
│   ├── sms.controller.js # SMS handling logic
│   └── payment.controller.js # Payment handling logic
├── middleware/           # Express middleware
│   ├── errorHandler.js   # Global error handling
│   ├── rateLimit.js      # Rate limiting
│   └── validateInbound.js # Request validation
├── models/               # Mongoose data models
│   ├── User.js          # User and credit management
│   ├── Message.js       # SMS message storage
│   └── RemainingMessage.js # Long message handling
├── routes/               # API route definitions
│   ├── sms.routes.js    # SMS endpoints
│   └── payment.routes.js # Payment endpoints
├── services/             # Business logic services
│   ├── ai/              # AI service integrations
│   │   ├── grok.service.js      # Grok AI API
│   │   ├── openai.service.js    # OpenAI Whisper API
│   │   └── router.service.js    # Smart AI routing
│   ├── comms/           # Communication services
│   │   └── twilio.service.js    # Twilio SMS integration
│   ├── payment/         # Payment services
│   │   └── stripe.service.js    # Stripe payment integration
│   └── ingest/          # Data ingestion services
│       └── audioInbound.service.js # Audio processing
└── utils/                # Utility functions
    ├── httpError.js      # Custom HTTP error classes
    └── logger.js         # Winston logging configuration
```

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **AI Services**: Grok AI, OpenAI Whisper
- **SMS**: Twilio API
- **Payments**: Stripe API
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting
- **Error Handling**: Custom HTTP error classes

## 📋 Prerequisites

- Node.js 16+
- MongoDB 5+
- Twilio Account
- Grok AI API Key
- OpenAI API Key
- Stripe Secret Key

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd sms-engine
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/sms_engine

   # Twilio
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890

   # AI APIs
   GROK_API_KEY=your_grok_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```

# Stripe Configuration

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# App Configuration

PORT=3000
NODE_ENV=development
FREE_SMS_CREDITS=9
MAX_SMS_LENGTH=1600
PAYMENT_URL=https://payment.textile.fyi

````

4. **Start the application**

```bash
# Development
npm run dev

# Production
npm start
````

## 🔧 Configuration

### Environment Variables

| Variable                 | Description                 | Default                                |
| ------------------------ | --------------------------- | -------------------------------------- |
| `MONGODB_URI`            | MongoDB connection string   | `mongodb://localhost:27017/sms_engine` |
| `TWILIO_ACCOUNT_SID`     | Twilio Account SID          | Required                               |
| `TWILIO_AUTH_TOKEN`      | Twilio Auth Token           | Required                               |
| `TWILIO_PHONE_NUMBER`    | Twilio phone number         | Required                               |
| `GROK_API_KEY`           | Grok AI API key             | Required                               |
| `OPENAI_API_KEY`         | OpenAI API key              | Required                               |
| `STRIPE_SECRET_KEY`      | Stripe secret key           | Required                               |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key      | Required                               |
| `PORT`                   | Server port                 | `3000`                                 |
| `NODE_ENV`               | Environment                 | `development`                          |
| `FREE_SMS_CREDITS`       | Trial credits for new users | `9`                                    |
| `MAX_SMS_LENGTH`         | Maximum SMS length          | `1600`                                 |
| `PAYMENT_URL`            | Payment page URL            | Required                               |

## 📱 API Endpoints

### SMS Webhook

```
POST /api/sms/recieveSMS
```

Handles incoming SMS from Twilio webhook. Supports both text and audio messages.

**Request Body (Twilio webhook format):**

```json
{
  "From": "+1234567890",
  "Body": "Hello, how are you?",
  "MediaUrl0": "https://example.com/audio.wav",
  "MediaContentType0": "audio/wav"
}
```

**Response:** TwiML XML response

### Health Check

```
GET /health
```

Returns service health status.

### Service Status

```
GET /status
```

Returns AI service health and statistics.

### Payment Endpoints

#### Check Balance

```
POST /api/payment/checkBalance
```

Check user's current credit balance.

#### Process Payment

```
POST /api/payment/pay
```

Process Stripe payment and add credits to user account.

#### Payment Configuration

```
GET /api/payment/config
```

Get payment configuration for frontend integration.

#### Payment History

```
POST /api/payment/history
```

Get payment history for a user.

## 🔄 Message Flow

1. **Incoming SMS**: Twilio webhook sends SMS data
2. **Audio Processing**: If audio present, transcribe using OpenAI Whisper
3. **Message Validation**: Validate phone number and content
4. **User Management**: Check/create user and manage credits
5. **AI Processing**: Route message to appropriate AI service (Grok)
6. **Response Generation**: Generate AI response with conversation context
7. **Message Splitting**: Handle long responses with "MORE" functionality
8. **Notification**: Send welcome/low balance/excess usage messages
9. **Response**: Return TwiML response to Twilio

## 💰 Credit System

- **New Users**: Receive 9 trial credits
- **Credit Consumption**: 1 credit per SMS
- **Low Balance Warning**: At 10 credits remaining
- **Excess Usage**: At 2 credits remaining
- **Account Blocking**: At 0 credits

## 🎵 Audio Support

- **Supported Formats**: WAV, MP3, MP4, MPEG, MPGA, WebM, OGG
- **Maximum Size**: 25MB
- **Transcription**: OpenAI Whisper integration
- **Fallback**: Graceful handling of unsupported audio

## 🛡️ Security Features

- **Helmet**: Security headers and CSP
- **CORS**: Configurable cross-origin requests
- **Rate Limiting**: Per-phone number rate limiting
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses
- **Logging**: Structured logging without sensitive data exposure

## 📊 Monitoring & Logging

- **Structured Logging**: Winston with multiple transports
- **Request Tracking**: Unique request IDs
- **Performance Metrics**: Response times and error rates
- **Health Checks**: Service health monitoring
- **Error Tracking**: Comprehensive error logging

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "SMS Controller"
```

## 🚀 Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-Specific Configs

- **Development**: Full logging, CORS enabled
- **Production**: Minimal logging, CORS restricted, security headers

## 🔧 Development

### Code Style

- ES6+ features
- Async/await patterns
- Comprehensive error handling
- JSDoc documentation
- Consistent naming conventions

### Adding New Features

1. Create service in appropriate directory
2. Add controller method
3. Define routes
4. Add validation middleware
5. Update tests
6. Update documentation

## 📈 Performance Considerations

- **Database Indexing**: Optimized MongoDB queries
- **Connection Pooling**: Efficient database connections
- **Async Processing**: Non-blocking operations
- **Rate Limiting**: Prevent abuse
- **Response Caching**: AI response optimization

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**

   - Check MongoDB service status
   - Verify connection string
   - Check network connectivity

2. **Twilio Authentication Error**

   - Verify Account SID and Auth Token
   - Check account status
   - Verify webhook URL

3. **AI API Errors**
   - Check API key validity
   - Verify API quotas
   - Check network connectivity

### Debug Mode

```bash
NODE_ENV=development DEBUG=* npm run dev
```

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Ensure CI passes

## 📞 Support

For support and questions:

- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for scalable SMS solutions**
