// routes/users.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Register Route
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

    const user = new User({ name, username, email, phone, password });
    await user.save();

    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("❌ Backend Error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
