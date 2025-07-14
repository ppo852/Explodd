import React, { useState, useEffect } from 'react';
import { X, FolderOpen, ArrowUp } from 'lucide-react';
import { fetchWithInterceptor } from '../utils/apiInterceptor';
import { User } from '../types';

interface Folder {
  id: string;
  name: string;
  type: 'folder';
  path: string;
  extension?: string;
  size?: number;
  modified?: Date;
  isFavorite?: boolean;
}

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFiles: string[];
  filePaths: string[];
  onMove: (filePaths: string[], destinationPath: string) => Promise<void>;
  currentUser: User | null;
}

const MoveModal: React.FC<MoveModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedFiles,
  filePaths,
  onMove,
  currentUser 
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Définir le chemin de départ en fonction de l'utilisateur
  const initialPath = currentUser ? `/${currentUser.username}` : '/';
  const [currentPath, setCurrentPath] = useState<string>(initialPath);

  // Réinitialiser le chemin lorsque le modal est ouvert
  useEffect(() => {
    if (isOpen) {
      setCurrentPath(initialPath);
      fetchFolders(initialPath);
    } else {
      // Réinitialiser l'état à la fermeture
      setSelectedFolder('');
      setError(null);
    }
  }, [isOpen, initialPath]);

  // Mettre à jour les dossiers lorsque le chemin change
  useEffect(() => {
    if (isOpen) {
      fetchFolders(currentPath);
    }
  }, [currentPath]);

  // Fonction spécifique pour récupérer les utilisateurs à la racine
  const fetchUsers = async () => {
    setIsFetchingFolders(true);
    setError(null);
    
    console.log('Récupération des utilisateurs pour la racine');
    
    try {
      const response = await fetchWithInterceptor('/api/users');
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des utilisateurs');
      }
      
      const data = await response.json();
      console.log('API users response:', data);
      
      if (data && Array.isArray(data)) {
        // Transformer les utilisateurs en dossiers virtuels
        const userFolders = data
          .filter(user => user.username !== 'admin') // Filtrer l'admin si nécessaire
          .map(user => ({
            id: user.id || user.username, // Utiliser l'ID existant ou le nom d'utilisateur comme ID
            name: user.username,
            type: 'folder' as 'folder',
            extension: '',
            size: 0,
            modified: new Date(),
            path: `/${user.username}`,
            isFavorite: false
          }));
        
        console.log('Dossiers utilisateurs créés:', userFolders);
        setFolders(userFolders);
      } else {
        console.error('Format de données utilisateurs inattendu:', data);
        setFolders([]);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des utilisateurs:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des utilisateurs');
      setFolders([]);
    } finally {
      setIsFetchingFolders(false);
    }
  };
  
  const fetchFolders = async (path: string) => {
    // Si nous sommes à la racine, utiliser fetchUsers à la place
    if (path === '/') {
      return fetchUsers();
    }
    
    setIsFetchingFolders(true);
    setError(null);
    
    console.log(`Fetching folders for path: ${path}`);
    
    try {
      const response = await fetchWithInterceptor(`/api/files?path=${encodeURIComponent(path)}&type=folder`);
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des dossiers');
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      
      // Traitement normal pour les chemins autres que la racine
      if (data && data.files && Array.isArray(data.files)) {
        // Filtrer pour ne garder que les dossiers
        const foldersList = data.files.filter((file: any) => file.type === 'folder');
        console.log('Filtered folders:', foldersList);
        setFolders(foldersList);
      } else {
        console.error('Format de données inattendu:', data);
        // Essayer de récupérer les dossiers d'une autre façon si le format est différent
        if (data && Array.isArray(data.files)) {
          const foldersList = data.files.filter((file: any) => file.type === 'folder');
          console.log('Alternative format folders:', foldersList);
          setFolders(foldersList);
        } else if (data && Array.isArray(data)) {
          const foldersList = data.filter((item: any) => item.type === 'folder');
          console.log('Direct array format folders:', foldersList);
          setFolders(foldersList);
        } else {
          setFolders([]);
        }
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des dossiers');
      setFolders([]);
    } finally {
      setIsFetchingFolders(false);
    }
  };

  const handleFolderClick = (folder: Folder) => {
    setCurrentPath(folder.path);
  };

  const handleParentFolderClick = () => {
    // Si nous sommes dans un dossier utilisateur direct (ex: /adam), revenir à la racine
    if (currentUser?.role === 'admin' && currentPath.split('/').filter(part => part).length === 1) {
      console.log(`Retour à la racine depuis le dossier utilisateur ${currentPath}`);
      setCurrentPath('/');
    } else {
      // Sinon, remonter d'un niveau normalement
      const newPath = currentPath.split('/').slice(0, -1).join('/') || '/';
      console.log(`Remontée d'un niveau: ${currentPath} -> ${newPath}`);
      setCurrentPath(newPath);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFolder) {
      setError('Veuillez sélectionner un dossier de destination');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onMove(filePaths, selectedFolder);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Déplacer {selectedFiles.length} élément(s)</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <button 
                onClick={handleParentFolderClick}
                disabled={currentPath === '/' || (currentUser?.role !== 'admin' && currentPath === `/${currentUser?.username}`)}
                className="flex items-center px-3 py-1.5 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
              >
                <ArrowUp className="w-4 h-4 mr-1" />
                Parent
              </button>
              <span className="text-sm text-gray-600">
                Chemin actuel: {currentPath}
              </span>
            </div>
            
            <div className="border border-gray-300 rounded-md h-64 overflow-y-auto p-2">
              {isFetchingFolders ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : folders.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-500">
                  Aucun dossier disponible
                </div>
              ) : (
                <ul>
                  {folders.map((folder) => (
                    <li key={folder.id} className="mb-1">
                      <div 
                        className={`flex items-center p-2 rounded-md cursor-pointer ${selectedFolder === folder.path ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        onClick={() => setSelectedFolder(folder.path)}
                        onDoubleClick={() => handleFolderClick(folder)}
                      >
                        <FolderOpen className="w-5 h-5 text-yellow-500 mr-2" />
                        <span>{folder.name}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-2 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isLoading}
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              disabled={isLoading || !selectedFolder}
            >
              {isLoading ? 'Déplacement...' : 'Déplacer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoveModal;
