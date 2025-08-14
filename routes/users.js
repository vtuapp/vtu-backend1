// routes/users.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user"); // keep lowercase if your file is models/user.js
const auth = require("../middleware/auth"); // JWT guard

/** helper: strip sensitive fields */
function sanitizeUser(doc) {
  const u = doc.toObject ? doc.toObject() : doc;
  delete u.password;
  delete u.__v;
  return u;
}

/** POST /api/users/register
 * body: { name, username, email, phone, password, bvn?, nin? }
 * Rules: phone=11 digits; (bvn || nin) required; each if provided must be 11 digits
 */
router.post("/register", async (req, res) => {
  try {
    let { name, username, email, phone, password, bvn, nin } = req.body || {};

    if (!name || !username || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // normalize
    username = String(username).trim().toLowerCase();
    email = String(email).trim().toLowerCase();

    // numbers-only & exact length checks
    const phoneDigits = String(phone).replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: "Phone number must be exactly 11 digits." });
    }

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

    // uniqueness
    const existing = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (existing) {
      const msg =
        existing.email === email ? "Email is already registered." : "Username is already taken.";
      return res.status(409).json({ message: msg });
    }

    // password hash
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // create user
    const user = await User.create({
      name,
      username,
      email,
      phone: phoneDigits,
      password: hashed,
      bvn: bvnDigits || undefined,
      nin: ninDigits || undefined,
      // optional defaults if present in your schema:
      // walletBalance: 0,
      // payvessel: { staticAccounts: [], lastCreatedAt: null },
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
    if (err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({ message: `${key} already exists.` });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

/** POST /api/users/login
 * body: { username, password } // username can be username or email
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
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

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
 * auth required — returns fresh user (for dashboard refresh)
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

module.exports = router;
