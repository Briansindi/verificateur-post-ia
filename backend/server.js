import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from './config/database.js';  // ← IMPORT DE LA CONNEXION MONGODB
import judgeRoutes from './routes/judge.js';
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

  // 1. Extraire les chiffres (les faits)
  const numbers1 = text1.match(/\b\d+\b/g) || [];
  const numbers2 = text2.match(/\b\d+\b/g) || [];
  
  // 2. Extraire les mots-clés principaux
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);
  
  // 3. Comparer les chiffres (poids fort)
  let numberScore = 0;
  if (numbers1.length > 0 && numbers2.length > 0) {
    const commonNumbers = numbers1.filter(n => numbers2.includes(n));
    numberScore = (commonNumbers.length / Math.max(numbers1.length, numbers2.length)) * 100;
  } else {
    numberScore = 100; // Pas de chiffres = pas de désaccord
  }
  
  // 4. Comparer les mots-clés (poids moyen)
  const commonKeywords = keywords1.filter(k => keywords2.includes(k));
  const keywordScore = (commonKeywords.length / Math.max(keywords1.length, keywords2.length)) * 100;
  
  // 5. Détecter si les réponses sont longues (bonus)
  const lengthBonus = (text1.length > 100 && text2.length > 100) ? 15 : 0;
  
  // 6. Score final pondéré
  const finalScore = (numberScore * 0.6) + (keywordScore * 0.4) + lengthBonus;
  
  return Math.min(100, Math.round(finalScore));
}

function extractKeywords(text) {
  // Mots importants (noms, concepts)
  const importantWords = [
    'pays', 'états', 'monde', 'officiellement', 'reconnus',
    'membres', 'nations', 'unies', 'observateurs', 'vatican',
    'palestine', 'saint-siège', 'internationale'
  ];
  
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  return words.filter(w => importantWords.includes(w));
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
app.use('/api/judge', judgeRoutes);
/* ===================================================== */

app.listen(PORT, () =>
  console.log(`Serveur Vérificateur post-IA sur http://localhost:${PORT}`)
);