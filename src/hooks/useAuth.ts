import { useState, useEffect } from 'react';
import { User } from '../types';
import { fetchWithInterceptor } from '../utils/apiInterceptor';

// L'intercepteur API gère maintenant les URL

// Utilisation du type User importé depuis types/index.ts

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  // Récupération des données d'authentification depuis le localStorage
  const getAuthDataFromStorage = () => {
    const authData = localStorage.getItem('authData');
    if (authData) {
      const parsed = JSON.parse(authData);
      return {
        user: parsed.user || null,
        token: parsed.token || null
      };
    }
    return { user: null, token: null };
  };
  
  const { user, token } = getAuthDataFromStorage();
  
  const [authState, setAuthState] = useState<AuthState>({
    user,
    token,
    isAuthenticated: !!token,
    isLoading: !!token, // Si on a un token, on va vérifier sa validité
    error: null
  });

  // Utiliser un identifiant de session au lieu de la date de démarrage
  const [sessionId] = useState<string>(() => {
    // Récupérer l'ID de session existant ou en créer un nouveau
    const existingSessionId = sessionStorage.getItem('sessionId');
    if (existingSessionId) return existingSessionId;
    
    // Créer un nouvel ID de session et le stocker dans sessionStorage (persisté uniquement pour l'onglet courant)
    const newSessionId = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('sessionId', newSessionId);
    return newSessionId;
  });

  // Vérifier le token au chargement et périodiquement
  useEffect(() => {
    const verifyToken = async () => {
      const { token } = getAuthDataFromStorage();
      
      if (!token) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false
        }));
        return;
      }
      
      try {
        const response = await fetchWithInterceptor(`/api/auth/verify`);
        const data = await response.json();
        
        if (response.ok) {
          // Vérifier si la session a dépassé la durée maximale
          const authData = JSON.parse(localStorage.getItem('authData') || '{}');
          const loginTime = authData.loginTime || 0;
          const currentTime = Date.now();
          const sessionDuration = currentTime - loginTime;
          const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 heures en millisecondes (augmenté de 4h à 24h)
          
          if (sessionDuration > maxSessionDuration) {
            // Session expirée après la durée maximale
            console.log('Session expirée, reconnexion requise');
            localStorage.removeItem('authData');
            
            setAuthState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: 'Session expirée, veuillez vous reconnecter'
            });
            return;
          }
          
          // Utiliser les informations utilisateur mises à jour renvoyées par l'API
          // Cela garantit que nous avons les permissions les plus récentes
          const updatedUser = data.user || getAuthDataFromStorage().user;
          
          // Mettre à jour les données d'authentification dans le localStorage
          if (data.user) {
            const updatedAuthData = {
              ...authData,
              user: updatedUser
            };
            localStorage.setItem('authData', JSON.stringify(updatedAuthData));
          }
          
          setAuthState({
            user: updatedUser,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          // Log pour le débogage
          console.log('Utilisateur mis à jour avec permissions:', updatedUser);
        } else {
          // Le token est invalide, supprimer les données d'authentification
          localStorage.removeItem('authData');
          
          setAuthState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Session expirée, veuillez vous reconnecter'
          });
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Erreur de connexion au serveur'
        }));
      }
    };
    
    // Vérifier le token immédiatement au chargement
    verifyToken();
    
    // Puis vérifier périodiquement (toutes les 15 minutes)
    const intervalId = setInterval(verifyToken, 15 * 60 * 1000);
    
    // Nettoyer l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, [sessionId]);

  // Fonction de connexion
  const login = async (username: string, password: string) => {
    setAuthState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));
    
    try {
      const response = await fetchWithInterceptor(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Sauvegarder le token et les informations de l'utilisateur dans un seul objet
        localStorage.setItem('authData', JSON.stringify({
          token: data.token,
          user: data.user,
          loginTime: Date.now() // Stocker la date/heure de connexion
        }));
        
        // Pas besoin de stocker la date de démarrage car nous utilisons sessionStorage
        
        setAuthState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        
        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Erreur lors de la connexion'
        }));
        
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Erreur de connexion au serveur'
      }));
      
      return false;
    }
  };

  // Fonction de déconnexion
  const logout = () => {
    localStorage.removeItem('authData');
    
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  };

  return {
    ...authState,
    login,
    logout
  };
}
