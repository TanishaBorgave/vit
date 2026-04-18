const ReconciliationResult = require("../models/ReconciliationResult");
const Issue = require("../models/Issue");

exports.getParties = async (req, res, next) => {
  try {
    const userId = req.userId;

    const parties = await ReconciliationResult.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: "$gstin",
          partyName: { $first: "$partyName" },
          totalInvoices: { $sum: 1 },
          matched: {
            $sum: { $cond: [{ $eq: ["$status", "MATCHED"] }, 1, 0] },
          },
          mismatched: {
            $sum: { $cond: [{ $eq: ["$status", "MISMATCH"] }, 1, 0] },
          },
          missingIn2B: {
            $sum: { $cond: [{ $eq: ["$status", "MISSING_IN_2B"] }, 1, 0] },
          },
          missingInBooks: {
            $sum: {
              $cond: [{ $eq: ["$status", "MISSING_IN_BOOKS"] }, 1, 0],
            },
          },
          totalItcAtRisk: { $sum: "$itcAtRisk" },
          totalMismatchAmount: {
            $sum: { $abs: "$amountDifference" },
          },
        },
      },
      {
        $addFields: {
          gstin: "$_id",
          issueCount: {
            $add: ["$mismatched", "$missingIn2B", "$missingInBooks"],
          },
          riskLevel: {
            $cond: {
              if: { $gte: ["$totalItcAtRisk", 50000] },
              then: "HIGH",
              else: {
                $cond: {
                  if: { $gte: ["$totalItcAtRisk", 10000] },
                  then: "MEDIUM",
                  else: "LOW",
                },
              },
            },
          },
        },
      },
      { $sort: { totalItcAtRisk: -1 } },
    ]);

    res.json({ parties });
  } catch (error) {
    next(error);
  }
};

exports.getPartyDetail = async (req, res, next) => {
  try {
    const { gstin } = req.params;
    const userId = req.userId;

    const results = await ReconciliationResult.find({
      user: userId,
      gstin: gstin.toUpperCase(),
    })
      .sort({ createdAt: -1 })
      .lean();

    const issues = await Issue.find({
      user: userId,
      gstin: gstin.toUpperCase(),
    })
      .sort({ createdAt: -1 })
      .lean();

    if (results.length === 0) {
      return res.status(404).json({ message: "No data found for this GSTIN" });
    }

    // Compute summary
    const summary = {
      gstin: gstin.toUpperCase(),
      partyName: results[0]?.partyName || "",
      totalInvoices: results.length,
      matched: results.filter((r) => r.status === "MATCHED").length,
      mismatched: results.filter((r) => r.status === "MISMATCH").length,
      missingIn2B: results.filter((r) => r.status === "MISSING_IN_2B").length,
      missingInBooks: results.filter((r) => r.status === "MISSING_IN_BOOKS")
        .length,
      totalItcAtRisk: results.reduce((sum, r) => sum + (r.itcAtRisk || 0), 0),
      totalMismatchAmount: results.reduce(
        (sum, r) => sum + Math.abs(r.amountDifference || 0),
        0
      ),
    };

    // Generate email template
    const missingInvoices = results
      .filter((r) => r.status === "MISSING_IN_2B")
      .map((r) => r.invoiceNo);
    const mismatchInvoices = results
      .filter((r) => r.status === "MISMATCH")
      .map((r) => ({
        invoiceNo: r.invoiceNo,
        reasons: r.mismatchReasons,
      }));

    const emailTemplate = generateEmailTemplate(
      summary.partyName,
      summary.gstin,
      missingInvoices,
      mismatchInvoices,
      summary.totalItcAtRisk
    );

    res.json({ summary, results, issues, emailTemplate });
  } catch (error) {
    next(error);
  }
};

function generateEmailTemplate(
  partyName,
  gstin,
  missingInvoices,
  mismatchInvoices,
  itcAtRisk
) {
  let template = `Subject: GST Reconciliation - Action Required for ${gstin}\n\n`;
  template += `Dear ${partyName || "Sir/Madam"},\n\n`;
  template += `We are writing regarding the GST reconciliation for GSTIN: ${gstin}.\n\n`;
  template += `During our periodic reconciliation of purchase records with GSTR-2B data, we have identified the following discrepancies that require your attention:\n\n`;

  if (missingInvoices.length > 0) {
    template += `**Missing Invoices (not found in GSTR-2B):**\n`;
    missingInvoices.forEach((inv) => {
      template += `  - Invoice No: ${inv}\n`;
    });
    template += `\n`;
  }

  if (mismatchInvoices.length > 0) {
    template += `**Mismatched Invoices:**\n`;
    mismatchInvoices.forEach((inv) => {
      template += `  - Invoice No: ${inv.invoiceNo}\n`;
      inv.reasons.forEach((r) => {
        template += `    Reason: ${r}\n`;
      });
    });
    template += `\n`;
  }

  template += `**Total ITC at Risk: ₹${itcAtRisk.toLocaleString("en-IN")}\n\n`;
  template += `We request you to kindly verify and rectify the above discrepancies at the earliest.\n\n`;
  template += `Please feel free to contact us for any clarification.\n\n`;
  template += `Regards,\n`;
  template += `Accounts Department`;

  return template;
}
