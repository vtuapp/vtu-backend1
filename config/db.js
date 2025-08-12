// db.js
const mongoose = require("mongoose");

mongoose.set("strictQuery", true);

const {
  MONGO_URI,
  MONGO_MAX_RETRIES = "0",     // 0 = retry forever
  MONGO_RETRY_MS = "3000",     // initial delay between retries (ms)
  MONGO_RETRY_MAX_MS = "30000" // cap for backoff (ms)
} = process.env;

let attempts = 0;
let currentDelay = parseInt(MONGO_RETRY_MS, 10);
const maxDelay = parseInt(MONGO_RETRY_MAX_MS, 10);
const maxRetries = parseInt(MONGO_MAX_RETRIES, 10);

async function connectOnce() {
  // Keep options minimal and modern; driver handles most defaults well
  return mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000, // fail fast if cluster not reachable
    maxPoolSize: 10,                 // good default for lightweight apps
    // socketTimeoutMS: 45000,       // uncomment if you see socket timeouts
  });
}

async function connectWithRetry() {
  try {
    const conn = await connectOnce();
    attempts = 0;            // reset attempts on success
    currentDelay = parseInt(MONGO_RETRY_MS, 10); // reset backoff
    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    attempts += 1;
    const canRetry = maxRetries === 0 || attempts <= maxRetries;

    console.error("❌ MongoDB connection failed:", err.message);
    if (!canRetry) {
      console.error(`🚫 Max retries reached (${attempts - 1}). Exiting.`);
      process.exit(1);
    }

    console.warn(`⏳ Retry #${attempts} in ${currentDelay}ms...`);
    await new Promise((r) => setTimeout(r, currentDelay));
    // Exponential backoff with cap
    currentDelay = Math.min(currentDelay * 2, maxDelay);
    return connectWithRetry();
  }
}

function attachConnectionEvents() {
  const conn = mongoose.connection;

  conn.on("connected", () => {
    console.log("🟢 Mongoose event: connected");
  });

  conn.on("reconnected", () => {
    console.log("🔄 Mongoose event: reconnected");
  });

  conn.on("disconnected", () => {
    console.warn("🟠 Mongoose event: disconnected — retrying…");
    // Kick off a retry loop if we get dropped unexpectedly
    connectWithRetry().catch(() => {}); // suppress unhandled
  });

  conn.on("error", (err) => {
    console.error("🔴 Mongoose event: error:", err.message);
  });
}

function handleGracefulShutdown() {
  const shutdown = (signal) => {
    return async () => {
      try {
        console.log(`⚙️  Received ${signal}. Closing MongoDB connection...`);
        await mongoose.connection.close();
        console.log("👋 MongoDB connection closed. Exiting.");
        process.exit(0);
      } catch (e) {
        console.error("Error during shutdown:", e);
        process.exit(1);
      }
    };
  };
  process.on("SIGINT", shutdown("SIGINT"));
  process.on("SIGTERM", shutdown("SIGTERM"));
}

const connectDB = async () => {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI is not set in environment variables.");
    process.exit(1);
  }

  attachConnectionEvents();
  handleGracefulShutdown();
  await connectWithRetry();
};

module.exports = connectDB;
