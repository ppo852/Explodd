import db from '../database';
import { UserPath } from './User';

class UserPathModel {
  /**
   * Récupère tous les chemins personnalisés
   */
  getAll(): UserPath[] {
    return db.prepare('SELECT * FROM user_paths').all() as UserPath[];
  }

  /**
   * Récupère tous les chemins personnalisés d'un utilisateur
   */
  getByUserId(userId: number): UserPath[] {
    return db.prepare('SELECT * FROM user_paths WHERE user_id = ?').all(userId) as UserPath[];
  }

  /**
   * Récupère un chemin personnalisé par son ID
   */
  getById(id: number): UserPath | undefined {
    return db.prepare('SELECT * FROM user_paths WHERE id = ?').get(id) as UserPath | undefined;
  }

  /**
   * Récupère un chemin personnalisé par le nom d'utilisateur et le chemin virtuel
   */
  getByUsernameAndVirtualPath(username: string, virtualPath: string): UserPath | undefined {
    return db.prepare(`
      SELECT up.* 
      FROM user_paths up
      JOIN users u ON up.user_id = u.id
      WHERE u.username = ? AND up.virtual_path = ?
    `).get(username, virtualPath) as UserPath | undefined;
  }

  /**
   * Crée ou met à jour un chemin personnalisé
   */
  setPath(username: string, virtualPath: string, realPath: string): boolean {
    // Récupérer l'ID de l'utilisateur
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
    
    if (!user) {
      return false;
    }
    
    // Vérifier si le chemin existe déjà
    const existingPath = this.getByUsernameAndVirtualPath(username, virtualPath);
    
    if (existingPath) {
      // Mettre à jour le chemin existant
      const result = db.prepare(`
        UPDATE user_paths 
        SET real_path = ? 
        WHERE id = ?
      `).run(realPath, existingPath.id || 0);
      
      return result.changes > 0;
    } else {
      // Créer un nouveau chemin
      const result = db.prepare(`
        INSERT INTO user_paths (user_id, virtual_path, real_path)
        VALUES (?, ?, ?)
      `).run(user.id, virtualPath, realPath);
      
      return result.lastInsertRowid !== null;
    }
  }

  /**
   * Supprime un chemin personnalisé
   */
  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM user_paths WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Récupère le chemin réel correspondant à un chemin virtuel pour un utilisateur par ID ou nom d'utilisateur
   */
  getRealPathById(userIdOrName: number | string | undefined, virtualPath: string): UserPath | null {
    if (!userIdOrName) return null;
    
    // console.log supprimé pour production (`Recherche du chemin pour userIdOrName=${userIdOrName}, virtualPath=${virtualPath}`);
    
    let userId: number;
    
    // Si c'est une chaîne, vérifier si c'est un ID numérique ou un nom d'utilisateur
    if (typeof userIdOrName === 'string') {
      // Essayer de convertir en nombre
      const numericId = parseInt(userIdOrName, 10);
      
      // Si c'est un nombre valide, l'utiliser comme ID
      if (!isNaN(numericId)) {
        userId = numericId;
      } else {
        // Sinon, rechercher l'ID de l'utilisateur par son nom
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(userIdOrName) as { id: number } | undefined;
        
        if (!user) {
          // console.log supprimé pour production (`Aucun utilisateur trouvé pour le nom: ${userIdOrName}`);
          return null;
        }
        
        userId = user.id;
      }
    } else {
      userId = userIdOrName;
    }
    
    // console.log supprimé pour production (`ID utilisateur résolu: ${userId}`);
    
    // Essayer d'abord de trouver le chemin exact
    const userPath = db.prepare(`
      SELECT * FROM user_paths 
      WHERE user_id = ? AND virtual_path = ?
    `).get(userId, virtualPath) as UserPath | undefined;
    
    if (userPath) {
      // console.log supprimé pour production (`Chemin exact trouvé: ${JSON.stringify(userPath)}`);
      return userPath;
    }
    
    // Vérifier si le chemin virtuel commence par /home/username
    const userQuery = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
    
    if (userQuery) {
      const username = userQuery.username;
      const homePath = `/${username}`;
      
      // console.log supprimé pour production (`Vérification du chemin home: ${homePath}`);
      
      if (virtualPath.startsWith(homePath)) {
        const homeUserPath = db.prepare(`
          SELECT * FROM user_paths 
          WHERE user_id = ? AND virtual_path = ?
        `).get(userId, homePath) as UserPath | undefined;
        
        if (homeUserPath) {
          // console.log supprimé pour production (`Chemin home trouvé: ${JSON.stringify(homeUserPath)}`);
          return homeUserPath;
        }
      }
    }
    
    // Essayer de trouver un chemin personnalisé qui pourrait être un préfixe du chemin virtuel
    const userPaths = this.getByUserId(userId);
    
    // console.log supprimé pour production (`Chemins disponibles pour l'utilisateur ${userId}: ${JSON.stringify(userPaths)}`);
    
    // Trier les chemins par longueur décroissante pour trouver le plus spécifique d'abord
    userPaths.sort((a, b) => b.virtual_path.length - a.virtual_path.length);
    
    for (const path of userPaths) {
      if (virtualPath.startsWith(path.virtual_path)) {
        // console.log supprimé pour production (`Chemin préfixe trouvé: ${JSON.stringify(path)}`);
        return path;
      }
    }
    
    // console.log supprimé pour production (`Aucun chemin trouvé pour ${virtualPath}`);
    return null;
  }

