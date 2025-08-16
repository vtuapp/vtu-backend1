// seedAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/admin");  // 👈 make sure this path is correct

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const username = process.env.SEED_ADMIN_USERNAME || "admin1";
    const password = process.env.SEED_ADMIN_PASSWORD || "StrongPass123";

    const exists = await Admin.findOne({ username });
    if (exists) {
      console.log("⚠️ Admin already exists:", username);
    } else {
      await Admin.create({ username, password });
      console.log("🎉 Admin created:", username);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
    process.exit(1);
  }
})();
