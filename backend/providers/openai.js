import axios from "axios";

export async function askOpenAI({ apiKey, question }) {
  const r = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: question }],
      max_tokens: 600,
      temperature: 0.0,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30000,
    }
  );

  const answer = r.data?.choices?.[0]?.message?.content ?? "";
  return { provider: "openai:gpt-4o-mini", answer };
}