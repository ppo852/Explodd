import express from 'express';
import { authMiddleware, AuthRequest } from '../utils/auth';
import SharedLinkModel, { SharedLink } from '../db/models/SharedLink';
import path from 'path';
import fs from 'fs-extra';
import { getFileInfo, getPhysicalPath } from '../utils/fileUtils';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import archiver from 'archiver';
import { hasPermission } from '../utils/permissionUtils';
import UserModel from '../db/models/User';

// Chemin de base pour le projet
const projectDir = process.cwd();

const router = express.Router();

// Créer un lien de partage (protégé par authentification)
router.post('/create', authMiddleware, express.json(), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const { filePath, password, expiryDays } = req.body;
    
    // Déboguer les données reçues

    
    // Convertir l'ID en string car notre modèle SharedLink attend un string
    const userId = String(authReq.user.id);
    
    // Vérifier si l'utilisateur a la permission de partager
    const user = UserModel.getById(Number(userId));
    if (!hasPermission(user, 'share')) {
      return res.status(403).json({ error: 'Vous n\'avez pas la permission de partager des fichiers' });
    }

    // Vérifier que tous les paramètres requis sont présents
    if (!filePath || !password) {
      return res.status(400).json({ error: 'Chemin du fichier et mot de passe requis' });
    }

    // Vérifier que le fichier existe
    let fullPath: string;
    try {
      // Récupérer le nom d'utilisateur depuis la requête authentifiée
      const username = authReq.user.username;
      
      // Détecter si le chemin est déjà un chemin physique absolu Windows (commence par X:\)
      const isWindowsAbsolutePath = /^[a-zA-Z]:\\/.test(filePath) || /^[a-zA-Z]:\//.test(filePath);
      
      if (isWindowsAbsolutePath) {
        // Normaliser le chemin pour gérer les chemins mixtes (backslashes et forward slashes)
        const normalizedPath = filePath.replace(/\//g, path.sep).replace(/\\/g, path.sep);

        
        // Vérifier si le fichier existe directement
        if (!fs.existsSync(normalizedPath)) {
          return res.status(404).json({ error: 'Fichier introuvable' });
        }
        fullPath = normalizedPath;
      } else {
        // Convertir le chemin virtuel en chemin physique
        fullPath = await getPhysicalPath(username, filePath);

        
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: 'Fichier introuvable' });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin' });
    }

    // Générer un identifiant unique pour le lien
    const linkId = uuidv4();

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculer la date d'expiration si spécifiée
    let expiresAt = null;
    if (expiryDays && expiryDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
    }

    // Créer le lien de partage
    SharedLinkModel.create({
      file_path: filePath,
      link_id: linkId,
      password: hashedPassword,
      expires_at: expiresAt ? expiresAt.toISOString() : undefined,
      user_id: userId
    });

    res.status(201).json({
      linkId,
      expiresAt: expiresAt ? expiresAt.toISOString() : null
    });
  } catch (error) {
    console.error('Erreur lors de la création du lien de partage:', error);
    res.status(500).json({ error: 'Erreur lors de la création du lien de partage' });
  }
});

