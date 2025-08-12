const express = require("express");
const crypto = require("crypto");
const router = require("express").Router();
const Transaction = require("../models/Transaction");
const User = require("../models/user");

// Raw body needed for HMAC verification
router.use("/webhook", express.raw({ type: "*/*" }));

router.post("/webhook", async (req, res) => {
  try {
    const rawBody = req.body?.toString() || "";
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const signature = req.header("HTTP_PAYVESSEL_HTTP_SIGNATURE");
    const secret = process.env.PAYVESSEL_API_SECRET;

    // Optional: IP allowlist (depends on your hosting/proxy)
    const xff = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const remoteIp = xff || req.socket.remoteAddress || "";
    const allowed = (process.env.PAYVESSEL_TRUSTED_IPS || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(remoteIp)) {
      return res.status(400).json({ message: "Permission denied, invalid ip address." });
    }

    // HMAC SHA-512 check
    const digest = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    if (!signature || digest !== signature) {
      return res.status(400).json({ message: "Permission denied, invalid hash." });
    }

    // Extract useful fields (naming from PayVessel notifications)
    const reference = payload?.transaction?.reference;
    const amount = Number(payload?.order?.settlement_amount ?? payload?.order?.amount ?? 0);
    const accountNumber = payload?.transaction?.accountNumber;

    if (!reference) return res.status(400).json({ message: "Missing reference" });

    // Idempotency
    const existing = await Transaction.findOne({ reference });
    if (existing) return res.status(200).json({ message: "transaction already exist" });

    // Map accountNumber -> user
    const user = await User.findOne({ "payvessel.staticAccounts.accountNumber": accountNumber });
    if (!user) return res.status(404).json({ message: "User for account not found" });

    await Transaction.create({
      userId: user._id,
      reference,
      amount,
      status: "success",
      raw: payload,
    });

    user.walletBalance = (user.walletBalance || 0) + amount;
    await user.save();

    res.status(200).json({ message: "success" });
  } catch (e) {
    console.error("Webhook error:", e);
    res.status(500).json({ message: "server error" });
  }
});

module.exports = router;
