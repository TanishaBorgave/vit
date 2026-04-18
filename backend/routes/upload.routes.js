const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/upload.controller");
const auth = require("../middleware/auth");

router.post(
  "/",
  auth,
  uploadController.uploadMiddleware,
  uploadController.uploadFile
);
router.get("/", auth, uploadController.getUploads);
router.delete("/:id", auth, uploadController.deleteUpload);

module.exports = router;
