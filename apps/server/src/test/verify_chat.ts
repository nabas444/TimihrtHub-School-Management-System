import "dotenv/config";

const apiKey = (
  process.env.Gemini_API_Key ||
  process.env.GEMINI_API_KEY ||
  ""
).trim();

async function testTimhirtHubKnowledge() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  const systemInstruction = `You are the official AI assistant for TimhirtHub School Management Platform. You know about exams, attendance, billing, fees, chat, library, timetable, and permissions.`;
  
  const userMessage = "How do I check my fee invoice and upgrade my school subscription in TimhirtHub?";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
    }),
  });

  const data: any = await res.json();
  console.log("Status:", res.status);
  console.log("AI Answer:", data.candidates?.[0]?.content?.parts?.[0]?.text);
}

testTimhirtHubKnowledge();
