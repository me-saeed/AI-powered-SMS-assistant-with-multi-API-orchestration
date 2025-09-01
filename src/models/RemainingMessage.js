const mongoose = require("mongoose");

const remainingMessageSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Remaining content is required"],
      trim: true,
    },
    originalMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      index: true,
    },
    messageIndex: {
      type: Number,
      default: 1,
    },
    totalParts: {
      type: Number,
      default: 1,
    },
    expiresAt: {
      type: Date,
      default: function () {
        // Messages expire after 24 hours
        return new Date(Date.now() + 24 * 60 * 60 * 1000);
      },
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient querying
remainingMessageSchema.index({ phone: 1, createdAt: -1 });
remainingMessageSchema.index({ phone: 1, expiresAt: 1 });

// Virtual for checking if message has expired
remainingMessageSchema.virtual("isExpired").get(function () {
  return Date.now() > this.expiresAt.getTime();
});

// Virtual for time until expiration
remainingMessageSchema.virtual("timeUntilExpiration").get(function () {
  return Math.max(0, this.expiresAt.getTime() - Date.now());
});

// Static method to get latest remaining message for a user
remainingMessageSchema.statics.getLatestRemainingMessage = async function (
  phoneNumber
) {
  return this.findOne({
    phone: phoneNumber,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

// Static method to get all remaining messages for a user
remainingMessageSchema.statics.getUserRemainingMessages = async function (
  phoneNumber
) {
  return this.find({
    phone: phoneNumber,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

// Static method to clean up expired messages
remainingMessageSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to create remaining message with proper indexing
remainingMessageSchema.statics.createRemainingMessage = async function (
  phoneNumber,
  content,
  originalMessageId = null
) {
  // Get the latest message index for this user
  const latestMessage = await this.findOne({ phone: phoneNumber }).sort({
    messageIndex: -1,
  });

  const messageIndex = latestMessage ? latestMessage.messageIndex + 1 : 1;

  return this.create({
    phone: phoneNumber,
    content,
    originalMessageId,
    messageIndex,
    totalParts: messageIndex,
  });
};

// Instance method to check if message is still valid
remainingMessageSchema.methods.isValid = function () {
  return !this.isExpired;
};

// Pre-save middleware to ensure content is not empty
remainingMessageSchema.pre("save", function (next) {
  if (!this.content || this.content.trim().length === 0) {
    next(new Error("Remaining message content cannot be empty"));
  }
  next();
});

// Pre-save middleware to update total parts if needed
remainingMessageSchema.pre("save", function (next) {
  if (this.messageIndex > this.totalParts) {
    this.totalParts = this.messageIndex;
  }
  next();
});

module.exports = mongoose.model("RemainingMessage", remainingMessageSchema);
