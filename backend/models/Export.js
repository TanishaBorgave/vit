const mongoose = require("mongoose");

const exportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    return: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Return",
      required: true,
    },
    exportType: {
      type: String,
      enum: ["GSTR1_EXCEL", "GSTR3B_EXCEL", "GSTR3B_SUMMARY"],
      required: true,
    },
    period: {
      month: { type: Number, required: true },
      year: { type: Number, required: true },
    },
    fileName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    invoiceCount: {
      type: Number,
      default: 0,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastDownloadedAt: Date,
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["GENERATING", "READY", "ERROR"],
      default: "GENERATING",
    },
    errorMessage: String,
  },
  { timestamps: true }
);

exportSchema.index({ user: 1, createdAt: -1 });
exportSchema.index({ user: 1, "period.year": 1, "period.month": 1 });

module.exports = mongoose.model("Export", exportSchema);
