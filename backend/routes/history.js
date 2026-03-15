import express from 'express';
import History from '../models/History.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Sauvegarder une analyse
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      question,
      finalScore,
      verdict,
      agreementScore,
      openaiAnswer,
      openaiScore,
      geminiAnswer,
      geminiAvailable,
      responseTime
    } = req.body;
    
    const history = new History({
      userId: req.userId,
      question,
      finalScore,
      verdict,
      agreementScore,
      openaiAnswer,
      openaiScore,
      geminiAnswer,
      geminiAvailable,
      responseTime
    });
    
    await history.save();
    
    // Incrémenter le compteur de requêtes de l'utilisateur
    req.user.totalQueries = (req.user.totalQueries || 0) + 1;
    await req.user.save();
    
    res.json(history);
    
  } catch (error) {
    console.error("Erreur sauvegarde historique:", error);
    res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  }
});

// Récupérer l'historique de l'utilisateur
router.get('/', authenticate, async (req, res) => {
  try {
    const history = await History.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(history);
    
  } catch (error) {
    console.error("Erreur chargement historique:", error);
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

// Supprimer un élément de l'historique
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
// Route de test pour vérifier que history fonctionne
router.get('/test', (req, res) => {
    res.json({ 
      message: "✅ Route history fonctionne",
      timestamp: new Date().toISOString(),
      routes: [
        "POST / (protégée)",
        "GET / (protégée)",
        "DELETE /:id (protégée)",
        "DELETE / (protégée)",
        "GET /test"
      ]
    });
  });

export default router;