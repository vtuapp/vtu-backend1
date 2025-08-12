const router = require("express").Router();
const api = require("../src/payvessel");
const User = require("../models/user");
const auth = require("../middleware/auth");

// Create (or reuse) STATIC virtual accounts for the logged-in user
router.post("/virtual-account", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Reuse if already created
    if (user.payvessel?.staticAccounts?.length) {
      return res.json({ ok: true, accounts: user.payvessel.staticAccounts });
    }

    // STATIC requires BVN or NIN
    if (!user.bvn && !user.nin) {
      return res.status(400).json({ message: "BVN or NIN required to create a STATIC account" });
    }

    // Prefer multiple banks for user choice; codes per PayVessel
    const body = {
      email: user.email,
      name: (user.name || user.username || "USER").toUpperCase(),
      phoneNumber: user.phone || "",
      bankcode: ["999991", "120001"], // PalmPay, 9PSB
      account_type: "STATIC",
      businessid: process.env.PAYVESSEL_BUSINESS_ID,
      bvn: user.bvn || undefined,
      nin: user.nin || undefined,
    };

    const { data } = await api.post("/pms/api/external/request/customerReservedAccount/", body);

    // Expect an array of banks in the response
    const accounts = (data?.banks || []).map((b) => ({
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      accountName: b.accountName,
      account_type: b.account_type || "STATIC",
      trackingReference: b.trackingReference,
    }));

    if (!accounts.length) {
      return res.status(502).json({ ok: false, message: "No accounts returned from provider", detail: data });
    }

    user.payvessel = { staticAccounts: accounts, lastCreatedAt: new Date() };
    await user.save();

    res.json({ ok: true, accounts });
  } catch (err) {
    console.error("Create VA error:", err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({
      ok: false,
      message: "Failed to create virtual account",
      detail: err?.response?.data || err.message,
    });
  }
});

module.exports = router;
