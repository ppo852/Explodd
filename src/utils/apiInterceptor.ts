import { getAuthToken } from './auth';

// URL de l'API
// Utiliser un chemin relatif pour que ça fonctionne à la fois en développement et en production
const API_URL = '';  // Vide car les URLs dans l'application incluent déjà le préfixe /api

/**
 * Intercepteur pour les requêtes API
 * Vérifie si le token est expiré avant chaque requête
 * Si le token est expiré, redirige vers la page de connexion
 */
export async function fetchWithInterceptor(url: string, options: RequestInit = {}) {
  // Vérifier si le token est expiré
  const authData = JSON.parse(localStorage.getItem('authData') || '{}');
  const loginTime = authData.loginTime || 0;
  const currentTime = Date.now();
  const sessionDuration = currentTime - loginTime;
  const maxSessionDuration = 4 * 60 * 60 * 1000; // 4 heures en millisecondes

  // Vérifier si la session a expiré
  if (sessionDuration > maxSessionDuration && authData.token) {
    console.log('Session expirée après 4 heures, reconnexion requise');
    localStorage.removeItem('authData');
    // Forcer le rechargement de la page pour rediriger vers la page de connexion
    window.location.reload();
    throw new Error('Session expirée');
  }

  // Ajouter le token d'authentification aux en-têtes si disponible
  const token = getAuthToken();
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  // Effectuer la requête
  const response = await fetch(url.startsWith('http') ? url : `${API_URL}${url}`, options);

  // Si la réponse indique que le token est expiré (401), rediriger vers la page de connexion
  if (response.status === 401) {
    console.log('Token expiré, reconnexion requise');
    localStorage.removeItem('authData');
    // Forcer le rechargement de la page pour rediriger vers la page de connexion
    window.location.reload();
    throw new Error('Token expiré');
  }

  return response;
}
