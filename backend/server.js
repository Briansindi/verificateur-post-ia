import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from './config/database.js';
import judgeRoutes from './routes/judge.js';

dotenv.config();

// Connexion à MongoDB
connectDB();

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

app.post("/api/verify", async (req, res) => {
  const { question, model } = req.body;

  if (!question || question.trim().length < 5) {
    return res.status(400).json({
      error: "La question doit contenir au moins 5 caractères.",
    });
  }

  // Déterminer le mode (comparaison par défaut)
  const useBoth = !model || model === 'both';
  const useChatGPT = useBoth || model === 'chatgpt';
  const useGemini = (useBoth || model === 'gemini') && GEMINI_KEY;

  try {
    console.log(`📝 Question reçue: "${question.substring(0, 50)}..."`);
    console.log(`🤖 Mode: ${useBoth ? 'comparaison' : model}`);

    let openaiAnswer = "";
    let geminiAnswer = null;
    let openaiAnalysis = null;
    let geminiAnalysis = null;

    // ---------- OPENAI ----------
    if (useChatGPT) {
      try {
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
        openaiAnswer = openaiResponse.data?.choices?.[0]?.message?.content ?? "";
        openaiAnalysis = analyzeResponse(question, openaiAnswer);
        console.log("✅ OpenAI: réponse reçue");
      } catch (openaiError) {
        console.error("❌ OpenAI error:", openaiError.message);
        openaiAnswer = `[Erreur OpenAI: ${openaiError.response?.data?.error?.message || openaiError.message}]`;
        openaiAnalysis = { score: 0, details: { pertinence: 0, longueur: 0, coherence: 0 }, wordCount: 0 };
      }
    }

    // ---------- GEMINI ----------
    if (useGemini) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
        });
        const result = await model.generateContent(question);
        geminiAnswer = result?.response?.text() ?? null;
        // Analyser Gemini avec la même fonction
        geminiAnalysis = analyzeResponse(question, geminiAnswer);
        console.log("✅ Gemini: réponse reçue");
      } catch (geminiError) {
        console.error("❌ Gemini error:", geminiError.message);
        geminiAnswer = `[Erreur Gemini: ${geminiError.message}]`;
        geminiAnalysis = { score: 0, details: { pertinence: 0, longueur: 0, coherence: 0 }, wordCount: 0 };
      }
    }

    let finalScore, verdict, agreementScore;

    // ---------- CALCUL SELON LE MODE ----------
    if (useBoth) {
      // Mode comparaison (comportement original)
      if (geminiAnswer && !geminiAnswer.startsWith("[Erreur") && openaiAnswer && !openaiAnswer.startsWith("[Erreur")) {
        agreementScore = calculateAgreement(openaiAnswer, geminiAnswer);
        finalScore = Math.round((openaiAnalysis.score + agreementScore) / 2);
        
        if (finalScore >= 70) verdict = "fiable";
        else if (finalScore >= 45) verdict = "à vérifier";
        else if (finalScore >= 30) verdict = "douteux";
        else verdict = "contradictoire";
      } else {
        // Mode mono-IA si une seule réponse
        finalScore = openaiAnalysis?.score || geminiAnalysis?.score || 0;
        verdict = "single-model";
      }
    } else if (model === 'chatgpt') {
      // Mode ChatGPT seul
      finalScore = openaiAnalysis?.score || 0;
      if (finalScore >= 70) verdict = "fiable";
      else if (finalScore >= 45) verdict = "à vérifier";
      else verdict = "douteux";
    } else if (model === 'gemini') {
      // Mode Gemini seul
      finalScore = geminiAnalysis?.score || 0;
      if (finalScore >= 70) verdict = "fiable";
      else if (finalScore >= 45) verdict = "à vérifier";
      else verdict = "douteux";
    }

    // Structure de réponse
    const response = {
      question,
      finalScore,
      verdict,
      openai: openaiAnswer ? {
        answer: openaiAnswer,
        analysis: openaiAnalysis
      } : null,
      gemini: geminiAnswer ? { 
        answer: geminiAnswer,
        analysis: geminiAnalysis
      } : null,
    };

    // Ajouter agreementScore seulement en mode comparaison
    if (useBoth && agreementScore) {
      response.agreementScore = agreementScore;
    }

    res.json(response);

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
  if (!answer || answer.trim().length === 0 || answer.startsWith("[Erreur")) {
    return {
      score: 0,
      details: {
        pertinence: 0,
        longueur: 0,
        coherence: 0
      },
      wordCount: 0
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
    : 70;

  // 2. LONGUEUR - La réponse est-elle suffisamment détaillée ?
  const wordCount = answer.split(/\s+/).length;
  const longueurIdeale = 50;
  const longueur = Math.min(100, (wordCount / longueurIdeale) * 100);

  // 3. COHÉRENCE - La réponse a-t-elle une structure logique ?
  const aDesPoints = answer.includes('.') || answer.includes('!') || answer.includes('?');
  const aDesPhrases = (answer.match(/[.!?]/g) || []).length > 1;
  const coherence = aDesPhrases ? 90 : aDesPoints ? 70 : 50;

  // Score pondéré
  const score = Math.round(
    pertinence * 0.5 +
    longueur * 0.25 +
    coherence * 0.25
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
  "ses", "nos", "vos", "leurs", "a", "ont", "été", "sera", "était"
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
    numberScore = 100;
  }
  
  // 4. Comparer les mots-clés (poids moyen)
  const commonKeywords = keywords1.filter(k => keywords2.includes(k));
  const keywordScore = commonKeywords.length / Math.max(keywords1.length, keywords2.length) * 100;
  
  // 5. Détecter si les réponses sont longues (bonus)
  const lengthBonus = (text1.length > 100 && text2.length > 100) ? 15 : 0;
  
  // 6. Score final pondéré
  const finalScore = (numberScore * 0.6) + (keywordScore * 0.4) + lengthBonus;
  
  return Math.min(100, Math.round(finalScore));
}

function extractKeywords(text) {
  const importantWords = [
    'pays', 'états', 'monde', 'officiellement', 'reconnus',
    'membres', 'nations', 'unies', 'observateurs', 'vatican',
    'palestine', 'saint-siège', 'internationale', 'messi', 'ronaldo',
    'football', 'barcelone', 'paris', 'argentine', 'portugal'
  ];
  
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  return words.filter(w => importantWords.includes(w));
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.includes(w));
}

// Routes d'authentification, historique et juge
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/judge', judgeRoutes);

/* ===================================================== */

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 Serveur Vérificateur Multi-IA démarré !");
  console.log("=".repeat(50));
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔑 OpenAI: ${OPENAI_KEY ? "✅" : "❌"}`);
  console.log(`🔑 Gemini: ${GEMINI_KEY ? "✅" : "❌"}`);
  console.log("=".repeat(50) + "\n");
});