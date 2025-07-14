import jwt from 'jsonwebtoken';
import { User } from '../db/models/User';
import { Request, Response, NextFunction } from 'express';

// Type pour les requêtes authentifiées
export interface AuthRequest extends Request {
  user: User;
}

// Clé secrète pour signer les tokens JWT
// Dans un environnement de production, cette clé devrait être stockée dans une variable d'environnement
const JWT_SECRET = 'explodd-secret-key-change-in-production';

// Durée de validité du token (4 heures)
const TOKEN_EXPIRATION = '4h';

/**
 * Génère un token JWT pour un utilisateur
 */
export function generateToken(user: User): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions // Ajout des permissions au payload du token
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
}

/**
 * Vérifie et décode un token JWT
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extrait le token JWT de l'en-tête Authorization
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.split(' ')[1];
}

/**
 * Middleware Express pour vérifier l'authentification
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  
  // Ajouter les informations de l'utilisateur à la requête
  (req as AuthRequest).user = decoded;
  next();
}

/**
 * Middleware Express pour vérifier les rôles
 */
export function roleMiddleware(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    next();
  };
}
