const mongoose = require("mongoose");

const TxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  reference: { type: String, unique: true, index: true },
  channel: { type: String, default: "payvessel_va" },
  amount: { type: Number, default: 0 },
  status: { type: String, enum: ["pending","success","failed"], default: "success" },
  raw: Object,
}, { timestamps: true });

module.exports = mongoose.model("Transaction", TxSchema);
