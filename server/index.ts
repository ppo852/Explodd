import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import db from './db/database';
import UserPathModel from './db/models/UserPath';
import UserModel from './db/models/User';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import shareRoutes from './routes/share';
import filesRoutes from './routes/files';
import statsRoutes from './routes/stats';
import { authMiddleware } from './utils/auth';
import jwt from 'jsonwebtoken';
import { getPhysicalPath } from './utils/fileUtils';
import fileIndexer from './services/fileIndexer'; // Importer le service d'indexation des fichiers

const JWT_SECRET = 'explodd-secret-key-change-in-production';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/stats', statsRoutes);

// Types
interface FileInfo {
  id: string;
  name: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: number;
  modified: Date;
  path: string;
  isFavorite: boolean;
}

// Utility functions
const generateUniqueId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

const getFileExtension = (filename: string): string | undefined => {
  const ext = path.extname(filename).toLowerCase();
  return ext ? ext.substring(1) : undefined;
};

const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(path);
    return stats.isDirectory();
  } catch (error) {
    console.error(`Error checking if path is directory: ${path}`, error);
    return false;
  }
};

const getFileInfo = async (filePath: string, basePath: string, currentVirtualPath: string): Promise<FileInfo> => {
  try {
    const stats = await fs.stat(filePath);
    const isDir = stats.isDirectory();
    
    // Calculer le chemin relatif par rapport au chemin de base
    let relativePath = path.relative(basePath, filePath).replace(/\\/g, '/');
    
    // Construire le chemin virtuel complet pour ce fichier/dossier
    let fullPath;
    
    // Si nous sommes à la racine d'un dossier spécial ou d'un utilisateur
    if (currentVirtualPath === '/' || currentVirtualPath === '/all') {
      fullPath = '/' + relativePath;
    } else {
      // Si nous sommes dans un sous-dossier, construire le chemin correctement
      // Vérifier si relativePath est vide (nous sommes au niveau du dossier actuel)
      if (relativePath === '') {
        fullPath = currentVirtualPath;
      } else {
        // Nous sommes dans un sous-dossier, ajouter le chemin relatif au chemin virtuel actuel
        // S'assurer qu'il n'y a pas de double slash
        const baseVirtualPath = currentVirtualPath.endsWith('/') ? currentVirtualPath : currentVirtualPath + '/';
        fullPath = baseVirtualPath + relativePath;
      }
    }
    
    // Vérifier si nous avons des métadonnées pour ce fichier/dossier
    const metadataQuery = db.prepare('SELECT * FROM file_metadata WHERE path = ?');
    const metadata = metadataQuery.get(filePath) as { size?: number, last_indexed?: string } | undefined;
    
    let fileSize = !isDir ? stats.size : undefined;
    
    // Si c'est un dossier, essayer d'obtenir sa taille depuis les métadonnées
    if (isDir && metadata && metadata.size !== null && metadata.size !== undefined) {
      fileSize = metadata.size;
    }
    
    // Si nous n'avons pas de métadonnées ou si elles sont obsolètes, les mettre à jour en arrière-plan
    if (!metadata || !metadata.last_indexed || new Date(metadata.last_indexed) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      // Mettre à jour en arrière-plan sans attendre
      import('./services/fileIndexer').then(fileIndexer => {
        fileIndexer.updateFileMetadata(filePath, fullPath).catch(err => {
          console.error(`Erreur lors de la mise à jour des métadonnées pour ${filePath}:`, err);
        });
      }).catch(err => {
        console.error('Erreur lors du chargement du service d\'indexation:', err);
      });
    }
    
    return {
      id: generateUniqueId(),
      name: path.basename(filePath),
      type: isDir ? 'folder' : 'file',
      extension: !isDir ? getFileExtension(filePath) : undefined,
      size: fileSize,
      modified: stats.mtime,
      path: fullPath,
      isFavorite: false,
    };
  } catch (error) {
    console.error(`Error getting file info for: ${filePath}`, error);
    throw error;
  }
};

