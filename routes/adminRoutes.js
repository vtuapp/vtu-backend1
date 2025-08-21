// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const authAdmin = require("../middleware/adminAuth"); // if you have one

// Admin auth endpoints
router.post("/register", /* ... */);
router.post("/login",    /* ... */);

// Admin API
router.get("/users",       authAdmin, /* ... */);
router.get("/transactions",authAdmin, /* ... */);
router.get("/earnings",    authAdmin, /* use req.query.date */);

// Option A: put data-plans here (then remove separate admin-data-plans mount)
// router.get("/data-plans", authAdmin, /* ... */);
// router.post("/data-plans", authAdmin, /* ... */);
// router.patch("/data-plans/:id", authAdmin, /* ... */);
// router.delete("/data-plans/:id", authAdmin, /* ... */);

module.exports = router;
