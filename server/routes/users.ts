import express from 'express';
import UserModel, { User } from '../db/models/User';
import { authMiddleware, AuthRequest } from '../utils/auth';

const router = express.Router();

// Importer UserPathModel pour gérer les chemins personnalisés
import UserPathModel from '../db/models/UserPath';

// UserPathModel est un singleton, pas besoin de l'instancier
import fs from 'fs-extra';
import path from 'path';

// Créer un nouvel utilisateur
router.post('/', authMiddleware, (req, res) => {
  const authReq = req as AuthRequest;
  try {
    console.log('Tentative de création d\'utilisateur avec les données:', JSON.stringify(req.body));
    const { username, password, role, permissions, canRename, canDelete, canMove, customPath } = req.body;
    
    // Vérifier que tous les champs obligatoires sont présents
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }
    
    // Vérifier que le chemin personnalisé est spécifié
    if (!customPath) {
      return res.status(400).json({ error: 'Un chemin personnalisé est obligatoire pour créer un utilisateur' });
    }
    
    // Vérifier que le nom d'utilisateur n'est pas déjà utilisé
    if (UserModel.getByUsername(username)) {
      return res.status(400).json({ error: 'Nom d\'utilisateur déjà utilisé' });
    }
    
    // Préparer les permissions en fonction des droits d'action
    const userPermissions = permissions || [];
    
    // Ajouter les permissions de renommage, suppression et déplacement si nécessaire
    if (canRename && !userPermissions.includes('rename')) {
      userPermissions.push('rename');
    }
    if (canDelete && !userPermissions.includes('delete')) {
      userPermissions.push('delete');
    }
    if (canMove && !userPermissions.includes('move')) {
      userPermissions.push('move');
    }
    
    console.log('Création d\'utilisateur avec les paramètres:', { username, role: role || 'user', permissions: userPermissions, customPath });
    
    // Créer l'utilisateur
    const id = UserModel.create({ username, password, role: role || 'user', permissions: userPermissions });
    console.log('ID utilisateur créé:', id);
    
    // Récupérer l'utilisateur créé
    const user = UserModel.getById(id);
    console.log('Utilisateur récupéré:', user);
    
    // Définir le chemin personnalisé pour l'utilisateur
    try {
      // Vérifier si le dossier existe, sinon le créer
      if (!fs.existsSync(customPath)) {
        fs.mkdirSync(customPath, { recursive: true });
        console.log(`Dossier créé pour l'utilisateur ${username}: ${customPath}`);
      }
      
      // Définir le chemin virtuel pour l'utilisateur
      // Utiliser le format /{username} comme chemin virtuel standard
      const virtualPath = `/${username}`;
      
      // Vérifier que l'utilisateur a bien été créé
      if (!user || !user.id) {
        console.error(`Erreur: utilisateur non créé ou ID manquant`);
        return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
      }
      
      // Enregistrer le chemin personnalisé dans la base de données
      console.log(`Enregistrement du chemin personnalisé: username=${username}, virtualPath=${virtualPath}, customPath=${customPath}`);
      const success = UserPathModel.setPath(username, virtualPath, customPath);
      
      if (!success) {
        console.error(`Erreur lors de la définition du chemin personnalisé pour l'utilisateur ${username}`);
        // Supprimer l'utilisateur si le chemin n'a pas pu être défini
        UserModel.delete(id);
        return res.status(500).json({ error: 'Erreur lors de la définition du chemin personnalisé' });
      }
      
      // Vérifier que le chemin a bien été enregistré
      const savedPath = UserPathModel.getRealPath(username, virtualPath);
      if (!savedPath || savedPath !== customPath) {
        console.error(`Erreur: le chemin enregistré (${savedPath}) ne correspond pas au chemin demandé (${customPath})`);
        UserModel.delete(id);
        return res.status(500).json({ error: 'Erreur lors de la vérification du chemin personnalisé' });
      }
      
      console.log(`Chemin personnalisé défini pour l'utilisateur ${username}: ${customPath}`);
      
      // Ajouter le chemin personnalisé aux données de l'utilisateur retournées
      const userWithPath = {
        ...user,
        customPath
      };
      
      res.status(201).json(userWithPath);
    } catch (pathError) {
      console.error('Erreur lors de la définition du chemin personnalisé:', pathError);
      // Supprimer l'utilisateur si le chemin n'a pas pu être défini
      UserModel.delete(id);
      res.status(500).json({ error: 'Erreur lors de la définition du chemin personnalisé' });
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// Récupérer tous les utilisateurs
router.get('/', authMiddleware, (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const users = UserModel.getAll();
    
    // Importer UserPathModel pour récupérer les chemins personnalisés
    const UserPathModel = require('../db/models/UserPath').default;
    
    // Ajouter le chemin personnalisé à chaque utilisateur
    const usersWithPaths = users.map(user => {
      // Cas spécial pour l'utilisateur admin
      if (user.username === 'admin') {
        return {
          ...user,
          homePath: null, // Pas de chemin personnalisé pour admin
          isAdmin: true
        };
      }
      
      // Pour les autres utilisateurs, récupérer le chemin personnalisé
      const userPath = `/${user.username}`;
      
      // Récupérer le chemin personnalisé depuis la base de données
      const userPaths = UserPathModel.getByUserId(user.id);
      const customPath = userPaths && userPaths.length > 0 ? userPaths[0].real_path : null;
      
      // Ajouter le chemin personnalisé aux données de l'utilisateur
      return {
        ...user,
        homePath: userPath,
        customPath: customPath || userPath
      };
    });
    
    res.json(usersWithPaths);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// Mettre à jour un utilisateur
router.put('/:id', authMiddleware, (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID requis' });
    const { username, password, role, permissions, customPath } = req.body;
    
    // Mettre à jour l'utilisateur
    const ok = UserModel.update(id, { username, password, role, permissions });
    
    if (ok) {
      const user = UserModel.getById(id);
      
      // Mettre à jour le chemin personnalisé si fourni
      if (customPath) {
        try {
          // Utiliser la méthode setPath pour définir le chemin personnalisé
          const virtualPath = `/${username}`;
          UserPathModel.setPath(username, virtualPath, customPath);
          
          // Créer le dossier physique si nécessaire
          if (!fs.existsSync(customPath)) {
            fs.mkdirSync(customPath, { recursive: true });
          }
        } catch (pathError) {
          console.error('Erreur lors de la mise à jour du chemin personnalisé:', pathError);
        }
      }
      
      // Récupérer le chemin personnalisé mis à jour
      const userPaths = UserPathModel.getByUserId(id);
      const updatedCustomPath = userPaths && userPaths.length > 0 ? userPaths[0].real_path : null;
      
      return res.json({
        ...user,
        customPath: updatedCustomPath
      });
    }
    res.status(404).json({ error: 'Utilisateur non trouvé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// Supprimer un utilisateur
router.delete('/:id', authMiddleware, (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID requis' });
    const ok = UserModel.delete(id);
    if (ok) return res.json({ success: true });
    res.status(404).json({ error: 'Utilisateur non trouvé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Route pour changer le mot de passe d'un utilisateur
router.post('/:id/password', authMiddleware, (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    // Vérifier que l'utilisateur est admin ou qu'il change son propre mot de passe
    const currentUser = authReq.user;
    const targetUser = UserModel.getById(Number(id));
    
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    if (currentUser.role !== 'admin' && currentUser.id !== Number(id)) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour changer ce mot de passe' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    const updated = UserModel.update(Number(id), { password });
    
    if (updated) {
      res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la modification du mot de passe' });
    }
  } catch (error) {
    console.error('Erreur lors de la modification du mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
