const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      index: true,
    },
    role: {
      type: String,
      required: [true, "Message role is required"],
      enum: {
        values: ["user", "assistant", "system"],
        message: "Role must be either user, assistant, or system",
      },
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [2000, "Message content cannot exceed 2000 characters"],
    },
    messageType: {
      type: String,
      enum: ["text", "audio", "image"],
      default: "text",
    },
    metadata: {
      twilioSid: String,
      audioUrl: String,
      transcription: String,
      processingTime: Number,
      tokensUsed: Number,
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

// Compound index for efficient querying of conversation history
messageSchema.index({ phone: 1, createdAt: -1 });
messageSchema.index({ phone: 1, role: 1, createdAt: -1 });

// Virtual for message age
messageSchema.virtual("age").get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for message length
messageSchema.virtual("contentLength").get(function () {
  return this.content ? this.content.length : 0;
});

// Static method to get conversation history
messageSchema.statics.getConversationHistory = async function (
  phoneNumber,
  limit = 10
) {
  return this.find({ phone: phoneNumber })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("role content createdAt")
    .lean();
};

// Static method to get recent messages
messageSchema.statics.getRecentMessages = async function (
  phoneNumber,
  limit = 10
) {
  return this.find({ phone: phoneNumber })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("role content createdAt")
    .lean();
};

// Static method to delete user messages
messageSchema.statics.deleteUserMessages = async function (phoneNumber) {
  return this.deleteMany({ phone: phoneNumber });
};

// Instance method to check if message is recent
messageSchema.methods.isRecent = function (minutes = 60) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return this.createdAt > cutoff;
};

// Pre-save middleware to validate content length
messageSchema.pre("save", function (next) {
  if (this.content && this.content.length > 2000) {
    next(new Error("Message content exceeds maximum length"));
  }
  next();
});

module.exports = mongoose.model("Message", messageSchema);
