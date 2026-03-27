import express from 'express';
import Conversation from '../models/Conversation.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Créer une nouvelle conversation
router.post('/', authenticate, async (req, res) => {
  try {
    const { modelUsed } = req.body;
    const conversation = new Conversation({
      userId: req.userId,
      modelUsed: modelUsed || 'chatgpt',
      title: "Nouvelle conversation",
      messages: []
    });
    await conversation.save();
    res.json(conversation);
  } catch (error) {
    console.error("Erreur création conversation:", error);
    res.status(500).json({ error: "Erreur lors de la création" });
  }
});

// Récupérer toutes les conversations de l'utilisateur
router.get('/', authenticate, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.userId })
      .sort({ lastMessageAt: -1 })
      .limit(50);
    
    res.json(conversations);
  } catch (error) {
    console.error("Erreur chargement conversations:", error);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// Récupérer une conversation spécifique
router.get('/:id', authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
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

// Ajouter un message à une conversation
router.post('/:id/messages', authenticate, async (req, res) => {
  try {
    const { role, content, score, verdict, fullData } = req.body;
    
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!conversation) {
      return res.status(404).json({ error: "Conversation non trouvée" });
    }
    
    conversation.messages.push({ role, content, score, verdict, fullData });
    
    // Mettre à jour le titre si c'est le premier message
    if (conversation.messages.length === 1 && role === 'user') {
      conversation.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }
    
    conversation.lastMessageAt = new Date();
    await conversation.save();
    
    res.json(conversation);
  } catch (error) {
    console.error("Erreur ajout message:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout" });
  }
});

// Supprimer une conversation
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// Supprimer toutes les conversations
router.delete('/', authenticate, async (req, res) => {
  try {
    await Conversation.deleteMany({ userId: req.userId });
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression totale:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

export default router;