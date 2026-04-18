/**
 * GSTR-3B Summary Generator
 * Computes tax liability, ITC, and net payable from reconciled data
 * Generates summary Excel report
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const HEADER_STYLE = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } },
  alignment: { horizontal: "center", vertical: "middle", wrapText: true },
  border: {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  },
};

const SECTION_STYLE = {
  font: { bold: true, size: 11, name: "Calibri", color: { argb: "FF1E293B" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } },
  alignment: { vertical: "middle" },
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

const TOTAL_STYLE = {
  font: { bold: true, size: 11, name: "Calibri", color: { argb: "FF1E40AF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } },
  alignment: { vertical: "middle" },
  border: {
    top: { style: "medium" },
    left: { style: "thin" },
    bottom: { style: "medium" },
    right: { style: "thin" },
  },
};

const AMOUNT_FORMAT = '#,##0.00';

/**
 * Compute GSTR-3B summary from sales and purchase invoices
 */
function computeGSTR3BSummary(salesInvoices, purchaseInvoices, reconResults) {
  // 3.1 - Outward supplies (from sales)
  const outwardSupplies = {
    taxableValue: 0,
    igst: 0,
    cgst: 0,
    sgst: 0,
    cess: 0,
  };

  for (const inv of salesInvoices) {
    outwardSupplies.taxableValue += inv.taxableValue || 0;
    outwardSupplies.igst += inv.igst || 0;
    outwardSupplies.cgst += inv.cgst || 0;
    outwardSupplies.sgst += inv.sgst || 0;
  }

  // 4 - ITC Available (from matched/valid purchases)
  const itcAvailable = {
    igst: 0,
    cgst: 0,
    sgst: 0,
    cess: 0,
  };

  const itcAtRisk = {
    igst: 0,
    cgst: 0,
    sgst: 0,
    total: 0,
  };

  // If we have reconciliation results, use matched invoices for ITC
  if (reconResults && reconResults.length > 0) {
    const matchedGstInvoiceIds = new Set();
    const riskInvoiceIds = new Set();

    for (const result of reconResults) {
      if (result.status === "MATCHED" && result.gstInvoice) {
        matchedGstInvoiceIds.add(result.gstInvoice.toString());
      } else if (result.status === "MISMATCH" || result.status === "MISSING_IN_2B") {
        if (result.bookInvoice) {
          riskInvoiceIds.add(result.bookInvoice.toString());
        }
        itcAtRisk.total += result.itcAtRisk || 0;
      }
    }

    for (const inv of purchaseInvoices) {
      const invId = inv._id.toString();
      if (matchedGstInvoiceIds.has(invId) || !reconResults.length) {
        itcAvailable.igst += inv.igst || 0;
        itcAvailable.cgst += inv.cgst || 0;
        itcAvailable.sgst += inv.sgst || 0;
      }
      if (riskInvoiceIds.has(invId)) {
        itcAtRisk.igst += inv.igst || 0;
        itcAtRisk.cgst += inv.cgst || 0;
        itcAtRisk.sgst += inv.sgst || 0;
      }
    }
  } else {
    // No reconciliation - use all purchase invoices
    for (const inv of purchaseInvoices) {
      itcAvailable.igst += inv.igst || 0;
      itcAvailable.cgst += inv.cgst || 0;
      itcAvailable.sgst += inv.sgst || 0;
    }
  }

  // Round all values
  const round = (v) => Math.round(v * 100) / 100;

  const totalOutputTax = round(
    outwardSupplies.igst + outwardSupplies.cgst + outwardSupplies.sgst
  );
  const totalITC = round(itcAvailable.igst + itcAvailable.cgst + itcAvailable.sgst);
  const netPayable = round(Math.max(0, totalOutputTax - totalITC));

  return {
    outwardSupplies: {
      taxableValue: round(outwardSupplies.taxableValue),
      igst: round(outwardSupplies.igst),
      cgst: round(outwardSupplies.cgst),
      sgst: round(outwardSupplies.sgst),
      cess: 0,
    },
    itcAvailable: {
      igst: round(itcAvailable.igst),
      cgst: round(itcAvailable.cgst),
      sgst: round(itcAvailable.sgst),
      cess: 0,
    },
    itcAtRisk: {
      igst: round(itcAtRisk.igst),
      cgst: round(itcAtRisk.cgst),
      sgst: round(itcAtRisk.sgst),
      total: round(itcAtRisk.total),
    },
    taxPayable: {
      igst: round(Math.max(0, outwardSupplies.igst - itcAvailable.igst)),
      cgst: round(Math.max(0, outwardSupplies.cgst - itcAvailable.cgst)),
      sgst: round(Math.max(0, outwardSupplies.sgst - itcAvailable.sgst)),
      cess: 0,
    },
    totalOutputTax,
    totalITC,
    netPayable,
    salesCount: salesInvoices.length,
    purchaseCount: purchaseInvoices.length,
  };
}