  /**
   * Récupère le chemin réel correspondant à un chemin virtuel pour un utilisateur
   */
  getRealPath(username: string, virtualPath: string): string | null {
    // console.log supprimé pour production (`getRealPath - username: ${username}, virtualPath: ${virtualPath}`);
    // Récupérer l'ID de l'utilisateur
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
    
    if (!user) {
      // console.log supprimé pour production (`Aucun utilisateur trouvé pour le nom: ${username}`);
      return null;
    }
    
    // Essayer d'abord de trouver le chemin exact
    const exactPath = this.getByUsernameAndVirtualPath(username, virtualPath);
    
    if (exactPath) {
      // console.log supprimé pour production (`Chemin exact trouvé: ${exactPath.real_path}`);
      return exactPath.real_path;
    }
    
    // Si pas de chemin exact, essayer de trouver un chemin pour le dossier de l'utilisateur
    const userBasePath = `/${username}`;
    
    // Vérifier si le chemin virtuel commence par le chemin de l'utilisateur
    if (virtualPath.startsWith(userBasePath)) {
      const userBasePathEntry = db.prepare(`
        SELECT up.* 
        FROM user_paths up
        JOIN users u ON up.user_id = u.id
        WHERE u.username = ? AND up.virtual_path = ?
      `).get(username, userBasePath) as UserPath | undefined;
      
      if (userBasePathEntry) {
        // Ajouter le reste du chemin virtuel au chemin réel du dossier de l'utilisateur
        const relativePath = virtualPath.substring(userBasePath.length);
        const fullPath = userBasePathEntry.real_path + relativePath;
        // console.log supprimé pour production (`Chemin complet construit: ${fullPath}`);
        return fullPath;
      }
    }
    
    // Nous n'utilisons plus l'ancien format /home/username
    // Format standard: /{username}
    
    // Essayer de trouver un chemin personnalisé qui pourrait être un préfixe du chemin virtuel
    const userPaths = this.getByUserId(user.id);
    
    // Trier les chemins par longueur décroissante pour trouver le plus spécifique d'abord
    userPaths.sort((a, b) => b.virtual_path.length - a.virtual_path.length);
    
    for (const path of userPaths) {
      if (virtualPath.startsWith(path.virtual_path)) {
        const relativePath = virtualPath.substring(path.virtual_path.length);
        const fullPath = path.real_path + relativePath;
        // console.log supprimé pour production (`Chemin trouvé par préfixe: ${fullPath}`);
        return fullPath;
      }
    }
    
    // console.log supprimé pour production (`Aucun chemin personnalisé trouvé pour ${username} et ${virtualPath}`);
    return null;
  }
}

export default new UserPathModel();
