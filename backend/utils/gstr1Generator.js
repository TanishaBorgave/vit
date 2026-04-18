/**
 * GSTR-1 Excel Generator
 * Generates GST-compliant Excel file with B2B, B2C, and CDN sheets
 * Compatible with GST Offline Utility format
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const HEADER_STYLE = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } },
  alignment: { horizontal: "center", vertical: "middle", wrapText: true },
  border: {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  },
};

const DATA_STYLE = {
  font: { size: 10, name: "Calibri" },
  alignment: { vertical: "middle" },
  border: {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  },
};

const AMOUNT_FORMAT = '#,##0.00';

/**
 * Classify invoices into B2B, B2C, and CDN categories
 */
function classifyInvoices(invoices) {
  const b2b = [];
  const b2c = [];
  const cdn = [];

  for (const inv of invoices) {
    const invoiceNo = String(inv.invoiceNo || "").toUpperCase();

    // Credit/Debit notes
    if (
      invoiceNo.startsWith("CR") ||
      invoiceNo.startsWith("CN") ||
      invoiceNo.startsWith("DN") ||
      invoiceNo.startsWith("DR") ||
      inv.taxableValue < 0
    ) {
      cdn.push(inv);
      continue;
    }

    // B2B: has valid GSTIN (not starting with URP or empty)
    if (inv.gstin && inv.gstin.length === 15 && !inv.gstin.startsWith("URP")) {
      b2b.push(inv);
    } else {
      b2c.push(inv);
    }
  }

  return { b2b, b2c, cdn };
}

/**
 * Determine GST rate from invoice
 */
function getGSTRate(inv) {
  if (!inv.taxableValue || inv.taxableValue === 0) return 0;
  const totalGst = (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);
  const rate = (totalGst / Math.abs(inv.taxableValue)) * 100;
  // Round to nearest standard rate
  const standardRates = [0, 0.1, 0.25, 1, 3, 5, 12, 18, 28];
  let closest = 0;
  let minDiff = Infinity;
  for (const r of standardRates) {
    const diff = Math.abs(rate - r);
    if (diff < minDiff) {
      minDiff = diff;
      closest = r;
    }
  }
  return closest;
}

/**
 * Determine supply type (Inter/Intra state)
 */
function getSupplyType(inv) {
  if (inv.igst && inv.igst > 0) return "Inter State";
  return "Intra State";
}

/**
 * Format date for Excel
 */
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Generate B2B sheet
 */
function generateB2BSheet(workbook, invoices) {
  const sheet = workbook.addWorksheet("b2b", {
    properties: { tabColor: { argb: "FF3B82F6" } },
  });

  // Columns matching GST offline utility
  sheet.columns = [
    { header: "GSTIN/UIN of Recipient", key: "gstin", width: 20 },
    { header: "Receiver Name", key: "receiverName", width: 25 },
    { header: "Invoice Number", key: "invoiceNo", width: 20 },
    { header: "Invoice date", key: "invoiceDate", width: 15 },
    { header: "Invoice Value", key: "invoiceValue", width: 15 },
    { header: "Place Of Supply", key: "placeOfSupply", width: 20 },
    { header: "Reverse Charge", key: "reverseCharge", width: 15 },
    { header: "Applicable % of Tax Rate", key: "applicableTaxRate", width: 15 },
    { header: "Invoice Type", key: "invoiceType", width: 15 },
    { header: "E-Commerce GSTIN", key: "ecomGstin", width: 20 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxableValue", width: 18 },
    { header: "Cess Amount", key: "cessAmount", width: 12 },
  ];

  // Apply header styles
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    Object.assign(cell, HEADER_STYLE);
    cell.font = HEADER_STYLE.font;
    cell.fill = HEADER_STYLE.fill;
    cell.alignment = HEADER_STYLE.alignment;
    cell.border = HEADER_STYLE.border;
  });
  headerRow.height = 30;

  // Add data
  for (const inv of invoices) {
    const stateCode = inv.gstin ? inv.gstin.substring(0, 2) : "";
    const row = sheet.addRow({
      gstin: inv.gstin,
      receiverName: inv.partyName || "",
      invoiceNo: inv.invoiceNo,
      invoiceDate: formatDate(inv.invoiceDate),
      invoiceValue: Math.round(inv.totalValue * 100) / 100,
      placeOfSupply: `${stateCode}-`,
      reverseCharge: "N",
      applicableTaxRate: "",
      invoiceType: "Regular",
      ecomGstin: "",
      rate: getGSTRate(inv),
      taxableValue: Math.round(inv.taxableValue * 100) / 100,
      cessAmount: 0,
    });

    row.eachCell((cell) => {
      cell.font = DATA_STYLE.font;
      cell.alignment = DATA_STYLE.alignment;
      cell.border = DATA_STYLE.border;
    });

    // Apply number format to amount columns
    row.getCell("invoiceValue").numFmt = AMOUNT_FORMAT;
    row.getCell("taxableValue").numFmt = AMOUNT_FORMAT;
    row.getCell("cessAmount").numFmt = AMOUNT_FORMAT;
  }

  // AutoFilter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: invoices.length + 1, column: 13 },
  };

  return sheet;
}

/**
 * Generate B2C sheet
 */
