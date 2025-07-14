import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import archiver from 'archiver';

// Définition du type AuthRequest
interface AuthRequest extends express.Request {
  user: {
    id: number;
    username: string;
  };
}

import { authMiddleware } from '../utils/auth';
import { getPhysicalPath } from '../utils/fileUtils';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const JWT_SECRET = 'explodd-secret-key-change-in-production';

// Configuration de multer pour le téléchargement de fichiers
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Récupérer l'utilisateur depuis le token
      let currentUsername: string | null = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
          const token = req.headers.authorization.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
          currentUsername = decoded.username;
        } catch (tokenError) {
          console.error('Erreur de décodage du token:', tokenError);
          return cb(new Error('Token invalide'), '');
        }
      }

      if (!currentUsername) {
        return cb(new Error('Utilisateur non authentifié'), '');
      }

      // Récupérer le chemin de destination depuis la requête
      const { path: destPath } = req.body;
      if (!destPath) {
        return cb(new Error('Chemin de destination requis'), '');
      }

      // Obtenir le chemin physique de destination
      try {
        const physicalPath = await getPhysicalPath(currentUsername, destPath);
        
        // Vérifier si le dossier existe, sinon le créer
        if (!await fs.pathExists(physicalPath)) {
          await fs.mkdir(physicalPath, { recursive: true });
        }
        
        cb(null, physicalPath);
      } catch (error) {
        console.error('Erreur lors de la conversion du chemin:', error);
        cb(new Error('Erreur lors de la conversion du chemin'), '');
      }
    } catch (error) {
      console.error('Erreur lors de la préparation du téléchargement:', error);
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // Utiliser le nom original du fichier ou générer un UUID si nécessaire
    const originalName = file.originalname;
    cb(null, originalName);
  }
});

const upload = multer({ storage });

