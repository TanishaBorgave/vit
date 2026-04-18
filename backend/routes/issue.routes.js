const express = require("express");
const router = express.Router();
const issueController = require("../controllers/issue.controller");
const auth = require("../middleware/auth");

router.get("/", auth, issueController.getIssues);
router.get("/summary", auth, issueController.getIssueSummary);
router.patch("/:id/status", auth, issueController.updateIssueStatus);

module.exports = router;
