const express = require("express");
const router = express.Router();
const reconciliationController = require("../controllers/reconciliation.controller");
const auth = require("../middleware/auth");

router.post("/run", auth, reconciliationController.runReconciliation);
router.get("/results", auth, reconciliationController.getResults);

module.exports = router;
