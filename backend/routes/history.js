import express from 'express';
import History from '../models/History.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Sauvegarder une conversation complète
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      conversationId,
      title,
      modelUsed,
      messages,
      question,           // Gardé pour compatibilité
      finalScore,
      verdict,
      agreementScore,
      openaiAnswer,
      openaiScore,
      geminiAnswer,
      geminiAvailable,
      mistralAnswer,
      llamaAnswer,
      responseTime
    } = req.body;
    
    const history = new History({
      userId: req.userId,
      conversationId: conversationId || Date.now().toString(),
      title: title || (messages?.[0]?.content?.substring(0, 50) || question?.substring(0, 50) || "Nouvelle conversation"),
      modelUsed: modelUsed || 'chatgpt',
      messages: messages || [],
      question: question,
      finalScore,
      verdict,
      agreementScore,
      openaiAnswer,
      openaiScore,
      geminiAnswer,
      geminiAvailable,
      mistralAnswer,
      llamaAnswer,
      responseTime
    });
    
    await history.save();
    
    // Incrémenter le compteur de requêtes de l'utilisateur
    req.user.totalQueries = (req.user.totalQueries || 0) + 1;
    await req.user.save();
    
    res.json(history);
    
  } catch (error) {
    console.error("Erreur sauvegarde conversation:", error);
    res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  }
});

// Récupérer toutes les conversations de l'utilisateur
router.get('/', authenticate, async (req, res) => {
  try {
    const history = await History.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(history);
    
  } catch (error) {
    console.error("Erreur chargement conversations:", error);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// Récupérer une conversation spécifique par son ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const conversation = await History.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!conversation) {
      return res.status(404).json({ error: "Conversation non trouvée" });
    }
    
    res.json(conversation);
    
  } catch (error) {
    console.error("Erreur chargement conversation:", error);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// Mettre à jour une conversation (ajouter des messages)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { messages, title, modelUsed } = req.body;
    
    const conversation = await History.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!conversation) {
      return res.status(404).json({ error: "Conversation non trouvée" });
    }
    
    // Mettre à jour les champs
    if (messages) conversation.messages = messages;
    if (title) conversation.title = title;
    if (modelUsed) conversation.modelUsed = modelUsed;
    
    // Garder le dernier score pour l'affichage dans la liste
    if (messages && messages.length > 0) {
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        conversation.finalScore = lastAssistant.score;
        conversation.verdict = lastAssistant.verdict;
      }
    }
    
    await conversation.save();
    res.json(conversation);
    
  } catch (error) {
    console.error("Erreur mise à jour conversation:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// Supprimer une conversation
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await History.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error("Erreur suppression:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// Effacer tout l'historique
router.delete('/', authenticate, async (req, res) => {
  try {
    await History.deleteMany({ userId: req.userId });
    res.json({ success: true });
    
  } catch (error) {
    console.error("Erreur suppression totale:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// Route de test
router.get('/test', (req, res) => {
    res.json({ 
      message: "✅ Route history fonctionne",
      timestamp: new Date().toISOString(),
      routes: [
        "POST / (créer conversation)",
        "GET / (liste conversations)",
        "GET /:id (détail conversation)",
        "PUT /:id (mettre à jour)",
        "DELETE /:id (supprimer)",
        "DELETE / (tout effacer)",
        "GET /test"
      ]
    });
  });

export default router;