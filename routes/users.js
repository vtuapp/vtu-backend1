// routes/users.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user"); // keep lowercase if your file is models/user.js
const auth = require("../middleware/auth"); // JWT guard

// POST /api/users/register — hash password before saving
router.post("/register", async (req, res) => {
  try {
    const { name, username, email, phone, password } = req.body;

    if (!name || !username || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({ name, username, email, phone, password: hashed });
    await user.save();

    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("❌ Backend Error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/users/login — verify with bcrypt + issue JWT
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body; // can be email or username
    if (!username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // sign JWT
    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    return res.json({ user: userObj, token });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/me — verify token and return user (no password)
router.get("/me", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("-password");
    if (!me) return res.status(404).json({ message: "User not found" });
    res.json(me);
  } catch (err) {
    console.error("❌ /me error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
