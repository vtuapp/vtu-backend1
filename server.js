// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Optional: const morgan = require("morgan");

dotenv.config();

// 🔒 Sanity checks
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing. Set it in your backend .env and in Render's Environment.");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is missing. Set it in your backend .env and in Render's Environment.");
  process.exit(1);
}

// DB
connectDB();

const app = express();
app.set("trust proxy", 1); // needed on Render/behind proxies

// --- CORS (open by default; restrict origin(s) if you like)
app.use(cors({ origin: true, credentials: true }));

// --- 1) Mount webhook BEFORE JSON parser (raw body needed for HMAC)
const payvesselWebhook = require("./routes/payvessel-webhook");
app.use("/api/payvessel", payvesselWebhook); // exposes POST /api/payvessel/webhook

// --- 2) Normal parsers for the rest
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Optional: request logging
// app.use(morgan("dev"));

// --- Health & root
app.get("/", (_req, res) => res.send("VTU Backend API is running..."));
app.get("/health", async (_req, res) => {
  const ready = !!(require("mongoose").connection.readyState === 1);
  return ready ? res.status(200).json({ ok: true }) : res.status(503).json({ ok: false });
});

// --- Routes
const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);

// PayVessel API routes (create/reuse virtual account, etc.)
const payvesselRoutes = require("./routes/payvessel");
app.use("/api/payvessel", payvesselRoutes);

// --- 404
app.use((req, res, _next) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// --- Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Server Error" });
});

// --- Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
