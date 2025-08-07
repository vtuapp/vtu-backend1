const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
// const morgan = require("morgan"); // Optional: for logging

// Load .env variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// app.use(morgan("dev")); // Optional: logs incoming requests

// Root route
app.get("/", (req, res) => {
  res.send("VTU Backend API is running...");
});

// Routes
const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);

// ❗ Future error handling middleware placeholder
// app.use((err, req, res, next) => {
//   res.status(err.status || 500).json({ message: err.message || "Server Error" });
// });

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
