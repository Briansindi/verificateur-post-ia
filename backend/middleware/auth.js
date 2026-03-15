import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token manquant - Veuillez vous connecter" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: "Utilisateur non trouvé" });
    }
    
    req.user = user;
    req.userId = user._id;
    next();
    
  } catch (error) {
    return res.status(401).json({ error: "Session invalide - Veuillez vous reconnecter" });
  }
};