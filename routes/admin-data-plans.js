const express = require("express");
const DataPlan = require("../models/DataPlan");
const adminAuth = require("../middleware/adminAuth");
const router = express.Router();

// All routes require admin
router.use(adminAuth);

// CREATE
router.post("/", async (req, res) => {
  try {
    const plan = await DataPlan.create(req.body);
    res.json({ ok: true, plan });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// READ (list, filterable)
router.get("/", async (req, res) => {
  try {
    const { network, isActive, dataType, planType, q } = req.query;
    const filter = {};
    if (network) filter.network = network;
    if (typeof isActive !== "undefined") filter.isActive = isActive === "true";
    if (dataType) filter.dataType = dataType;
    if (planType) filter.planType = planType;
    if (q) filter.$or = [
      { planName: new RegExp(q, "i") },
      { dataSizeLabel: new RegExp(q, "i") },
      { gatewayPlanId: new RegExp(q, "i") }
    ];

    const plans = await DataPlan.find(filter).sort({ network: 1, price: 1 });
    res.json({ ok: true, plans });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// READ one
router.get("/:id", async (req, res) => {
  try {
    const plan = await DataPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, plan });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// UPDATE
router.patch("/:id", async (req, res) => {
  try {
    const plan = await DataPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, plan });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const plan = await DataPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

module.exports = router;
