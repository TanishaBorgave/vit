const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const returnsController = require("../controllers/returns.controller");
const invoiceUploadController = require("../controllers/invoiceUpload.controller");

// ── PDF Invoice Upload (Phase 2) ──
router.post(
  "/upload-invoices",
  auth,
  invoiceUploadController.pdfUploadMiddleware,
  invoiceUploadController.uploadPDFInvoices
);

// Get Phase 2 invoices
router.get("/invoices", auth, invoiceUploadController.getInvoices);

// Edit an extracted invoice
router.put("/invoice/:id", auth, invoiceUploadController.updateInvoice);

// ── Return Summary & Validation ──
router.get("/summary", auth, returnsController.getReturnSummary);
router.post("/validate", auth, returnsController.validateReturn);

// ── Excel Generation ──
router.post("/generate-gstr1", auth, returnsController.generateGSTR1);
router.post("/generate-gstr3b", auth, returnsController.generateGSTR3B);

// ── Export Management ──
router.get("/exports", auth, returnsController.getExports);
router.get("/history", auth, returnsController.getReturnHistory);
router.get("/export/:id", auth, returnsController.downloadExport);
router.delete("/export/:id", auth, returnsController.deleteExport);

module.exports = router;