// Vérifier le mot de passe pour un lien partagé
router.post('/verify/:linkId', express.json(), async (req, res) => {
  try {
    const { linkId } = req.params;
    const { password } = req.body;

    // Vérifier que le mot de passe est fourni
    if (!password) {
      return res.status(400).json({ error: 'Le mot de passe est obligatoire' });
    }

    // Trouver le lien partagé
    const sharedLink = SharedLinkModel.getByLinkId(linkId);
    if (!sharedLink) {
      return res.status(404).json({ error: 'Lien de partage introuvable' });
    }

    // Vérifier si le lien a expiré
    if (sharedLink.expires_at) {
      const expiryDate = new Date(sharedLink.expires_at);
      if (expiryDate < new Date()) {
        return res.status(410).json({ error: 'Ce lien a expiré' });
      }
    }

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, sharedLink.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // Générer un token JWT qui expire dans 15 minutes
    const tokenPayload = {
      linkId: linkId,
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    };

    // Clé secrète pour signer le token JWT (dans un environnement de production, utilisez une variable d'environnement)
    const SECRET_KEY = 'explodd-share-secret-key-change-in-production';
    const accessToken = jwt.sign(tokenPayload, SECRET_KEY);

    res.json({ 
      success: true,
      accessToken,
      filePath: sharedLink.file_path
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du lien de partage:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du lien de partage' });
  }
});

// Accéder aux informations d'un fichier partagé avec un token temporaire
router.get('/access/:accessToken', async (req, res) => {
  try {
    const { accessToken } = req.params;
    
    // Clé secrète pour vérifier le token JWT
    const SECRET_KEY = 'explodd-share-secret-key-change-in-production';
    
    // Vérifier que le token JWT est valide
    let decodedToken;
    try {
      decodedToken = jwt.verify(accessToken, SECRET_KEY) as { linkId: string };
    } catch (err) {
      return res.status(401).json({ error: 'Token d\'accès invalide ou expiré' });
    }
    
    const { linkId } = decodedToken;
    
    // Récupérer le lien partagé
    const sharedLink = SharedLinkModel.getByLinkId(linkId);
    if (!sharedLink) {
      return res.status(404).json({ error: 'Lien de partage non trouvé' });
    }
    
    // Vérifier si le lien a expiré
    if (sharedLink.expires_at) {
      const expiryDate = new Date(sharedLink.expires_at);
      if (expiryDate < new Date()) {
        return res.status(410).json({ error: 'Ce lien a expiré' });
      }
    }
    
    // Utiliser getPhysicalPath pour convertir le chemin virtuel en chemin physique
    let realPath: string;
    try {
      // Récupérer le nom d'utilisateur depuis le lien partagé
      const UserModel = require('../db/models/User').default;
      const user = UserModel.getById(sharedLink.user_id);
      const username = user ? user.username : '';
      
      // Convertir le chemin virtuel en chemin physique
      realPath = await getPhysicalPath(username, sharedLink.file_path);
      // console.log supprimé pour production ('Chemin physique résolu:', realPath);
      
      // Vérifier si le fichier existe
      if (!fs.existsSync(realPath)) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
      }
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin' });
    }
    
    // Si c'est un dossier, renvoyer les informations du dossier avec ses enfants
    const stats = await fs.stat(realPath);
    if (stats.isDirectory()) {
      // console.log supprimé pour production ('Accès à un dossier partagé:', realPath);
      
      // Lire le contenu du dossier
      const files = await fs.readdir(realPath);
      const children = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(realPath, file);
          return await getFileInfo(filePath, process.cwd(), path.join(sharedLink.file_path, file));
        })
      );
      
      // Créer l'objet fileInfo pour le dossier avec ses enfants
      const folderInfo = {
        name: path.basename(realPath),
        path: sharedLink.file_path,
        size: 0, // Les dossiers n'ont pas de taille directe
        type: 'folder',
        extension: '',
        modified: stats.mtime,
        children: children
      };
      
      // console.log supprimé pour production ('Informations du dossier partagé:', { name: folderInfo.name, childCount: children.length });
      return res.json({ fileInfo: folderInfo });
    }
    
    // Si c'est un fichier, renvoyer les informations du fichier au format JSON
    const fileName = path.basename(realPath);
    const fileInfo = {
      name: fileName,
      path: sharedLink.file_path,
      size: stats.size,
      type: 'file',
      extension: path.extname(fileName).slice(1).toLowerCase(),
      modified: stats.mtime
    };
    
    return res.json({ fileInfo });
  } catch (error) {
    console.error('Erreur lors de l\'accès au fichier partagé:', error);
    res.status(500).json({ error: 'Erreur lors de l\'accès au fichier partagé' });
  }
});

