const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    period: {
      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
      },
      year: {
        type: Number,
        required: true,
      },
    },
    returnType: {
      type: String,
      enum: ["GSTR1", "GSTR3B"],
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "VALIDATED", "EXPORTED", "FILED"],
      default: "DRAFT",
    },
    summary: {
      totalInvoices: { type: Number, default: 0 },
      totalTaxableValue: { type: Number, default: 0 },
      totalCgst: { type: Number, default: 0 },
      totalSgst: { type: Number, default: 0 },
      totalIgst: { type: Number, default: 0 },
      totalGst: { type: Number, default: 0 },
      totalInvoiceValue: { type: Number, default: 0 },
      // GSTR-1 specific
      b2bCount: { type: Number, default: 0 },
      b2cCount: { type: Number, default: 0 },
      cdnCount: { type: Number, default: 0 },
      // GSTR-3B specific
      outputTaxLiability: { type: Number, default: 0 },
      itcAvailable: { type: Number, default: 0 },
      netTaxPayable: { type: Number, default: 0 },
    },
    validation: {
      totalErrors: { type: Number, default: 0 },
      totalWarnings: { type: Number, default: 0 },
      errors: [
        {
          invoiceId: mongoose.Schema.Types.ObjectId,
          invoiceNo: String,
          gstin: String,
          field: String,
          message: String,
          severity: {
            type: String,
            enum: ["ERROR", "WARNING"],
          },
        },
      ],
    },
    invoiceIds: [mongoose.Schema.Types.ObjectId],
    reconciledOnly: {
      type: Boolean,
      default: false,
    },
    approvedMismatches: [mongoose.Schema.Types.ObjectId],
  },
  { timestamps: true }
);

returnSchema.index({ user: 1, "period.year": 1, "period.month": 1, returnType: 1 });
returnSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("Return", returnSchema);
