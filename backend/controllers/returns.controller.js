const path = require("path");
const fs = require("fs");
const Invoice = require("../models/Invoice");
const ReconciliationResult = require("../models/ReconciliationResult");
const Return = require("../models/Return");
const Export = require("../models/Export");
const { validateInvoices } = require("../utils/validator");
const { generateGSTR1Excel, classifyInvoices } = require("../utils/gstr1Generator");
const { computeGSTR3BSummary, generateGSTR3BExcel } = require("../utils/gstr3bGenerator");

const EXPORT_DIR = path.join(__dirname, "../uploads/exports");

/**
 * GET /returns/summary
 * Get return summary for a given period
 */
exports.getReturnSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const userId = req.userId;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const periodMonth = parseInt(month);
    const periodYear = parseInt(year);

    // Get date range for the period
    const startDate = new Date(periodYear, periodMonth - 1, 1);
    const endDate = new Date(periodYear, periodMonth, 0, 23, 59, 59);

    // Fetch invoices for the period
    const allInvoices = await Invoice.find({
      user: userId,
      invoiceDate: { $gte: startDate, $lte: endDate },
    }).lean();

    const salesInvoices = allInvoices.filter(
      (inv) => inv.source === "books" || inv.source === "sales"
    );
    const purchaseInvoices = allInvoices.filter(
      (inv) => inv.source === "gstr2b" || inv.source === "gstr1" || inv.source === "purchase"
    );

    // Classify for GSTR-1
    const { b2b, b2c, cdn } = classifyInvoices(salesInvoices);

    // Get reconciliation results
    const reconResults = await ReconciliationResult.find({
      user: userId,
    }).lean();

    // Compute GSTR-3B summary
    const gstr3bSummary = computeGSTR3BSummary(
      salesInvoices,
      purchaseInvoices,
      reconResults
    );

    // Validate invoices
    const salesValidation = validateInvoices(salesInvoices, periodMonth, periodYear);
    const purchaseValidation = validateInvoices(purchaseInvoices, periodMonth, periodYear);

    // Check for existing returns
    const existingReturns = await Return.find({
      user: userId,
      "period.month": periodMonth,
      "period.year": periodYear,
    }).lean();

    // Get existing exports
    const existingExports = await Export.find({
      user: userId,
      "period.month": periodMonth,
      "period.year": periodYear,
      status: "READY",
    })
      .sort({ createdAt: -1 })
      .lean();

    // Compute totals
    const totalCgst = salesInvoices.reduce((sum, inv) => sum + (inv.cgst || 0), 0);
    const totalSgst = salesInvoices.reduce((sum, inv) => sum + (inv.sgst || 0), 0);
    const totalIgst = salesInvoices.reduce((sum, inv) => sum + (inv.igst || 0), 0);
    const totalTaxableValue = salesInvoices.reduce(
      (sum, inv) => sum + (inv.taxableValue || 0),
      0
    );
    const totalGst = salesInvoices.reduce(
      (sum, inv) => sum + (inv.gstAmount || 0),
      0
    );
    const totalInvoiceValue = salesInvoices.reduce(
      (sum, inv) => sum + (inv.totalValue || 0),
      0
    );

    res.json({
      period: { month: periodMonth, year: periodYear },
      invoiceCounts: {
        total: allInvoices.length,
        sales: salesInvoices.length,
        purchases: purchaseInvoices.length,
      },
      gstr1: {
        totalInvoices: salesInvoices.length,
        b2bCount: b2b.length,
        b2cCount: b2c.length,
        cdnCount: cdn.length,
        totalTaxableValue: Math.round(totalTaxableValue * 100) / 100,
        totalCgst: Math.round(totalCgst * 100) / 100,
        totalSgst: Math.round(totalSgst * 100) / 100,
        totalIgst: Math.round(totalIgst * 100) / 100,
        totalGst: Math.round(totalGst * 100) / 100,
        totalInvoiceValue: Math.round(totalInvoiceValue * 100) / 100,
      },
      gstr3b: gstr3bSummary,
      validation: {
        sales: {
          totalErrors: salesValidation.totalErrors,
          totalWarnings: salesValidation.totalWarnings,
          errors: salesValidation.errors.slice(0, 50), // Limit for response size
        },
        purchases: {
          totalErrors: purchaseValidation.totalErrors,
          totalWarnings: purchaseValidation.totalWarnings,
          errors: purchaseValidation.errors.slice(0, 50),
        },
      },
      reconciliation: {
        totalResults: reconResults.length,
        matched: reconResults.filter((r) => r.status === "MATCHED").length,
        mismatched: reconResults.filter((r) => r.status === "MISMATCH").length,
        missingIn2B: reconResults.filter((r) => r.status === "MISSING_IN_2B").length,
        missingInBooks: reconResults.filter((r) => r.status === "MISSING_IN_BOOKS").length,
        totalItcAtRisk: reconResults.reduce((sum, r) => sum + (r.itcAtRisk || 0), 0),
      },
      existingReturns,
      existingExports: existingExports.map((exp) => ({
        _id: exp._id,
        exportType: exp.exportType,
        fileName: exp.fileName,
        fileSize: exp.fileSize,
        invoiceCount: exp.invoiceCount,
        downloadCount: exp.downloadCount,
        version: exp.version,
        createdAt: exp.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /returns/validate
 * Run validation on invoices for a period
 */
exports.validateReturn = async (req, res, next) => {
  try {
    const { month, year, returnType } = req.body;
    const userId = req.userId;

    if (!month || !year || !returnType) {
      return res.status(400).json({
        message: "Month, year, and returnType are required",
      });
    }

    const periodMonth = parseInt(month);
    const periodYear = parseInt(year);

    const startDate = new Date(periodYear, periodMonth - 1, 1);
    const endDate = new Date(periodYear, periodMonth, 0, 23, 59, 59);

    let invoices;
    if (returnType === "GSTR1") {
      invoices = await Invoice.find({
        user: userId,
        source: { $in: ["books", "sales"] },
        invoiceDate: { $gte: startDate, $lte: endDate },
      }).lean();
    } else {
      invoices = await Invoice.find({
        user: userId,
        invoiceDate: { $gte: startDate, $lte: endDate },
      }).lean();
    }

    const validation = validateInvoices(invoices, periodMonth, periodYear);

    // Upsert return record
    const returnDoc = await Return.findOneAndUpdate(
      {
        user: userId,
        "period.month": periodMonth,
        "period.year": periodYear,
        returnType,
      },
      {
        user: userId,
        period: { month: periodMonth, year: periodYear },
        returnType,
        status: validation.totalErrors > 0 ? "DRAFT" : "VALIDATED",
        validation: {
          totalErrors: validation.totalErrors,
          totalWarnings: validation.totalWarnings,
          errors: validation.errors,
        },
        invoiceIds: invoices.map((inv) => inv._id),
      },
      { upsert: true, new: true }
    );

    res.json({
      returnId: returnDoc._id,
      status: returnDoc.status,
      validation: {
        totalErrors: validation.totalErrors,
        totalWarnings: validation.totalWarnings,
        errors: validation.errors,
        canExport: validation.totalErrors === 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /returns/generate-gstr1
 * Generate GSTR-1 Excel file
 */
exports.generateGSTR1 = async (req, res, next) => {
  try {
    const { month, year, forceExport } = req.body;
    const userId = req.userId;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const periodMonth = parseInt(month);
    const periodYear = parseInt(year);

    const startDate = new Date(periodYear, periodMonth - 1, 1);
    const endDate = new Date(periodYear, periodMonth, 0, 23, 59, 59);

    // Fetch sales invoices for the period (Phase 1: "books", Phase 2: "sales")
    const salesInvoices = await Invoice.find({
      user: userId,
      source: { $in: ["books", "sales"] },
      invoiceDate: { $gte: startDate, $lte: endDate },
    }).lean();

    if (salesInvoices.length === 0) {
      return res.status(400).json({
        message: "No sales invoices found for the selected period",
      });
    }

    // Validate before export
    const validation = validateInvoices(salesInvoices, periodMonth, periodYear);
    if (validation.totalErrors > 0 && !forceExport) {
      return res.status(400).json({
        message: `${validation.totalErrors} critical error(s) found. Fix errors before exporting or set forceExport=true.`,
        validation: {
          totalErrors: validation.totalErrors,
          totalWarnings: validation.totalWarnings,
          errors: validation.errors.filter((e) => e.severity === "ERROR"),
        },
      });
    }

    // Check reconciliation status
    const reconResults = await ReconciliationResult.find({ user: userId }).lean();
    const unresolvedMismatches = reconResults.filter(
      (r) => r.status === "MISMATCH" || r.status === "MISSING_IN_2B"
    );

    // Generate Excel
    const result = await generateGSTR1Excel(
      salesInvoices,
      { month: periodMonth, year: periodYear },
      req.user?.gstin || "",
      EXPORT_DIR
    );

    // Get version number
    const prevExports = await Export.countDocuments({
      user: userId,
      exportType: "GSTR1_EXCEL",
      "period.month": periodMonth,
      "period.year": periodYear,
    });

    // Save return record
    const returnDoc = await Return.findOneAndUpdate(
      {
        user: userId,
        "period.month": periodMonth,
        "period.year": periodYear,
        returnType: "GSTR1",
      },
      {
        user: userId,
        period: { month: periodMonth, year: periodYear },
        returnType: "GSTR1",
        status: "EXPORTED",
        summary: {
          totalInvoices: salesInvoices.length,
          totalTaxableValue: salesInvoices.reduce(
            (sum, inv) => sum + (inv.taxableValue || 0),
            0
          ),
          totalCgst: salesInvoices.reduce((sum, inv) => sum + (inv.cgst || 0), 0),
          totalSgst: salesInvoices.reduce((sum, inv) => sum + (inv.sgst || 0), 0),
          totalIgst: salesInvoices.reduce((sum, inv) => sum + (inv.igst || 0), 0),
          totalGst: salesInvoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0),
          b2bCount: result.breakdown.b2b,
          b2cCount: result.breakdown.b2c,
          cdnCount: result.breakdown.cdn,
        },
        validation: {
          totalErrors: validation.totalErrors,
          totalWarnings: validation.totalWarnings,
          errors: validation.errors,
        },
        invoiceIds: salesInvoices.map((inv) => inv._id),
      },
      { upsert: true, new: true }
    );

    // Save export record
    const exportRecord = await Export.create({
      user: userId,
      return: returnDoc._id,
      exportType: "GSTR1_EXCEL",
      period: { month: periodMonth, year: periodYear },
      fileName: result.fileName,
      filePath: result.filePath,
      fileSize: result.fileSize,
      invoiceCount: result.invoiceCount,
      version: prevExports + 1,
      status: "READY",
    });

    res.json({
      message: "GSTR-1 Excel generated successfully",
      export: {
        _id: exportRecord._id,
        fileName: result.fileName,
        fileSize: result.fileSize,
        invoiceCount: result.invoiceCount,
        breakdown: result.breakdown,
        version: exportRecord.version,
      },
      warnings: validation.totalWarnings,
      unresolvedMismatches: unresolvedMismatches.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /returns/generate-gstr3b
 * Generate GSTR-3B summary Excel
 */
exports.generateGSTR3B = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const userId = req.userId;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const periodMonth = parseInt(month);
    const periodYear = parseInt(year);

    const startDate = new Date(periodYear, periodMonth - 1, 1);
    const endDate = new Date(periodYear, periodMonth, 0, 23, 59, 59);

    // Fetch all invoices
    const allInvoices = await Invoice.find({
      user: userId,
      invoiceDate: { $gte: startDate, $lte: endDate },
    }).lean();

    const salesInvoices = allInvoices.filter(
      (inv) => inv.source === "books" || inv.source === "sales"
    );
    const purchaseInvoices = allInvoices.filter(
      (inv) => inv.source === "gstr2b" || inv.source === "gstr1" || inv.source === "purchase"
    );

    if (salesInvoices.length === 0 && purchaseInvoices.length === 0) {
      return res.status(400).json({
        message: "No invoices found for the selected period",
      });
    }

    // Get reconciliation results
    const reconResults = await ReconciliationResult.find({
      user: userId,
    }).lean();

    // Compute summary
    const summary = computeGSTR3BSummary(
      salesInvoices,
      purchaseInvoices,
      reconResults
    );

    // Generate Excel
    const result = await generateGSTR3BExcel(
      summary,
      { month: periodMonth, year: periodYear },
      EXPORT_DIR
    );

    // Get version number
    const prevExports = await Export.countDocuments({
      user: userId,
      exportType: "GSTR3B_EXCEL",
      "period.month": periodMonth,
      "period.year": periodYear,
    });

    // Save return record
    const returnDoc = await Return.findOneAndUpdate(
      {
        user: userId,
        "period.month": periodMonth,
        "period.year": periodYear,
        returnType: "GSTR3B",
      },
      {
        user: userId,
        period: { month: periodMonth, year: periodYear },
        returnType: "GSTR3B",
        status: "EXPORTED",
        summary: {
          totalInvoices: allInvoices.length,
          outputTaxLiability: summary.totalOutputTax,
          itcAvailable: summary.totalITC,
          netTaxPayable: summary.netPayable,
        },
      },
      { upsert: true, new: true }
    );

    // Save export record
    const exportRecord = await Export.create({
      user: userId,
      return: returnDoc._id,
      exportType: "GSTR3B_EXCEL",
      period: { month: periodMonth, year: periodYear },
      fileName: result.fileName,
      filePath: result.filePath,
      fileSize: result.fileSize,
      invoiceCount: allInvoices.length,
      version: prevExports + 1,
      status: "READY",
    });

    res.json({
      message: "GSTR-3B summary generated successfully",
      export: {
        _id: exportRecord._id,
        fileName: result.fileName,
        fileSize: result.fileSize,
        version: exportRecord.version,
      },
      summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /returns/export/:id
 * Download an exported file
 */
exports.downloadExport = async (req, res, next) => {
  try {
    const exportRecord = await Export.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!exportRecord) {
      return res.status(404).json({ message: "Export not found" });
    }

    if (exportRecord.status !== "READY") {
      return res.status(400).json({ message: "Export is not ready for download" });
    }

    if (!fs.existsSync(exportRecord.filePath)) {
      return res.status(404).json({ message: "Export file not found on server" });
    }

    // Update download count
    exportRecord.downloadCount = (exportRecord.downloadCount || 0) + 1;
    exportRecord.lastDownloadedAt = new Date();
    await exportRecord.save();

    res.download(exportRecord.filePath, exportRecord.fileName);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /returns/exports
 * Get all exports for the user
 */
exports.getExports = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { user: req.userId };

    if (month && year) {
      filter["period.month"] = parseInt(month);
      filter["period.year"] = parseInt(year);
    }

    const exports = await Export.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ exports });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /returns/history
 * Get return filing history
 */
exports.getReturnHistory = async (req, res, next) => {
  try {
    const returns = await Return.find({ user: req.userId })
      .sort({ "period.year": -1, "period.month": -1 })
      .lean();

    res.json({ returns });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /returns/export/:id
 * Delete an export file
 */
exports.deleteExport = async (req, res, next) => {
  try {
    const exportRecord = await Export.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!exportRecord) {
      return res.status(404).json({ message: "Export not found" });
    }

    // Delete file from disk
    if (fs.existsSync(exportRecord.filePath)) {
      fs.unlinkSync(exportRecord.filePath);
    }

    await Export.deleteOne({ _id: exportRecord._id });

    res.json({ message: "Export deleted successfully" });
  } catch (error) {
    next(error);
  }
};