// Routes
// Route pour récupérer les fichiers avec pagination
app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    // Définir currentUsername ici pour qu'il soit accessible dans tout le bloc
    let currentUsername: string | null = null;
    
    // Récupérer l'utilisateur depuis le token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string };
        currentUsername = decoded.username;
      } catch (tokenError) {
        console.error('Erreur de décodage du token:', tokenError);
      }
    }
    
    const userPath = req.query.path as string || '/';
    
    // Security check - prevent directory traversal attacks
    if (userPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    // Utilisation du dossier du projet comme base pour les chemins virtuels
    const projectDir = path.resolve('.');
    console.log('Dossier du projet:', projectDir);
    
    // Utiliser la fonction getPhysicalPath pour convertir le chemin virtuel en chemin physique
    let realPath: string;
    try {
      // Si c'est un chemin absolu Windows (ex: D:\Videos), l'utiliser directement
      const isWindowsAbsolutePath = /^[A-Z]:\\/.test(userPath);
      if (isWindowsAbsolutePath) {
        realPath = userPath;
      } else if (userPath === '/stats') {
        // Route spéciale pour les statistiques, renvoyer un tableau vide au lieu d'une erreur
        return res.json({
          path: '/stats',
          files: []
        });
      } else if (userPath === '/') {
        // Pour la racine, afficher tous les utilisateurs comme dossiers virtuels
        if (!currentUsername) {
          return res.status(401).json({ error: 'Utilisateur non authentifié' });
        }
        
        // Cas spécial pour l'utilisateur admin
        if (currentUsername === 'admin') {
          // Pour l'admin, afficher tous les utilisateurs comme dossiers virtuels
          try {
            // Utiliser UserModel importé en haut du fichier
            const users = UserModel.getAll();
            
            // Définir l'interface pour le type User
            interface User {
              id?: number;
              username: string;
              [key: string]: any; // Pour les autres propriétés potentielles
            }
            
            // Créer un dossier virtuel pour chaque utilisateur
            const userFolders = users.map((user: User) => {
              return {
                id: generateUniqueId(),
                name: user.username,
                type: 'folder' as 'folder',
                modified: new Date(),
                path: `/${user.username}`,
                isFavorite: false,
                size: 0, // Taille symbolique pour les dossiers
                extension: '' // Pas d'extension pour les dossiers
              };
            });
            
            return res.json({
              path: userPath,
              files: userFolders
            });
          } catch (error) {
            console.error('Erreur lors de la récupération des utilisateurs:', error);
            return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
          }
        } else {
          // Pour les utilisateurs normaux, rediriger vers leur dossier personnel
          try {
            realPath = await getPhysicalPath(currentUsername, '/');
          } catch (error) {
            console.error('Erreur lors de la récupération du chemin personnalisé:', error);
            return res.status(404).json({ error: 'Aucun chemin personnalisé défini pour cet utilisateur' });
          }
        }
      } else {
        // Pour tous les chemins, utiliser getPhysicalPath sans cas spécifique
        realPath = await getPhysicalPath(currentUsername || '', userPath);
        
        // Si le chemin n'existe pas et que c'est un dossier, essayer de le créer
        if (!fs.existsSync(realPath)) {
          const parentDir = path.dirname(realPath);
          const parentExists = await fs.pathExists(parentDir);
          
          if (parentExists) {
            try {
              console.log(`Tentative de création du dossier: ${realPath}`);
              await fs.mkdirp(realPath);
              console.log(`Dossier créé avec succès: ${realPath}`);
            } catch (mkdirError) {
              console.error(`Erreur lors de la création du dossier ${realPath}:`, mkdirError);
            }
          }
        }
      }
      
      console.log('Chemin réel utilisé:', realPath);
    } catch (error) {
      console.error('Erreur lors de la conversion du chemin virtuel en chemin physique:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du chemin' });
    }
    
    // Vérifier si le chemin existe avec plus de détails
    try {
      const pathExists = await fs.pathExists(realPath);
      console.log(`Vérification du chemin ${realPath}: ${pathExists ? 'Existe' : 'N\'existe pas'}`);
      
      if (!pathExists) {
        return res.status(404).json({ error: 'Path not found: ' + realPath });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error(`Erreur lors de la vérification du chemin ${realPath}:`, error);
      return res.status(500).json({ error: `Erreur lors de la vérification du chemin: ${errorMessage}` });
    }
    
    // Vérifier si le chemin est un répertoire
    try {
      const isDir = await isDirectory(realPath);
      if (!isDir) {
        console.log(`Le chemin ${realPath} n'est pas un répertoire`);
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch (dirError) {
      const errorMessage = dirError instanceof Error ? dirError.message : 'Erreur inconnue';
      console.error(`Erreur lors de la vérification si le chemin est un répertoire:`, dirError);
      return res.status(500).json({ error: `Erreur lors de la vérification du répertoire: ${errorMessage}` });
    }
    
    // Pour tous les chemins, lister les fichiers normalement
    console.log(`Lecture du contenu du dossier: ${realPath}`);
    try {
      // Vérifier si le chemin existe
      const pathExists = await fs.pathExists(realPath);
      console.log(`Le chemin ${realPath} existe: ${pathExists}`);
      
      if (!pathExists) {
        console.log(`Création du dossier ${realPath}`);
        await fs.mkdirp(realPath);
      }
      
      // Paramètres de pagination
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100; // Nombre d'éléments par page
      const skip = (page - 1) * limit;
      
      // Paramètres de tri
      const sortBy = req.query.sortBy as string || 'name';
      const sortOrder = req.query.sortOrder as string || 'asc';
      
      // Paramètres de filtrage
      const searchQuery = req.query.search as string || '';
      const fileType = req.query.type as string || 'all';
      
      // Paramètres de filtrage avancé
      const dateRange = req.query.dateRange as string || 'all';
      const sizeRange = req.query.sizeRange as string || 'all';
      const extension = req.query.extension as string || '';
      
      // Read directory contents
      const files = await fs.readdir(realPath);
      console.log(`Contenu du dossier ${realPath}:`, files);
      
      // Obtenir les infos pour tous les fichiers d'abord
      const allFileInfoPromises = files.map(file => {
        // Passer le chemin virtuel actuel à getFileInfo
        const currentVirtualPath = req.query.path as string || '/';
        return getFileInfo(path.join(realPath, file), realPath, currentVirtualPath);
      });
      
      let allFileInfos = await Promise.all(allFileInfoPromises);
      
      // Filtrer par recherche si nécessaire
      if (searchQuery) {
        allFileInfos = allFileInfos.filter(file => 
          file.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Filtrer par type de fichier si nécessaire
      if (fileType !== 'all') {
        allFileInfos = allFileInfos.filter(file => {
          if (fileType === 'folder') return file.type === 'folder';
          if (fileType === 'image') return file.extension && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.extension.toLowerCase());
          if (fileType === 'video') return file.extension && ['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(file.extension.toLowerCase());
          if (fileType === 'audio') return file.extension && ['mp3', 'wav', 'flac', 'ogg'].includes(file.extension.toLowerCase());
          if (fileType === 'document') return file.extension && ['txt', 'doc', 'docx', 'pdf'].includes(file.extension.toLowerCase());
          return true;
        });
      }
      
      console.log(`Le chemin ${realPath} existe: ${pathExists}`);
      
      if (!pathExists) {
        console.log(`Création du dossier ${realPath}`);
        await fs.mkdirp(realPath);
        }
        
        // Continuer avec le traitement normal des fichiers
        
        // Filtrer par recherche si nécessaire
        if (searchQuery) {
          allFileInfos = allFileInfos.filter(file => 
            file.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        
        // Filtrer par type de fichier si nécessaire
        if (fileType !== 'all') {
          allFileInfos = allFileInfos.filter(file => {
            if (fileType === 'folder') return file.type === 'folder';
            if (fileType === 'image') return file.extension && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.extension.toLowerCase());
            if (fileType === 'video') return file.extension && ['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(file.extension.toLowerCase());
            if (fileType === 'audio') return file.extension && ['mp3', 'wav', 'flac', 'ogg'].includes(file.extension.toLowerCase());
            if (fileType === 'document') return file.extension && ['txt', 'doc', 'docx', 'pdf'].includes(file.extension.toLowerCase());
            return true;
          });
        }
        
        // Filtrer par extension si spécifié
        if (extension) {
          allFileInfos = allFileInfos.filter(file => 
            file.extension && file.extension.toLowerCase() === extension.toLowerCase()
          );
        }
        
        // Filtrer par date
        if (dateRange !== 'all') {
          const now = new Date();
          let dateLimit: Date;
          
          switch (dateRange) {
            case 'today':
              dateLimit = new Date(now.setHours(0, 0, 0, 0));
              break;
            case 'week':
              dateLimit = new Date(now.setDate(now.getDate() - 7));
              break;
            case 'month':
              dateLimit = new Date(now.setMonth(now.getMonth() - 1));
              break;
            case 'year':
              dateLimit = new Date(now.setFullYear(now.getFullYear() - 1));
              break;
            default:
              dateLimit = new Date(0); // 1970-01-01
          }
          
          allFileInfos = allFileInfos.filter(file => 
            file.modified && new Date(file.modified) >= dateLimit
          );
        }
        
        // Filtrer par taille
        if (sizeRange !== 'all') {
          allFileInfos = allFileInfos.filter(file => {
            // Ignorer les dossiers pour le filtrage par taille
            if (file.type === 'folder' || file.size === undefined) return false;
            
            const size = file.size;
            
            switch (sizeRange) {
              case 'tiny':
                return size < 10 * 1024; // < 10 KB
              case 'small':
                return size >= 10 * 1024 && size < 1024 * 1024; // 10 KB - 1 MB
              case 'medium':
                return size >= 1024 * 1024 && size < 10 * 1024 * 1024; // 1 MB - 10 MB
              case 'large':
                return size >= 10 * 1024 * 1024 && size < 100 * 1024 * 1024; // 10 MB - 100 MB
              case 'xlarge':
                return size >= 100 * 1024 * 1024; // > 100 MB
              default:
                return true;
            }
          });
        }
        
        // Calculer le nombre total de fichiers pour la pagination après filtrage
        const totalFiles = allFileInfos.length;
        
        // Paginer les résultats après filtrage
        const filteredFileInfos = allFileInfos.slice(skip, skip + limit);
        
        console.log(`Traitement terminé. ${filteredFileInfos.length} fichiers/dossiers après filtrage (sur ${totalFiles} au total)`);
        
        // Trier les résultats
        filteredFileInfos.sort((a, b) => {
          // Toujours mettre les dossiers en premier
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          
          // Ensuite trier selon le critère sélectionné
          if (sortBy === 'name') {
            return sortOrder === 'asc' 
              ? a.name.localeCompare(b.name) 
              : b.name.localeCompare(a.name);
          } else if (sortBy === 'modified') {
            return sortOrder === 'asc' 
              ? a.modified.getTime() - b.modified.getTime() 
              : b.modified.getTime() - a.modified.getTime();
          } else if (sortBy === 'size' && a.size !== undefined && b.size !== undefined) {
            return sortOrder === 'asc' 
              ? a.size - b.size 
              : b.size - a.size;
          }
          return 0;
        });
        
        console.log(`Nombre de fichiers/dossiers trouvés: ${filteredFileInfos.length} (sur ${totalFiles} au total)`);
        
        // Renvoyer les résultats avec les métadonnées de pagination
        res.json({
          files: filteredFileInfos,
          pagination: {
            total: totalFiles,
            page,
            limit,
            totalPages: Math.ceil(totalFiles / limit)
          }
        });
      } catch (error) {
        console.error(`Erreur lors de la lecture du dossier ${realPath}:`, error);
        res.status(500).json({ error: `Erreur lors de la lecture du dossier: ${error instanceof Error ? error.message : 'Erreur inconnue'}` });
      }
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  }
);

// API pour récupérer les chemins personnalisés (protégée par authentification)
app.get('/api/users/paths', authMiddleware, (req, res) => {
  try {
    // Récupérer tous les chemins personnalisés
    const userPaths = UserPathModel.getAll();
    
    // Transformer en format attendu par le frontend
    const pathsMap: Record<string, string> = {};
    
    // Obtenir les utilisateurs associés aux chemins
    const users = db.prepare('SELECT id, username FROM users').all() as { id: number, username: string }[];
    const userIdToUsername: Record<number, string> = {};
    
    users.forEach(user => {
      userIdToUsername[user.id] = user.username;
    });
    
    userPaths.forEach(path => {
      const username = userIdToUsername[path.user_id];
      if (username) {
        pathsMap[username] = path.real_path;
      }
    });
    
    res.json(pathsMap);
  } catch (error) {
    console.error('Error getting user paths:', error);
    res.status(500).json({ error: 'Failed to get user paths' });
  }
});

// API pour définir un chemin personnalisé (protégée par authentification)
app.post('/api/users/:username/path', authMiddleware, express.json(), async (req, res) => {
  try {
    const { username } = req.params;
    const { customPath } = req.body;
    
    console.log(`Définition du chemin personnalisé pour ${username}: ${customPath}`);
    
    if (!username || !customPath) {
      console.log('Erreur: Username ou customPath manquant');
      return res.status(400).json({ error: 'Username and customPath are required' });
    }
    
    // Vérifier si l'utilisateur existe
    const user = await db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
    if (!user) {
      console.log(`Erreur: Utilisateur ${username} non trouvé`);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`Utilisateur trouvé: ${JSON.stringify(user)}`);
    
    // Créer le dossier personnalisé s'il n'existe pas
    if (!fs.existsSync(customPath)) {
      try {
        fs.mkdirSync(customPath, { recursive: true });
        console.log(`Dossier personnalisé créé: ${customPath}`);
      } catch (error) {
        console.error(`Erreur lors de la création du dossier personnalisé: ${customPath}`, error);
        return res.status(500).json({ error: 'Failed to create custom path directory' });
      }
    } else {
      console.log(`Le dossier ${customPath} existe déjà`);
    }
    
    // Vérifier si un chemin existe déjà pour cet utilisateur
    const existingPath = await db.prepare(`
      SELECT * FROM user_paths 
      WHERE user_id = ? AND virtual_path = ?
    `).get(user.id, `/${username}`) as { id: number, virtual_path: string, real_path: string } | undefined;
    
    console.log(`Chemin existant: ${JSON.stringify(existingPath)}`);
    
    // Sauvegarder le chemin personnalisé dans la base de données
    // Utiliser le chemin virtuel /${username}
    const virtualPath = `/${username}`;
    const success = UserPathModel.setPath(username, virtualPath, customPath);
    
    if (success) {
      console.log(`Chemin personnalisé pour ${username} défini à ${customPath}`);
      
      // Vérifier que le chemin a bien été enregistré
      const verifyPath = await db.prepare(`
        SELECT * FROM user_paths 
        WHERE user_id = ? AND virtual_path = ?
      `).get(user.id, virtualPath) as { id: number, virtual_path: string, real_path: string } | undefined;
      
      console.log(`Vérification du chemin enregistré: ${JSON.stringify(verifyPath)}`);
      
      if (verifyPath && verifyPath.real_path === customPath) {
        console.log('Chemin correctement enregistré dans la base de données');
      } else {
        console.log('ATTENTION: Le chemin ne semble pas avoir été correctement enregistré');
      }
      
      res.json({ success: true, username, customPath, virtualPath });
    } else {
      console.log('Erreur lors de la définition du chemin personnalisé');
      res.status(500).json({ error: 'Failed to set custom path' });
    }
  } catch (error) {
    console.error('Error setting custom path:', error);
    res.status(500).json({ error: 'Failed to set custom path' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Démarrer l'indexation des fichiers (toutes les 30 minutes)
  fileIndexer.scheduleIndexing(30 * 60 * 1000);
});
