/**
 * GST Data Validation Engine
 * Validates invoice data before export to ensure GST compliance
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validate GSTIN format
 */
function validateGSTIN(gstin) {
  if (!gstin) return { valid: false, message: "GSTIN is missing" };
  const cleaned = gstin.toUpperCase().replace(/\s+/g, "");
  if (!GSTIN_REGEX.test(cleaned)) {
    return { valid: false, message: `Invalid GSTIN format: ${gstin}` };
  }
  return { valid: true };
}

/**
 * Validate invoice number
 */
function validateInvoiceNo(invoiceNo) {
  if (!invoiceNo || String(invoiceNo).trim() === "") {
    return { valid: false, message: "Invoice number is missing" };
  }
  if (String(invoiceNo).length > 16) {
    return {
      valid: false,
      message: `Invoice number exceeds 16 characters: ${invoiceNo}`,
    };
  }
  return { valid: true };
}

/**
 * Validate invoice date within a return period
 */
function validateInvoiceDate(invoiceDate, periodMonth, periodYear) {
  if (!invoiceDate) {
    return { valid: false, message: "Invoice date is missing" };
  }

  const date = new Date(invoiceDate);
  if (isNaN(date.getTime())) {
    return { valid: false, message: "Invalid invoice date" };
  }

  // Financial year check - allow invoices from the same financial year
  const invMonth = date.getMonth() + 1;
  const invYear = date.getFullYear();

  // Determine financial year of the return period
  const fyStart = periodMonth >= 4 ? periodYear : periodYear - 1;
  const fyEnd = fyStart + 1;

  // Invoice should be within financial year (Apr fyStart to Mar fyEnd)
  const fyStartDate = new Date(fyStart, 3, 1); // April 1
  const fyEndDate = new Date(fyEnd, 2, 31, 23, 59, 59); // March 31

  if (date < fyStartDate || date > fyEndDate) {
    return {
      valid: false,
      severity: "WARNING",
      message: `Invoice date ${date.toLocaleDateString("en-IN")} is outside the financial year ${fyStart}-${fyEnd}`,
    };
  }

  // Check if date is in the future
  if (date > new Date()) {
    return {
      valid: false,
      message: `Invoice date ${date.toLocaleDateString("en-IN")} is in the future`,
    };
  }

  return { valid: true };
}

/**
 * Validate tax calculation correctness
 */
function validateTaxCalculation(invoice) {
  const errors = [];

  const { taxableValue, cgst, sgst, igst, gstAmount } = invoice;

  // Check negative values
  if (taxableValue < 0) {
    errors.push({
      field: "taxableValue",
      message: "Taxable value is negative",
      severity: "WARNING",
    });
  }

  // Verify GST component sum
  const componentSum = Math.round(((cgst || 0) + (sgst || 0) + (igst || 0)) * 100) / 100;
  if (gstAmount > 0 && componentSum > 0) {
    const diff = Math.abs(gstAmount - componentSum);
    if (diff > 1) {
      errors.push({
        field: "gstAmount",
        message: `GST amount (₹${gstAmount}) does not match sum of CGST+SGST+IGST (₹${componentSum})`,
        severity: "WARNING",
      });
    }
  }

  // Check IGST vs CGST+SGST (shouldn't have both)
  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    errors.push({
      field: "igst",
      message: "Invoice has both IGST and CGST/SGST. Only one type should apply.",
      severity: "WARNING",
    });
  }

  // Verify CGST = SGST for intra-state
  if (cgst > 0 && sgst > 0) {
    const diff = Math.abs(cgst - sgst);
    if (diff > 1) {
      errors.push({
        field: "cgst",
        message: `CGST (₹${cgst}) and SGST (₹${sgst}) should be equal for intra-state supplies`,
        severity: "WARNING",
      });
    }
  }

  // Check reasonable GST rates (common rates: 5%, 12%, 18%, 28%)
  if (taxableValue > 0 && gstAmount > 0) {
    const effectiveRate = Math.round((gstAmount / taxableValue) * 100);
    const validRates = [0, 0.1, 0.25, 1, 3, 5, 6, 7.5, 9, 12, 14, 18, 28];
    const isStandardRate = validRates.some(
      (r) => Math.abs(effectiveRate - r) <= 1
    );
    if (!isStandardRate && effectiveRate > 30) {
      errors.push({
        field: "gstAmount",
        message: `Effective GST rate (${effectiveRate}%) seems unusually high`,
        severity: "WARNING",
      });
    }
  }

  return errors;
}

/**
 * Check for duplicate invoices
 */
function findDuplicates(invoices) {
  const seen = new Map();
  const duplicates = [];

  for (const inv of invoices) {
    const key = `${inv.gstin}|${inv.invoiceNo}`;
    if (seen.has(key)) {
      duplicates.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        field: "invoiceNo",
        message: `Duplicate invoice: ${inv.invoiceNo} for GSTIN ${inv.gstin}`,
        severity: "ERROR",
      });
    } else {
      seen.set(key, inv._id);
    }
  }

  return duplicates;
}

/**
 * Validate all invoices for a return period
 */
function validateInvoices(invoices, periodMonth, periodYear) {
  const errors = [];

  // Check duplicates first
  const duplicates = findDuplicates(invoices);
  errors.push(...duplicates);

  for (const inv of invoices) {
    // Validate GSTIN
    const gstinResult = validateGSTIN(inv.gstin);
    if (!gstinResult.valid) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        field: "gstin",
        message: gstinResult.message,
        severity: "ERROR",
      });
    }

    // Validate Invoice Number
    const invNoResult = validateInvoiceNo(inv.invoiceNo);
    if (!invNoResult.valid) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo || "(empty)",
        gstin: inv.gstin,
        field: "invoiceNo",
        message: invNoResult.message,
        severity: "ERROR",
      });
    }

    // Validate Date
    const dateResult = validateInvoiceDate(inv.invoiceDate, periodMonth, periodYear);
    if (!dateResult.valid) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        field: "invoiceDate",
        message: dateResult.message,
        severity: dateResult.severity || "ERROR",
      });
    }

    // Validate Tax Calculations
    const taxErrors = validateTaxCalculation(inv);
    for (const err of taxErrors) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        ...err,
      });
    }
  }

  const totalErrors = errors.filter((e) => e.severity === "ERROR").length;
  const totalWarnings = errors.filter((e) => e.severity === "WARNING").length;

  return { errors, totalErrors, totalWarnings };
}

module.exports = {
  validateGSTIN,
  validateInvoiceNo,
  validateInvoiceDate,
  validateTaxCalculation,
  findDuplicates,
  validateInvoices,
};