/**
 * Generate GSTR-3B summary Excel
 */
async function generateGSTR3BExcel(summary, period, exportDir) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GST Recon Platform";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("GSTR-3B Summary", {
    properties: { tabColor: { argb: "FF7C3AED" } },
  });

  sheet.columns = [
    { key: "description", width: 45 },
    { key: "igst", width: 18 },
    { key: "cgst", width: 18 },
    { key: "sgst", width: 18 },
    { key: "cess", width: 15 },
    { key: "total", width: 20 },
  ];

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Title
  const titleRow = sheet.addRow([
    `GSTR-3B Summary - ${monthNames[period.month - 1]} ${period.year}`,
  ]);
  titleRow.font = { bold: true, size: 16, name: "Calibri", color: { argb: "FF1E293B" } };
  titleRow.height = 35;
  sheet.mergeCells("A1:F1");
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  // Generated date
  const dateRow = sheet.addRow([
    `Generated on: ${new Date().toLocaleString("en-IN")}`,
  ]);
  dateRow.font = { size: 9, color: { argb: "FF94A3B8" }, name: "Calibri" };
  sheet.mergeCells("A2:F2");
  dateRow.getCell(1).alignment = { horizontal: "center" };

  // Blank row
  sheet.addRow([]);

  // Headers
  const headerRow = sheet.addRow([
    "Description",
    "IGST (₹)",
    "CGST (₹)",
    "SGST/UTGST (₹)",
    "Cess (₹)",
    "Total (₹)",
  ]);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_STYLE.font;
    cell.fill = HEADER_STYLE.fill;
    cell.alignment = HEADER_STYLE.alignment;
    cell.border = HEADER_STYLE.border;
  });
  headerRow.height = 28;

  // Section 3.1 - Output Tax
  const section1 = sheet.addRow([
    "3.1 - Outward Supplies (Output Tax Liability)",
    "",
    "",
    "",
    "",
    "",
  ]);
  section1.eachCell((cell) => {
    cell.font = SECTION_STYLE.font;
    cell.fill = SECTION_STYLE.fill;
    cell.border = SECTION_STYLE.border;
  });
  section1.height = 24;

  const addDataRow = (desc, igst, cgst, sgst, cess) => {
    const total = (igst || 0) + (cgst || 0) + (sgst || 0) + (cess || 0);
    const row = sheet.addRow([desc, igst, cgst, sgst, cess, total]);
    row.eachCell((cell, colNumber) => {
      cell.font = DATA_STYLE.font;
      cell.alignment = DATA_STYLE.alignment;
      cell.border = DATA_STYLE.border;
      if (colNumber >= 2) {
        cell.numFmt = AMOUNT_FORMAT;
      }
    });
    return row;
  };

  const addTotalRow = (desc, igst, cgst, sgst, cess) => {
    const total = (igst || 0) + (cgst || 0) + (sgst || 0) + (cess || 0);
    const row = sheet.addRow([desc, igst, cgst, sgst, cess, total]);
    row.eachCell((cell, colNumber) => {
      cell.font = TOTAL_STYLE.font;
      cell.fill = TOTAL_STYLE.fill;
      cell.border = TOTAL_STYLE.border;
      if (colNumber >= 2) {
        cell.numFmt = AMOUNT_FORMAT;
      }
    });
    row.height = 24;
    return row;
  };

  addDataRow(
    "(a) Outward taxable supplies (other than zero-rated, nil-rated, exempt)",
    summary.outwardSupplies.igst,
    summary.outwardSupplies.cgst,
    summary.outwardSupplies.sgst,
    summary.outwardSupplies.cess
  );

  addDataRow("(b) Outward taxable supplies (zero-rated)", 0, 0, 0, 0);
  addDataRow("(c) Other outward supplies (nil-rated, exempt)", 0, 0, 0, 0);
  addDataRow("(d) Inward supplies (liable to reverse charge)", 0, 0, 0, 0);
  addDataRow("(e) Non-GST outward supplies", 0, 0, 0, 0);

  addTotalRow(
    "Total Output Tax Liability",
    summary.outwardSupplies.igst,
    summary.outwardSupplies.cgst,
    summary.outwardSupplies.sgst,
    0
  );

  // Blank row
  sheet.addRow([]);

  // Section 4 - ITC
  const section2 = sheet.addRow([
    "4 - Eligible ITC (Input Tax Credit)",
    "",
    "",
    "",
    "",
    "",
  ]);
  section2.eachCell((cell) => {
    cell.font = SECTION_STYLE.font;
    cell.fill = SECTION_STYLE.fill;
    cell.border = SECTION_STYLE.border;
  });
  section2.height = 24;

  addDataRow(
    "(A) ITC Available (from reconciled invoices)",
    summary.itcAvailable.igst,
    summary.itcAvailable.cgst,
    summary.itcAvailable.sgst,
    summary.itcAvailable.cess
  );

  addDataRow("(B) ITC Reversed", 0, 0, 0, 0);

  addTotalRow(
    "Net ITC Available (A - B)",
    summary.itcAvailable.igst,
    summary.itcAvailable.cgst,
    summary.itcAvailable.sgst,
    0
  );

  // Blank row
  sheet.addRow([]);

  // ITC at Risk section
  if (summary.itcAtRisk.total > 0) {
    const riskSection = sheet.addRow([
      "⚠ ITC at Risk (Unmatched/Mismatched Invoices)",
      "",
      "",
      "",
      "",
      "",
    ]);
    riskSection.eachCell((cell) => {
      cell.font = { bold: true, size: 11, name: "Calibri", color: { argb: "FFDC2626" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      cell.border = SECTION_STYLE.border;
    });
    riskSection.height = 24;

    addDataRow(
      "ITC at Risk",
      summary.itcAtRisk.igst,
      summary.itcAtRisk.cgst,
      summary.itcAtRisk.sgst,
      0
    );

    sheet.addRow([]);
  }

  // Section 6 - Tax Payable
  const section3 = sheet.addRow([
    "6.1 - Payment of Tax",
    "",
    "",
    "",
    "",
    "",
  ]);
  section3.eachCell((cell) => {
    cell.font = SECTION_STYLE.font;
    cell.fill = SECTION_STYLE.fill;
    cell.border = SECTION_STYLE.border;
  });
  section3.height = 24;

  addDataRow(
    "Tax Payable",
    summary.taxPayable.igst,
    summary.taxPayable.cgst,
    summary.taxPayable.sgst,
    summary.taxPayable.cess
  );

  addTotalRow(
    "NET TAX PAYABLE",
    summary.taxPayable.igst,
    summary.taxPayable.cgst,
    summary.taxPayable.sgst,
    0
  );

  // Footer
  sheet.addRow([]);
  const footerRow = sheet.addRow([
    `Sales Invoices: ${summary.salesCount} | Purchase Invoices: ${summary.purchaseCount}`,
  ]);
  footerRow.font = { size: 9, italic: true, color: { argb: "FF64748B" }, name: "Calibri" };
  sheet.mergeCells(`A${footerRow.number}:F${footerRow.number}`);

  // Generate filename
  const monthShort = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const periodStr = `${monthShort[period.month - 1]}_${period.year}`;
  const timestamp = Date.now();
  const fileName = `GSTR3B_Summary_${periodStr}_${timestamp}.xlsx`;
  const filePath = path.join(exportDir, fileName);

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  await workbook.xlsx.writeFile(filePath);
  const stats = fs.statSync(filePath);

  return {
    fileName,
    filePath,
    fileSize: stats.size,
  };
}

module.exports = {
  computeGSTR3BSummary,
  generateGSTR3BExcel,
};
