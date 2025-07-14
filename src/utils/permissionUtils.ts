import { User } from '../types';

/**
 * Liste des permissions disponibles dans l'application
 */
export const PERMISSIONS = {
  READ: 'read',      // Permission de lecture (obligatoire)
  WRITE: 'write',    // Permission d'écriture (création de fichiers/dossiers)
  SHARE: 'share',    // Permission de partage
  RENAME: 'rename',  // Permission de renommage
  DELETE: 'delete',  // Permission de suppression
  MOVE: 'move',      // Permission de déplacement
};

/**
 * Vérifie si un utilisateur possède une permission spécifique
 * @param user L'utilisateur à vérifier
 * @param permission La permission à vérifier
 * @returns true si l'utilisateur a la permission, false sinon
 */
export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user) return false;
  
  // Les administrateurs ont toutes les permissions
  if (user.role === 'admin') return true;
  
  // La permission de lecture est obligatoire et toujours présente
  if (permission === PERMISSIONS.READ) return true;
  
  // Vérifier si la permission est dans le tableau des permissions de l'utilisateur
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
};

/**
 * Vérifie si un utilisateur possède plusieurs permissions
 * @param user L'utilisateur à vérifier
 * @param permissions Les permissions à vérifier
 * @returns true si l'utilisateur a toutes les permissions, false sinon
 */
export const hasPermissions = (user: User | null, permissions: string[]): boolean => {
  if (!user) return false;
  
  // Les administrateurs ont toutes les permissions
  if (user.role === 'admin') return true;
  
  // Vérifier chaque permission
  return permissions.every(permission => hasPermission(user, permission));
};
