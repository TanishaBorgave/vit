/**
 * Vendor Risk Scoring Engine
 *
 * A statistical ML engine that analyzes reconciliation data to:
 * 1. Extract behavioral features per vendor (GSTIN)
 * 2. Compute weighted risk scores across 4 dimensions
 * 3. Classify vendors into risk tiers (LOW / MEDIUM / HIGH / CRITICAL)
 * 4. Predict future delay probability and ITC risk
 *
 * Algorithm Overview:
 * - Feature extraction from ReconciliationResult, Invoice, and Issue collections
 * - Normalization using min-max scaling across the user's vendor population
 * - Weighted scoring: compliance (35%), reliability (25%), financial impact (25%), resolution (15%)
 * - Logistic regression-style prediction for delay probability
 * - Trend analysis comparing recent vs historical performance
 */

const ReconciliationResult = require("../models/ReconciliationResult");
const Invoice = require("../models/Invoice");
const Issue = require("../models/Issue");
const VendorRisk = require("../models/VendorRisk");

// ── Scoring Weights ──
const WEIGHTS = {
  compliance: 0.35,
  reliability: 0.25,
  financialImpact: 0.25,
  resolution: 0.15,
};

// ── Risk Thresholds ──
const RISK_THRESHOLDS = {
  LOW: 70,       // score >= 70
  MEDIUM: 45,    // score >= 45
  HIGH: 25,      // score >= 25
  CRITICAL: 0,   // score < 25
};

