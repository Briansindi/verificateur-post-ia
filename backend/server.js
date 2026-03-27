import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from './config/database.js';
import judgeRoutes from './routes/judge.js';
import conversationRoutes from './routes/conversations.js';
dotenv.config();

// Connexion à MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5050;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY; // ← DeepSeek remplacé par Mistral
const GROQ_KEY = process.env.GROQ_API_KEY;

// Année actuelle pour les prompts
const CURRENT_YEAR = new Date().getFullYear();

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
  const { question } = req.body;

  if (!question || question.trim().length < 5) {
    return res.status(400).json({
      error: "La question doit contenir au moins 5 caractères.",
    });
  }

  try {
    console.log(`📝 Question reçue: "${question.substring(0, 50)}..."`);
    console.log(`🤖 Appel parallèle aux 4 IA (année: ${CURRENT_YEAR})`);

    // ---------- APPELS PARALLÈLES AUX 4 IA ----------
    const [openaiResult, geminiResult, mistralResult, groqResult] = await Promise.allSettled([
      // 1. OpenAI
      (async () => {
        try {
          const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `Nous sommes en ${CURRENT_YEAR}. Réponds avec des informations à jour et raisonne avec cette date.`
                },
                {
                  role: "user",
                  content: question
                }
              ],
              temperature: 0.0,
            },
            {
              headers: { Authorization: `Bearer ${OPENAI_KEY}` },
              timeout: 15000
            }
          );
          const answer = response.data?.choices?.[0]?.message?.content ?? "";
          const analysis = analyzeResponse(question, answer);
          return { answer, analysis, success: true };
        } catch (error) {
          console.error("❌ OpenAI error:", error.message);
          return { 
            answer: `[Erreur OpenAI: ${error.response?.data?.error?.message || error.message}]`,
            analysis: { score: 0, details: { pertinence: 0, longueur: 0, coherence: 0 }, wordCount: 0 },
            success: false 
          };
        }
      })(),

      // 2. Gemini
      (async () => {
        if (!GEMINI_KEY) return { answer: null, analysis: null, success: false, error: "Clé manquante" };
        try {
          const genAI = new GoogleGenerativeAI(GEMINI_KEY);
          const modelGemini = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
          const prompt = `Nous sommes en ${CURRENT_YEAR}. ${question}`;
          const result = await modelGemini.generateContent(prompt);
          const answer = result?.response?.text() ?? null;
          const analysis = analyzeResponse(question, answer);
          return { answer, analysis, success: true };
        } catch (error) {
          console.error("❌ Gemini error:", error.message);
          return { 
            answer: `[Erreur Gemini: ${error.message}]`,
            analysis: { score: 0, details: { pertinence: 0, longueur: 0, coherence: 0 }, wordCount: 0 },
            success: false 
          };
        }
      })(),

      // 3. Mistral (remplace DeepSeek) - API gratuite
      (async () => {
        if (!MISTRAL_KEY) return { answer: null, analysis: null, success: false, error: "Clé manquante" };
        try {
          const response = await axios.post(
            "https://api.mistral.ai/v1/chat/completions",
            {
              model: "mistral-tiny",
              messages: [
                {
                  role: "system",
                  content: `Nous sommes en ${CURRENT_YEAR}. Réponds avec des informations à jour.`
                },
                {
                  role: "user",
                  content: question
                }
              ],
              temperature: 0.0,
            },
            {
              headers: { Authorization: `Bearer ${MISTRAL_KEY}` },
              timeout: 15000
            }
          );
          const answer = response.data?.choices?.[0]?.message?.content ?? "";
          return { answer, analysis: null, success: true };
        } catch (error) {
          console.error("❌ Mistral error:", error.message);
          return { 
            answer: `[Erreur Mistral: ${error.message}]`,
            analysis: null,
            success: false 
          };
        }
      })(),

      // 4. Groq (Llama 3)
      (async () => {
        if (!GROQ_KEY) return { answer: null, analysis: null, success: false, error: "Clé manquante" };
        try {
          const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content: `Nous sommes en ${CURRENT_YEAR}. Réponds avec des informations à jour.`
                },
                {
                  role: "user",
                  content: question
                }
              ],
              temperature: 0.0,
            },
            {
              headers: { Authorization: `Bearer ${GROQ_KEY}` },
              timeout: 15000
            }
          );
          const answer = response.data?.choices?.[0]?.message?.content ?? "";
          return { answer, analysis: null, success: true };
        } catch (error) {
          console.error("❌ Groq error:", error.message);
          return { 
            answer: `[Erreur Llama: ${error.message}]`,
            analysis: null,
            success: false 
          };
        }
      })()
    ]);

    // Récupération des résultats
    const openaiData = openaiResult.status === 'fulfilled' ? openaiResult.value : { answer: null, analysis: null };
    const geminiData = geminiResult.status === 'fulfilled' ? geminiResult.value : { answer: null, analysis: null };
    const mistralData = mistralResult.status === 'fulfilled' ? mistralResult.value : { answer: null };
    const groqData = groqResult.status === 'fulfilled' ? groqResult.value : { answer: null };

    // ---------- CALCUL DU SCORE (toujours basé sur ChatGPT + Gemini) ----------
    let finalScore, verdict, agreementScore;

    const hasOpenai = openaiData.answer && !openaiData.answer.startsWith("[Erreur");
    const hasGemini = geminiData.answer && !geminiData.answer.startsWith("[Erreur");

    if (hasOpenai && hasGemini) {
      agreementScore = calculateAgreement(openaiData.answer, geminiData.answer);
      finalScore = Math.round((openaiData.analysis.score + agreementScore) / 2);
      
      if (finalScore >= 70) verdict = "fiable";
      else if (finalScore >= 45) verdict = "à vérifier";
      else if (finalScore >= 30) verdict = "douteux";
      else verdict = "contradictoire";
    } else if (hasOpenai) {
      finalScore = openaiData.analysis.score;
      if (finalScore >= 70) verdict = "fiable";
      else if (finalScore >= 45) verdict = "à vérifier";
      else verdict = "douteux";
    } else if (hasGemini) {
      finalScore = geminiData.analysis.score;
      if (finalScore >= 70) verdict = "fiable";
      else if (finalScore >= 45) verdict = "à vérifier";
      else verdict = "douteux";
    } else {
      finalScore = 0;
      verdict = "indisponible";
    }

    // Structure de réponse (toutes les 4 IA)
    const response = {
      question,
      finalScore,
      verdict,
      openai: openaiData.answer ? {
        answer: openaiData.answer,
        analysis: openaiData.analysis
      } : null,
      gemini: geminiData.answer ? {
        answer: geminiData.answer,
        analysis: geminiData.analysis
      } : null,
      mistral: mistralData.answer ? {
        answer: mistralData.answer
      } : null,
      llama: groqData.answer ? {
        answer: groqData.answer
      } : null
    };

    if (agreementScore) {
      response.agreementScore = agreementScore;
    }

    console.log(`✅ Réponses reçues: OpenAI=${hasOpenai}, Gemini=${hasGemini}, Mistral=${!!mistralData.answer}, Llama=${!!groqData.answer}`);
    res.json(response);

  } catch (error) {
    console.error("💥 Erreur globale:", error);
    return res.status(500).json({
      error: "Erreur lors de la vérification.",
      message: error.message
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

  const questionLower = question.toLowerCase();
  const answerLower = answer.toLowerCase();
  
  const questionWords = questionLower
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.includes(w));
  
  let motsClesTrouves = 0;
  questionWords.forEach(word => {
    if (answerLower.includes(word)) motsClesTrouves++;
  });
  
  const pertinence = questionWords.length > 0 
    ? (motsClesTrouves / questionWords.length) * 100
    : 70;

  const wordCount = answer.split(/\s+/).length;
  const longueurIdeale = 50;
  const longueur = Math.min(100, (wordCount / longueurIdeale) * 100);

  const aDesPoints = answer.includes('.') || answer.includes('!') || answer.includes('?');
  const aDesPhrases = (answer.match(/[.!?]/g) || []).length > 1;
  const coherence = aDesPhrases ? 90 : aDesPoints ? 70 : 50;

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
  // Vérifier que les deux textes existent
  if (!text1 || !text2) return 0;
  if (text1.startsWith("[Erreur") || text2.startsWith("[Erreur")) return 0;
  
  // Extraire les mots significatifs (plus de 3 lettres, sans stopwords)
  const words1 = text1.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.includes(w));
    
  const words2 = text2.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.includes(w));
  
  // Si un des deux n'a pas de mots, retourner 100 (pas de désaccord possible)
  if (words1.length === 0 || words2.length === 0) return 100;
  
  // Calculer l'intersection et l'union
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  // Éviter la division par zéro
  const jaccard = union.size === 0 ? 1 : intersection.size / union.size;
  
  // Score de base
  let score = jaccard * 100;
  
  // Bonus pour les chiffres (si les deux contiennent les mêmes nombres)
  const numbers1 = text1.match(/\b\d+\b/g) || [];
  const numbers2 = text2.match(/\b\d+\b/g) || [];
  
  if (numbers1.length > 0 && numbers2.length > 0) {
    const commonNumbers = numbers1.filter(n => numbers2.includes(n));
    const numberScore = commonNumbers.length / Math.max(numbers1.length, numbers2.length);
    score = (score + numberScore * 100) / 2;
  }
  
  // Bonus pour les réponses longues et similaires
  if (text1.length > 100 && text2.length > 100) {
    score = Math.min(100, score + 10);
  }
  
  // Arrondir et garantir que c'est un nombre
  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  
  return isNaN(finalScore) ? 100 : finalScore;
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/judge', judgeRoutes);
app.use('/api/conversations', conversationRoutes);

/* ===================================================== */

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 Serveur Vérificateur Multi-IA démarré !");
  console.log("=".repeat(50));
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔑 OpenAI: ${OPENAI_KEY ? "✅" : "❌"}`);
  console.log(`🔑 Gemini: ${GEMINI_KEY ? "✅" : "❌"}`);
  console.log(`🔑 Mistral: ${MISTRAL_KEY ? "✅" : "❌"}`);
  console.log(`🔑 Groq (Llama): ${GROQ_KEY ? "✅" : "❌"}`);
  console.log(`📅 Année actuelle: ${CURRENT_YEAR}`);
  console.log("=".repeat(50) + "\n");
});