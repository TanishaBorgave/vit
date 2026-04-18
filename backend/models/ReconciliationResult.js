const mongoose = require("mongoose");

const reconciliationResultSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
    gstInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
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
    invoiceNo: {
      type: String,
    },
    invoiceDate: {
      type: Date,
    },
    bookAmount: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    bookTaxableValue: {
      type: Number,
      default: 0,
    },
    gstTaxableValue: {
      type: Number,
      default: 0,
    },
    amountDifference: {
      type: Number,
      default: 0,
    },
    taxableValueDifference: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["MATCHED", "MISMATCH", "MISSING_IN_2B", "MISSING_IN_BOOKS"],
      required: true,
      index: true,
    },
    mismatchReasons: [String],
    itcAtRisk: {
      type: Number,
      default: 0,
    },
    reconciliationDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

reconciliationResultSchema.index({ user: 1, status: 1 });
reconciliationResultSchema.index({ user: 1, gstin: 1 });

module.exports = mongoose.model("ReconciliationResult", reconciliationResultSchema);
