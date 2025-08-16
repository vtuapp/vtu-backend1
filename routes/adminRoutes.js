const express = require("express");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const router = express.Router();

const sign = (id) => jwt.sign({ id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

// TEMP: register one admin (disable after first use or protect with a SECRET)
router.post("/register", async (req, res) => {
  try {
    const { username, password, secret } = req.body;
    if (secret !== process.env.ADMIN_SETUP_SECRET) {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }
    const exists = await Admin.findOne({ username });
    if (exists) return res.status(400).json({ ok: false, message: "Admin exists" });

    const admin = await Admin.create({ username, password });
    res.json({ ok: true, admin: { id: admin._id, username: admin.username } });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

// LOGIN with username + password
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    const ok = await admin.matchPassword(password);
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    return res.json({
      ok: true,
      token: sign(admin._id),
      admin: { username: admin.username }
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
