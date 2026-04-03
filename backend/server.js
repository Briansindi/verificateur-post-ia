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
import { pipeline } from '@xenova/transformers';

dotenv.config();

// Connexion à MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5050;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

const CURRENT_YEAR = new Date().getFullYear();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "Vérificateur Multi-IA",
    mongodb: "✅ connecté",
    version: "3.0"
  });
});

if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

// ⚡ Timeout
const withTimeout = (promise, ms, name) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${name} timeout`)), ms)
    )
  ]);
};

// ⚡ Embedding local avec Transformers.js
let embeddingPipeline = null;

async function getEmbedding(text) {
  try {
    if (!embeddingPipeline) {
      console.log("🔄 Chargement du modèle d'embedding (1ère fois seulement)...");
      embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log("✅ Modèle d'embedding chargé !");
    }
    
    const result = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  } catch (error) {
    console.error("❌ Embedding error:", error.message);
    return null;
  }
}

// ⚡ Similarité cosinus
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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

    // ---------- APPELS PARALLÈLES ----------
    const [openaiResult, geminiResult, mistralResult, groqResult] = await Promise.allSettled([
      // 1. OpenAI
      (async () => {
        try {
          const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: `Nous sommes en ${CURRENT_YEAR}. Réponds avec des informations à jour.` },
                { role: "user", content: question }
              ],
              temperature: 0.0,
              max_tokens: 400
            },
            { headers: { Authorization: `Bearer ${OPENAI_KEY}` }, timeout: 12000 }
          );
          const answer = response.data?.choices?.[0]?.message?.content ?? "";
          const analysis = analyzeResponse(question, answer);
          return { answer, analysis, success: true };
        } catch (error) {
          console.error("❌ OpenAI error:", error.message);
          return { 
            answer: `[Erreur OpenAI]`,
            analysis: { score: 0, details: { pertinence: 0, longueur: 0, coherence: 0 }, wordCount: 0 },
            success: false 
          };
        }
      })(),

      // 2. Gemini
      (async () => {
        if (!GEMINI_KEY) return { answer: null, analysis: null, success: false };
        try {
          const genAI = new GoogleGenerativeAI(GEMINI_KEY);
          const modelGemini = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: { temperature: 0.0, maxOutputTokens: 300 }
          });
          
          const result = await withTimeout(
            modelGemini.generateContent(question),
            20000,
            "Gemini"
          );
          
          const answer = result?.response?.text() ?? null;
          const analysis = analyzeResponse(question, answer);
          return { answer, analysis, success: true };
        } catch (error) {
          console.error("❌ Gemini error:", error.message);
          return { 
            answer: `[Erreur Gemini]`,
            analysis: { score: 0, details: {}, wordCount: 0 },
            success: false 
          };
        }
      })(),

      // 3. Mistral
      (async () => {
        if (!MISTRAL_KEY) return { answer: null };
        try {
          const response = await axios.post(
            "https://api.mistral.ai/v1/chat/completions",
            {
              model: "mistral-tiny",
              messages: [
                { role: "system", content: `Nous sommes en ${CURRENT_YEAR}.` },
                { role: "user", content: question }
              ],
              temperature: 0.0,
              max_tokens: 300
            },
            { headers: { Authorization: `Bearer ${MISTRAL_KEY}` }, timeout: 12000 }
          );
          return { answer: response.data?.choices?.[0]?.message?.content ?? "" };
        } catch (error) {
          console.error("❌ Mistral error:", error.message);
          return { answer: null };
        }
      })(),

      // 4. Llama
      (async () => {
        if (!GROQ_KEY) return { answer: null };
        try {
          const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: `Nous sommes en ${CURRENT_YEAR}.` },
                { role: "user", content: question }
              ],
              temperature: 0.0,
              max_tokens: 300
            },
            { headers: { Authorization: `Bearer ${GROQ_KEY}` }, timeout: 12000 }
          );
          return { answer: response.data?.choices?.[0]?.message?.content ?? "" };
        } catch (error) {
          console.error("❌ Llama error:", error.message);
          return { answer: null };
        }
      })()
    ]);

    const openaiData = openaiResult.status === 'fulfilled' ? openaiResult.value : { answer: null, analysis: null };
    const geminiData = geminiResult.status === 'fulfilled' ? geminiResult.value : { answer: null, analysis: null };
    const mistralData = mistralResult.status === 'fulfilled' ? mistralResult.value : { answer: null };
    const groqData = groqResult.status === 'fulfilled' ? groqResult.value : { answer: null };

    // ---------- CALCUL DU SCORE AVEC EMBEDDING LOCAL ----------
    let finalScore, verdict;
    let lexicalScore = 0;
    let embeddingScore = 0;

    const hasOpenai = openaiData.answer && !openaiData.answer.includes("[Erreur");
    const hasGemini = geminiData.answer && !geminiData.answer.includes("[Erreur");

    if (hasOpenai && hasGemini) {
      // 1. Score lexical (ancien algorithme)
      lexicalScore = calculateAgreement(openaiData.answer, geminiData.answer);
      
      // 2. Score sémantique (embedding local)
      console.log("🔍 Calcul de similarité sémantique via embedding local...");
      const [embedding1, embedding2] = await Promise.all([
        getEmbedding(openaiData.answer),
        getEmbedding(geminiData.answer)
      ]);
      
      if (embedding1 && embedding2) {
        embeddingScore = cosineSimilarity(embedding1, embedding2) * 100;
        console.log(`📊 Similarité sémantique: ${embeddingScore.toFixed(1)}%`);
      } else {
        embeddingScore = lexicalScore; // fallback
      }
      
      // 3. Score final pondéré (lexical 20% + sémantique 80%)
      const combinedAgreement = (lexicalScore * 0.2) + (embeddingScore * 0.8);
      finalScore = Math.round((openaiData.analysis.score + combinedAgreement) / 2);
      
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

    // Structure de réponse
    const response = {
      question,
      finalScore,
      verdict,
      semanticScore: embeddingScore > 0 ? Math.round(embeddingScore) : undefined,
      lexicalScore: Math.round(lexicalScore),
      openai: openaiData.answer ? {
        answer: openaiData.answer,
        analysis: openaiData.analysis
      } : null,
      gemini: geminiData.answer ? {
        answer: geminiData.answer,
        analysis: geminiData.analysis
      } : null,
      mistral: mistralData.answer ? { answer: mistralData.answer } : null,
      llama: groqData.answer ? { answer: groqData.answer } : null
    };

    console.log(`✅ Réponses: OpenAI=${hasOpenai}, Gemini=${hasGemini}`);
    console.log(`📊 Lexical: ${lexicalScore}% | Sémantique: ${embeddingScore.toFixed(1)}% | Final: ${finalScore}%`);
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
/* ============= ANALYSE ============= */
/* ===================================================== */

function analyzeResponse(question, answer) {
  if (!answer || answer.trim().length === 0 || answer.startsWith("[Erreur")) {
    return {
      score: 0,
      details: { pertinence: 0, longueur: 0, coherence: 0 },
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
  const longueur = Math.min(100, (wordCount / 50) * 100);

  const aDesPoints = answer.includes('.') || answer.includes('!') || answer.includes('?');
  const aDesPhrases = (answer.match(/[.!?]/g) || []).length > 1;
  const coherence = aDesPhrases ? 90 : aDesPoints ? 70 : 50;

  const score = Math.round(pertinence * 0.5 + longueur * 0.25 + coherence * 0.25);

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

const stopwords = [
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "mais",
  "est", "sont", "dans", "avec", "pour", "sur", "par", "plus", "moins",
  "que", "qui", "quoi", "dont", "où", "au", "aux", "ce", "ces", "cet",
  "cette", "mon", "ton", "son", "notre", "votre", "leur", "mes", "tes",
  "ses", "nos", "vos", "leurs", "a", "ont", "été", "sera", "était"
];

function calculateAgreement(text1, text2) {
  if (!text1 || !text2) return 0;
  if (text1.includes("[Erreur") || text2.includes("[Erreur")) return 0;
  
  const words1 = text1.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.includes(w));
    
  const words2 = text2.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.includes(w));
  
  if (words1.length === 0 || words2.length === 0) return 100;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  let score = (intersection.size / union.size) * 100;
  
  const numbers1 = text1.match(/\b\d+\b/g) || [];
  const numbers2 = text2.match(/\b\d+\b/g) || [];
  
  if (numbers1.length > 0 && numbers2.length > 0) {
    const commonNumbers = numbers1.filter(n => numbers2.includes(n));
    const numberScore = commonNumbers.length / Math.max(numbers1.length, numbers2.length);
    score = (score + numberScore * 100) / 2;
  }
  
  if (text1.length > 100 && text2.length > 100) {
    score = Math.min(100, score + 10);
  }
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/judge', judgeRoutes);
app.use('/api/conversations', conversationRoutes);

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 Serveur Vérificateur Multi-IA démarré !");
  console.log("=".repeat(50));
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔑 OpenAI: ${OPENAI_KEY ? "✅" : "❌"}`);
  console.log(`🔑 Gemini: ${GEMINI_KEY ? "✅" : "❌"}`);
  console.log(`🔑 Mistral: ${MISTRAL_KEY ? "✅" : "❌"}`);
  console.log(`🔑 Groq: ${GROQ_KEY ? "✅" : "❌"}`);
  console.log(`🧠 Embedding local: ✅ (all-MiniLM-L6-v2)`);
  console.log(`📅 Année: ${CURRENT_YEAR}`);
  console.log("=".repeat(50) + "\n");
});