// Télécharger un fichier partagé avec un token temporaire
router.get('/download/:accessToken', async (req, res) => {
  try {
    const { accessToken } = req.params;
    
    // Clé secrète pour vérifier le token JWT
    const SECRET_KEY = 'explodd-share-secret-key-change-in-production';
    
    // Vérifier que le token JWT est valide
    let decodedToken;
    try {
      decodedToken = jwt.verify(accessToken, SECRET_KEY) as { linkId: string };
    } catch (err) {
      return res.status(401).json({ error: 'Token d\'accès invalide ou expiré' });
    }
    
    const { linkId } = decodedToken;
    
    // Récupérer le lien partagé
    const sharedLink = SharedLinkModel.getByLinkId(linkId);
    if (!sharedLink) {
      return res.status(404).json({ error: 'Lien de partage non trouvé' });
    }
    
    // Vérifier si le lien a expiré
    if (sharedLink.expires_at) {
      const expiryDate = new Date(sharedLink.expires_at);
      if (expiryDate < new Date()) {
        return res.status(410).json({ error: 'Ce lien a expiré' });
      }
    }
    
    // Utiliser getPhysicalPath pour convertir le chemin virtuel en chemin physique
    let realPath: string;
    try {
      // Récupérer le nom d'utilisateur depuis le lien partagé
      const UserModel = require('../db/models/User').default;
      const user = UserModel.getById(sharedLink.user_id);
      const username = user ? user.username : '';
      
      // Convertir le chemin virtuel en chemin physique
      realPath = await getPhysicalPath(username, sharedLink.file_path);
      // console.log supprimé pour production ('Chemin physique résolu pour téléchargement:', realPath);
      
      // Vérifier si le fichier existe
      if (!fs.existsSync(realPath)) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
      }
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin' });
    }
    
    // Si c'est un dossier et que format=zip est spécifié, créer une archive ZIP
    const stats = await fs.stat(realPath);
    if (stats.isDirectory() && req.query.format === 'zip') {
      // Créer une archive ZIP à la volée
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(realPath)}.zip"`);
      
      // Créer l'archive ZIP
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Gérer les erreurs d'archive
      archive.on('error', (err) => {
        console.error('Erreur lors de la création du ZIP:', err);
        res.status(500).end();
      });
      
      // Pipe l'archive directement vers la réponse HTTP
      archive.pipe(res);
      
      // Ajouter le dossier entier récursivement
      archive.directory(realPath, path.basename(realPath));
      
      // Finaliser l'archive
      await archive.finalize();
      return;
    } else if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Impossible de télécharger un dossier sans spécifier format=zip' });
    }
    
    // Si c'est un fichier, le télécharger
    const fileName = path.basename(realPath);
    res.download(realPath, fileName);
  } catch (error) {
    console.error('Erreur lors du téléchargement du fichier partagé:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier partagé' });
  }
});

// Supprimer un lien de partage (protégé par authentification)
router.delete('/:linkId', authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const { linkId } = req.params;
    
    // Convertir l'ID en string car notre modèle SharedLink attend un string
    const userId = String(authReq.user.id);
    
    // Trouver le lien partagé
    const sharedLink = SharedLinkModel.getByLinkId(linkId);
    
    if (!sharedLink) {
      return res.status(404).json({ error: 'Lien de partage introuvable' });
    }
    
    // Vérifier que l'utilisateur est le propriétaire du lien
    if (sharedLink.user_id !== userId) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour supprimer ce lien' });
    }
    
    // Supprimer le lien
    const deleted = SharedLinkModel.deleteByLinkId(linkId);
    
    if (!deleted) {
      return res.status(500).json({ error: 'Erreur lors de la suppression du lien' });
    }
    
    res.status(200).json({ message: 'Lien supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du lien de partage:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du lien de partage' });
  }
});

// Créer un lien de partage pour plusieurs fichiers (protégé par authentification)
router.post('/create-multi', authMiddleware, express.json(), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const { filePaths, password, expiryDays } = req.body;
    
    // Déboguer les données reçues

    
    // Convertir l'ID en string car notre modèle SharedLink attend un string
    const userId = String(authReq.user.id);

    // Vérifier que tous les paramètres requis sont présents
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0 || !password) {
      return res.status(400).json({ error: 'Liste de fichiers et mot de passe requis' });
    }

    // Récupérer le nom d'utilisateur depuis la requête authentifiée
    const username = authReq.user.username;
    
    // Vérifier que tous les fichiers existent
    const validPaths = [];
    for (const filePath of filePaths) {
      try {
        // Détecter si le chemin est déjà un chemin physique absolu Windows
        const isWindowsAbsolutePath = /^[a-zA-Z]:\\/.test(filePath) || /^[a-zA-Z]:\//.test(filePath);
        
        let fullPath;
        if (isWindowsAbsolutePath) {
          // Normaliser le chemin pour gérer les chemins mixtes
          const normalizedPath = filePath.replace(/\//g, path.sep).replace(/\\/g, path.sep);
          
          // Vérifier si le fichier existe directement
          if (!fs.existsSync(normalizedPath)) {

            continue;
          }
          fullPath = normalizedPath;
        } else {
          // Convertir le chemin virtuel en chemin physique
          fullPath = await getPhysicalPath(username, filePath);
          
          if (!fs.existsSync(fullPath)) {

            continue;
          }
        }
        
        // Ajouter le chemin valide à la liste
        validPaths.push({
          physicalPath: fullPath,
          virtualPath: filePath
        });
      } catch (error) {
        console.error(`Erreur lors de la vérification du chemin ${filePath}:`, error);
        // Continuer avec les autres fichiers
      }
    }
    
    // Vérifier qu'il y a au moins un fichier valide
    if (validPaths.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier valide trouvé' });
    }

    // Générer un identifiant unique pour le lien
    const linkId = uuidv4();

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculer la date d'expiration si spécifiée
    let expiresAt = null;
    if (expiryDays && expiryDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
    }

    // Créer le lien de partage avec un indicateur multi-fichiers
    SharedLinkModel.create({
      file_path: JSON.stringify(filePaths), // Stocker tous les chemins en JSON
      link_id: linkId,
      password: hashedPassword,
      expires_at: expiresAt ? expiresAt.toISOString() : undefined,
      user_id: userId,
      is_multi: true // Indicateur pour les liens multi-fichiers
    });

    res.status(201).json({
      linkId,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      fileCount: validPaths.length
    });
  } catch (error) {
    console.error('Erreur lors de la création du lien de partage multi-fichiers:', error);
    res.status(500).json({ error: 'Erreur lors de la création du lien de partage multi-fichiers' });
  }
});

