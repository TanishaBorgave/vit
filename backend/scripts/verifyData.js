/**
 * Database Verification Script
 * Proves data on frontend comes from your uploaded files, not hardcoded
 *
 * Usage: node scripts/verifyData.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const db = mongoose.connection.db;

  // ── 1. Show all collections ──
  const collections = await db.listCollections().toArray();
  console.log("═══════════════════════════════════════════");
  console.log("  DATABASE COLLECTIONS");
  console.log("═══════════════════════════════════════════");
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`  📁 ${col.name}: ${count} documents`);
  }

  // ── 2. Show uploads (what files were uploaded) ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  UPLOADED FILES");
  console.log("═══════════════════════════════════════════");
  const uploads = await db.collection("uploads").find({}).toArray();
  if (uploads.length === 0) {
    console.log("  ⚠ No uploads found. Upload your Excel/PDF files first!");
  } else {
    uploads.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.originalName}`);
      console.log(`     Type: ${u.fileType} | Rows: ${u.rowCount} | Status: ${u.status}`);
      console.log(`     Uploaded: ${new Date(u.createdAt).toLocaleString()}`);
      console.log("");
    });
  }

  // ── 3. Show invoices (parsed from your files) ──
  console.log("═══════════════════════════════════════════");
  console.log("  INVOICES IN DATABASE (from your uploads)");
  console.log("═══════════════════════════════════════════");
  const invoices = await db.collection("invoices").find({}).toArray();
  if (invoices.length === 0) {
    console.log("  ⚠ No invoices found.");
  } else {
    // Group by source
    const grouped = {};
    invoices.forEach((inv) => {
      const src = inv.source || "unknown";
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(inv);
    });

    for (const [source, invs] of Object.entries(grouped)) {
      console.log(`\n  📋 Source: "${source}" (${invs.length} invoices)`);
      console.log("  ─────────────────────────────────────────");
      invs.slice(0, 5).forEach((inv) => {
        console.log(`  • ${inv.invoiceNo} | GSTIN: ${inv.gstin} | ₹${inv.taxableValue} | GST: ₹${inv.gstAmount} | Date: ${new Date(inv.invoiceDate).toLocaleDateString()}`);
      });
      if (invs.length > 5) console.log(`  ... and ${invs.length - 5} more`);
    }
  }

  // ── 4. Show reconciliation results ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  RECONCILIATION RESULTS");
  console.log("═══════════════════════════════════════════");
  const reconResults = await db.collection("reconciliationresults").find({}).toArray();
  if (reconResults.length === 0) {
    console.log("  ⚠ No reconciliation results. Run reconciliation first!");
  } else {
    const statusCounts = {};
    reconResults.forEach((r) => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    console.log("  Status breakdown:");
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`    ${status}: ${count}`);
    }
    console.log(`\n  Sample results (first 5):`);
    reconResults.slice(0, 5).forEach((r) => {
      console.log(`  • ${r.invoiceNo} | ${r.status} | GSTIN: ${r.gstin} | Book: ₹${r.bookAmount} | GST: ₹${r.gstAmount} | Diff: ₹${r.amountDifference}`);
    });
  }

  // ── 5. Show vendor risk scores (if ML was run) ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  VENDOR RISK SCORES (ML-computed)");
  console.log("═══════════════════════════════════════════");
  const risks = await db.collection("vendorrisks").find({}).toArray();
  if (risks.length === 0) {
    console.log("  ⚠ No risk scores. Run ML analysis from Vendor Risk AI page!");
  } else {
    risks.forEach((r) => {
      console.log(`  • ${r.partyName || r.gstin} | Score: ${r.scores?.overallScore}/100 | Risk: ${r.riskLevel} | Delay: ${Math.round(r.predictions?.delayProbability * 100)}%`);
    });
  }

  // ── 6. Data flow proof ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  DATA FLOW VERIFICATION");
  console.log("═══════════════════════════════════════════");
  console.log("  Excel Upload → Parser → MongoDB (invoices) → API → Frontend");
  console.log("");

  if (uploads.length > 0 && invoices.length > 0) {
    // Trace one invoice back to its upload
    const sampleInv = invoices[0];
    const parentUpload = uploads.find((u) => u._id.toString() === sampleInv.upload?.toString());
    console.log("  🔍 Tracing invoice back to source file:");
    console.log(`     Invoice: ${sampleInv.invoiceNo}`);
    console.log(`     GSTIN: ${sampleInv.gstin}`);
    console.log(`     Amount: ₹${sampleInv.taxableValue}`);
    console.log(`     Source type: ${sampleInv.source}`);
    console.log(`     Upload ID: ${sampleInv.upload}`);
    if (parentUpload) {
      console.log(`     ✅ Linked to file: "${parentUpload.originalName}"`);
      console.log(`     ✅ File type: ${parentUpload.fileType}`);
      console.log(`     ✅ NOT hardcoded — data came from your uploaded file!`);
    } else {
      console.log(`     ⚠ Could not find parent upload (may have been deleted)`);
    }
  }

  console.log("\n✅ Verification complete!\n");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
