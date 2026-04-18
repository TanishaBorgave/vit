const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["books", "gstr2b", "gstr1", "sales", "purchase"],
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    rowCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "processed", "error"],
      default: "uploaded",
    },
    errorMessage: String,
    processedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Upload", uploadSchema);