// Route pour renommer un fichier ou un dossier
router.post('/rename', authMiddleware, async (req, res) => {
  try {
    const { filePath, newName } = req.body;
    
    if (!filePath || !newName) {
      return res.status(400).json({ error: 'Le chemin du fichier et le nouveau nom sont requis' });
    }

    // Récupérer l'utilisateur depuis le token
    let currentUsername: string | null = null;
    let userId: number | null = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
        currentUsername = decoded.username;
        userId = decoded.id;
      } catch (tokenError) {
        console.error('Erreur de décodage du token:', tokenError);
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    if (!currentUsername || !userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    
    // Vérifier si l'utilisateur a la permission de renommer
    const user = UserModel.getById(userId);
    if (!hasPermission(user, 'rename')) {
      return res.status(403).json({ error: 'Vous n\'avez pas la permission de renommer des fichiers ou dossiers' });
    }

    // Obtenir le chemin physique du fichier
    let oldPhysicalPath: string;

    try {
      oldPhysicalPath = await getPhysicalPath(currentUsername, filePath);
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin' });
    }

    // Vérifier si le fichier existe
    if (!await fs.pathExists(oldPhysicalPath)) {
      return res.status(404).json({ error: 'Fichier ou dossier introuvable' });
    }

    // Construire le nouveau chemin
    const dirPath = path.dirname(oldPhysicalPath);
    const newPhysicalPath = path.join(dirPath, newName);

    // Vérifier si un fichier avec le nouveau nom existe déjà
    if (await fs.pathExists(newPhysicalPath)) {
      return res.status(409).json({ error: 'Un fichier ou dossier avec ce nom existe déjà' });
    }

    // Renommer le fichier
    await fs.rename(oldPhysicalPath, newPhysicalPath);

    // Construire le nouveau chemin virtuel pour la réponse
    const oldBasename = path.basename(filePath);
    const newVirtualPath = filePath.replace(oldBasename, newName);
    
    // Ajouter des logs pour débogage
    // console.log supprimé pour production ('Renommage de fichier:');
    // console.log supprimé pour production ('- Ancien chemin physique:', oldPhysicalPath);
    // console.log supprimé pour production ('- Nouveau chemin physique:', newPhysicalPath);
    // console.log supprimé pour production ('- Ancien chemin virtuel:', filePath);
    // console.log supprimé pour production ('- Nouveau chemin virtuel:', newVirtualPath);
    
    // Vérifier que le fichier existe bien au nouvel emplacement
    const fileExists = await fs.pathExists(newPhysicalPath);
    // console.log supprimé pour production ('- Fichier existe au nouvel emplacement:', fileExists);
    
    // Forcer un rafraîchissement du cache des fichiers
    // (Cela peut aider si le problème est lié à un cache côté serveur)
    try {
      // Si c'est un dossier, indexer son contenu
      const stats = await fs.stat(newPhysicalPath);
      if (stats.isDirectory()) {
        // console.log supprimé pour production ('- Démarrage de l\'indexation du dossier renommé');
        // Vous pouvez appeler ici une fonction d'indexation si nécessaire
      }
    } catch (indexError) {
      console.error('Erreur lors de l\'indexation après renommage:', indexError);
    }

    res.json({
      success: true,
      oldPath: filePath,
      newPath: newVirtualPath,
      fileExists: fileExists
    });
  } catch (error) {
    console.error('Erreur lors du renommage:', error);
    res.status(500).json({ error: 'Erreur lors du renommage du fichier ou dossier' });
  }
});

// Route pour supprimer un fichier ou un dossier
router.post('/delete', authMiddleware, async (req, res) => {
  try {
    const { filePaths } = req.body;
    
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return res.status(400).json({ error: 'Les chemins des fichiers à supprimer sont requis' });
    }

    // Récupérer l'utilisateur depuis le token
    let currentUsername: string | null = null;
    let userId: number | null = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
        currentUsername = decoded.username;
        userId = decoded.id;
      } catch (tokenError) {
        console.error('Erreur de décodage du token:', tokenError);
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    if (!currentUsername || !userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    
    // Vérifier si l'utilisateur a la permission de supprimer
    const user = UserModel.getById(userId);
    if (!hasPermission(user, 'delete')) {
      return res.status(403).json({ error: 'Vous n\'avez pas la permission de supprimer des fichiers ou dossiers' });
    }

    const results = [];
    const errors = [];

    // Traiter chaque fichier à supprimer
    for (const filePath of filePaths) {
      try {
        // Obtenir le chemin physique du fichier
        const physicalPath = await getPhysicalPath(currentUsername, filePath);

        // Vérifier si le fichier existe
        if (!await fs.pathExists(physicalPath)) {
          errors.push({ path: filePath, error: 'Fichier ou dossier introuvable' });
          continue;
        }

        // Supprimer le fichier ou dossier
        await fs.remove(physicalPath);
        results.push({ path: filePath, success: true });
      } catch (error) {
        console.error(`Erreur lors de la suppression de ${filePath}:`, error);
        errors.push({ path: filePath, error: 'Erreur lors de la suppression' });
      }
    }

    res.json({
      success: errors.length === 0,
      results,
      errors
    });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des fichiers ou dossiers' });
  }
});

// Route pour déplacer un fichier ou un dossier
router.post('/move', authMiddleware, async (req, res) => {
  try {
    const { filePaths, destinationPath } = req.body;
    
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0 || !destinationPath) {
      return res.status(400).json({ error: 'Les chemins des fichiers et le chemin de destination sont requis' });
    }

    // Récupérer l'utilisateur depuis le token
    let currentUsername: string | null = null;
    let userId: number | null = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
        currentUsername = decoded.username;
        userId = decoded.id;
      } catch (tokenError) {
        console.error('Erreur de décodage du token:', tokenError);
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    if (!currentUsername || !userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    
    // Vérifier si l'utilisateur a la permission de déplacer
    const user = UserModel.getById(userId);
    if (!hasPermission(user, 'move')) {
      return res.status(403).json({ error: 'Vous n\'avez pas la permission de déplacer des fichiers ou dossiers' });
    }

    const results = [];
    const errors = [];

    // Obtenir le chemin physique de la destination
    let destPhysicalPath: string;
    try {
      destPhysicalPath = await getPhysicalPath(currentUsername, destinationPath);
      
      // Vérifier si la destination existe et est un dossier
      const destStats = await fs.stat(destPhysicalPath);
      if (!destStats.isDirectory()) {
        return res.status(400).json({ error: 'La destination n\'est pas un dossier' });
      }
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin de destination:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin de destination' });
    }

    // Traiter chaque fichier à déplacer
    for (const filePath of filePaths) {
      try {
        // Obtenir le chemin physique du fichier
        const sourcePhysicalPath = await getPhysicalPath(currentUsername, filePath);

        // Vérifier si le fichier existe
        if (!await fs.pathExists(sourcePhysicalPath)) {
          errors.push({ path: filePath, error: 'Fichier ou dossier introuvable' });
          continue;
        }

        // Construire le nouveau chemin
        const fileName = path.basename(sourcePhysicalPath);
        const newPhysicalPath = path.join(destPhysicalPath, fileName);

        // Vérifier si un fichier avec le même nom existe déjà à la destination
        if (await fs.pathExists(newPhysicalPath)) {
          errors.push({ path: filePath, error: 'Un fichier ou dossier avec ce nom existe déjà à la destination' });
          continue;
        }

        // Déplacer le fichier
        await fs.move(sourcePhysicalPath, newPhysicalPath);

        // Construire le nouveau chemin virtuel pour la réponse
        const newVirtualPath = path.posix.join(destinationPath, fileName);
        results.push({ 
          oldPath: filePath, 
          newPath: newVirtualPath,
          success: true 
        });
      } catch (error) {
        console.error(`Erreur lors du déplacement de ${filePath}:`, error);
        errors.push({ path: filePath, error: 'Erreur lors du déplacement' });
      }
    }

    res.json({
      success: errors.length === 0,
      results,
      errors
    });
  } catch (error) {
    console.error('Erreur lors du déplacement:', error);
    res.status(500).json({ error: 'Erreur lors du déplacement des fichiers ou dossiers' });
  }
});

import { hasPermission } from '../utils/permissionUtils';
import UserModel from '../db/models/User';

// Route pour créer un nouveau dossier
router.post('/mkdir', authMiddleware, async (req, res) => {
  try {
    const { path: folderPath, name } = req.body;
    
    if (!folderPath || !name) {
      return res.status(400).json({ error: 'Le chemin du dossier parent et le nom sont requis' });
    }

    // Récupérer l'utilisateur depuis le token
    let currentUsername: string | null = null;
    let userId: number | null = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
        currentUsername = decoded.username;
        userId = decoded.id;
      } catch (tokenError) {
        console.error('Erreur de décodage du token:', tokenError);
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    if (!currentUsername || !userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    
    // Vérifier si l'utilisateur a la permission d'écriture
    const user = UserModel.getById(userId);
    if (!hasPermission(user, 'write')) {
      return res.status(403).json({ error: 'Vous n\'avez pas la permission de créer des dossiers' });
    }

    // Construire le chemin complet du nouveau dossier
    const newFolderVirtualPath = path.posix.join(folderPath, name);
    
    // Obtenir le chemin physique du nouveau dossier
    let newFolderPhysicalPath: string;
    try {
      newFolderPhysicalPath = await getPhysicalPath(currentUsername, newFolderVirtualPath);
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin' });
    }

    // Vérifier si le dossier existe déjà
    if (await fs.pathExists(newFolderPhysicalPath)) {
      return res.status(409).json({ error: 'Un fichier ou dossier avec ce nom existe déjà' });
    }

    // Créer le dossier
    await fs.mkdir(newFolderPhysicalPath, { recursive: true });

    res.json({
      success: true,
      path: newFolderVirtualPath
    });
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    res.status(500).json({ error: 'Erreur lors de la création du dossier' });
  }
});

// Route pour créer un nouveau fichier vide
router.post('/touch', authMiddleware, async (req, res) => {
  try {
    const { path: folderPath, name } = req.body;
    
    if (!folderPath || !name) {
      return res.status(400).json({ error: 'Le chemin du dossier parent et le nom sont requis' });
    }

    // Récupérer l'utilisateur depuis le token
    let currentUsername: string | null = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
        currentUsername = decoded.username;
      } catch (tokenError) {
        console.error('Erreur de décodage du token:', tokenError);
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    if (!currentUsername) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    // Construire le chemin complet du nouveau fichier
    const newFileVirtualPath = path.posix.join(folderPath, name);
    
    // Obtenir le chemin physique du nouveau fichier
    let newFilePhysicalPath: string;
    try {
      newFilePhysicalPath = await getPhysicalPath(currentUsername, newFileVirtualPath);
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin' });
    }

    // Vérifier si le fichier existe déjà
    if (await fs.pathExists(newFilePhysicalPath)) {
      return res.status(409).json({ error: 'Un fichier ou dossier avec ce nom existe déjà' });
    }

    // Créer le fichier vide
    await fs.writeFile(newFilePhysicalPath, '');

    res.json({
      success: true,
      path: newFileVirtualPath
    });
  } catch (error) {
    console.error('Erreur lors de la création du fichier:', error);
    res.status(500).json({ error: 'Erreur lors de la création du fichier' });
  }
});

// Route pour télécharger des fichiers
router.post('/upload', authMiddleware, (req, res) => {
  // Utiliser multer pour gérer le téléchargement
  upload.array('files')(req, res, async (err) => {
    if (err) {
      console.error('Erreur lors du téléchargement:', err);
      return res.status(500).json({ error: 'Erreur lors du téléchargement des fichiers' });
    }

    try {
      const files = req.files as Express.Multer.File[];
      const { path: destPath } = req.body;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Aucun fichier téléchargé' });
      }

      // Récupérer l'utilisateur depuis le token
      let currentUsername: string | null = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
          const token = req.headers.authorization.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
          currentUsername = decoded.username;
        } catch (tokenError) {
          console.error('Erreur de décodage du token:', tokenError);
          return res.status(401).json({ error: 'Token invalide' });
        }
      }

      if (!currentUsername) {
        return res.status(401).json({ error: 'Utilisateur non authentifié' });
      }

      // Construire les chemins virtuels pour la réponse
      const results = files.map(file => {
        const virtualPath = path.posix.join(destPath, file.filename);
        return {
          originalName: file.originalname,
          path: virtualPath,
          size: file.size,
          mimetype: file.mimetype,
          success: true
        };
      });

      res.json({
        success: true,
        files: results
      });
    } catch (error) {
      console.error('Erreur lors du traitement des fichiers téléchargés:', error);
      res.status(500).json({ error: 'Erreur lors du traitement des fichiers téléchargés' });
    }
  });
});

