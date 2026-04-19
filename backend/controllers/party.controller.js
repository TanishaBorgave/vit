const ReconciliationResult = require("../models/ReconciliationResult");
const Issue = require("../models/Issue");
const { chatWithGemini } = require("../utils/ai.service");

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

/**
 * Build the context data for email generation from reconciliation results
 */
function buildEmailContext(results, summary) {
  const missingInvoices = results
    .filter((r) => r.status === "MISSING_IN_2B")
    .map((r) => ({
      invoiceNo: r.invoiceNo,
      date: r.invoiceDate,
      amount: r.bookAmount,
    }));

  const mismatchInvoices = results
    .filter((r) => r.status === "MISMATCH")
    .map((r) => ({
      invoiceNo: r.invoiceNo,
      reasons: r.mismatchReasons,
      bookAmount: r.bookAmount,
      gstAmount: r.gstAmount,
      difference: Math.abs(r.amountDifference || 0),
    }));

  return { missingInvoices, mismatchInvoices };
}

/**
 * Generate a dynamic follow-up email using Gemini AI
 */
async function generateEmailWithAI(summary, missingInvoices, mismatchInvoices, tone = "formal") {
  const prompt = `You are an expert GST accounts professional in India. Generate a professional follow-up email to a vendor/supplier regarding GST reconciliation discrepancies.

IMPORTANT INSTRUCTIONS:
- Write ONLY the email content (Subject line + body). No extra commentary or explanation.
- The tone should be ${tone} and professional.
- Use plain text format (no markdown, no bold/italic syntax like ** or *).
- Include specific invoice numbers and amounts mentioned below.
- Keep it concise but thorough.
- End with a polite request for resolution and a professional sign-off.

PARTY DETAILS:
- Party Name: ${summary.partyName || "N/A"}
- GSTIN: ${summary.gstin}
- Total Invoices Reconciled: ${summary.totalInvoices}
- Matched: ${summary.matched}
- Total ITC at Risk: ₹${summary.totalItcAtRisk.toLocaleString("en-IN")}

${missingInvoices.length > 0 ? `MISSING INVOICES (present in our Books but NOT found in GSTR-2B):
${missingInvoices.map((inv) => `  - Invoice No: ${inv.invoiceNo}, Amount: ₹${(inv.amount || 0).toLocaleString("en-IN")}`).join("\n")}` : ""}

${mismatchInvoices.length > 0 ? `MISMATCHED INVOICES (values differ between our Books and GSTR-2B):
${mismatchInvoices.map((inv) => `  - Invoice No: ${inv.invoiceNo}, Our Amount: ₹${(inv.bookAmount || 0).toLocaleString("en-IN")}, GSTR-2B Amount: ₹${(inv.gstAmount || 0).toLocaleString("en-IN")}, Difference: ₹${(inv.difference || 0).toLocaleString("en-IN")}
    Reasons: ${inv.reasons.join(", ")}`).join("\n")}` : ""}

Generate the email now:`;

  try {
    const emailContent = await chatWithGemini(prompt);
    return emailContent;
  } catch (error) {
    console.error("Gemini AI email generation failed:", error.message);
    // Fallback to a basic template if AI fails
    return generateFallbackTemplate(summary, missingInvoices, mismatchInvoices);
  }
}

/**
 * Fallback template in case Gemini API is unavailable
 */
function generateFallbackTemplate(summary, missingInvoices, mismatchInvoices) {
  let template = `Subject: GST Reconciliation - Action Required for ${summary.gstin}\n\n`;
  template += `Dear ${summary.partyName || "Sir/Madam"},\n\n`;
  template += `We are writing regarding the GST reconciliation for GSTIN: ${summary.gstin}.\n\n`;
  template += `During our periodic reconciliation of purchase records with GSTR-2B data, we have identified discrepancies that require your attention:\n\n`;

  if (missingInvoices.length > 0) {
    template += `Missing Invoices (not found in GSTR-2B):\n`;
    missingInvoices.forEach((inv) => {
      template += `  - Invoice No: ${inv.invoiceNo}\n`;
    });
    template += `\n`;
  }

  if (mismatchInvoices.length > 0) {
    template += `Mismatched Invoices:\n`;
    mismatchInvoices.forEach((inv) => {
      template += `  - Invoice No: ${inv.invoiceNo}\n`;
      inv.reasons.forEach((r) => {
        template += `    Reason: ${r}\n`;
      });
    });
    template += `\n`;
  }

  template += `Total ITC at Risk: ₹${summary.totalItcAtRisk.toLocaleString("en-IN")}\n\n`;
  template += `We request you to kindly verify and rectify the above discrepancies at the earliest.\n\n`;
  template += `Please feel free to contact us for any clarification.\n\n`;
  template += `Regards,\nAccounts Department`;

  return template;
}

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

    // Generate dynamic AI email template
    const { missingInvoices, mismatchInvoices } = buildEmailContext(results, summary);

    let emailTemplate = null;
    if (summary.missingIn2B > 0 || summary.mismatched > 0) {
      emailTemplate = await generateEmailWithAI(summary, missingInvoices, mismatchInvoices);
    }

    res.json({ summary, results, issues, emailTemplate });
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate email with a specific tone using Gemini AI
 */
exports.regenerateEmail = async (req, res, next) => {
  try {
    const { gstin } = req.params;
    const { tone = "formal" } = req.body;
    const userId = req.userId;

    const results = await ReconciliationResult.find({
      user: userId,
      gstin: gstin.toUpperCase(),
    })
      .sort({ createdAt: -1 })
      .lean();

    if (results.length === 0) {
      return res.status(404).json({ message: "No data found for this GSTIN" });
    }

    const summary = {
      gstin: gstin.toUpperCase(),
      partyName: results[0]?.partyName || "",
      totalInvoices: results.length,
      matched: results.filter((r) => r.status === "MATCHED").length,
      mismatched: results.filter((r) => r.status === "MISMATCH").length,
      missingIn2B: results.filter((r) => r.status === "MISSING_IN_2B").length,
      missingInBooks: results.filter((r) => r.status === "MISSING_IN_BOOKS").length,
      totalItcAtRisk: results.reduce((sum, r) => sum + (r.itcAtRisk || 0), 0),
      totalMismatchAmount: results.reduce(
        (sum, r) => sum + Math.abs(r.amountDifference || 0),
        0
      ),
    };

    const { missingInvoices, mismatchInvoices } = buildEmailContext(results, summary);
    const emailTemplate = await generateEmailWithAI(summary, missingInvoices, mismatchInvoices, tone);

    res.json({ emailTemplate });
  } catch (error) {
    next(error);
  }
};
