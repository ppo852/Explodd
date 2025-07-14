// src/utils/auth.ts

/**
 * Récupère le token JWT depuis localStorage (clé 'authData').
 * Retourne null si absent ou invalide.
 */
export const getAuthToken = (): string | null => {
  const authData = localStorage.getItem('authData');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.token || null;
    } catch (e) {
      console.error('Erreur lors de la récupération du token:', e);
      return null;
    }
  }
  return null;
};
