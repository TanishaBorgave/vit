const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const vendorRiskController = require("../controllers/vendorRisk.controller");

// Run ML analysis pipeline
router.post("/analyze", auth, vendorRiskController.runAnalysis);

// Dashboard aggregated stats
router.get("/dashboard/stats", auth, vendorRiskController.getDashboardStats);

// Get all vendor risk profiles
router.get("/", auth, vendorRiskController.getAll);

// Get single vendor detail
router.get("/:gstin", auth, vendorRiskController.getVendorDetail);

module.exports = router;
