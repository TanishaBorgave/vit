const fetch = require("node-fetch");

const chatWithGemini = async (query, userData) => {
  const prompt = `
${query}
`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables");
    throw new Error("Gemini API key not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  const data = await response.json();

  // Handle HTTP errors
  if (!response.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    console.error(`Gemini API error (${response.status}):`, errMsg);
    throw new Error(`Gemini API error: ${errMsg}`);
  }

  // Handle blocked content
  if (data?.promptFeedback?.blockReason) {
    console.error("Gemini blocked the prompt:", data.promptFeedback.blockReason);
    throw new Error(`Prompt blocked: ${data.promptFeedback.blockReason}`);
  }

  // Handle missing candidates
  if (!data?.candidates || data.candidates.length === 0) {
    console.error("Gemini returned no candidates. Full response:", JSON.stringify(data, null, 2));
    throw new Error("Gemini returned no candidates");
  }

  // Handle candidate-level blocks
  const candidate = data.candidates[0];
  if (candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKED") {
    console.error("Gemini response blocked by safety filters:", candidate.finishReason);
    throw new Error(`Response blocked: ${candidate.finishReason}`);
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("Gemini response has no text. Candidate:", JSON.stringify(candidate, null, 2));
    throw new Error("Gemini returned empty text");
  }

  return text;
};

module.exports = { chatWithGemini };