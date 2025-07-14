import express from 'express';
import UserModel from '../db/models/User';
import { generateToken, authMiddleware } from '../utils/auth';

const router = express.Router();

/**
 * Route de connexion
 * POST /api/auth/login
 */
router.post('/login', express.json(), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }
    
    // Authentifier l'utilisateur
    const user = UserModel.authenticate(username, password);
    
    if (!user) {
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
    
    // Générer un token JWT
    const token = generateToken(user);
    
    // Renvoyer le token et les informations de l'utilisateur
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions // Ajout du tableau des permissions
      }
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

/**
 * Route pour vérifier si un token est valide
 * GET /api/auth/verify
 */
router.get('/verify', authMiddleware, (req, res) => {
  // Cette route est protégée par le middleware d'authentification
  // Si on arrive ici, c'est que le token est valide
  
  // Récupérer l'utilisateur complet depuis la base de données pour avoir les permissions à jour
  const authReq = req as any;
  const userId = authReq.user.id;
  
  if (userId) {
    const user = UserModel.getById(userId);
    if (user) {
      // Renvoyer les informations complètes de l'utilisateur
      return res.json({ 
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions
        }
      });
    }
  }
  
  // Fallback si l'utilisateur n'est pas trouvé
  res.json({ valid: true });
});

export default router;
