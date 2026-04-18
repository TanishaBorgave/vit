/**
 * PDF Invoice Parser
 * Extracts invoice data from PDF files using text pattern matching
 * Supports common Indian invoice formats
 */

const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const { normalizeGSTIN, normalizeAmount, normalizeDate } = require("./normalizer");

// Common regex patterns for Indian invoices
const PATTERNS = {
  gstin: /(?:GSTIN|GST\s*No|GST\s*IN|GSTIN\/UIN)[\s:.\-]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/gi,
  gstinStandalone: /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/g,
  invoiceNo: /(?:Invoice\s*(?:No|Number|#|Num)|Bill\s*(?:No|Number)|Document\s*No|Inv\s*No|Voucher\s*No)[\s:.\-#]*([A-Za-z0-9\-\/\\._]+)/i,
  invoiceDate: /(?:Invoice\s*Date|Bill\s*Date|Date\s*of\s*Invoice|Dated|Document\s*Date|Inv\.?\s*Date)[\s:.\-]*(\d{1,2}[\s\-\/\.]\d{1,2}[\s\-\/\.]\d{2,4}|\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})/i,
  dateGeneric: /\b(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})\b/g,
  taxableValue: /(?:Taxable\s*(?:Value|Amount)|Assessable\s*Value|Base\s*Amount|Sub\s*Total|Net\s*Amount|Amount\s*Before\s*Tax)[\s:.\-₹Rs]*([0-9,]+\.?\d{0,2})/i,
  cgst: /(?:CGST|Central\s*GST)[\s:@.\-%0-9]*?₹?\s*([0-9,]+\.?\d{0,2})/i,
  sgst: /(?:SGST|UTGST|State\s*GST)[\s:@.\-%0-9]*?₹?\s*([0-9,]+\.?\d{0,2})/i,
  igst: /(?:IGST|Integrated\s*GST)[\s:@.\-%0-9]*?₹?\s*([0-9,]+\.?\d{0,2})/i,
  totalAmount: /(?:Total\s*(?:Amount|Value|Invoice\s*Value)|Grand\s*Total|Net\s*Payable|Amount\s*Payable|Bill\s*Amount|Invoice\s*Value|Total\s*₹)[\s:.\-₹Rs]*([0-9,]+\.?\d{0,2})/i,
  gstAmount: /(?:Total\s*(?:Tax|GST)|GST\s*Amount|Tax\s*Amount)[\s:.\-₹Rs]*([0-9,]+\.?\d{0,2})/i,
  partyName: /(?:Sold\s*To|Bill\s*To|Buyer|Customer|Ship\s*To|Consignee|Party\s*Name|Billed\s*To|M\/s)[\s:.\-]*([A-Za-z][A-Za-z\s&.,]+)/i,
  sellerName: /(?:Seller|From|Supplier|Vendor|Company|Firm)[\s:.\-]*([A-Za-z][A-Za-z\s&.,]+)/i,
  hsnCode: /(?:HSN|SAC|HSN\/SAC)[\s:.\-]*(\d{4,8})/i,
  placeOfSupply: /(?:Place\s*of\s*Supply|POS)[\s:.\-]*([A-Za-z\s]+(?:\(\d{2}\))?)/i,
};

/**
 * Parse a number from Indian format (e.g., "1,23,456.78")
 */
function parseIndianNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[,\s₹Rs]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Extract all GSTIN numbers from text
 */
function extractGSTINs(text) {
  const gstins = new Set();
  let match;

  // First try labeled GSTIN
  const labeledRegex = new RegExp(PATTERNS.gstin.source, "gi");
  while ((match = labeledRegex.exec(text)) !== null) {
    gstins.add(normalizeGSTIN(match[1]));
  }

  // Then standalone GSTIN patterns
  const standaloneRegex = new RegExp(PATTERNS.gstinStandalone.source, "g");
  while ((match = standaloneRegex.exec(text)) !== null) {
    gstins.add(normalizeGSTIN(match[1]));
  }

  return Array.from(gstins).filter((g) => g.length === 15);
}

/**
 * Extract invoice data from PDF text
 */
