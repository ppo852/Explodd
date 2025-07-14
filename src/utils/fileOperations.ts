import { fetchWithInterceptor } from './apiInterceptor';

// Pas besoin de préfixe car les URLs sont déjà préfixées avec /api dans les appels directs
const API_URL = '';

/**
 * Renomme un fichier ou un dossier
 * @param filePath Chemin du fichier à renommer
 * @param newName Nouveau nom du fichier
 * @returns Promesse avec le résultat de l'opération
 */
export const renameFile = async (filePath: string, newName: string) => {
  try {
    const response = await fetchWithInterceptor(`${API_URL}/files/rename`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath, newName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors du renommage');
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors du renommage:', error);
    throw error;
  }
};

/**
 * Supprime un ou plusieurs fichiers ou dossiers
 * @param filePaths Tableau des chemins des fichiers à supprimer
 * @returns Promesse avec le résultat de l'opération
 */
export const deleteFiles = async (filePaths: string[]) => {
  try {
    const response = await fetchWithInterceptor(`${API_URL}/files/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePaths }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la suppression');
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    throw error;
  }
};

/**
 * Déplace un ou plusieurs fichiers ou dossiers vers une destination
 * @param filePaths Tableau des chemins des fichiers à déplacer
 * @param destinationPath Chemin de destination
 * @returns Promesse avec le résultat de l'opération
 */
export const moveFiles = async (filePaths: string[], destinationPath: string) => {
  try {
    const response = await fetchWithInterceptor(`${API_URL}/files/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePaths, destinationPath }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors du déplacement');
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors du déplacement:', error);
    throw error;
  }
};

/**
 * Crée un nouveau dossier
 * @param path Chemin du dossier parent
 * @param name Nom du nouveau dossier
 * @returns Promesse avec le résultat de l'opération
 */
export const createFolder = async (path: string, name: string) => {
  try {
    const response = await fetchWithInterceptor(`${API_URL}/files/mkdir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, name }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la création du dossier');
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    throw error;
  }
};

/**
 * Crée un nouveau fichier vide
 * @param path Chemin du dossier parent
 * @param name Nom du nouveau fichier
 * @returns Promesse avec le résultat de l'opération
 */
export const createFile = async (path: string, name: string) => {
  try {
    const response = await fetchWithInterceptor(`${API_URL}/files/touch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, name }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la création du fichier');
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la création du fichier:', error);
    throw error;
  }
};

/**
 * Télécharge des fichiers vers le serveur
 * @param path Chemin de destination
 * @param files Liste des fichiers à télécharger
 * @returns Promesse avec le résultat de l'opération
 */
export const uploadFiles = async (path: string, files: File[]): Promise<void> => {
  try {
    const formData = new FormData();
    formData.append('path', path);
    
    for (const file of files) {
      formData.append('files', file);
    }
    
    const response = await fetchWithInterceptor('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors du téléchargement des fichiers');
    }
  } catch (error) {
    console.error('Erreur lors du téléchargement des fichiers:', error);
    throw error;
  }
};

/**
 * Télécharge (download) les fichiers ou dossiers sélectionnés
 * Si un seul fichier est sélectionné, il sera téléchargé directement
 * Si plusieurs fichiers ou un dossier sont sélectionnés, ils seront compressés en ZIP
 * @param filePaths Chemins virtuels des fichiers à télécharger
 */
export const downloadFiles = async (filePaths: string[]): Promise<void> => {
  try {
    if (filePaths.length === 0) {
      throw new Error('Aucun fichier sélectionné pour le téléchargement');
    }

    // Créer un formulaire pour envoyer les chemins des fichiers
    const response = await fetchWithInterceptor('/api/files/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paths: filePaths }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Fichier non trouvé');
      }
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors du téléchargement des fichiers');
    }

    // Récupérer le blob de la réponse
    const blob = await response.blob();
    
    // Créer un URL pour le blob
    const url = window.URL.createObjectURL(blob);
    
    // Créer un lien temporaire pour télécharger le fichier
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Déterminer le nom du fichier à partir du Content-Disposition ou utiliser un nom par défaut
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'explodd-files.zip';
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    } else if (filePaths.length === 1) {
      // Si un seul fichier, utiliser son nom
      filename = filePaths[0].split('/').pop() || 'fichier';
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyer
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Erreur lors du téléchargement des fichiers:', error);
    throw error;
  }
};
