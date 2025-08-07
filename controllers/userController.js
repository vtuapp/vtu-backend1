const User = require("../models/user");
const bcrypt = require("bcryptjs");

// ✅ Register New User
const registerUser = async (req, res) => {
  try {
    const { name, username, email, phone, password } = req.body;

    // 🔎 Check if any field is missing
    if (!name || !username || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 🔁 Check if email or username already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: "User already exists." });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 💾 Save new user
    const newUser = new User({
      name,
      username,
      email,
      phone,
      password: hashedPassword,
    });

    await newUser.save();

    // ✅ Return success response
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { registerUser };
