const XLSX = require("xlsx");
const path = require("path");

// ===================== PHASE 1: Reconciliation Samples =====================

// ---------------- PURCHASE REGISTER (Books) ----------------
const purchaseRegister = [
  { gstin: "27AABCU9603R1ZM", party_name: "Tata Steel Ltd", invoice_no: "INV-001", invoice_date: "2024-01-01", taxable_value: 100000, cgst: 9000, sgst: 9000, igst: 0, gst_amount: 18000, total_value: 118000 },
  { gstin: "29AABCT1332L1ZL", party_name: "Infosys Ltd", invoice_no: "INF-002", invoice_date: "2024-01-05", taxable_value: 200000, cgst: 0, sgst: 0, igst: 36000, gst_amount: 36000, total_value: 236000 },
  { gstin: "06AABCR1718E1ZL", party_name: "Reliance Industries", invoice_no: "RIL-003", invoice_date: "2024-01-10", taxable_value: 150000, cgst: 13500, sgst: 13500, igst: 0, gst_amount: 27000, total_value: 177000 },
];

// ---------------- GSTR-2B DATA ----------------
const gstr2b = [
  { gstin: "27AABCU9603R1ZM", invoice_no: "INV-001", invoice_date: "2024-01-01", taxable_value: 100000, gst_amount: 18000 },
  { gstin: "29AABCT1332L1ZL", invoice_no: "INF-002", invoice_date: "2024-01-05", taxable_value: 190000, gst_amount: 34200 },
  { gstin: "36AABCD7890S1Z1", invoice_no: "DS-004", invoice_date: "2024-01-12", taxable_value: 50000, gst_amount: 9000 },
];

// ===================== PHASE 2: Return Preparation Samples =====================

// ---------------- SALES REGISTER (for GSTR-1) ----------------
const salesRegister = [
  // B2B invoices (registered parties with GSTIN)
  { gstin: "27AABCU9603R1ZM", party_name: "Tata Steel Ltd", invoice_no: "SALE-2024-001", invoice_date: "01/01/2024", taxable_value: 250000, cgst: 22500, sgst: 22500, igst: 0, gst_amount: 45000, total_value: 295000 },
  { gstin: "29AABCT1332L1ZL", party_name: "Infosys Ltd", invoice_no: "SALE-2024-002", invoice_date: "05/01/2024", taxable_value: 180000, cgst: 0, sgst: 0, igst: 32400, gst_amount: 32400, total_value: 212400 },
  { gstin: "06AABCR1718E1ZL", party_name: "Reliance Industries", invoice_no: "SALE-2024-003", invoice_date: "10/01/2024", taxable_value: 320000, cgst: 28800, sgst: 28800, igst: 0, gst_amount: 57600, total_value: 377600 },
  { gstin: "27AAACH2702H1ZW", party_name: "HCL Technologies", invoice_no: "SALE-2024-004", invoice_date: "12/01/2024", taxable_value: 95000, cgst: 8550, sgst: 8550, igst: 0, gst_amount: 17100, total_value: 112100 },
  { gstin: "33AABCW3046M1ZP", party_name: "Wipro Ltd", invoice_no: "SALE-2024-005", invoice_date: "15/01/2024", taxable_value: 140000, cgst: 0, sgst: 0, igst: 25200, gst_amount: 25200, total_value: 165200 },
  { gstin: "24AABCG3456R1Z7", party_name: "Gujarat Petrochemicals", invoice_no: "SALE-2024-006", invoice_date: "18/01/2024", taxable_value: 210000, cgst: 0, sgst: 0, igst: 37800, gst_amount: 37800, total_value: 247800 },
  { gstin: "07AABCS5678P1Z9", party_name: "Sunrise Electronics", invoice_no: "SALE-2024-007", invoice_date: "20/01/2024", taxable_value: 75000, cgst: 0, sgst: 0, igst: 13500, gst_amount: 13500, total_value: 88500 },
  { gstin: "27AABCM1234N1Z5", party_name: "Mahindra Auto Parts", invoice_no: "SALE-2024-008", invoice_date: "22/01/2024", taxable_value: 165000, cgst: 14850, sgst: 14850, igst: 0, gst_amount: 29700, total_value: 194700 },
  // B2C invoices (no GSTIN — consumer sales)
  { gstin: "", party_name: "Walk-in Customer", invoice_no: "SALE-2024-009", invoice_date: "25/01/2024", taxable_value: 15000, cgst: 1350, sgst: 1350, igst: 0, gst_amount: 2700, total_value: 17700 },
  { gstin: "", party_name: "Cash Sale", invoice_no: "SALE-2024-010", invoice_date: "28/01/2024", taxable_value: 8500, cgst: 765, sgst: 765, igst: 0, gst_amount: 1530, total_value: 10030 },
  { gstin: "", party_name: "Counter Sale", invoice_no: "SALE-2024-011", invoice_date: "30/01/2024", taxable_value: 22000, cgst: 1980, sgst: 1980, igst: 0, gst_amount: 3960, total_value: 25960 },
  // Credit Note
  { gstin: "27AABCU9603R1ZM", party_name: "Tata Steel Ltd", invoice_no: "CN-2024-001", invoice_date: "28/01/2024", taxable_value: -12000, cgst: -1080, sgst: -1080, igst: 0, gst_amount: -2160, total_value: -14160 },
];

