import fs from 'fs-extra';
import path from 'path';
import db from '../db/database';
import { getPhysicalPath } from '../utils/pathUtils';
import UserPathModel from '../db/models/UserPath';

/**
 * Indexe un fichier ou dossier et met à jour ses métadonnées dans la base de données
 * @param filePath Chemin physique du fichier ou dossier
 * @param virtualPath Chemin virtuel correspondant
 * @param parentPath Chemin parent (pour les sous-dossiers)
 */
export async function indexFileOrDirectory(filePath: string, virtualPath: string, parentPath: string | null = null): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    const isDir = stats.isDirectory();
    const fileName = path.basename(filePath);
    let totalSize = 0;

    // Si c'est un fichier, sa taille est directement disponible
    if (!isDir) {
      totalSize = stats.size;
    } else {
      // Pour un dossier, on doit calculer la taille récursivement
      try {
        const items = await fs.readdir(filePath);
        
        for (const item of items) {
          const itemPath = path.join(filePath, item);
          const itemVirtualPath = path.posix.join(virtualPath, item);
          
          // Appel récursif pour chaque élément du dossier
          const itemSize = await indexFileOrDirectory(itemPath, itemVirtualPath, virtualPath);
          totalSize += itemSize;
        }
      } catch (error) {
        console.error(`Erreur lors de l'indexation du dossier ${filePath}:`, error);
      }
    }

    // Mettre à jour ou insérer les métadonnées dans la base de données
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO file_metadata 
      (path, name, is_directory, size, last_modified, last_indexed, parent_path, virtual_path)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `);
    
    stmt.run(
      filePath,
      fileName,
      isDir ? 1 : 0,
      totalSize,
      stats.mtime.toISOString(),
      parentPath,
      virtualPath
    );

    return totalSize;
  } catch (error) {
    console.error(`Erreur lors de l'indexation de ${filePath}:`, error);
    return 0;
  }
}

/**
 * Indexe tous les chemins racine configurés dans l'application
 */
export async function indexAllRootPaths(): Promise<void> {
  try {
    console.log('Démarrage de l\'indexation des fichiers...');
    
    // Récupérer tous les chemins personnalisés
    const userPaths = UserPathModel.getAll();
    
    for (const userPath of userPaths) {
      console.log(`Indexation du chemin: ${userPath.real_path} (virtuel: ${userPath.virtual_path})`);
      await indexFileOrDirectory(userPath.real_path, userPath.virtual_path);
    }
    
    console.log('Indexation terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'indexation des chemins:', error);
  }
}

/**
 * Planifie l'indexation périodique des fichiers
 * @param intervalMs Intervalle en millisecondes entre chaque indexation
 */
export function scheduleIndexing(intervalMs: number = 3600000): NodeJS.Timeout {
  console.log(`Planification de l'indexation des fichiers toutes les ${intervalMs / 60000} minutes`);
  
  // Exécuter une première indexation immédiatement
  indexAllRootPaths();
  
  // Puis planifier les indexations suivantes
  return setInterval(() => {
    indexAllRootPaths();
  }, intervalMs);
}

/**
 * Met à jour les métadonnées d'un fichier ou dossier spécifique
 * @param filePath Chemin physique du fichier ou dossier
 * @param virtualPath Chemin virtuel correspondant
 */
export async function updateFileMetadata(filePath: string, virtualPath: string): Promise<void> {
  try {
    const parentDir = path.dirname(filePath);
    const parentVirtualPath = path.dirname(virtualPath);
    
    await indexFileOrDirectory(filePath, virtualPath, parentVirtualPath === '/' ? null : parentVirtualPath);
    
    // Mettre à jour récursivement les tailles des dossiers parents
    await updateParentDirectorySizes(parentDir, parentVirtualPath);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour des métadonnées pour ${filePath}:`, error);
  }
}

/**
 * Met à jour récursivement les tailles des dossiers parents
 * @param dirPath Chemin physique du dossier
 * @param virtualPath Chemin virtuel correspondant
 */
async function updateParentDirectorySizes(dirPath: string, virtualPath: string): Promise<void> {
  if (!dirPath || dirPath === '/' || dirPath === '.' || dirPath === '..') {
    return;
  }
  
  try {
    // Calculer la nouvelle taille totale du dossier
    let totalSize = 0;
    const query = db.prepare('SELECT SUM(size) as total FROM file_metadata WHERE parent_path = ?');
    const result = query.get(virtualPath) as { total?: number } | undefined;
    
    if (result && result.total !== undefined) {
      totalSize = result.total;
    }
    
    // Mettre à jour la taille du dossier
    const updateStmt = db.prepare('UPDATE file_metadata SET size = ?, last_indexed = CURRENT_TIMESTAMP WHERE path = ?');
    updateStmt.run(totalSize, dirPath);
    
    // Continuer avec le dossier parent
    const parentDir = path.dirname(dirPath);
    const parentVirtualPath = path.dirname(virtualPath);
    
    if (parentDir !== dirPath) {
      await updateParentDirectorySizes(parentDir, parentVirtualPath);
    }
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la taille du dossier ${dirPath}:`, error);
  }
}

/**
 * Supprime les métadonnées d'un fichier ou dossier
 * @param filePath Chemin physique du fichier ou dossier
 */
export function deleteFileMetadata(filePath: string): void {
  try {
    // Supprimer l'entrée et toutes ses sous-entrées (pour les dossiers)
    const stmt = db.prepare('DELETE FROM file_metadata WHERE path = ? OR path LIKE ?');
    stmt.run(filePath, `${filePath}/%`);
    
    // Mettre à jour les tailles des dossiers parents
    const parentDir = path.dirname(filePath);
    updateParentDirectorySizes(parentDir, path.dirname(filePath));
  } catch (error) {
    console.error(`Erreur lors de la suppression des métadonnées pour ${filePath}:`, error);
  }
}

export default {
  indexFileOrDirectory,
  indexAllRootPaths,
  scheduleIndexing,
  updateFileMetadata,
  deleteFileMetadata
};
