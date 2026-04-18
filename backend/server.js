require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const uploadRoutes = require("./routes/upload.routes");
const reconciliationRoutes = require("./routes/reconciliation.routes");
const partyRoutes = require("./routes/party.routes");
const issueRoutes = require("./routes/issue.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const returnsRoutes = require("./routes/returns.routes");
const vendorRiskRoutes = require("./routes/vendorRisk.routes");
const aiRoutes = require("./routes/ai.routes");


const errorHandler = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    const color = res.statusCode < 400 ? "\x1b[32m" : res.statusCode < 500 ? "\x1b[33m" : "\x1b[31m";
    console.log(
      `\x1b[2m[${new Date().toLocaleTimeString("en-IN", { hour12: false })}]\x1b[0m ` +
      `${color}${req.method}\x1b[0m ${req.originalUrl} ` +
      `${color}${res.statusCode}\x1b[0m \x1b[2m${duration}ms\x1b[0m`
    );
    originalEnd.apply(res, args);
  };
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/vendor-risk", vendorRiskRoutes);
app.use("/api/ai", aiRoutes); 

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

  
