import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import UserPathModel from '../db/models/UserPath';

export interface FileInfo {
  id: string;
  name: string;
  type: 'folder' | 'file';
  extension: string;
  size: number;
  modified: Date;
  path: string;
  isFavorite: boolean;
}

/**
 * Convertit un chemin virtuel en chemin physique et crée les dossiers manquants si nécessaire
 */
export const getPhysicalPath = async (username: string, virtualPath: string, basePath: string = ''): Promise<string> => {
  try {
    console.log(`getPhysicalPath - username: ${username}, virtualPath: ${virtualPath}`);
    
    // Exception spéciale pour l'utilisateur admin initial - il n'a pas besoin de chemin personnalisé
    // Ceci ne s'applique qu'à l'utilisateur 'admin' créé au premier démarrage
    if (username === 'admin' && username.toLowerCase() === 'admin') {
      console.log('Utilisateur admin initial détecté, utilisation du chemin spécial admin');
      // Créer un chemin spécial pour admin dans le dossier du projet
      const adminPath = path.join(process.cwd(), 'admin_dashboard');
      
      // S'assurer que le dossier existe
      await fs.ensureDir(adminPath);
      
      // Si c'est le chemin racine, retourner directement le dossier admin
      if (virtualPath === '/' || virtualPath === '/all') {
        return adminPath;
      }
      
      // Cas spécial: si on accède au dossier d'un autre utilisateur (format: /username)
      const userPathMatch = virtualPath.match(/^\/([^\/]+)(?:\/(.*))?$/);
      if (userPathMatch) {
        const targetUsername = userPathMatch[1];
        // Ne pas créer de dossier utilisateur dans admin_dashboard si ce n'est pas admin lui-même
        if (targetUsername !== 'admin') {
          // Récupérer le chemin personnalisé de cet utilisateur directement
          const targetUserPath = UserPathModel.getRealPath(targetUsername, `/${targetUsername}`);
          if (targetUserPath) {
            const subPath = userPathMatch[2] || '';
            return subPath ? path.join(targetUserPath, subPath) : targetUserPath;
          }
        }
      }
      
      // Pour les autres cas concernant admin, combiner avec le chemin virtuel
      return path.join(adminPath, virtualPath.replace(/^\//, ''));
    }
    
    // Vérifier si le chemin est déjà un chemin physique absolu Windows (commence par X:\)
    const isWindowsAbsolutePath = /^[a-zA-Z]:\\/.test(virtualPath) || /^[a-zA-Z]:\//.test(virtualPath);
    
    if (isWindowsAbsolutePath) {
      // Normaliser le chemin pour gérer les chemins mixtes (backslashes et forward slashes)
      const normalizedPath = virtualPath.replace(/\//g, path.sep).replace(/\\/g, path.sep);
      console.log(`Chemin absolu Windows détecté, pas besoin de conversion: ${normalizedPath}`);
      return normalizedPath;
    }
    
    // Récupérer le chemin réel depuis UserPathModel
    // D'abord, essayer de récupérer le chemin de base de l'utilisateur
    const userBasePath = UserPathModel.getRealPath(username, `/${username}`);
    
    if (!userBasePath) {
      console.error(`Aucun chemin personnalisé trouvé pour l'utilisateur ${username}`);
      throw new Error(`Aucun chemin personnalisé trouvé pour l'utilisateur ${username}`);
    }
    
    console.log(`Chemin de base pour l'utilisateur ${username}: ${userBasePath}`);
    
    // Déterminer le chemin physique final à partir des conditions
    let finalPath: string = '';
    
    // Cas spécial pour les routes d'API comme /stats
    if (virtualPath === '/stats') {
      console.log('Route spéciale /stats détectée, pas besoin de conversion physique');
      throw new Error('Route spéciale qui ne nécessite pas de conversion physique');
    }
    
    // Cas spécial: si on accède au dossier d'un autre utilisateur (format: /username)
    const userPathMatch = virtualPath.match(/^\/([^\/]+)(?:\/(.*))?$/);
    
    if (userPathMatch) {
      const targetUsername = userPathMatch[1];
      const subPath = userPathMatch[2] || '';
      
      // Si on accède au dossier d'un autre utilisateur
      if (targetUsername !== username) {
        console.log(`Accès au dossier: ${targetUsername}, sous-chemin: ${subPath}`);
        
        // Vérifier d'abord si c'est un utilisateur existant
        const targetUserPath = UserPathModel.getRealPath(targetUsername, `/${targetUsername}`);
        
        if (targetUserPath) {
          // C'est un utilisateur avec un chemin personnalisé
          // Construire le chemin complet
          finalPath = subPath ? path.join(targetUserPath, subPath) : targetUserPath;
          console.log(`Chemin physique pour l'utilisateur ${targetUsername}: ${finalPath}`);
          return finalPath;
        } else if (username === 'admin') {
          // Si c'est l'admin qui essaie d'accéder à un dossier qui n'est pas un utilisateur
          // Considérer que c'est un sous-dossier dans le répertoire de l'admin
          console.log(`Admin accède au dossier non-utilisateur: ${targetUsername}`);
          const adminPath = userBasePath;
          finalPath = path.join(adminPath, targetUsername, subPath);
          console.log(`Chemin physique pour le dossier non-utilisateur: ${finalPath}`);
          
          // Vérifier si le dossier existe, sinon le créer
          await fs.ensureDir(finalPath);
          
          return finalPath;
        } else {
          // Pour les utilisateurs normaux, ne pas autoriser l'accès aux dossiers qui ne sont pas des utilisateurs
          console.error(`Accès non autorisé au dossier ${targetUsername} pour l'utilisateur ${username}`);
          throw new Error(`Accès non autorisé au dossier ${targetUsername}`);
        }
      }
    }
    
    // Traitement normal pour l'utilisateur courant
    if (virtualPath === `/${username}` || virtualPath === '/') {
      finalPath = userBasePath;
    } else if (virtualPath.startsWith(`/${username}/`)) {
      // Extraire la partie relative du chemin virtuel
      const relativePath = virtualPath.substring(`/${username}/`.length);
      finalPath = path.join(userBasePath, relativePath);
    // Ancien format /home/username supprimé - nous utilisons maintenant uniquement le format /username
    } else {
      // Pour d'autres chemins virtuels, essayer de les résoudre normalement
      const resolvedPath = UserPathModel.getRealPath(username, virtualPath);
      
      if (!resolvedPath) {
        console.error(`Aucun chemin personnalisé trouvé pour l'utilisateur ${username} et le chemin ${virtualPath}`);
        throw new Error(`Chemin non trouvé: ${virtualPath}`);
      }
      
      finalPath = resolvedPath;
    }
    
    console.log(`Chemin réel trouvé: ${finalPath}`);
    
    // Vérifier si le dossier existe, sinon le créer
    if (virtualPath.endsWith('/') || !path.extname(virtualPath)) {
      await fs.ensureDir(finalPath);
      console.log(`Dossier créé si nécessaire: ${finalPath}`);
    } else {
      // Si c'est un fichier, s'assurer que son dossier parent existe
      const parentDir = path.dirname(finalPath);
      await fs.ensureDir(parentDir);
      console.log(`Dossier parent créé si nécessaire: ${parentDir}`);
    }
    
    return finalPath;
  } catch (error) {
    console.error(`Erreur lors de la conversion du chemin virtuel en chemin physique: ${virtualPath}`, error);
    throw error;
  }
};

export const getFileInfo = async (filePath: string, basePath: string, currentVirtualPath: string): Promise<FileInfo> => {
  try {
    const stats = await fs.stat(filePath);
    const isDir = stats.isDirectory();
    let relativePath = path.relative(basePath, filePath).replace(/\\/g, '/');
    let fullPath;
    if (currentVirtualPath === '/' || currentVirtualPath === '/all') {
      fullPath = '/' + relativePath;
    } else {
      if (relativePath === '') {
        fullPath = currentVirtualPath;
      } else {
        const baseVirtualPath = currentVirtualPath.endsWith('/') ? currentVirtualPath : currentVirtualPath + '/';
        fullPath = baseVirtualPath + relativePath;
      }
    }
    return {
      id: uuidv4(),
      name: path.basename(filePath),
      type: isDir ? 'folder' : 'file',
      extension: !isDir ? path.extname(filePath).slice(1).toLowerCase() : '',
      size: isDir ? 0 : stats.size,
      modified: stats.mtime,
      path: fullPath,
      isFavorite: false // À implémenter plus tard
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération des informations du fichier ${filePath}:`, error);
    throw error;
  }
};

/**
 * Détermine le type de fichier en fonction de son extension
 */
export const getFileType = (extension: string): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'file' => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const videoExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
  const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'md'];
  const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz'];

  if (imageExtensions.includes(extension)) return 'image';
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (documentExtensions.includes(extension)) return 'document';
  if (archiveExtensions.includes(extension)) return 'archive';
  return 'file';
};
