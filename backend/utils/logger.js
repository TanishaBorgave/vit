/**
 * Server Logger Utility
 * Color-coded, timestamped terminal logs for all key actions
 */

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Background
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

function timestamp() {
  return new Date().toLocaleTimeString("en-IN", { hour12: false });
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const logger = {
  // ── File Upload Events ──
  upload(fileName, fileType, fileSize) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgGreen}${COLORS.bright} 📁 UPLOAD ${COLORS.reset} ` +
      `${COLORS.green}${fileName}${COLORS.reset} ` +
      `${COLORS.dim}(${fileType} · ${formatSize(fileSize)})${COLORS.reset}`
    );
  },

  uploadProcessed(fileName, rowCount, fileType) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgGreen}${COLORS.bright} ✅ PARSED ${COLORS.reset} ` +
      `${COLORS.green}${fileName}${COLORS.reset} → ` +
      `${COLORS.bright}${rowCount} invoices${COLORS.reset} ` +
      `${COLORS.dim}(source: ${fileType})${COLORS.reset}`
    );
  },

  uploadError(fileName, error) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgRed}${COLORS.bright} ❌ UPLOAD FAIL ${COLORS.reset} ` +
      `${COLORS.red}${fileName}${COLORS.reset} — ` +
      `${COLORS.dim}${error}${COLORS.reset}`
    );
  },

  uploadDeleted(fileName) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgYellow}${COLORS.bright} 🗑️  DELETE ${COLORS.reset} ` +
      `${COLORS.yellow}${fileName}${COLORS.reset}`
    );
  },

  // ── PDF Invoice Events ──
  pdfUpload(fileCount, invoiceType) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgMagenta}${COLORS.bright} 📄 PDF UPLOAD ${COLORS.reset} ` +
      `${COLORS.magenta}${fileCount} file(s)${COLORS.reset} ` +
      `${COLORS.dim}(type: ${invoiceType})${COLORS.reset}`
    );
  },

  pdfExtracted(fileName, invoiceNo, confidence) {
    const confColor = confidence === "HIGH" ? COLORS.green : confidence === "MEDIUM" ? COLORS.yellow : COLORS.red;
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgMagenta}${COLORS.bright} 🔍 EXTRACTED ${COLORS.reset} ` +
      `${COLORS.magenta}${fileName}${COLORS.reset} → ` +
      `${COLORS.bright}${invoiceNo}${COLORS.reset} ` +
      `${confColor}[${confidence}]${COLORS.reset}`
    );
  },

  // ── Reconciliation Events ──
  reconciliation(matched, mismatched, missingIn2B, missingInBooks) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgCyan}${COLORS.bright} 🔄 RECONCILED ${COLORS.reset} ` +
      `${COLORS.green}${matched} matched${COLORS.reset} · ` +
      `${COLORS.yellow}${mismatched} mismatch${COLORS.reset} · ` +
      `${COLORS.red}${missingIn2B} missing(2B)${COLORS.reset} · ` +
      `${COLORS.cyan}${missingInBooks} extra(2B)${COLORS.reset}`
    );
  },

  // ── ML Analysis Events ──
  mlAnalysis(vendorCount, avgScore) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgBlue}${COLORS.bright} 🧠 ML ANALYSIS ${COLORS.reset} ` +
      `${COLORS.blue}${vendorCount} vendors scored${COLORS.reset} · ` +
      `${COLORS.dim}avg: ${avgScore}/100${COLORS.reset}`
    );
  },

  // ── Return Generation ──
  returnGenerated(type, invoiceCount) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.bgGreen}${COLORS.bright} 📊 ${type} GENERATED ${COLORS.reset} ` +
      `${COLORS.green}${invoiceCount} invoices${COLORS.reset}`
    );
  },

  // ── Auth Events ──
  auth(action, email) {
    const icon = action === "LOGIN" ? "🔓" : action === "SIGNUP" ? "👤" : "🔒";
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${COLORS.cyan}${icon} ${action}${COLORS.reset} ` +
      `${COLORS.dim}${email}${COLORS.reset}`
    );
  },

  // ── Generic request log ──
  request(method, url, statusCode) {
    const color = statusCode < 400 ? COLORS.green : statusCode < 500 ? COLORS.yellow : COLORS.red;
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ` +
      `${color}${method}${COLORS.reset} ${url} ` +
      `${color}${statusCode}${COLORS.reset}`
    );
  },
};

module.exports = logger;
