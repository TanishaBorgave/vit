const ReconciliationResult = require("../models/ReconciliationResult");
const Invoice = require("../models/Invoice");
const Issue = require("../models/Issue");
const Upload = require("../models/Upload");

exports.getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Reconciliation summary
    const reconStats = await ReconciliationResult.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
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
          totalAmountDifference: { $sum: { $abs: "$amountDifference" } },
        },
      },
    ]);

    // Status distribution for charts
    const statusDistribution = await ReconciliationResult.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: { $abs: "$amountDifference" } },
        },
      },
    ]);

    // GSTIN-wise impact (top 10)
    const gstinImpact = await ReconciliationResult.aggregate([
      { $match: { user: userId, status: { $ne: "MATCHED" } } },
      {
        $group: {
          _id: "$gstin",
          partyName: { $first: "$partyName" },
          issueCount: { $sum: 1 },
          itcAtRisk: { $sum: "$itcAtRisk" },
          mismatchAmount: { $sum: { $abs: "$amountDifference" } },
        },
      },
      { $sort: { itcAtRisk: -1 } },
      { $limit: 10 },
    ]);

    // Issue summary
    const issueSummary = await Issue.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent uploads
    const recentUploads = await Upload.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const stats = reconStats[0] || {
      totalInvoices: 0,
      matched: 0,
      mismatched: 0,
      missingIn2B: 0,
      missingInBooks: 0,
      totalItcAtRisk: 0,
      totalAmountDifference: 0,
    };

    res.json({
      stats,
      statusDistribution,
      gstinImpact,
      issueSummary,
      recentUploads,
    });
  } catch (error) {
    next(error);
  }
};