function extractInvoiceData(text, fileName) {
  const data = {
    invoiceNo: "",
    invoiceDate: null,
    gstin: "",
    partyName: "",
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    gstAmount: 0,
    totalValue: 0,
    rawText: text.substring(0, 2000), // Store first 2000 chars for debugging
    extractionConfidence: "LOW",
    extractedFields: [],
  };

  // Extract Invoice Number
  const invNoMatch = text.match(PATTERNS.invoiceNo);
  if (invNoMatch) {
    data.invoiceNo = invNoMatch[1].trim();
    data.extractedFields.push("invoiceNo");
  } else {
    // Fallback: look for common invoice number patterns in text
    const fallbackPatterns = [
      /\b(INV[-\/]?\d{3,})\b/i,
      /\b(BILL[-\/]?\d{3,})\b/i,
      /\b(GST[-\/]?INV[-\/]?\d{3,})\b/i,
      /\b([A-Z]{2,5}[-\/]\d{4}[-\/]\d{3,})\b/,
    ];
    let found = false;
    for (const pat of fallbackPatterns) {
      const m = text.match(pat);
      if (m) {
        data.invoiceNo = m[1].trim();
        data.extractedFields.push("invoiceNo");
        found = true;
        break;
      }
    }
    if (!found) {
      // Use filename as last resort
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").replace(/[^A-Za-z0-9\-_]/g, "-");
      data.invoiceNo = nameWithoutExt;
    }
  }

  // Extract Invoice Date
  const dateMatch = text.match(PATTERNS.invoiceDate);
  if (dateMatch) {
    data.invoiceDate = normalizeDate(dateMatch[1]);
    data.extractedFields.push("invoiceDate");
  } else {
    // Try generic date
    const genericDates = text.match(PATTERNS.dateGeneric);
    if (genericDates && genericDates.length > 0) {
      data.invoiceDate = normalizeDate(genericDates[0]);
      data.extractedFields.push("invoiceDate");
    }
  }

  // Extract GSTIN(s)
  const gstins = extractGSTINs(text);
  if (gstins.length > 0) {
    // Use first GSTIN as the party GSTIN (usually buyer/seller)
    data.gstin = gstins[0];
    data.extractedFields.push("gstin");
    // If multiple GSTINs, the second is usually the other party
    if (gstins.length > 1) {
      data.gstin = gstins[1]; // Second GSTIN is usually buyer
    }
  }

  // Extract Party Name
  const partyMatch = text.match(PATTERNS.partyName);
  if (partyMatch) {
    data.partyName = partyMatch[1].trim().substring(0, 100);
    data.extractedFields.push("partyName");
  } else {
    const sellerMatch = text.match(PATTERNS.sellerName);
    if (sellerMatch) {
      data.partyName = sellerMatch[1].trim().substring(0, 100);
      data.extractedFields.push("partyName");
    }
  }

  // Extract Taxable Value
  const taxableMatch = text.match(PATTERNS.taxableValue);
  if (taxableMatch) {
    data.taxableValue = parseIndianNumber(taxableMatch[1]);
    data.extractedFields.push("taxableValue");
  }

  // Extract CGST
  const cgstMatch = text.match(PATTERNS.cgst);
  if (cgstMatch) {
    data.cgst = parseIndianNumber(cgstMatch[1]);
    data.extractedFields.push("cgst");
  }

  // Extract SGST
  const sgstMatch = text.match(PATTERNS.sgst);
  if (sgstMatch) {
    data.sgst = parseIndianNumber(sgstMatch[1]);
    data.extractedFields.push("sgst");
  }

  // Extract IGST
  const igstMatch = text.match(PATTERNS.igst);
  if (igstMatch) {
    data.igst = parseIndianNumber(igstMatch[1]);
    data.extractedFields.push("igst");
  }

  // Extract GST Amount
  const gstAmtMatch = text.match(PATTERNS.gstAmount);
  if (gstAmtMatch) {
    data.gstAmount = parseIndianNumber(gstAmtMatch[1]);
    data.extractedFields.push("gstAmount");
  }

  // Calculate gstAmount from components if not found directly
  if (data.gstAmount === 0 && (data.cgst + data.sgst + data.igst) > 0) {
    data.gstAmount = normalizeAmount(data.cgst + data.sgst + data.igst);
  }

  // Extract Total Amount
  const totalMatch = text.match(PATTERNS.totalAmount);
  if (totalMatch) {
    data.totalValue = parseIndianNumber(totalMatch[1]);
    data.extractedFields.push("totalValue");
  }

  // If taxable value not found, try to calculate from total - gst
  if (data.taxableValue === 0 && data.totalValue > 0 && data.gstAmount > 0) {
    data.taxableValue = normalizeAmount(data.totalValue - data.gstAmount);
    data.extractedFields.push("taxableValue(calculated)");
  }

  // If total not found, calculate from taxable + gst
  if (data.totalValue === 0 && data.taxableValue > 0) {
    data.totalValue = normalizeAmount(data.taxableValue + data.gstAmount);
  }

  // Determine extraction confidence
  const criticalFields = ["invoiceNo", "gstin", "taxableValue"];
  const foundCritical = criticalFields.filter((f) => data.extractedFields.includes(f));
  if (foundCritical.length >= 3) {
    data.extractionConfidence = "HIGH";
  } else if (foundCritical.length >= 2) {
    data.extractionConfidence = "MEDIUM";
  } else {
    data.extractionConfidence = "LOW";
  }

  return data;
}

/**
 * Parse a PDF file and extract invoice data
 */
async function parsePDFInvoice(filePath, fileName) {
  const dataBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(dataBuffer);
  const parser = new PDFParse(uint8Array);
  await parser.load();

  // getText() returns { pages: [{ text: '...' }, ...] }
  const result = await parser.getText();
  const pages = result?.pages || [];
  const numPages = pages.length || 1;

  // Combine text from all pages
  let fullText = "";
  for (const page of pages) {
    if (page?.text) fullText += page.text + "\n";
  }

  const text = fullText;

  if (!text.trim()) {
    return {
      success: false,
      error: "PDF contains no extractable text. It may be a scanned image.",
      data: null,
    };
  }

  const invoiceData = extractInvoiceData(text, fileName);

  return {
    success: true,
    data: invoiceData,
    pageCount: numPages,
    textLength: text.length,
  };
}

/**
 * Parse multiple PDF files
 */
async function parseMultiplePDFs(files) {
  const results = [];

  for (const file of files) {
    try {
      const result = await parsePDFInvoice(file.path, file.originalname || file.filename);
      results.push({
        fileName: file.originalname || file.filename,
        filePath: file.path,
        ...result,
      });
    } catch (error) {
      results.push({
        fileName: file.originalname || file.filename,
        filePath: file.path,
        success: false,
        error: error.message,
        data: null,
      });
    }
  }

  return results;
}

module.exports = {
  parsePDFInvoice,
  parseMultiplePDFs,
  extractInvoiceData,
  extractGSTINs,
};
