import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

// server/index.js

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
    console.error("Missing OPENAI_API_KEY in environment. Set it in .env or env vars.");
    process.exit(1);
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json());

// Health check
app.get("/", (req, res) => res.json({ status: "ok", service: "Vérificateur post-IA" }));

// Route principale : envoi d'une question à ChatGPT et analyse
app.post("/api/verify", async (req, res) => {
    const { question } = req.body;

    if (!question || typeof question !== "string" || question.trim().length < 5) {
        return res.status(400).json({ error: "question doit être une chaîne de minimum 5 caractères." });
    }

    try {
        // Appel OpenAI Chat Completions
        const gptResponse = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: question }],
                max_tokens: 800,
                temperature: 0.0,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${OPENAI_KEY}`,
                },
                timeout: 30000,
            }
        );

        const answer =
            gptResponse.data?.choices?.[0]?.message?.content ??
            gptResponse.data?.choices?.[0]?.text ??
            "";

        const analysis = analyzeResponse(question, answer);

        res.json({
            question,
            answer,
            confidenceScore: analysis.score,
            analysis,
        });
    } catch (error) {
        const status = error?.response?.status;
  const data = error?.response?.data;
  console.error("OpenAI request error:", status, data || error.message);

  return res.status(500).json({
    error: "Erreur lors de la vérification.",
    detail: {
      status,
      message: data?.error?.message || error.message,
      type: data?.error?.type,
      code: data?.error?.code,
    },
  });
    }
});

// Analyse rudimentaire basée sur recoupement de mots et longueur
function analyzeResponse(question, answer) {
    const normalize = (s) =>
        (s || "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]+/gu, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2);

    const qWords = Array.from(new Set(normalize(question)));
    const aWords = Array.from(new Set(normalize(answer)));

    const intersectionCount = qWords.filter((w) => aWords.includes(w)).length;
    const unionCount = new Set([...qWords, ...aWords]).size || 1;
    const overlapRatio = intersectionCount / unionCount; // 0..1

    const answerWordCount = answer ? answer.split(/\s+/).filter(Boolean).length : 0;
    const lengthFactor = Math.min(answerWordCount / 50, 1); // favor réponses détaillées jusqu'à ~50 mots

    // Score combine overlap and length (weighted)
    const rawScore = (overlapRatio * 0.7 + lengthFactor * 0.3) * 100;
    const score = Math.round(Math.max(0, Math.min(100, rawScore)));

    return {
        score,
        overlapRatio: Number(overlapRatio.toFixed(3)),
        intersectionCount,
        qWordCount: qWords.length,
        aWordCount: aWords.length,
        answerWordCount,
        lengthFactor: Number(lengthFactor.toFixed(3)),
        explanation:
            "Score heuristique basé sur la similarité lexicale (recoupement de mots) et la longueur de la réponse. Ne remplace pas une vérification humaine.",
    };
}

app.listen(PORT, () => console.log(`✅ Serveur Vérificateur post-IA sur http://localhost:${PORT}`));