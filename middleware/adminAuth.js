const jwt = require("jsonwebtoken");
const Admin = require("../models/admin"); // your Admin model

module.exports = async function adminAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }
    // Optionally ensure the admin still exists
    const admin = await Admin.findById(decoded.id).select("_id username");
    if (!admin) return res.status(401).json({ ok: false, message: "Invalid admin" });

    req.admin = admin;
    next();
  } catch (e) {
    res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
};