// Télécharger plusieurs fichiers en ZIP avec un token temporaire
router.get('/download-zip/:accessToken', async (req, res) => {
  try {
    const { accessToken } = req.params;
    
    // Clé secrète pour vérifier le token JWT
    const SECRET_KEY = 'explodd-share-secret-key-change-in-production';
    
    // Vérifier que le token JWT est valide
    let decodedToken;
    try {
      decodedToken = jwt.verify(accessToken, SECRET_KEY) as { linkId: string };
    } catch (err) {
      return res.status(401).json({ error: 'Token d\'accès invalide ou expiré' });
    }
    
    const { linkId } = decodedToken;
    
    // Récupérer le lien partagé
    const sharedLink = SharedLinkModel.getByLinkId(linkId);
    if (!sharedLink) {
      return res.status(404).json({ error: 'Lien de partage non trouvé' });
    }
    
    // Vérifier si le lien a expiré
    if (sharedLink.expires_at) {
      const expiryDate = new Date(sharedLink.expires_at);
      if (expiryDate < new Date()) {
        return res.status(410).json({ error: 'Ce lien a expiré' });
      }
    }
    
    // Vérifier si c'est un lien multi-fichiers
    if (!sharedLink.is_multi) {
      return res.status(400).json({ error: 'Ce n\'est pas un lien multi-fichiers' });
    }
    
    // Récupérer la liste des chemins de fichiers
    let filePaths;
    try {
      filePaths = JSON.parse(sharedLink.file_path);
      if (!Array.isArray(filePaths)) {
        throw new Error('Format de chemin invalide');
      }
    } catch (error) {
      return res.status(500).json({ error: 'Format de lien invalide' });
    }
    
    // Récupérer le nom d'utilisateur depuis le lien partagé
    const UserModel = require('../db/models/User').default;
    const user = UserModel.getById(sharedLink.user_id);
    const username = user ? user.username : '';
    
    // Préparer le téléchargement ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="shared_files_${linkId.substring(0, 8)}.zip"`);
    
    // Créer l'archive ZIP à la volée
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Gérer les erreurs d'archive
    archive.on('error', (err) => {
      console.error('Erreur lors de la création du ZIP:', err);
      res.status(500).end();
    });
    
    // Pipe l'archive directement vers la réponse HTTP
    archive.pipe(res);
    
    // Liste des extensions de fichiers déjà compressés
    const compressedExtensions = [
      '.zip', '.rar', '.7z', '.gz', '.tar', '.bz2', '.xz', '.tgz', '.tbz2',
      '.iso', '.jar', '.war', '.ear', '.docx', '.xlsx', '.pptx', '.odt', '.epub'
    ];
    
    // Ajouter chaque fichier à l'archive
    for (const filePath of filePaths) {
      try {
        // Déterminer si le chemin est absolu ou virtuel
        const isWindowsAbsolutePath = /^[a-zA-Z]:\\/.test(filePath) || /^[a-zA-Z]:\//.test(filePath);
        
        let physicalPath;
        if (isWindowsAbsolutePath) {
          // Normaliser le chemin pour gérer les chemins mixtes
          physicalPath = filePath.replace(/\//g, path.sep).replace(/\\/g, path.sep);
        } else {
          // Convertir le chemin virtuel en chemin physique
          physicalPath = await getPhysicalPath(username, filePath);
        }
        
        // Vérifier si le fichier existe
        if (!fs.existsSync(physicalPath)) {
          // console.log supprimé pour production (`Fichier introuvable pour le ZIP: ${physicalPath}`);
          continue;
        }
        
        // Vérifier si c'est un dossier
        const stats = await fs.stat(physicalPath);
        if (stats.isDirectory()) {
          // Ajouter le dossier entier récursivement
          archive.directory(physicalPath, path.basename(physicalPath));
        } else {
          // Vérifier si le fichier est déjà compressé
          const ext = path.extname(physicalPath).toLowerCase();
          const isAlreadyCompressed = compressedExtensions.includes(ext);
          
          // Ajouter le fichier à l'archive
          if (isAlreadyCompressed) {
            // Ne pas compresser à nouveau les fichiers déjà compressés
            archive.file(physicalPath, { 
              name: path.basename(physicalPath),
              store: true // Stockage sans compression (ignorer l'erreur TypeScript)
            } as any); // Utiliser 'as any' pour éviter l'erreur de type
          } else {
            // Compresser normalement
            archive.file(physicalPath, { 
              name: path.basename(physicalPath)
            });
          }
        }
      } catch (error) {
        console.error(`Erreur lors de l'ajout du fichier ${filePath} au ZIP:`, error);
        // Continuer avec les autres fichiers
      }
    }
    
    // Finaliser l'archive
    await archive.finalize();
  } catch (error) {
    console.error('Erreur lors du téléchargement des fichiers partagés:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement des fichiers partagés' });
  }
});

