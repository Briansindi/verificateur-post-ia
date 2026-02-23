import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json());

app.get("/", (req, res) =>
  res.json({ status: "ok", service: "Vérificateur post-IA" })
);

app.post("/api/verify", async (req, res) => {
  const { question } = req.body;

  if (!question || question.trim().length < 5) {
    return res.status(400).json({
      error: "question doit être une chaîne de minimum 5 caractères.",
    });
  }

  try {
    // 🔹 Appel OpenAI
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: question }],
        temperature: 0.0,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
      }
    );

    const openaiAnswer =
      openaiResponse.data?.choices?.[0]?.message?.content ?? "";

    // 🔹 Appel Gemini (si clé présente)
    let geminiAnswer = null;

    if (GEMINI_KEY) {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
      });

      const result = await model.generateContent(question);
      geminiAnswer = result?.response?.text() ?? null;
    }

    // 🔹 Analyse locale OpenAI
    const openaiAnalysis = analyzeResponse(question, openaiAnswer);

    let agreementScore = null;
    let verdict = "single-model";

    // 🔹 Si Gemini dispo → calcul accord
    if (geminiAnswer) {
      agreementScore = calculateAgreement(
        openaiAnswer,
        geminiAnswer
      );

      if (agreementScore >= 75) verdict = "fiable";
      else if (agreementScore >= 45) verdict = "à vérifier";
      else verdict = "douteux";
    }

    // 🔹 Score final
    const finalScore = agreementScore
      ? Math.round(openaiAnalysis.score * 0.7 + agreementScore * 0.3)
      : openaiAnalysis.score;

    res.json({
      question,
      finalScore,
      verdict,
      agreementScore,
      openai: {
        answer: openaiAnswer,
        analysis: openaiAnalysis,
      },
      gemini: geminiAnswer
        ? { answer: geminiAnswer }
        : null,
    });
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;

    console.error("IA request error:", status, data || error.message);

    return res.status(500).json({
      error: "Erreur lors de la vérification.",
      detail: {
        status,
        message: data?.error?.message || error.message,
      },
    });
  }
});

// 🔹 Ton analyse existante améliorée
function analyzeResponse(question, answer) {
  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const qWords = Array.from(new Set(normalize(question)));
  const aWords = Array.from(new Set(normalize(answer)));

  const intersectionCount = qWords.filter((w) =>
    aWords.includes(w)
  ).length;

  const unionCount =
    new Set([...qWords, ...aWords]).size || 1;

  const overlapRatio = intersectionCount / unionCount;

  const answerWordCount = answer
    ? answer.split(/\s+/).length
    : 0;

  const lengthFactor = Math.min(answerWordCount / 12, 1);

  const rawScore =
    (overlapRatio * 0.85 + lengthFactor * 0.15) * 100;

  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    score,
    overlapRatio,
    answerWordCount,
  };
}

// 🔹 Similarité simple entre deux réponses
function calculateAgreement(a, b) {
  const tokenize = (s) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean);

  const A = tokenize(a);
  const B = tokenize(b);

  const setA = new Set(A);
  const setB = new Set(B);

  const inter = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;

  return Math.round((inter / union) * 100);
}

app.listen(PORT, () =>
  console.log(
    `✅ Serveur Vérificateur post-IA sur http://localhost:${PORT}`
  )
);