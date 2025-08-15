// routes/users.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const auth = require("../middleware/auth");

/** helper: strip sensitive fields */
function sanitizeUser(doc) {
  const u = doc.toObject ? doc.toObject() : doc;
  delete u.password;
  delete u.__v;
  return u;
}

/** POST /api/users/register
 * Accepts EITHER:
 *  - New:  { name, username, email, phone, password, idType: "bvn"|"nin", idValue: "11digits" }
 *  - Legacy: { name, username, email, phone, password, bvn?, nin? }
 */
router.post("/register", async (req, res) => {
  try {
    let {
      name,
      username,
      email,
      phone,
      password,
      idType,
      idValue,
      bvn,  // legacy
      nin,  // legacy
    } = req.body || {};

    // Required basics
    if (!name || !username || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    // Normalize identity fields
    username = String(username).trim().toLowerCase();
    email = String(email).trim().toLowerCase();

    // Phone: numeric and exactly 11 digits
    const phoneDigits = String(phone).replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: "Phone number must be exactly 11 digits." });
    }

    // --- Determine BVN/NIN from new or legacy payloads
    let finalBVN = "";
    let finalNIN = "";

    if (typeof idType === "string" && typeof idValue === "string") {
      const type = idType.trim().toLowerCase();
      const value = idValue.replace(/\D/g, "");
      if (!["bvn", "nin"].includes(type)) {
        return res.status(400).json({ message: "idType must be either 'bvn' or 'nin'." });
      }
      if (value.length !== 11) {
        return res.status(400).json({ message: `${type.toUpperCase()} must be exactly 11 digits.` });
      }
      if (type === "bvn") finalBVN = value;
      if (type === "nin") finalNIN = value;
    } else {
      // Legacy support (if idType/idValue not sent)
      const bvnDigits = (bvn ?? "").toString().replace(/\D/g, "");
      const ninDigits = (nin ?? "").toString().replace(/\D/g, "");
      if (!bvnDigits && !ninDigits) {
        return res.status(400).json({ message: "You must provide either BVN or NIN." });
      }
      if (bvnDigits && bvnDigits.length !== 11) {
        return res.status(400).json({ message: "BVN must be exactly 11 digits." });
      }
      if (ninDigits && ninDigits.length !== 11) {
        return res.status(400).json({ message: "NIN must be exactly 11 digits." });
      }
      finalBVN = bvnDigits || "";
      finalNIN = ninDigits || "";
    }

    // Uniqueness checks (case-insensitive by storing lowercased)
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const msg =
        existing.email === email ? "Email is already registered." : "Username is already taken.";
      return res.status(409).json({ message: msg });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      username,
      email,
      phone: phoneDigits,
      password: hashed,            // store hash in "password"
      bvn: finalBVN || undefined,  // only one will be set
      nin: finalNIN || undefined,
    });

    // JWT
    const token = jwt.sign(
      { id: user._id.toString(), isAdmin: !!user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "User registered successfully.",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    if (err?.code === 11000) {
      // Duplicate key error from unique index
      const key = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({ message: `${key} already exists.` });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

/** POST /api/users/login
 * body: { username, password } // username can be email or username
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const handle = String(username).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ username: handle }, { email: handle }],
    });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id.toString(), isAdmin: !!user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** GET /api/users/me
 * auth required — returns fresh user
 */
router.get("/me", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id || req.user._id);
    if (!me) return res.status(404).json({ message: "User not found" });
    return res.json({ user: sanitizeUser(me) });
  } catch (err) {
    console.error("❌ /me error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** POST /api/users/kyc
 * auth required — body: { idType: "bvn" | "nin", idValue: "11digits" }
 * Saves the chosen ID to the user; used by Add Money when KYC missing.
 */
router.post("/kyc", auth, async (req, res) => {
  try {
    const { idType, idValue } = req.body || {};
    const type = String(idType || "").toLowerCase();
    const value = String(idValue || "").replace(/\D/g, "");

    if (!["bvn", "nin"].includes(type)) {
      return res.status(400).json({ message: "idType must be 'bvn' or 'nin'." });
    }
    if (value.length !== 11) {
      return res.status(400).json({ message: `${type.toUpperCase()} must be exactly 11 digits.` });
    }

    const user = await User.findById(req.user.id || req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (type === "bvn") user.bvn = value;
    else user.nin = value;

    await user.save();
    return res.json({ message: "KYC updated", user: sanitizeUser(user) });
  } catch (err) {
    console.error("❌ /kyc error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
