import { GoogleGenerativeAI } from "@google/generative-ai";

export async function askGemini({ apiKey, question }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(question);
  const answer = result?.response?.text?.() ?? "";
  return { provider: "gemini:1.5-flash", answer };
}