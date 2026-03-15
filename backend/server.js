import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from './config/database.js';  // ← IMPORT DE LA CONNEXION MONGODB

dotenv.config();

// Connexion à MongoDB
connectDB();  // ← INITIALISATION DE LA CONNEXION

const app = express();
const PORT = process.env.PORT || 5050;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "Vérificateur Multi-IA",
    mongodb: "✅ connecté",
    version: "2.0"
  });
});

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
    /* ---------- OPENAI ---------- */
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

    const openaiAnswer = openaiResponse.data?.choices?.[0]?.message?.content ?? "";

    /* ---------- GEMINI ---------- */
    let geminiAnswer = null;

    if (GEMINI_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
        });
        const result = await model.generateContent(question);
        geminiAnswer = result?.response?.text() ?? null;
      } catch (geminiError) {
        console.error("Gemini error:", geminiError.message);
        // Continue sans Gemini
      }
    }

    /* ---------- ANALYSE OPENAI ---------- */
    const openaiAnalysis = analyzeResponse(question, openaiAnswer);

/* ---------- CALCUL DE L'ACCORD ENTRE IA ---------- */
let agreementScore = null;
let verdict = "single-model";
let finalScore = openaiAnalysis.score;

if (geminiAnswer && !geminiAnswer.startsWith("[Erreur")) {
  // Calculer l'accord entre les deux IA
  agreementScore = calculateAgreement(openaiAnswer, geminiAnswer);
  
  // Calculer le score final (moyenne du score OpenAI et de l'accord)
  finalScore = Math.round((openaiAnalysis.score + agreementScore) / 2);
  
  // DÉTERMINER LE VERDICT BASÉ SUR LE SCORE FINAL (pas sur l'accord seul)
  if (finalScore >= 70) {
    verdict = "fiable";
  } else if (finalScore >= 45) {
    verdict = "à vérifier";
  } else if (finalScore >= 30) {
    verdict = "douteux";
  } else {
    verdict = "contradictoire";
  }
  
  // S'assurer que le score final est entre 0 et 100
  finalScore = Math.min(100, Math.max(0, finalScore));

  
  // S'assurer que le score final est cohérent
  finalScore = Math.min(100, Math.max(0, finalScore));
}

// Structure de réponse claire et cohérente
res.json({
  question,
  finalScore,           // ← Un SEUL score final (ex: 46%)
  agreementScore,       // ← L'accord entre IA (ex: 34%)
  verdict,
  openai: {
    answer: openaiAnswer,
    analysis: {
      score: openaiAnalysis.score,  // ← Score individuel OpenAI (ex: 73%)
      ...openaiAnalysis.details
    }
  },
  gemini: geminiAnswer ? { 
    answer: geminiAnswer,
    // Tu peux ajouter un score pour Gemini si tu veux
  } : null,
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

/* ===================================================== */
/* ============= ANALYSE AMÉLIORÉE OPENAI ============= */
/* ===================================================== */

function analyzeResponse(question, answer) {
  if (!answer || answer.trim().length === 0) {
    return {
      score: 0,
      details: {
        pertinence: 0,
        longueur: 0,
        coherence: 0
      }
    };
  }

  // 1. PERTINENCE - La réponse répond-elle à la question ?
  const questionLower = question.toLowerCase();
  const answerLower = answer.toLowerCase();
  
  // Mots-clés importants de la question
  const questionWords = questionLower
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.includes(w));
  
  // Compter les mots-clés de la question présents dans la réponse
  let motsClesTrouves = 0;
  questionWords.forEach(word => {
    if (answerLower.includes(word)) motsClesTrouves++;
  });
  
  const pertinence = questionWords.length > 0 
    ? (motsClesTrouves / questionWords.length) * 100
    : 70; // Si pas de mots-clés significatifs, score moyen

  // 2. LONGUEUR - La réponse est-elle suffisamment détaillée ?
  const wordCount = answer.split(/\s+/).length;
  const longueurIdeale = 50; // Nombre de mots idéal
  const longueur = Math.min(100, (wordCount / longueurIdeale) * 100);

  // 3. COHÉRENCE - La réponse a-t-elle une structure logique ?
  const aDesPoints = answer.includes('.') || answer.includes('!') || answer.includes('?');
  const aDesPhrases = (answer.match(/[.!?]/g) || []).length > 1;
  const coherence = aDesPhrases ? 90 : aDesPoints ? 70 : 50;

  // Score pondéré
  const score = Math.round(
    pertinence * 0.5 +   // La pertinence est la plus importante
    longueur * 0.25 +    // La longueur compte mais moins
    coherence * 0.25     // La cohérence aussi
  );

  return {
    score,
    details: {
      pertinence: Math.round(pertinence),
      longueur: Math.round(longueur),
      coherence
    },
    wordCount
  };
}

/* ===================================================== */
/* ============ ACCORD SÉMANTIQUE AMÉLIORÉ ============ */
/* ===================================================== */

const stopwords = [
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "mais",
  "est", "sont", "dans", "avec", "pour", "sur", "par", "plus", "moins",
  "que", "qui", "quoi", "dont", "où", "au", "aux", "ce", "ces", "cet",
  "cette", "mon", "ton", "son", "notre", "votre", "leur", "mes", "tes",
  "ses", "nos", "vos", "leurs"
];

function calculateAgreement(text1, text2) {
  if (!text1 || !text2) return 0;

  // Nettoyer et tokenizer
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  // 1. SIMILARITÉ DE JACCARD (mots en commun)
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  const jaccard = intersection.size / union.size;

  // 2. SIMILARITÉ DE CONTENU (fréquence des mots)
  const freq1 = {};
  const freq2 = {};
  
  tokens1.forEach(w => freq1[w] = (freq1[w] || 0) + 1);
  tokens2.forEach(w => freq2[w] = (freq2[w] || 0) + 1);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
  
  allWords.forEach(word => {
    const f1 = freq1[word] || 0;
    const f2 = freq2[word] || 0;
    dotProduct += f1 * f2;
    norm1 += f1 * f1;
    norm2 += f2 * f2;
  });
  
  const cosine = norm1 && norm2 ? dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;

  // 3. BONUS POUR LES RÉPONSES FACTUELLES (présence de dates, nombres, etc.)
  const aDesChiffres1 = /\d+/.test(text1);
  const aDesChiffres2 = /\d+/.test(text2);
  const factuelBonus = (aDesChiffres1 && aDesChiffres2) ? 0.2 : 0;

  // Score combiné (jaccard pour les mots exacts, cosine pour la similarité sémantique)
  const rawScore = (jaccard * 0.6 + cosine * 0.4) * 100;
  
  // Ajouter le bonus factuel
  let finalScore = rawScore * (1 + factuelBonus);
  
  // Plafonner à 100
  finalScore = Math.min(100, finalScore);

  return Math.round(finalScore);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")  // Enlever la ponctuation
    .replace(/\s+/g, " ")                 // Normaliser les espaces
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.includes(w)); // Enlever les mots trop courts et stopwords
}
// Routes d'authentification et historique (à ajouter avant app.listen)
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);

/* ===================================================== */

app.listen(PORT, () =>
  console.log(`Serveur Vérificateur post-IA sur http://localhost:${PORT}`)
);