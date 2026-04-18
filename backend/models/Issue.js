const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reconciliationResult: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReconciliationResult",
      required: true,
    },
    gstin: {
      type: String,
      required: true,
      index: true,
    },
    partyName: String,
    invoiceNo: String,
    issueType: {
      type: String,
      enum: ["MISMATCH", "MISSING_IN_2B", "MISSING_IN_BOOKS"],
      required: true,
    },
    description: String,
    amountDifference: {
      type: Number,
      default: 0,
    },
    itcAtRisk: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["OPEN", "FOLLOWED_UP", "RESOLVED", "IGNORED"],
      default: "OPEN",
      index: true,
    },
    followUpDate: Date,
    resolvedDate: Date,
    notes: String,
    timeline: [
      {
        action: String,
        status: String,
        date: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

issueSchema.index({ user: 1, gstin: 1, status: 1 });

module.exports = mongoose.model("Issue", issueSchema);