// ---------------- PURCHASE REGISTER for ITC (Phase 2) ----------------
const purchaseRegisterP2 = [
  { gstin: "27AABCU9603R1ZM", party_name: "Tata Steel Ltd", invoice_no: "TS-PUR-001", invoice_date: "03/01/2024", taxable_value: 180000, cgst: 16200, sgst: 16200, igst: 0, gst_amount: 32400, total_value: 212400 },
  { gstin: "29AABCT1332L1ZL", party_name: "Infosys Ltd", invoice_no: "INF-PUR-002", invoice_date: "08/01/2024", taxable_value: 95000, cgst: 0, sgst: 0, igst: 17100, gst_amount: 17100, total_value: 112100 },
  { gstin: "06AABCR1718E1ZL", party_name: "Reliance Industries", invoice_no: "RIL-PUR-003", invoice_date: "12/01/2024", taxable_value: 220000, cgst: 19800, sgst: 19800, igst: 0, gst_amount: 39600, total_value: 259600 },
  { gstin: "33AABCW3046M1ZP", party_name: "Wipro Ltd", invoice_no: "WIP-PUR-004", invoice_date: "15/01/2024", taxable_value: 130000, cgst: 0, sgst: 0, igst: 23400, gst_amount: 23400, total_value: 153400 },
  { gstin: "24AABCG3456R1Z7", party_name: "Gujarat Petrochemicals", invoice_no: "GP-PUR-005", invoice_date: "20/01/2024", taxable_value: 85000, cgst: 0, sgst: 0, igst: 15300, gst_amount: 15300, total_value: 100300 },
  { gstin: "07AABCS5678P1Z9", party_name: "Sunrise Electronics", invoice_no: "SE-PUR-006", invoice_date: "25/01/2024", taxable_value: 45000, cgst: 0, sgst: 0, igst: 8100, gst_amount: 8100, total_value: 53100 },
];

// ===================== CREATE EXCEL FILES =====================
function createExcel(data, fileName, sheetName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path.join(__dirname, fileName));
}

// Phase 1 samples
createExcel(purchaseRegister, "sample_books.xlsx", "Purchase Register");
createExcel(gstr2b, "sample_gstr2b.xlsx", "GSTR-2B");

// Phase 2 samples
createExcel(salesRegister, "sample_sales_register.xlsx", "Sales Register");
createExcel(purchaseRegisterP2, "sample_purchase_register.xlsx", "Purchase Register");

console.log("✅ All sample files created:");
console.log("");
console.log("  Phase 1 (Reconciliation):");
console.log("    📄 sample_books.xlsx         — 3 purchase invoices (Books)");
console.log("    📄 sample_gstr2b.xlsx        — 3 entries (1 match, 1 mismatch, 1 extra)");
console.log("");
console.log("  Phase 2 (Return Preparation):");
console.log("    📄 sample_sales_register.xlsx    — 12 sales invoices (8 B2B + 3 B2C + 1 Credit Note)");
console.log("    📄 sample_purchase_register.xlsx — 6 purchase invoices (for ITC calculation)");
console.log("");
console.log("  Upload instructions:");
console.log("    Phase 1: Upload sample_books.xlsx as 'Books' and sample_gstr2b.xlsx as 'GSTR-2B'");
console.log("    Phase 2: Upload sample_sales_register.xlsx as 'Sales Register' and sample_purchase_register.xlsx as 'Purchase Register'");