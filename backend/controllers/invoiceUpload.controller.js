const multer = require("multer");
const path = require("path");
const Upload = require("../models/Upload");
const Invoice = require("../models/Invoice");
const { parseMultiplePDFs } = require("../utils/pdfParser");
const {
  normalizeGSTIN,
  normalizeInvoiceNo,
  normalizeAmount,
} = require("../utils/normalizer");

// Multer config for PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const pdfFilter = (req, file, cb) => {
  if (
    file.mimetype === "application/pdf" ||
    file.originalname.match(/\.pdf$/i)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed for invoice upload"), false);
  }
};

exports.pdfUploadMiddleware = multer({
  storage,
  fileFilter: pdfFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
}).array("invoices", 50); // Up to 50 PDFs at once

/**
 * POST /returns/upload-invoices
 * Upload and parse PDF invoices for return preparation
 */
exports.uploadPDFInvoices = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No PDF files uploaded" });
    }

    const { invoiceType } = req.body; // "sales" or "purchase"
    if (!invoiceType || !["sales", "purchase"].includes(invoiceType)) {
      return res.status(400).json({
        message: "invoiceType is required (sales or purchase)",
      });
    }

    // Parse all PDFs
    const parseResults = await parseMultiplePDFs(req.files);

    const successfulInvoices = [];
    const failedFiles = [];
    const warnings = [];

    for (const result of parseResults) {
      if (!result.success) {
        failedFiles.push({
          fileName: result.fileName,
          error: result.error,
        });
        continue;
      }

      const data = result.data;

      // Check minimum extraction quality
      if (!data.invoiceNo && !data.gstin && data.taxableValue === 0) {
        failedFiles.push({
          fileName: result.fileName,
          error: "Could not extract any invoice data from PDF",
        });
        continue;
      }

      if (data.extractionConfidence === "LOW") {
        warnings.push({
          fileName: result.fileName,
          message: `Low confidence extraction - only found: ${data.extractedFields.join(", ")}`,
        });
      }

      // Create upload record
      const upload = await Upload.create({
        user: req.userId,
        fileName: path.basename(result.filePath),
        originalName: result.fileName,
        fileType: invoiceType,
        filePath: result.filePath,
        rowCount: 1,
        status: "processed",
        processedAt: new Date(),
      });

      // Create invoice record
      const invoice = {
        user: req.userId,
        upload: upload._id,
        gstin: normalizeGSTIN(data.gstin),
        partyName: data.partyName || "",
        invoiceNo: data.invoiceNo || result.fileName.replace(/\.pdf$/i, ""),
        invoiceNoNormalized: normalizeInvoiceNo(data.invoiceNo || result.fileName),
        invoiceDate: data.invoiceDate || new Date(),
        taxableValue: normalizeAmount(data.taxableValue),
        cgst: normalizeAmount(data.cgst),
        sgst: normalizeAmount(data.sgst),
        igst: normalizeAmount(data.igst),
        gstAmount: normalizeAmount(data.gstAmount),
        totalValue: normalizeAmount(data.totalValue),
        source: invoiceType,
        rawData: {
          extractionConfidence: data.extractionConfidence,
          extractedFields: data.extractedFields,
          pageCount: result.pageCount,
          sourceFile: result.fileName,
        },
      };

      const savedInvoice = await Invoice.create(invoice);

      successfulInvoices.push({
        _id: savedInvoice._id,
        uploadId: upload._id,
        fileName: result.fileName,
        invoiceNo: data.invoiceNo,
        gstin: data.gstin,
        partyName: data.partyName,
        taxableValue: data.taxableValue,
        gstAmount: data.gstAmount,
        totalValue: data.totalValue,
        confidence: data.extractionConfidence,
        extractedFields: data.extractedFields,
      });
    }

    res.status(201).json({
      message: `Processed ${req.files.length} PDF(s): ${successfulInvoices.length} successful, ${failedFiles.length} failed`,
      summary: {
        total: req.files.length,
        successful: successfulInvoices.length,
        failed: failedFiles.length,
        warnings: warnings.length,
      },
      invoices: successfulInvoices,
      failed: failedFiles,
      warnings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /returns/invoice/:id
 * Edit an extracted invoice (correct parsing errors)
 */
exports.updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const invoice = await Invoice.findOne({
      _id: id,
      user: req.userId,
      source: { $in: ["sales", "purchase"] },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Allowed update fields
    const allowedFields = [
      "gstin",
      "partyName",
      "invoiceNo",
      "invoiceDate",
      "taxableValue",
      "cgst",
      "sgst",
      "igst",
      "gstAmount",
      "totalValue",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === "gstin") {
          invoice.gstin = normalizeGSTIN(updates[field]);
        } else if (field === "invoiceNo") {
          invoice.invoiceNo = updates[field];
          invoice.invoiceNoNormalized = normalizeInvoiceNo(updates[field]);
        } else if (field === "invoiceDate") {
          invoice.invoiceDate = new Date(updates[field]);
        } else if (
          ["taxableValue", "cgst", "sgst", "igst", "gstAmount", "totalValue"].includes(field)
        ) {
          invoice[field] = normalizeAmount(updates[field]);
        } else {
          invoice[field] = updates[field];
        }
      }
    }

    await invoice.save();

    res.json({
      message: "Invoice updated successfully",
      invoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /returns/invoices
 * Get all Phase 2 invoices for the user
 */
exports.getInvoices = async (req, res, next) => {
  try {
    const { type, month, year } = req.query;
    const filter = {
      user: req.userId,
      source: { $in: ["sales", "purchase"] },
    };

    if (type) filter.source = type;

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      filter.invoiceDate = { $gte: startDate, $lte: endDate };
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ invoices });
  } catch (error) {
    next(error);
  }
};
