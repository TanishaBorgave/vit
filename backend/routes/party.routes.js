const express = require("express");
const router = express.Router();
const partyController = require("../controllers/party.controller");
const auth = require("../middleware/auth");

router.get("/", auth, partyController.getParties);
router.post("/:gstin/regenerate-email", auth, partyController.regenerateEmail);
router.get("/:gstin", auth, partyController.getPartyDetail);

module.exports = router;
