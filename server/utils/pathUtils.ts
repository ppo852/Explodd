import fs from 'fs-extra';
import path from 'path';
import UserPathModel from '../db/models/UserPath';

/**
 * Convertit un chemin virtuel en chemin physique
 * @param virtualPath Chemin virtuel à convertir
 * @param userId ID de l'utilisateur (optionnel)
 * @returns Chemin physique correspondant
 */
export const getPhysicalPath = async (virtualPath: string, userId?: string): Promise<string> => {
  try {
    console.log(`getPhysicalPath - virtualPath: ${virtualPath}, userId: ${userId}`);
    
    // Si le chemin est déjà un chemin absolu Windows (commence par une lettre de lecteur)
    if (/^[A-Za-z]:/.test(virtualPath)) {
      console.log(`Chemin absolu Windows détecté: ${virtualPath}`);
      return virtualPath;
    }

    // Normaliser le chemin virtuel
    const normalizedPath = virtualPath.replace(/\\/g, '/');
    console.log(`Chemin normalisé: ${normalizedPath}`);
    
    // Cas spécial pour la racine
    if (normalizedPath === '/' || normalizedPath === '') {
      const rootPath = process.env.ROOT_PATH || path.join(__dirname, '..', '..', 'uploads');
      console.log(`Chemin racine utilisé: ${rootPath}`);
      return rootPath;
    }

    // Rechercher un chemin personnalisé correspondant
    console.log(`Recherche d'un chemin personnalisé pour userId=${userId}, path=${normalizedPath}`);
    const userPath = UserPathModel.getRealPathById(userId, normalizedPath);
    
    if (userPath) {
      console.log(`Chemin personnalisé trouvé: ${JSON.stringify(userPath)}`);
      
      // Construire le chemin physique complet
      let realPath: string = userPath.real_path;
      console.log(`Chemin réel de base: ${realPath}`);
      
      // Si le chemin virtuel est plus long que le chemin virtuel de base,
      // ajouter la partie restante au chemin physique
      if (normalizedPath.length > userPath.virtual_path.length) {
        const relativePath = normalizedPath.substring(userPath.virtual_path.length);
        realPath = path.join(realPath, relativePath);
        console.log(`Chemin relatif ajouté: ${relativePath}, nouveau chemin réel: ${realPath}`);
      }
      
      // Créer le dossier s'il n'existe pas
      await fs.ensureDir(path.dirname(realPath));
      console.log(`Dossier assuré: ${path.dirname(realPath)}`);
      
      return realPath;
    } else {
      console.log(`Aucun chemin personnalisé trouvé pour ${normalizedPath}`);
    }

    // Si aucun chemin personnalisé n'est trouvé, utiliser le chemin par défaut
    const defaultPath = path.join(process.env.ROOT_PATH || path.join(__dirname, '..', '..', 'uploads'), normalizedPath);
    
    // Créer le dossier s'il n'existe pas
    await fs.ensureDir(path.dirname(defaultPath));
    
    return defaultPath;
  } catch (error) {
    console.error(`Erreur lors de la conversion du chemin virtuel ${virtualPath}:`, error);
    throw error;
  }
};

/**
 * Convertit un chemin physique en chemin virtuel
 * @param physicalPath Chemin physique à convertir
 * @returns Chemin virtuel correspondant
 */
export const getVirtualPath = (physicalPath: string): string => {
  try {
    // Normaliser le chemin physique
    const normalizedPath = physicalPath.replace(/\\/g, '/');
    
    // Rechercher un chemin personnalisé correspondant
    const userPaths = UserPathModel.getAll();
    
    for (const userPath of userPaths) {
      if (normalizedPath.startsWith(userPath.real_path)) {
        // Construire le chemin virtuel
        const relativePath = normalizedPath.substring(userPath.real_path.length);
        return path.posix.join(userPath.virtual_path, relativePath);
      }
    }
    
    // Si aucun chemin personnalisé n'est trouvé, utiliser le chemin par défaut
    const rootPath = process.env.ROOT_PATH || path.join(__dirname, '..', '..', 'uploads');
    if (normalizedPath.startsWith(rootPath)) {
      return '/' + normalizedPath.substring(rootPath.length);
    }
    
    return normalizedPath;
  } catch (error) {
    console.error(`Erreur lors de la conversion du chemin physique ${physicalPath}:`, error);
    return physicalPath;
  }
};

export default {
  getPhysicalPath,
  getVirtualPath
};
