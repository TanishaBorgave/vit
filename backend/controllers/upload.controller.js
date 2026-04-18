const multer = require("multer");
const path = require("path");
const XLSX = require("xlsx");
const Upload = require("../models/Upload");
const Invoice = require("../models/Invoice");
const logger = require("../utils/logger");
const {
  normalizeGSTIN,
  normalizeInvoiceNo,
  normalizeDate,
  normalizeAmount,
  mapColumns,
} = require("../utils/normalizer");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ];
  if (
    allowedTypes.includes(file.mimetype) ||
    file.originalname.match(/\.(xlsx|xls|csv)$/i)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files (.xlsx, .xls) and CSV files are allowed"), false);
  }
};

exports.uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).single("file");

exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    logger.upload(req.file.originalname, req.body.fileType, req.file.size);

    const { fileType } = req.body;
    if (!fileType || !["books", "gstr2b", "gstr1", "sales", "purchase"].includes(fileType)) {
      return res
        .status(400)
        .json({ message: "fileType is required (books, gstr2b, gstr1, sales, or purchase)" });
    }

    // Create upload record
    const upload = await Upload.create({
      user: req.userId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileType,
      filePath: req.file.path,
      status: "processing",
    });

    try {
      // Parse Excel
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rawData.length === 0) {
        upload.status = "error";
        upload.errorMessage = "No data found in the file";
        await upload.save();
        return res.status(400).json({ message: "No data found in the file" });
      }

      // Map columns
      const headers = Object.keys(rawData[0]);
      const columnMap = mapColumns(headers);

      // Process and normalize data
      const invoices = [];
      const source = fileType === "books" ? "books" : fileType;

      for (const row of rawData) {
        const gstin = normalizeGSTIN(
          columnMap.gstin ? row[columnMap.gstin] : ""
        );
        const invoiceNo = columnMap.invoiceNo
          ? String(row[columnMap.invoiceNo] || "")
          : "";
        const invoiceDate = normalizeDate(
          columnMap.invoiceDate ? row[columnMap.invoiceDate] : ""
        );

        // Skip rows without essential data
        if (!gstin || !invoiceNo) continue;

        const cgst = normalizeAmount(
          columnMap.cgst ? row[columnMap.cgst] : 0
        );
        const sgst = normalizeAmount(
          columnMap.sgst ? row[columnMap.sgst] : 0
        );
        const igst = normalizeAmount(
          columnMap.igst ? row[columnMap.igst] : 0
        );
        const taxableValue = normalizeAmount(
          columnMap.taxableValue ? row[columnMap.taxableValue] : 0
        );

        let gstAmount = normalizeAmount(
          columnMap.gstAmount ? row[columnMap.gstAmount] : 0
        );
        // If gstAmount not available, calculate from components
        if (gstAmount === 0 && (cgst + sgst + igst) > 0) {
          gstAmount = normalizeAmount(cgst + sgst + igst);
        }

        const totalValue = normalizeAmount(
          columnMap.totalValue ? row[columnMap.totalValue] : taxableValue + gstAmount
        );

        invoices.push({
          user: req.userId,
          upload: upload._id,
          gstin,
          partyName: columnMap.partyName ? String(row[columnMap.partyName] || "") : "",
          invoiceNo,
          invoiceNoNormalized: normalizeInvoiceNo(invoiceNo),
          invoiceDate: invoiceDate || new Date(),
          taxableValue,
          cgst,
          sgst,
          igst,
          gstAmount,
          totalValue,
          source,
          rawData: row,
        });
      }

      // Batch insert
      if (invoices.length > 0) {
        await Invoice.insertMany(invoices);
      }

      // Update upload status
      upload.rowCount = invoices.length;
      upload.status = "processed";
      upload.processedAt = new Date();
      await upload.save();

      logger.uploadProcessed(req.file.originalname, invoices.length, fileType);

      res.status(201).json({
        message: "File uploaded and processed successfully",
        upload: {
          id: upload._id,
          fileName: upload.originalName,
          fileType: upload.fileType,
          rowCount: invoices.length,
          status: upload.status,
          columnMapping: columnMap,
        },
      });
    } catch (parseError) {
      upload.status = "error";
      upload.errorMessage = parseError.message;
      await upload.save();
      logger.uploadError(req.file.originalname, parseError.message);
      throw parseError;
    }
  } catch (error) {
    next(error);
  }
};

exports.getUploads = async (req, res, next) => {
  try {
    const uploads = await Upload.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ uploads });
  } catch (error) {
    next(error);
  }
};

exports.deleteUpload = async (req, res, next) => {
  try {
    const upload = await Upload.findOne({
      _id: req.params.id,
      user: req.userId,
    });
    if (!upload) {
      return res.status(404).json({ message: "Upload not found" });
    }

    // Delete associated invoices
    await Invoice.deleteMany({ upload: upload._id });
    await Upload.deleteOne({ _id: upload._id });

    logger.uploadDeleted(upload.originalName);
    res.json({ message: "Upload and associated data deleted" });
  } catch (error) {
    next(error);
  }
};
