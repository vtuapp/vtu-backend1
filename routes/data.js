const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { purchaseData } = require("../services/dataGateway");
const DataPlan = require("../models/DataPlan");
const Transaction = require("../models/Transaction");
const User = require("../models/user");

// POST /api/data/purchase  (user must be logged in)
router.post("/purchase", auth, async (req, res) => {
  try {
    const { network, planId, phone } = req.body;
    if (!network || !planId || !phone) {
      return res.status(400).json({ ok: false, message: "network, planId, phone are required" });
    }

    const plan = await DataPlan.findById(planId);
    if (!plan) return res.status(404).json({ ok: false, message: "Plan not found" });
    if (!plan.isActive || !plan.gatewayStatus) {
      return res.status(400).json({ ok: false, message: "Plan unavailable" });
    }
    if (plan.network !== network) {
      return res.status(400).json({ ok: false, message: "Network mismatch for plan" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ ok: false, message: "User missing" });

    // Ensure funds available (we only deduct AFTER success, but block if not enough)
    if ((user.walletBalance || 0) < Number(plan.price)) {
      return res.status(400).json({ ok: false, message: "Insufficient wallet balance" });
    }

    // Create a unique reference/requestId
    const requestId = `DATA_${Date.now()}_${Math.floor(Math.random()*1e6)}`;

    // Create PENDING transaction first
    const tx = await Transaction.create({
      userId: user._id,
      reference: requestId,
      channel: "data_gateway",
      kind: "PURCHASE",
      service: "DATA",
      amount: Number(plan.price),
      status: "pending",
      network: plan.network,
      phone,
      planId: plan._id,
      gatewayName: plan.gatewayName || "DEFAULT",
      gatewayPlanId: plan.gatewayPlanId || "",
      requestId,
      walletBefore: Number(user.walletBalance || 0),
    });

    // Call gateway
    const gw = await purchaseData({
      network: plan.network,
      phone,
      gatewayPlanId: plan.gatewayPlanId,
      requestId,
    });

    // Decide success based on gateway response (adjust when you add real provider)
    const success = !!gw?.ok;

    tx.raw = gw;
    tx.status = success ? "success" : "failed";

    if (success) {
      user.walletBalance = Number(user.walletBalance || 0) - Number(plan.price);
      tx.walletAfter = user.walletBalance;
      await user.save();
    } else {
      tx.walletAfter = Number(user.walletBalance || 0);
    }

    await tx.save();
    return res.json({ ok: success, tx, message: success ? "Data purchase successful" : "Data purchase failed" });
  } catch (e) {
    console.error("purchase error:", e);
    return res.status(500).json({ ok: false, message: e.message || "Server error" });
  }
});

module.exports = router;
