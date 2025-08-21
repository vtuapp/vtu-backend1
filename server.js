// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Routers
const userRoutes = require("./routes/users");
const payvesselRoutes = require("./routes/payvessel");
const payvesselWebhook = require("./routes/payvessel-webhook"); // raw body needed
const dataRoutes = require("./routes/data");
const adminRoutes = require("./routes/adminRoutes");            // e.g. /users, /transactions, /earnings, /data-plans
const adminDataPlans = require("./routes/admin-data-plans");    // if you keep data-plans in its own file

dotenv.config();

// --- Sanity checks
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing.");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is missing.");
  process.exit(1);
}

// --- DB
connectDB();

const app = express();
app.set("trust proxy", 1);

// --- CORS
app.use(cors({ origin: true, credentials: true }));

// --- 1) Mount webhook BEFORE JSON parser (raw body needed for HMAC)
app.use("/api/payvessel", payvesselWebhook); // e.g. POST /api/payvessel/webhook

// --- 2) Parsers (AFTER webhook)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Health & root
app.get("/", (_req, res) => res.send("VTU Backend API is running..."));
app.get("/health", (_req, res) => {
  const ready = require("mongoose").connection.readyState === 1;
  return ready ? res.status(200).json({ ok: true }) : res.status(503).json({ ok: false });
});

// --- App Routers (ALL before 404)
app.use("/api/users", userRoutes);
app.use("/api/payvessel", payvesselRoutes);      // normal PayVessel API (non-webhook)
app.use("/api/data", dataRoutes);

// Admin base router (contains /users, /transactions, /earnings, optionally /data-plans)
app.use("/api/admin", adminRoutes);

// If you split data-plans into its own file, mount it here.
// NOTE: choose ONE place for data-plans (either inside adminRoutes or this line)
app.use("/api/admin/data-plans", adminDataPlans);

// --- 404 handler (AFTER all routers)
app.use((req, res, _next) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// --- Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ message: err.message || "Server Error" });
});

// --- Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
