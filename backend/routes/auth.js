import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
const router = express.Router();

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Vérifications basiques
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: "Mot de passe trop court (minimum 6 caractères)" });
    }
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }
    
    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Créer l'utilisateur
    const user = new User({
      email,
      password: hashedPassword
    });
    
    await user.save();
    
    // Générer le token JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: "Inscription réussie",
      token,
      user: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
    
  } catch (error) {
    console.error("Erreur register:", error);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Vérifications
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }
    
    // Chercher l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }
    
    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }
    
    // Mettre à jour dernière connexion
    user.lastLogin = new Date();
    await user.save();
    
    // Générer le token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: "Connexion réussie",
      token,
      user: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt,
        totalQueries: user.totalQueries || 0
      }
    });
    
  } catch (error) {
    console.error("Erreur login:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// Route protégée pour tester
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      createdAt: req.user.createdAt,
      totalQueries: req.user.totalQueries || 0
    }
  });
});
// Route de test pour vérifier que auth fonctionne
router.get('/test', (req, res) => {
    res.json({ 
      message: "✅ Route auth fonctionne",
      timestamp: new Date().toISOString(),
      routes: [
        "POST /register",
        "POST /login",
        "GET /me (protégée)",
        "GET /test"
      ]
    });
  });
export default router;