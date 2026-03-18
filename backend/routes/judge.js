import express from 'express';
import axios from 'axios';

const router = express.Router();

// Utilise TA clé OpenAI existante
const OPENAI_KEY = process.env.OPENAI_API_KEY;

router.post('/evaluate', async (req, res) => {
  try {
    const { question, answerA, answerB } = req.body;
    
    console.log("🔍 Évaluation par GPT...");
    
    const prompt = `
Tu es un évaluateur impartial. Compare ces deux réponses d'IA à la question suivante :

QUESTION: "${question}"

RÉPONSE A (OpenAI):
${answerA}

RÉPONSE B (Gemini):
${answerB}

Analyse :
1. Les informations clés sont-elles les mêmes ?
2. Y a-t-il des contradictions ?
3. Quelle est la fiabilité de l'information ?

Réponds UNIQUEMENT au format JSON suivant :
{
  "accord": (nombre entre 0 et 100, basé sur la similarité des informations),
  "fiabilite": (nombre entre 0 et 100, basé sur la cohérence et le caractère factuel),
  "verdict": "fiable|à vérifier|douteux|contradictoire",
  "explication": "une phrase courte expliquant ta décision",
  "points_communs": ["point clé 1", "point clé 2"],
  "divergences": ["différence 1"] ou []
}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini', // ou gpt-3.5-turbo pour moins cher
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const evaluation = JSON.parse(response.data.choices[0].message.content);
    
    console.log("✅ Évaluation terminée");
    res.json(evaluation);
    
  } catch (error) {
    console.error("❌ Erreur juge GPT:", error);
    res.status(500).json({ 
      error: "Erreur d'évaluation",
      accord: 50,
      fiabilite: 50,
      verdict: "à vérifier",
      explication: "Erreur technique, évaluation approximative"
    });
  }
});

export default router;