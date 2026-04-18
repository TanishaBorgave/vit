const Invoice = require("../models/Invoice");
const ReconciliationResult = require("../models/ReconciliationResult");
const Issue = require("../models/Issue");

/**
 * Run reconciliation engine
 * Matching priority: GSTIN → Invoice Number → Date (±3 days) → Amount (±1%)
 */
exports.runReconciliation = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Clear previous results
    await ReconciliationResult.deleteMany({ user: userId });
    await Issue.deleteMany({ user: userId });

    // Fetch all invoices
    const bookInvoices = await Invoice.find({
      user: userId,
      source: "books",
    }).lean();

    const gstInvoices = await Invoice.find({
      user: userId,
      source: { $in: ["gstr2b", "gstr1"] },
    }).lean();

    if (bookInvoices.length === 0 && gstInvoices.length === 0) {
      return res.status(400).json({
        message: "No invoices found. Please upload both Books and GST data first.",
      });
    }

    // Index GST invoices by GSTIN + normalized invoice number
    const gstIndex = new Map();
    for (const inv of gstInvoices) {
      const key = `${inv.gstin}|${inv.invoiceNoNormalized}`;
      if (!gstIndex.has(key)) {
        gstIndex.set(key, []);
      }
      gstIndex.get(key).push(inv);
    }

    const matchedGstIds = new Set();
    const results = [];
    const issues = [];

    // Process each book invoice
    for (const bookInv of bookInvoices) {
      const key = `${bookInv.gstin}|${bookInv.invoiceNoNormalized}`;
      const candidates = gstIndex.get(key) || [];

      let bestMatch = null;
      let bestScore = 0;

      for (const gstInv of candidates) {
        let score = 2; // GSTIN + Invoice number match

        // Date check (±3 days tolerance)
        if (bookInv.invoiceDate && gstInv.invoiceDate) {
          const dayDiff = Math.abs(
            (new Date(bookInv.invoiceDate) - new Date(gstInv.invoiceDate)) /
              (1000 * 60 * 60 * 24)
          );
          if (dayDiff <= 3) score += 1;
        }

        // Amount check (±1% tolerance)
        if (bookInv.gstAmount > 0 && gstInv.gstAmount > 0) {
          const diff = Math.abs(bookInv.gstAmount - gstInv.gstAmount);
          const tolerance = bookInv.gstAmount * 0.01;
          if (diff <= tolerance) score += 1;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = gstInv;
        }
      }

      if (bestMatch) {
        matchedGstIds.add(bestMatch._id.toString());

        // Determine if exact match or mismatch
        const mismatchReasons = [];
        let status = "MATCHED";

        // Check date mismatch
        if (bookInv.invoiceDate && bestMatch.invoiceDate) {
          const dayDiff = Math.abs(
            (new Date(bookInv.invoiceDate) - new Date(bestMatch.invoiceDate)) /
              (1000 * 60 * 60 * 24)
          );
          if (dayDiff > 3) {
            mismatchReasons.push(`Date difference: ${Math.round(dayDiff)} days`);
          }
        }

        // Check taxable value mismatch
        const taxValDiff = Math.abs(
          bookInv.taxableValue - bestMatch.taxableValue
        );
        if (taxValDiff > bookInv.taxableValue * 0.01 && taxValDiff > 1) {
          mismatchReasons.push(
            `Taxable value: Books ₹${bookInv.taxableValue} vs GST ₹${bestMatch.taxableValue}`
          );
        }

        // Check GST amount mismatch
        const gstDiff = Math.abs(bookInv.gstAmount - bestMatch.gstAmount);
        if (gstDiff > bookInv.gstAmount * 0.01 && gstDiff > 1) {
          mismatchReasons.push(
            `GST amount: Books ₹${bookInv.gstAmount} vs GST ₹${bestMatch.gstAmount}`
          );
        }

        if (mismatchReasons.length > 0) {
          status = "MISMATCH";
        }

        const amountDifference = bookInv.gstAmount - bestMatch.gstAmount;
        const taxableValueDifference =
          bookInv.taxableValue - bestMatch.taxableValue;
        const itcAtRisk =
          status === "MISMATCH" ? Math.abs(amountDifference) : 0;

        const result = {
          user: userId,
          bookInvoice: bookInv._id,
          gstInvoice: bestMatch._id,
          gstin: bookInv.gstin,
          partyName: bookInv.partyName || bestMatch.partyName,
          invoiceNo: bookInv.invoiceNo,
          invoiceDate: bookInv.invoiceDate,
          bookAmount: bookInv.gstAmount,
          gstAmount: bestMatch.gstAmount,
          bookTaxableValue: bookInv.taxableValue,
          gstTaxableValue: bestMatch.taxableValue,
          amountDifference,
          taxableValueDifference,
          status,
          mismatchReasons,
          itcAtRisk,
        };

        results.push(result);

        // Create issue for mismatches
        if (status === "MISMATCH") {
          issues.push({
            user: userId,
            gstin: bookInv.gstin,
            partyName: bookInv.partyName || bestMatch.partyName,
            invoiceNo: bookInv.invoiceNo,
            issueType: "MISMATCH",
            description: mismatchReasons.join("; "),
            amountDifference: Math.abs(amountDifference),
            itcAtRisk,
            status: "OPEN",
            timeline: [
              {
                action: "Created",
                status: "OPEN",
                date: new Date(),
                note: "Auto-generated from reconciliation",
              },
            ],
          });
        }
      } else {
        // Missing in GST data
        const itcAtRisk = bookInv.gstAmount;
        results.push({
          user: userId,
          bookInvoice: bookInv._id,
          gstin: bookInv.gstin,
          partyName: bookInv.partyName,
          invoiceNo: bookInv.invoiceNo,
          invoiceDate: bookInv.invoiceDate,
          bookAmount: bookInv.gstAmount,
          gstAmount: 0,
          bookTaxableValue: bookInv.taxableValue,
          gstTaxableValue: 0,
          amountDifference: bookInv.gstAmount,
          taxableValueDifference: bookInv.taxableValue,
          status: "MISSING_IN_2B",
          mismatchReasons: ["Invoice not found in GST data"],
          itcAtRisk,
        });

        issues.push({
          user: userId,
          gstin: bookInv.gstin,
          partyName: bookInv.partyName,
          invoiceNo: bookInv.invoiceNo,
          issueType: "MISSING_IN_2B",
          description: "Invoice present in Books but missing in GST data (GSTR-2B)",
          amountDifference: bookInv.gstAmount,
          itcAtRisk,
          status: "OPEN",
          timeline: [
            {
              action: "Created",
              status: "OPEN",
              date: new Date(),
              note: "Auto-generated from reconciliation",
            },
          ],
        });
      }
    }

    // Find invoices in GST but not in books
    for (const gstInv of gstInvoices) {
      if (!matchedGstIds.has(gstInv._id.toString())) {
        results.push({
          user: userId,
          gstInvoice: gstInv._id,
          gstin: gstInv.gstin,
          partyName: gstInv.partyName,
          invoiceNo: gstInv.invoiceNo,
          invoiceDate: gstInv.invoiceDate,
          bookAmount: 0,
          gstAmount: gstInv.gstAmount,
          bookTaxableValue: 0,
          gstTaxableValue: gstInv.taxableValue,
          amountDifference: -gstInv.gstAmount,
          taxableValueDifference: -gstInv.taxableValue,
          status: "MISSING_IN_BOOKS",
          mismatchReasons: ["Invoice found in GST data but not in Books"],
          itcAtRisk: 0,
        });

        issues.push({
          user: userId,
          gstin: gstInv.gstin,
          partyName: gstInv.partyName,
          invoiceNo: gstInv.invoiceNo,
          issueType: "MISSING_IN_BOOKS",
          description:
            "Invoice present in GST data but missing in Purchase Register",
          amountDifference: gstInv.gstAmount,
          itcAtRisk: 0,
          status: "OPEN",
          timeline: [
            {
              action: "Created",
              status: "OPEN",
              date: new Date(),
              note: "Auto-generated from reconciliation",
            },
          ],
        });
      }
    }

    // Batch insert results
    const savedResults = await ReconciliationResult.insertMany(results);

    // Link issues to reconciliation results and insert
    for (let i = 0; i < issues.length; i++) {
      // Find corresponding result
      const matchResult = savedResults.find(
        (r) =>
          r.gstin === issues[i].gstin &&
          r.invoiceNo === issues[i].invoiceNo &&
          r.status !== "MATCHED"
      );
      if (matchResult) {
        issues[i].reconciliationResult = matchResult._id;
      }
    }

    const validIssues = issues.filter((i) => i.reconciliationResult);
    if (validIssues.length > 0) {
      await Issue.insertMany(validIssues);
    }

    // Summary
    const summary = {
      totalInvoices: results.length,
      matched: results.filter((r) => r.status === "MATCHED").length,
      mismatched: results.filter((r) => r.status === "MISMATCH").length,
      missingIn2B: results.filter((r) => r.status === "MISSING_IN_2B").length,
      missingInBooks: results.filter((r) => r.status === "MISSING_IN_BOOKS")
        .length,
      totalItcAtRisk: results.reduce((sum, r) => sum + r.itcAtRisk, 0),
      issuesCreated: validIssues.length,
    };

    res.json({
      message: "Reconciliation completed successfully",
      summary,
    });
  } catch (error) {
    next(error);
  }
};

exports.getResults = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      gstin,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = { user: req.userId };
    if (status) filter.status = status;
    if (gstin) filter.gstin = gstin;
    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: "i" } },
        { gstin: { $regex: search, $options: "i" } },
        { partyName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [results, total] = await Promise.all([
      ReconciliationResult.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ReconciliationResult.countDocuments(filter),
    ]);

    res.json({
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};