// Liste des liens partagés d'un utilisateur (protégé par authentification)
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const userId = String(authReq.user.id);
    
    // Récupérer tous les liens partagés de l'utilisateur
    const userLinks = SharedLinkModel.getAllByUserId(userId);
    
    // Formater les liens pour l'affichage
    const formattedLinks = userLinks.map((link: SharedLink) => {
      // Vérifier si le lien est expiré
      let isExpired = false;
      if (link.expires_at) {
        const expiryDate = new Date(link.expires_at);
        isExpired = expiryDate < new Date();
      }
      
      // Récupérer les informations de l'utilisateur qui a créé le lien
      const creator = UserModel.getById(Number(link.user_id));
      
      // Vérifier si c'est un lien multi-fichiers
      let filePath = link.file_path;
      let fileName = '';
      
      if (link.is_multi && typeof filePath === 'string') {
        try {
          const paths = JSON.parse(filePath);
          filePath = Array.isArray(paths) ? paths[0] : filePath;
          fileName = path.basename(filePath) + ' (+ autres)';
        } catch (e) {
          fileName = 'Multiple fichiers';
        }
      } else {
        fileName = path.basename(filePath);
      }
      
      return {
        id: link.link_id,
        fileName,
        filePath,
        createdAt: link.created_at,
        expiresAt: link.expires_at || null,
        isExpired,
        isMulti: link.is_multi || false,
        creatorName: creator ? creator.username : 'Utilisateur inconnu'
      };
    });
    
    res.json({ links: formattedLinks });
  } catch (error) {
    console.error('Erreur lors de la récupération des liens partagés:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des liens partagés' });
  }
});

// Supprimer un lien partagé (protégé par authentification)
router.delete('/delete/:linkId', authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const userId = String(authReq.user.id);
    const { linkId } = req.params;
    
    // Vérifier que le lien existe et appartient à l'utilisateur
    const link = SharedLinkModel.getByLinkId(linkId);
    
    if (!link) {
      return res.status(404).json({ error: 'Lien introuvable' });
    }
    
    if (link.user_id !== userId) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour supprimer ce lien' });
    }
    
    // Supprimer le lien
    SharedLinkModel.deleteByLinkId(linkId);
    
    res.json({ success: true, message: 'Lien supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du lien partagé:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du lien partagé' });
  }
});

// Mettre à jour l'expiration d'un lien (protégé par authentification)
router.put('/update/:linkId', authMiddleware, express.json(), async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const userId = String(authReq.user.id);
    const { linkId } = req.params;
    const { expiryDays, newPassword } = req.body;
    
    // Vérifier que le lien existe et appartient à l'utilisateur
    const link = SharedLinkModel.getByLinkId(linkId);
    
    if (!link) {
      return res.status(404).json({ error: 'Lien introuvable' });
    }
    
    if (link.user_id !== userId) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour modifier ce lien' });
    }
    
    // Préparer les mises à jour
    const updates: any = {};
    
    // Mettre à jour l'expiration si spécifiée
    if (expiryDays !== undefined) {
      if (expiryDays > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);
        updates.expires_at = expiresAt.toISOString();
      } else {
        updates.expires_at = null; // Pas d'expiration
      }
    }
    
    // Mettre à jour le mot de passe si spécifié
    if (newPassword) {
      updates.password = await bcrypt.hash(newPassword, 10);
    }
    
    // Appliquer les mises à jour si le lien a un ID
    if (link.id) {
      SharedLinkModel.update(link.id, updates);
    }
    
    res.json({ 
      success: true, 
      message: 'Lien mis à jour avec succès',
      expiresAt: updates.expires_at
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du lien partagé:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du lien partagé' });
  }
});

export default router;
