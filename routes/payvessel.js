// routes/payvessel.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const User = require("../models/user");

// ⚠️ Path fix: lib lives at projectRoot/lib/payvessel.js (NOT src/lib/...)
const api = require("../lib/payvessel"); 

// Quick check the route is mounted:
router.get("/_ping", (_req, res) => res.json({ ok: true, at: "/api/payvessel" }));

// Create (or reuse) STATIC virtual accounts for the logged-in user
router.post("/virtual-account", auth, async (req, res) => {
  try {
    // Sanity: ensure provider creds exist so we don't 500 cryptically
    const missing = [];
    if (!process.env.PAYVESSEL_API_KEY) missing.push("PAYVESSEL_API_KEY");
    if (!process.env.PAYVESSEL_API_SECRET) missing.push("PAYVESSEL_API_SECRET");
    if (!process.env.PAYVESSEL_BUSINESS_ID) missing.push("PAYVESSEL_BUSINESS_ID");
    if (missing.length) {
      return res.status(500).json({ 
        ok: false, 
        message: `Missing provider env: ${missing.join(", ")}` 
      });
    }

    const me = await User.findById(req.user.id || req.user._id);
    if (!me) return res.status(404).json({ ok: false, message: "User not found" });

    // Reuse if already created
    if (me.payvessel?.staticAccounts?.length) {
      return res.json({ ok: true, accounts: me.payvessel.staticAccounts });
    }

    // STATIC requires BVN or NIN
    if (!me.bvn && !me.nin) {
      return res.status(400).json({ ok: false, message: "BVN or NIN required to create a STATIC account" });
    }

    // Prefer multiple banks for user choice; codes per PayVessel
    const body = {
      email: me.email,
      name: (me.name || me.username || "USER").toUpperCase(),
      phoneNumber: me.phone || "",
      bankcode: ["999991", "120001"], // PalmPay, 9PSB
      account_type: "STATIC",
      businessid: process.env.PAYVESSEL_BUSINESS_ID,
      ...(me.bvn ? { bvn: me.bvn } : {}),
      ...(me.nin ? { nin: me.nin } : {}),
    };

    const resp = await api.post("/pms/api/external/request/customerReservedAccount/", body);
    const accounts = (resp.data?.banks || []).map((b) => ({
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      accountName: b.accountName,
      account_type: b.account_type || "STATIC",
      trackingReference: b.trackingReference,
      provider: "payvessel",
    }));

    if (!accounts.length) {
      return res.status(502).json({ ok: false, message: "No accounts returned from provider", detail: resp.data });
    }

    me.payvessel = { staticAccounts: accounts, lastCreatedAt: new Date() };
    await me.save();

    return res.json({ ok: true, accounts });
  } catch (err) {
    console.error("Create VA error:", err?.response?.data || err.message);
    return res.status(err?.response?.status || 500).json({
      ok: false,
      message: "Failed to create virtual account",
      detail: err?.response?.data || err.message,
    });
  }
});

module.exports = router;
