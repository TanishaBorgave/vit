const VendorRisk = require("../models/VendorRisk");
const { analyzeVendorRisks } = require("../utils/vendorRiskEngine");
const logger = require("../utils/logger");

/**
 * POST /api/vendor-risk/analyze
 * Run the ML analysis pipeline on all vendors
 */
exports.runAnalysis = async (req, res, next) => {
  try {
    const result = await analyzeVendorRisks(req.userId);

    logger.mlAnalysis(result.summary.total, result.summary.avgOverallScore || 0);

    res.json({
      message: `Analyzed ${result.summary.total} vendors`,
      summary: result.summary,
      vendors: result.vendors.map((v) => ({
        gstin: v.gstin,
        partyName: v.partyName,
        riskLevel: v.riskLevel,
        scores: v.scores,
        predictions: v.predictions,
        metrics: v.metrics,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/vendor-risk
 * Get all cached vendor risk scores
 */
exports.getAll = async (req, res, next) => {
  try {
    const { riskLevel, sort = "overallScore", order = "asc" } = req.query;

    const filter = { user: req.userId };
    if (riskLevel) filter.riskLevel = riskLevel;

    const sortObj = {};
    if (sort === "overallScore") sortObj["scores.overallScore"] = order === "desc" ? -1 : 1;
    else if (sort === "itcAtRisk") sortObj["metrics.totalItcAtRisk"] = order === "desc" ? -1 : 1;
    else if (sort === "delay") sortObj["predictions.delayProbability"] = order === "desc" ? -1 : 1;
    else sortObj["scores.overallScore"] = 1;

    const vendors = await VendorRisk.find(filter).sort(sortObj).lean();

    // Compute summary
    const summary = {
      total: vendors.length,
      low: vendors.filter((v) => v.riskLevel === "LOW").length,
      medium: vendors.filter((v) => v.riskLevel === "MEDIUM").length,
      high: vendors.filter((v) => v.riskLevel === "HIGH").length,
      critical: vendors.filter((v) => v.riskLevel === "CRITICAL").length,
      avgOverallScore:
        vendors.length > 0
          ? Math.round(vendors.reduce((s, v) => s + v.scores.overallScore, 0) / vendors.length)
          : 0,
      totalItcAtRisk: vendors.reduce((s, v) => s + v.metrics.totalItcAtRisk, 0),
      vendorsLikelyToDelay: vendors.filter((v) => v.predictions.likelyToDelay).length,
    };

    res.json({ vendors, summary });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/vendor-risk/:gstin
 * Get detailed risk profile for a specific vendor
 */
exports.getVendorDetail = async (req, res, next) => {
  try {
    const vendor = await VendorRisk.findOne({
      user: req.userId,
      gstin: req.params.gstin,
    }).lean();

    if (!vendor) {
      return res.status(404).json({ message: "Vendor risk profile not found" });
    }

    res.json({ vendor });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/vendor-risk/dashboard/stats
 * Aggregated stats for the risk dashboard
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const vendors = await VendorRisk.find({ user: req.userId }).lean();

    if (vendors.length === 0) {
      return res.json({
        hasData: false,
        summary: { total: 0, low: 0, medium: 0, high: 0, critical: 0 },
        topRiskyVendors: [],
        delayPredictions: [],
        scoreDistribution: [],
      });
    }

    // Top risky vendors (worst first)
    const topRiskyVendors = [...vendors]
      .sort((a, b) => a.scores.overallScore - b.scores.overallScore)
      .slice(0, 10)
      .map((v) => ({
        gstin: v.gstin,
        partyName: v.partyName,
        riskLevel: v.riskLevel,
        overallScore: v.scores.overallScore,
        itcAtRisk: v.metrics.totalItcAtRisk,
        delayProbability: v.predictions.delayProbability,
        recommendedAction: v.predictions.recommendedAction,
      }));

    // Vendors most likely to delay
    const delayPredictions = [...vendors]
      .filter((v) => v.predictions.delayProbability > 0.3)
      .sort((a, b) => b.predictions.delayProbability - a.predictions.delayProbability)
      .slice(0, 10)
      .map((v) => ({
        gstin: v.gstin,
        partyName: v.partyName,
        delayProbability: v.predictions.delayProbability,
        estimatedDelay: v.predictions.estimatedNextDelay,
        itcRiskNextPeriod: v.predictions.itcRiskNextPeriod,
      }));

    // Score distribution (for histogram)
    const buckets = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];
    for (const v of vendors) {
      const score = v.scores.overallScore;
      if (score <= 20) buckets[0].count++;
      else if (score <= 40) buckets[1].count++;
      else if (score <= 60) buckets[2].count++;
      else if (score <= 80) buckets[3].count++;
      else buckets[4].count++;
    }

    // Dimension averages
    const dimensionAverages = {
      compliance: Math.round(vendors.reduce((s, v) => s + v.scores.complianceScore, 0) / vendors.length),
      reliability: Math.round(vendors.reduce((s, v) => s + v.scores.reliabilityScore, 0) / vendors.length),
      financialImpact: Math.round(vendors.reduce((s, v) => s + v.scores.financialImpactScore, 0) / vendors.length),
      resolution: Math.round(vendors.reduce((s, v) => s + v.scores.resolutionScore, 0) / vendors.length),
    };

    res.json({
      hasData: true,
      summary: {
        total: vendors.length,
        low: vendors.filter((v) => v.riskLevel === "LOW").length,
        medium: vendors.filter((v) => v.riskLevel === "MEDIUM").length,
        high: vendors.filter((v) => v.riskLevel === "HIGH").length,
        critical: vendors.filter((v) => v.riskLevel === "CRITICAL").length,
        avgOverallScore: Math.round(
          vendors.reduce((s, v) => s + v.scores.overallScore, 0) / vendors.length
        ),
        totalItcAtRisk: vendors.reduce((s, v) => s + v.metrics.totalItcAtRisk, 0),
        vendorsLikelyToDelay: vendors.filter((v) => v.predictions.likelyToDelay).length,
      },
      topRiskyVendors,
      delayPredictions,
      scoreDistribution: buckets,
      dimensionAverages,
    });
  } catch (error) {
    next(error);
  }
};