// Route pour télécharger (download) des fichiers ou dossiers sélectionnés
router.post('/download', authMiddleware, async (req, res) => {
  try {
    const { paths } = req.body;
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier sélectionné pour le téléchargement' });
    }

    // Récupérer l'utilisateur depuis le token
    const authReq = req as AuthRequest;
    const currentUsername = authReq.user.username;

    // Si un seul fichier est sélectionné et que ce n'est pas un dossier, le télécharger directement
    if (paths.length === 1) {
      const filePath = paths[0];
      const physicalPath = await getPhysicalPath(currentUsername, filePath);
      
      // Vérifier si le fichier existe
      if (!await fs.pathExists(physicalPath)) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
      }
      
      const stats = await fs.stat(physicalPath);
      
      // Si c'est un fichier, le télécharger directement
      if (stats.isFile()) {
        const fileName = path.basename(physicalPath);
        return res.download(physicalPath, fileName);
      }
    }
    
    // Pour plusieurs fichiers ou un dossier, créer une archive ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="explodd-files.zip"`);
    
    // Créer l'archive ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Gérer les erreurs d'archive
    archive.on('error', (err: Error) => {
      console.error('Erreur lors de la création du ZIP:', err);
      res.status(500).end();
    });
    
    // Pipe l'archive directement vers la réponse HTTP
    archive.pipe(res);
    
    // Liste des extensions de fichiers déjà compressés
    const compressedExtensions = [
      '.zip', '.rar', '.7z', '.gz', '.tar', '.bz2', '.xz',
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.mp4', '.avi',
      '.mov', '.mkv', '.pdf', '.docx', '.xlsx', '.pptx'
    ];
    
    // Ajouter chaque fichier/dossier à l'archive
    for (const virtualPath of paths) {
      try {
        const physicalPath = await getPhysicalPath(currentUsername, virtualPath);
        
        if (!await fs.pathExists(physicalPath)) {
          console.warn(`Fichier non trouvé: ${physicalPath}`);
          continue;
        }
        
        const stats = await fs.stat(physicalPath);
        const name = path.basename(physicalPath);
        
        if (stats.isDirectory()) {
          // Ajouter le dossier entier récursivement
          archive.directory(physicalPath, name);
        } else {
          // Pour les fichiers
          const ext = path.extname(physicalPath).toLowerCase();
          const isAlreadyCompressed = compressedExtensions.includes(ext);
          
          if (isAlreadyCompressed) {
            // Ne pas compresser à nouveau les fichiers déjà compressés
            // Utiliser une assertion de type pour contourner la limitation du type EntryData
            archive.file(physicalPath, { 
              name: name,
              store: true // Stockage sans compression
            } as archiver.EntryData);
          } else {
            // Compresser normalement
            archive.file(physicalPath, { name: name });
          }
        }
      } catch (error) {
        console.error(`Erreur lors de l'ajout du fichier ${virtualPath} à l'archive:`, error);
      }
    }
    
    // Finaliser l'archive
    await archive.finalize();
  } catch (error) {
    console.error('Erreur lors du téléchargement des fichiers:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement des fichiers' });
  }
});

export default router;
