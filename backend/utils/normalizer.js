/**
 * Normalize GSTIN - uppercase, remove spaces
 */
function normalizeGSTIN(gstin) {
  if (!gstin) return "";
  return String(gstin).toUpperCase().replace(/\s+/g, "").trim();
}

/**
 * Normalize invoice number - uppercase, remove spaces, dashes, special chars
 */
function normalizeInvoiceNo(invoiceNo) {
  if (!invoiceNo) return "";
  return String(invoiceNo)
    .toUpperCase()
    .replace(/[\s\-\/\\\.]+/g, "")
    .trim();
}

/**
 * Parse date from various formats to ISO Date
 */
function normalizeDate(dateValue) {
  if (!dateValue) return null;

  // If already a Date object
  if (dateValue instanceof Date) {
    return isNaN(dateValue) ? null : dateValue;
  }

  const str = String(dateValue).trim();

  // Try Excel serial date number
  if (/^\d{5}$/.test(str)) {
    const excelEpoch = new Date(1899, 11, 30);
    const days = parseInt(str, 10);
    const date = new Date(excelEpoch.getTime() + days * 86400000);
    return isNaN(date) ? null : date;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const date = new Date(
      parseInt(ddmmyyyy[3]),
      parseInt(ddmmyyyy[2]) - 1,
      parseInt(ddmmyyyy[1])
    );
    return isNaN(date) ? null : date;
  }

  // Try YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyymmdd) {
    const date = new Date(
      parseInt(yyyymmdd[1]),
      parseInt(yyyymmdd[2]) - 1,
      parseInt(yyyymmdd[3])
    );
    return isNaN(date) ? null : date;
  }

  // Fallback to Date.parse
  const parsed = new Date(str);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Normalize numeric value - round to 2 decimal places
 */
function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Map Excel columns to our schema
 * Tries multiple common column name patterns
 */
function mapColumns(headers) {
  const mapping = {};
  const lowerHeaders = headers.map((h) => String(h || "").toLowerCase().trim());

  // GSTIN
  const gstinIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes("gstin") ||
      h.includes("gst no") ||
      h.includes("gst_no") ||
      h.includes("supplier gstin") ||
      h === "gstin/uin"
  );
  mapping.gstin = gstinIdx >= 0 ? headers[gstinIdx] : null;

  // Party Name
  const partyIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes("party") ||
      h.includes("supplier") ||
      h.includes("vendor") ||
      h.includes("name") ||
      h.includes("trade name")
  );
  mapping.partyName = partyIdx >= 0 ? headers[partyIdx] : null;

  // Invoice Number
  const invNoIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes("invoice no") ||
      h.includes("invoice_no") ||
      h.includes("inv no") ||
      h.includes("invoice number") ||
      h.includes("bill no") ||
      h.includes("document no") ||
      h.includes("doc no")
  );
  mapping.invoiceNo = invNoIdx >= 0 ? headers[invNoIdx] : null;

  // Invoice Date
  const invDateIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes("invoice date") ||
      h.includes("invoice_date") ||
      h.includes("inv date") ||
      h.includes("bill date") ||
      h.includes("document date") ||
      h.includes("doc date") ||
      h === "date"
  );
  mapping.invoiceDate = invDateIdx >= 0 ? headers[invDateIdx] : null;

  // Taxable Value
  const taxableIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes("taxable") ||
      h.includes("assessable") ||
      h.includes("base amount") ||
      h.includes("net amount")
  );
  mapping.taxableValue = taxableIdx >= 0 ? headers[taxableIdx] : null;

  // CGST
  const cgstIdx = lowerHeaders.findIndex((h) => h.includes("cgst") && !h.includes("sgst"));
  mapping.cgst = cgstIdx >= 0 ? headers[cgstIdx] : null;

  // SGST
  const sgstIdx = lowerHeaders.findIndex((h) => h.includes("sgst") || h.includes("utgst"));
  mapping.sgst = sgstIdx >= 0 ? headers[sgstIdx] : null;

  // IGST
  const igstIdx = lowerHeaders.findIndex((h) => h.includes("igst"));
  mapping.igst = igstIdx >= 0 ? headers[igstIdx] : null;

  // GST Amount / Tax Amount
  const gstAmtIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes("gst amount") ||
      h.includes("tax amount") ||
      h.includes("total tax") ||
      h.includes("gst_amount") ||
      h.includes("tax_amount")
  );
  mapping.gstAmount = gstAmtIdx >= 0 ? headers[gstAmtIdx] : null;

  // Total Value
  const totalIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes("total") ||
      h.includes("gross") ||
      h.includes("invoice value") ||
      h.includes("inv value")
  );
  mapping.totalValue = totalIdx >= 0 ? headers[totalIdx] : null;

  return mapping;
}

module.exports = {
  normalizeGSTIN,
  normalizeInvoiceNo,
  normalizeDate,
  normalizeAmount,
  mapColumns,
};
