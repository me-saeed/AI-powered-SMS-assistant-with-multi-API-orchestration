const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phNo: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      validate: {
        validator: function (v) {
          // Basic phone number validation
          return /^\+?[\d\s\-\(\)]+$/.test(v);
        },
        message: "Invalid phone number format",
      },
    },
    blance: {
      type: Number,
      required: true,
      min: [0, "Balance cannot be negative"],
      default: 0,
    },
    smsSent: {
      type: Number,
      required: true,
      min: [0, "SMS count cannot be negative"],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
userSchema.index({ phNo: 1 });
userSchema.index({ blance: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for remaining credits
userSchema.virtual("remainingCredits").get(function () {
  return Math.max(0, this.blance);
});

// Virtual for credit status
userSchema.virtual("creditStatus").get(function () {
  if (this.blance <= 0) return "exhausted";
  if (this.blance <= 2) return "low";
  if (this.blance <= 10) return "warning";
  return "good";
});

// Instance method to check if user can send SMS
userSchema.methods.canSendSMS = function () {
  return this.blance > 0 && this.isActive;
};

// Instance method to consume credits
userSchema.methods.consumeCredit = function () {
  if (this.blance > 0) {
    this.blance -= 1;
    this.smsSent += 1;
    this.lastActivity = new Date();
    return true;
  }
  return false;
};

// Instance method to add credits
userSchema.methods.addCredits = function (amount) {
  if (amount > 0) {
    this.blance += amount;
    this.updatedAt = new Date();
    return true;
  }
  return false;
};

// Static method to find or create user
userSchema.statics.findOrCreate = async function (
  phoneNumber,
  initialCredits = 0
) {
  let user = await this.findOne({ phNo: phoneNumber });

  if (!user) {
    user = await this.create({
      phNo: phoneNumber,
      blance: initialCredits,
      smsSent: 0,
    });
  }

  return user;
};

// Pre-save middleware to update timestamps
userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("User", userSchema);
