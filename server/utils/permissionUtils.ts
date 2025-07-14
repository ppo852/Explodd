import { User } from '../db/models/User';

/**
 * Vérifie si un utilisateur possède une permission spécifique
 * @param user L'utilisateur à vérifier
 * @param permission La permission requise (ex: 'read', 'write', 'delete', etc.)
 * @returns true si l'utilisateur a la permission, false sinon
 */
export function hasPermission(user: User | undefined | null, permission: string): boolean {
  // Si l'utilisateur n'existe pas, il n'a aucune permission
  if (!user) return false;
  
  // Les administrateurs ont toutes les permissions
  if (user.role === 'admin') return true;
  
  // Vérifier si la permission spécifique est dans le tableau des permissions de l'utilisateur
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

/**
 * Liste des permissions disponibles dans l'application
 */
export const AVAILABLE_PERMISSIONS = [
  'read',    // Lecture des fichiers et dossiers
  'write',   // Création/modification de fichiers et dossiers
  'share',   // Partage de fichiers
  'rename',  // Renommage de fichiers et dossiers
  'delete',  // Suppression de fichiers et dossiers
  'move'     // Déplacement de fichiers et dossiers
];
