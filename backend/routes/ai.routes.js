const express = require("express");
const { chatWithGemini } = require("../utils/ai.service");

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { query } = req.body;

    // TEMP DATA
    const userData = {
      total: 120,
      mismatch: 15,
      itcRisk: 42000,
      topVendor: "ABC Ltd"
    };

    const reply = await chatWithGemini(query, userData);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});

module.exports = router; // ✅ IMPORTANT