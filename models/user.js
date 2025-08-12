const mongoose = require("mongoose");

const StaticAccountSchema = new mongoose.Schema({
  bankName: String,
  accountNumber: { type: String, index: true },
  accountName: String,
  account_type: String, // STATIC or DYNAMIC
  trackingReference: String,
  provider: { type: String, default: "payvessel" },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },

    // Wallet balance (same as your `wallet` but clearer naming)
    walletBalance: { type: Number, default: 0 },

    // Optional: keep your original name for backwards compatibility
    wallet: { type: Number, default: 0 },

    // PayVessel integration fields
    bvn: { type: String }, // Required for STATIC accounts
    nin: { type: String }, // Required for STATIC accounts
    payvessel: {
      staticAccounts: [StaticAccountSchema],
      lastCreatedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
