const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    upload: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Upload",
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
    invoiceNo: {
      type: String,
      required: true,
      index: true,
    },
    invoiceNoNormalized: {
      type: String,
      index: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    taxableValue: {
      type: Number,
      required: true,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    igst: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      required: true,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ["books", "gstr2b", "gstr1", "sales", "purchase"],
      required: true,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Compound index for matching
invoiceSchema.index({ user: 1, gstin: 1, invoiceNoNormalized: 1, source: 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
