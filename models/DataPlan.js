const mongoose = require("mongoose");

const DataPlanSchema = new mongoose.Schema(
  {
    network: { type: String, enum: ["MTN", "AIRTEL", "GLO", "9MOBILE"], required: true },
    planName: { type: String, required: true },            // e.g. "1.5GB Daily"
    dataSizeLabel: { type: String, required: true },       // e.g. "1.5GB"
    price: { type: Number, required: true },               // NGN
    validityDays: { type: Number, required: true },        // e.g. 1, 7, 30
    dataType: { type: String, enum: ["SME", "CORPORATE", "GIFTING"], required: true },
    planType: { type: String, enum: ["DAILY", "WEEKLY", "MONTHLY", "3MONTHS", "6MONTHS", "YEARLY"], required: true },

    // Gateway mapping (for your vendor API)
    gatewayName: { type: String, default: "" },
    gatewayPlanId: { type: String, default: "" },
    gatewayStatus: { type: Boolean, default: true }, // can this plan be sent to gateway?

    // Admin controls
    isActive: { type: Boolean, default: true },

    // Optional extras
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

// helpful unique-ish index to avoid duplicates
DataPlanSchema.index({ network: 1, planName: 1, dataType: 1 }, { unique: true });

module.exports = mongoose.model("DataPlan", DataPlanSchema);