// ── Sigmoid function for probability estimation ──
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// ── Min-Max normalize to 0–100 ──
function normalize(value, min, max) {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

// ── Clamp to range ──
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * STEP 1: Extract raw metrics per vendor from the database
 */
async function extractVendorFeatures(userId) {
  const vendors = {};

  // ── Get all reconciliation results grouped by GSTIN ──
  const reconResults = await ReconciliationResult.find({ user: userId }).lean();

  for (const result of reconResults) {
    const gstin = result.gstin;
    if (!vendors[gstin]) {
      vendors[gstin] = {
        gstin,
        partyName: result.partyName || "",
        results: [],
        invoiceDates: [],
        uploadDates: [],
      };
    }
    vendors[gstin].results.push(result);
    if (result.invoiceDate) vendors[gstin].invoiceDates.push(new Date(result.invoiceDate));
    if (result.reconciliationDate) vendors[gstin].uploadDates.push(new Date(result.reconciliationDate));
    if (result.partyName && !vendors[gstin].partyName) {
      vendors[gstin].partyName = result.partyName;
    }
  }

  // ── Enrich with invoice data for delay calculation ──
  const bookInvoices = await Invoice.find({
    user: userId,
    source: "books",
  }).lean();

  const gstInvoices = await Invoice.find({
    user: userId,
    source: { $in: ["gstr2b", "gstr1"] },
  }).lean();

  // Build lookup maps
  const booksByGstin = {};
  for (const inv of bookInvoices) {
    if (!booksByGstin[inv.gstin]) booksByGstin[inv.gstin] = [];
    booksByGstin[inv.gstin].push(inv);
  }

  const gstByGstin = {};
  for (const inv of gstInvoices) {
    if (!gstByGstin[inv.gstin]) gstByGstin[inv.gstin] = [];
    gstByGstin[inv.gstin].push(inv);
  }

  // ── Get issues grouped by GSTIN ──
  const issues = await Issue.find({ user: userId }).lean();
  const issuesByGstin = {};
  for (const issue of issues) {
    if (!issuesByGstin[issue.gstin]) issuesByGstin[issue.gstin] = [];
    issuesByGstin[issue.gstin].push(issue);
  }

  // ── Compute metrics per vendor ──
  const vendorMetrics = [];
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (const [gstin, vendor] of Object.entries(vendors)) {
    const results = vendor.results;
    const total = results.length;
    if (total === 0) continue;

    const matched = results.filter((r) => r.status === "MATCHED").length;
    const mismatched = results.filter((r) => r.status === "MISMATCH").length;
    const missingIn2B = results.filter((r) => r.status === "MISSING_IN_2B").length;
    const missingInBooks = results.filter((r) => r.status === "MISSING_IN_BOOKS").length;

    // Amount differences
    const diffs = results
      .filter((r) => r.amountDifference !== 0)
      .map((r) => Math.abs(r.amountDifference));
    const avgDiff = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
    const maxDiff = diffs.length > 0 ? Math.max(...diffs) : 0;

    // ITC at risk
    const totalItcAtRisk = results.reduce((sum, r) => sum + (r.itcAtRisk || 0), 0);
    const totalTaxableValue = results.reduce(
      (sum, r) => sum + Math.max(r.bookTaxableValue || 0, r.gstTaxableValue || 0),
      0
    );

    // Upload delay: difference between invoice date in books vs when it appeared in GSTR-2B
    const bookDates = (booksByGstin[gstin] || []).map((i) => ({
      invoiceNo: i.invoiceNoNormalized,
      date: new Date(i.invoiceDate),
      createdAt: new Date(i.createdAt),
    }));
    const gstDates = (gstByGstin[gstin] || []).map((i) => ({
      invoiceNo: i.invoiceNoNormalized,
      date: new Date(i.invoiceDate),
      createdAt: new Date(i.createdAt),
    }));

    const delays = [];
    for (const book of bookDates) {
      const gstMatch = gstDates.find((g) => g.invoiceNo === book.invoiceNo);
      if (gstMatch) {
        const delayDays = Math.abs(gstMatch.createdAt - book.createdAt) / (1000 * 60 * 60 * 24);
        delays.push(delayDays);
      }
    }
    const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
    const maxDelay = delays.length > 0 ? Math.max(...delays) : 0;

    // Issues
    const vendorIssues = issuesByGstin[gstin] || [];
    const openIssues = vendorIssues.filter((i) => i.status === "OPEN" || i.status === "FOLLOWED_UP").length;
    const resolvedIssues = vendorIssues.filter((i) => i.status === "RESOLVED").length;

    // Resolution time for resolved issues
    const resolutionTimes = vendorIssues
      .filter((i) => i.status === "RESOLVED" && i.resolvedDate && i.createdAt)
      .map((i) => Math.abs(new Date(i.resolvedDate) - new Date(i.createdAt)) / (1000 * 60 * 60 * 24));
    const avgResolutionDays =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

    // Trend analysis: recent vs older
    const recentResults = results.filter(
      (r) => r.reconciliationDate && new Date(r.reconciliationDate) >= threeMonthsAgo
    );
    const olderResults = results.filter(
      (r) => !r.reconciliationDate || new Date(r.reconciliationDate) < threeMonthsAgo
    );

    const recentMismatchRate =
      recentResults.length > 0
        ? recentResults.filter((r) => r.status !== "MATCHED").length / recentResults.length
        : 0;
    const olderMismatchRate =
      olderResults.length > 0
        ? olderResults.filter((r) => r.status !== "MATCHED").length / olderResults.length
        : 0;

    let trendDirection = "STABLE";
    if (recentResults.length >= 2 && olderResults.length >= 2) {
      const diff = recentMismatchRate - olderMismatchRate;
      if (diff > 0.1) trendDirection = "WORSENING";
      else if (diff < -0.1) trendDirection = "IMPROVING";
    }

    vendorMetrics.push({
      gstin,
      partyName: vendor.partyName,
      metrics: {
        totalInvoices: total,
        matchedInvoices: matched,
        mismatchedInvoices: mismatched,
        missingIn2B,
        missingInBooks,
        matchRate: total > 0 ? matched / total : 0,
        mismatchRate: total > 0 ? (mismatched + missingIn2B) / total : 0,
        missingRate: total > 0 ? missingIn2B / total : 0,
        totalTaxableValue,
        totalItcAtRisk,
        avgAmountDifference: Math.round(avgDiff * 100) / 100,
        maxAmountDifference: Math.round(maxDiff * 100) / 100,
        avgUploadDelay: Math.round(avgDelay * 10) / 10,
        maxUploadDelay: Math.round(maxDelay * 10) / 10,
        totalIssues: vendorIssues.length,
        openIssues,
        resolvedIssues,
        avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
        recentMismatchRate: Math.round(recentMismatchRate * 1000) / 1000,
        olderMismatchRate: Math.round(olderMismatchRate * 1000) / 1000,
        trendDirection,
      },
    });
  }

  return vendorMetrics;
}

/**
 * STEP 2: Compute risk scores using weighted multi-factor model
 */
function computeScores(vendorMetrics) {
  if (vendorMetrics.length === 0) return [];

  // ── Population-level stats for normalization ──
  const allMatchRates = vendorMetrics.map((v) => v.metrics.matchRate);
  const allMismatchRates = vendorMetrics.map((v) => v.metrics.mismatchRate);
  const allItcRisks = vendorMetrics.map((v) => v.metrics.totalItcAtRisk);
  const allDelays = vendorMetrics.map((v) => v.metrics.avgUploadDelay);
  const allResolutionDays = vendorMetrics.map((v) => v.metrics.avgResolutionDays);

  const minMatchRate = Math.min(...allMatchRates);
  const maxMatchRate = Math.max(...allMatchRates);
  const minItcRisk = Math.min(...allItcRisks);
  const maxItcRisk = Math.max(...allItcRisks);
  const minDelay = Math.min(...allDelays);
  const maxDelay = Math.max(...allDelays);

  for (const vendor of vendorMetrics) {
    const m = vendor.metrics;

    // ── 1. Compliance Score (higher match rate = better) ──
    // Base: match rate normalized
    let complianceScore = m.matchRate * 100;
    // Penalty for mismatches (weighted heavier than missing)
    complianceScore -= m.mismatchRate * 30;
    // Penalty for missing in 2B
    complianceScore -= m.missingRate * 20;
    complianceScore = clamp(complianceScore, 0, 100);

    // ── 2. Reliability Score (lower delay = better) ──
    let reliabilityScore = 100;
    if (maxDelay > 0) {
      // Inverse: less delay = higher score
      reliabilityScore = 100 - normalize(m.avgUploadDelay, minDelay, maxDelay);
    }
    // Bonus for no missing invoices
    if (m.missingIn2B === 0) reliabilityScore = Math.min(100, reliabilityScore + 10);
    // Penalty for open issues
    if (m.openIssues > 0) reliabilityScore -= m.openIssues * 5;
    reliabilityScore = clamp(reliabilityScore, 0, 100);

    // ── 3. Financial Impact Score (lower ITC risk = better) ──
    let financialScore = 100;
    if (maxItcRisk > 0) {
      financialScore = 100 - normalize(m.totalItcAtRisk, minItcRisk, maxItcRisk);
    }
    // Impact of amount differences
    if (m.avgAmountDifference > 1000) {
      financialScore -= Math.min(30, m.avgAmountDifference / 1000);
    }
    financialScore = clamp(financialScore, 0, 100);

    // ── 4. Resolution Score (faster resolution = better) ──
    let resolutionScore = 80; // default neutral-good
    if (m.totalIssues > 0) {
      const resolutionRate = m.resolvedIssues / m.totalIssues;
      resolutionScore = resolutionRate * 70;
      // Penalty for slow resolution
      if (m.avgResolutionDays > 15) resolutionScore -= 15;
      if (m.avgResolutionDays > 30) resolutionScore -= 15;
      // Bonus for resolving everything
      if (m.openIssues === 0 && m.resolvedIssues > 0) resolutionScore += 20;
    }
    resolutionScore = clamp(resolutionScore, 0, 100);

    // ── Trend adjustment ──
    let trendAdjustment = 0;
    if (m.trendDirection === "IMPROVING") trendAdjustment = 5;
    else if (m.trendDirection === "WORSENING") trendAdjustment = -10;

    // ── Composite score ──
    const overallScore = clamp(
      Math.round(
        complianceScore * WEIGHTS.compliance +
        reliabilityScore * WEIGHTS.reliability +
        financialScore * WEIGHTS.financialImpact +
        resolutionScore * WEIGHTS.resolution +
        trendAdjustment
      ),
      0,
      100
    );

    // ── Risk classification ──
    let riskLevel;
    if (overallScore >= RISK_THRESHOLDS.LOW) riskLevel = "LOW";
    else if (overallScore >= RISK_THRESHOLDS.MEDIUM) riskLevel = "MEDIUM";
    else if (overallScore >= RISK_THRESHOLDS.HIGH) riskLevel = "HIGH";
    else riskLevel = "CRITICAL";

    // ── Build feature vector for the prediction model ──
    const featureVector = [
      m.matchRate,
      m.mismatchRate,
      m.missingRate,
      m.avgUploadDelay / 30,         // normalized to months
      m.totalItcAtRisk / 100000,     // normalized scale
      m.avgAmountDifference / 10000,
      m.openIssues / Math.max(1, m.totalIssues),
      m.avgResolutionDays / 30,
      m.recentMismatchRate,
      m.trendDirection === "WORSENING" ? 1 : m.trendDirection === "IMPROVING" ? -1 : 0,
    ];

    // ── Delay prediction using logistic model ──
    // Linear combination of risk factors
    const delaySignal =
      -2.0 +                                          // bias (most vendors don't delay)
      m.missingRate * 4.0 +                            // missing invoices = strong delay signal
      m.mismatchRate * 2.5 +                           // mismatches correlate with delays
      (m.avgUploadDelay / 30) * 3.0 +                  // past delays predict future delays
      (m.openIssues / Math.max(1, m.totalIssues)) * 2.0 + // unresolved issues
      (m.trendDirection === "WORSENING" ? 1.5 : 0) +  // worsening trend
      (m.trendDirection === "IMPROVING" ? -1.0 : 0);   // improving trend

    const delayProbability = Math.round(sigmoid(delaySignal) * 1000) / 1000;
    const likelyToDelay = delayProbability > 0.5;

    // Estimated next delay (exponential smoothing on past delays)
    const estimatedNextDelay = Math.round(
      (m.avgUploadDelay * 0.7 + m.maxUploadDelay * 0.3) * (1 + (delayProbability - 0.5))
    );

    // Predicted ITC risk for next period
    const itcRiskNextPeriod = Math.round(
      (m.totalItcAtRisk / Math.max(1, m.totalInvoices)) * m.mismatchRate * 100
    );

    // Recommended action
    let recommendedAction = "";
    if (riskLevel === "CRITICAL") {
      recommendedAction = "Immediate follow-up required. Consider alternative vendors.";
    } else if (riskLevel === "HIGH") {
      recommendedAction = "Schedule meeting with vendor. Request invoice upload SLA commitment.";
    } else if (riskLevel === "MEDIUM") {
      recommendedAction = "Monitor closely. Send periodic invoice upload reminders.";
    } else if (likelyToDelay) {
      recommendedAction = "Low risk but delay predicted. Send proactive reminder before filing deadline.";
    } else {
      recommendedAction = "No action needed. Vendor is performing well.";
    }

    vendor.scores = {
      complianceScore: Math.round(complianceScore),
      reliabilityScore: Math.round(reliabilityScore),
      financialImpactScore: Math.round(financialScore),
      resolutionScore: Math.round(resolutionScore),
      overallScore,
    };

    vendor.riskLevel = riskLevel;
    vendor.featureVector = featureVector;
    vendor.predictions = {
      likelyToDelay,
      delayProbability,
      estimatedNextDelay: Math.max(0, estimatedNextDelay),
      itcRiskNextPeriod: Math.max(0, itcRiskNextPeriod),
      recommendedAction,
    };
  }

  return vendorMetrics;
}

/**
 * STEP 3: Run full analysis pipeline and persist results
 */
async function analyzeVendorRisks(userId) {
  // Extract features
  const vendorMetrics = await extractVendorFeatures(userId);

  if (vendorMetrics.length === 0) {
    return { vendors: [], summary: { total: 0, low: 0, medium: 0, high: 0, critical: 0 } };
  }

  // Compute scores and predictions
  const scoredVendors = computeScores(vendorMetrics);

  // Persist to database (upsert)
  const bulkOps = scoredVendors.map((vendor) => ({
    updateOne: {
      filter: { user: userId, gstin: vendor.gstin },
      update: {
        $set: {
          user: userId,
          gstin: vendor.gstin,
          partyName: vendor.partyName,
          metrics: vendor.metrics,
          scores: vendor.scores,
          riskLevel: vendor.riskLevel,
          predictions: vendor.predictions,
          featureVector: vendor.featureVector,
          lastAnalyzedAt: new Date(),
          dataPoints: vendor.metrics.totalInvoices,
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await VendorRisk.bulkWrite(bulkOps);
  }

  // Summary
  const summary = {
    total: scoredVendors.length,
    low: scoredVendors.filter((v) => v.riskLevel === "LOW").length,
    medium: scoredVendors.filter((v) => v.riskLevel === "MEDIUM").length,
    high: scoredVendors.filter((v) => v.riskLevel === "HIGH").length,
    critical: scoredVendors.filter((v) => v.riskLevel === "CRITICAL").length,
    avgOverallScore:
      Math.round(
        scoredVendors.reduce((sum, v) => sum + v.scores.overallScore, 0) / scoredVendors.length
      ),
    totalItcAtRisk: scoredVendors.reduce((sum, v) => sum + v.metrics.totalItcAtRisk, 0),
    vendorsLikelyToDelay: scoredVendors.filter((v) => v.predictions.likelyToDelay).length,
  };

  return {
    vendors: scoredVendors.sort((a, b) => a.scores.overallScore - b.scores.overallScore),
    summary,
  };
}

module.exports = {
  extractVendorFeatures,
  computeScores,
  analyzeVendorRisks,
};
