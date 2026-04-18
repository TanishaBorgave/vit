const mongoose = require("mongoose");

const vendorRiskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gstin: {
      type: String,
      required: true,
      index: true,
    },
    partyName: {
      type: String,
      default: "",
    },

    // ── Raw Metrics (from reconciliation data) ──
    metrics: {
      totalInvoices: { type: Number, default: 0 },
      matchedInvoices: { type: Number, default: 0 },
      mismatchedInvoices: { type: Number, default: 0 },
      missingIn2B: { type: Number, default: 0 },
      missingInBooks: { type: Number, default: 0 },

      matchRate: { type: Number, default: 0 },           // 0-1
      mismatchRate: { type: Number, default: 0 },         // 0-1
      missingRate: { type: Number, default: 0 },           // 0-1

      totalTaxableValue: { type: Number, default: 0 },
      totalItcAtRisk: { type: Number, default: 0 },
      avgAmountDifference: { type: Number, default: 0 },
      maxAmountDifference: { type: Number, default: 0 },

      // Delay metrics
      avgUploadDelay: { type: Number, default: 0 },       // days
      maxUploadDelay: { type: Number, default: 0 },        // days

      // Issue resolution metrics
      totalIssues: { type: Number, default: 0 },
      openIssues: { type: Number, default: 0 },
      resolvedIssues: { type: Number, default: 0 },
      avgResolutionDays: { type: Number, default: 0 },

      // Trend (recent vs older)
      recentMismatchRate: { type: Number, default: 0 },   // last 3 months
      olderMismatchRate: { type: Number, default: 0 },     // before that
      trendDirection: { type: String, enum: ["IMPROVING", "STABLE", "WORSENING"], default: "STABLE" },
    },

    // ── ML-Computed Scores (0-100) ──
    scores: {
      complianceScore: { type: Number, default: 50 },      // How well they match
      reliabilityScore: { type: Number, default: 50 },     // Upload consistency
      financialImpactScore: { type: Number, default: 50 }, // ITC risk magnitude
      resolutionScore: { type: Number, default: 50 },      // How fast issues resolved
      overallScore: { type: Number, default: 50 },         // Weighted composite
    },

    // ── Risk Classification ──
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },

    // ── Predictions ──
    predictions: {
      likelyToDelay: { type: Boolean, default: false },
      delayProbability: { type: Number, default: 0 },     // 0-1
      estimatedNextDelay: { type: Number, default: 0 },    // predicted days
      itcRiskNextPeriod: { type: Number, default: 0 },     // predicted ₹ at risk
      recommendedAction: { type: String, default: "" },
    },

    // ── Feature Vector (for the ML model) ──
    featureVector: [Number],

    // ── Metadata ──
    lastAnalyzedAt: { type: Date, default: Date.now },
    dataPoints: { type: Number, default: 0 },              // how many records analyzed
  },
  { timestamps: true }
);

vendorRiskSchema.index({ user: 1, gstin: 1 }, { unique: true });
vendorRiskSchema.index({ user: 1, riskLevel: 1 });
vendorRiskSchema.index({ user: 1, "scores.overallScore": 1 });

module.exports = mongoose.model("VendorRisk", vendorRiskSchema);