function generateB2CSheet(workbook, invoices) {
  const sheet = workbook.addWorksheet("b2cs", {
    properties: { tabColor: { argb: "FF22C55E" } },
  });

  sheet.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Place Of Supply", key: "placeOfSupply", width: 20 },
    { header: "Applicable % of Tax Rate", key: "applicableTaxRate", width: 15 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxableValue", width: 18 },
    { header: "Cess Amount", key: "cessAmount", width: 12 },
    { header: "E-Commerce GSTIN", key: "ecomGstin", width: 20 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_STYLE.font;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } };
    cell.alignment = HEADER_STYLE.alignment;
    cell.border = HEADER_STYLE.border;
  });
  headerRow.height = 30;

  // Aggregate B2C by rate and supply type
  const aggregated = new Map();
  for (const inv of invoices) {
    const rate = getGSTRate(inv);
    const supplyType = getSupplyType(inv);
    const key = `${rate}|${supplyType}`;

    if (!aggregated.has(key)) {
      aggregated.set(key, {
        type: "OE",
        placeOfSupply: supplyType,
        rate,
        taxableValue: 0,
        cessAmount: 0,
      });
    }
    const agg = aggregated.get(key);
    agg.taxableValue += inv.taxableValue || 0;
  }

  for (const [, data] of aggregated) {
    const row = sheet.addRow({
      type: data.type,
      placeOfSupply: data.placeOfSupply,
      applicableTaxRate: "",
      rate: data.rate,
      taxableValue: Math.round(data.taxableValue * 100) / 100,
      cessAmount: 0,
      ecomGstin: "",
    });

    row.eachCell((cell) => {
      cell.font = DATA_STYLE.font;
      cell.alignment = DATA_STYLE.alignment;
      cell.border = DATA_STYLE.border;
    });
    row.getCell("taxableValue").numFmt = AMOUNT_FORMAT;
    row.getCell("cessAmount").numFmt = AMOUNT_FORMAT;
  }

  return sheet;
}

/**
 * Generate Credit/Debit Notes sheet
 */
function generateCDNSheet(workbook, invoices) {
  const sheet = workbook.addWorksheet("cdnr", {
    properties: { tabColor: { argb: "FFF59E0B" } },
  });

  sheet.columns = [
    { header: "GSTIN/UIN of Recipient", key: "gstin", width: 20 },
    { header: "Receiver Name", key: "receiverName", width: 25 },
    { header: "Note/Refund Voucher Number", key: "noteNo", width: 20 },
    { header: "Note/Refund Voucher date", key: "noteDate", width: 15 },
    { header: "Document Type", key: "docType", width: 15 },
    { header: "Place Of Supply", key: "placeOfSupply", width: 20 },
    { header: "Note/Refund Voucher Value", key: "noteValue", width: 18 },
    { header: "Applicable % of Tax Rate", key: "applicableTaxRate", width: 15 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxableValue", width: 18 },
    { header: "Cess Amount", key: "cessAmount", width: 12 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_STYLE.font;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };
    cell.alignment = HEADER_STYLE.alignment;
    cell.border = HEADER_STYLE.border;
  });
  headerRow.height = 30;

  for (const inv of invoices) {
    const invoiceNo = String(inv.invoiceNo || "").toUpperCase();
    const isDebitNote =
      invoiceNo.startsWith("DN") || invoiceNo.startsWith("DR");

    const stateCode = inv.gstin ? inv.gstin.substring(0, 2) : "";
    const row = sheet.addRow({
      gstin: inv.gstin,
      receiverName: inv.partyName || "",
      noteNo: inv.invoiceNo,
      noteDate: formatDate(inv.invoiceDate),
      docType: isDebitNote ? "D" : "C",
      placeOfSupply: `${stateCode}-`,
      noteValue: Math.round(Math.abs(inv.totalValue) * 100) / 100,
      applicableTaxRate: "",
      rate: getGSTRate(inv),
      taxableValue: Math.round(Math.abs(inv.taxableValue) * 100) / 100,
      cessAmount: 0,
    });

    row.eachCell((cell) => {
      cell.font = DATA_STYLE.font;
      cell.alignment = DATA_STYLE.alignment;
      cell.border = DATA_STYLE.border;
    });
    row.getCell("noteValue").numFmt = AMOUNT_FORMAT;
    row.getCell("taxableValue").numFmt = AMOUNT_FORMAT;
    row.getCell("cessAmount").numFmt = AMOUNT_FORMAT;
  }

  return sheet;
}

/**
 * Generate complete GSTR-1 Excel workbook
 */
async function generateGSTR1Excel(invoices, period, userGstin, exportDir) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GST Recon Platform";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Classify invoices
  const { b2b, b2c, cdn } = classifyInvoices(invoices);

  // Generate sheets
  generateB2BSheet(workbook, b2b);
  generateB2CSheet(workbook, b2c);
  if (cdn.length > 0) {
    generateCDNSheet(workbook, cdn);
  }

  // Generate filename
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const periodStr = `${monthNames[period.month - 1]}_${period.year}`;
  const timestamp = Date.now();
  const fileName = `GSTR1_${periodStr}_${timestamp}.xlsx`;
  const filePath = path.join(exportDir, fileName);

  // Ensure directory exists
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  await workbook.xlsx.writeFile(filePath);

  const stats = fs.statSync(filePath);

  return {
    fileName,
    filePath,
    fileSize: stats.size,
    invoiceCount: invoices.length,
    breakdown: {
      b2b: b2b.length,
      b2c: b2c.length,
      cdn: cdn.length,
    },
  };
}

module.exports = {
  generateGSTR1Excel,
  classifyInvoices,
  getGSTRate,
};
