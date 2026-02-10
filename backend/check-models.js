// backend/check-models.js
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ No API Key found in .env");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log("🔍 Checking available models for your API Key...");

fetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
        console.error("❌ API Error:", data.error.message);
    } else if (data.models) {
        console.log("✅ SUCCEEDED! Here are the models you can use:");
        data.models.forEach(m => {
            // Only show models that support generating content
            if (m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`   👉 ${m.name.replace("models/", "")}`);
            }
        });
    } else {
        console.log("⚠️ No models found. Response:", data);
    }
  })
  .catch(err => console.error("❌ Network Error:", err));