import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Download, 
  Edit3, 
  FolderOpen, 
  X, 
  Link,
  MoreVertical,
  Trash2
} from 'lucide-react';

import { FileItem, User } from '../types';
import { hasPermission, PERMISSIONS } from '../utils/permissionUtils';
import { renameFile, deleteFiles, moveFiles, createFolder, createFile, downloadFiles } from '../utils/fileOperations';
import RenameModal from './RenameModal';
import MoveModal from './MoveModal';
import NewItemModal from './NewItemModal';

interface ToolbarProps {
  currentPath: string;
  sortBy: string;
  setSortBy: (sort: string) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  filterType: string;
  setFilterType: (type: string) => void;
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
  onShareFile: (fileName: string, filePath: string) => void;
  // Fonction pour revenir au dossier précédent
  onGoBack: () => void;
  // Indique si on peut revenir en arrière
  canGoBack: boolean;
  // Ajouter une prop pour accéder aux fichiers affichés
  files?: FileItem[];
  // Ajouter une prop pour rafraîchir les fichiers après une opération
  refreshFiles?: () => void;
  // Utilisateur actuel pour vérifier les permissions
  currentUser: User | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  currentPath, 
  sortBy, 
  setSortBy, 
  sortOrder,
  setSortOrder,
  selectedFiles,  
  setSelectedFiles,
  onShareFile,
  onGoBack,
  canGoBack,
  files = [],
  refreshFiles,
  currentUser
}) => {
  // État pour détecter si nous sommes sur mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // État pour le menu déroulant sur mobile
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  
  // Détecter si nous sommes sur mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px est le breakpoint sm de Tailwind
    };
    
    // Vérifier au chargement
    checkIfMobile();
    
    // Vérifier au redimensionnement
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  
  // Fermer le menu mobile quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fermer le menu mobile si la sélection disparaît
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setShowMobileMenu(false);
    }
  }, [selectedFiles]);

  // Afficher l'objet utilisateur et ses permissions pour diagnostic
  console.log('Toolbar - currentUser:', currentUser);
  console.log('Toolbar - permissions:', currentUser?.permissions);
  console.log('Toolbar - isAdmin:', currentUser?.role === 'admin');
  console.log('Toolbar - hasRenamePermission:', hasPermission(currentUser, PERMISSIONS.RENAME));
  console.log('Toolbar - hasDeletePermission:', hasPermission(currentUser, PERMISSIONS.DELETE));
  console.log('Toolbar - hasWritePermission:', hasPermission(currentUser, PERMISSIONS.WRITE));

  const getPathName = (path: string) => {
    const pathMap: { [key: string]: string } = {
      '/all': 'Tous les fichiers',
      '/recent': 'Récents',
      '/shared-with-me': 'Partagés avec moi',
      '/shared-with-others': 'Partagés avec d\'autres',
      '/shared-by-link': 'Partagés par lien',
      '/file-requests': 'Demandes de fichiers',
      
      '/home/admin': 'Dossier Admin',
    };
    return pathMap[path] || 'Fichiers';
  };

  const sortOptions = [
    { value: 'name', label: 'Nom' },
    { value: 'modified', label: 'Modifié' },
    { value: 'size', label: 'Taille' },
    { value: 'type', label: 'Type' },
  ];

  // États pour les modales et les opérations
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [fileToRename, setFileToRename] = useState<{ name: string, path: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Récupérer les chemins complets des fichiers sélectionnés
  const getSelectedFilePaths = () => {
    return selectedFiles.map(fileId => {
      const file = files.find(f => f.id === fileId);
      return file ? file.path : '';
    }).filter(path => path !== '');
  };

  const handleRename = () => {
    if (selectedFiles.length !== 1) {
      setError('Veuillez sélectionner un seul fichier à renommer');
      return;
    }

    const selectedFileId = selectedFiles[0];
    const selectedFile = files.find(file => file.id === selectedFileId);
    
    if (selectedFile) {
      setFileToRename({ name: selectedFile.name, path: selectedFile.path });
      setShowRenameModal(true);
    } else {
      setError('Fichier sélectionné introuvable');
    }
  };

  const handleRenameSubmit = async (filePath: string, newName: string) => {
    try {
      await renameFile(filePath, newName);
      
      // Fermer la modale
      setShowRenameModal(false);
      setFileToRename(null);
      
      // Rafraîchir la liste des fichiers
      if (refreshFiles) {
        // Attendre un court instant pour s'assurer que le serveur a bien terminé
        setTimeout(() => refreshFiles(), 500);
      }
      
      // Effacer la sélection
      setSelectedFiles([]);
    } catch (err) {
      console.error('Erreur lors du renommage du fichier:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du renommage du fichier');
    }
  };

  const handleDelete = async () => {
    if (selectedFiles.length === 0) {
      setError('Veuillez sélectionner au moins un fichier à supprimer');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      
      // Récupérer les chemins des fichiers sélectionnés
      const filePaths = getSelectedFilePaths();
      
      // Supprimer les fichiers
      await deleteFiles(filePaths);
      
      // Rafraîchir la liste des fichiers
      if (refreshFiles) {
        setTimeout(() => refreshFiles(), 500);
      }
      
      // Effacer la sélection
      setSelectedFiles([]);
    } catch (err) {
      console.error('Erreur lors de la suppression des fichiers:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression des fichiers');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMove = () => {
    if (selectedFiles.length === 0) {
      setError('Veuillez sélectionner au moins un fichier à déplacer');
      return;
    }
    setShowMoveModal(true);
  };

  const handleMoveSubmit = async (filePaths: string[], destinationPath: string) => {
    try {
      await moveFiles(filePaths, destinationPath);
      setShowMoveModal(false);
      if (refreshFiles) {
        setTimeout(() => refreshFiles(), 500);
      }
      setSelectedFiles([]);
    } catch (err) {
      console.error('Erreur lors du déplacement des fichiers:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du déplacement des fichiers');
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  // Gestion de la création de dossier
  const handleCreateFolder = async (path: string, name: string) => {
    try {
      await createFolder(path, name);
      if (refreshFiles) {
        // Attendre un court instant pour s'assurer que le serveur a bien terminé
        setTimeout(() => refreshFiles(), 500);
      }
    } catch (err) {
      console.error('Erreur lors de la création du dossier:', err);
      throw err;
    }
  };

  // Gestion de la création de fichier
  const handleCreateFile = async (path: string, name: string) => {
    try {
      await createFile(path, name);
      if (refreshFiles) {
        // Attendre un court instant pour s'assurer que le serveur a bien terminé
        setTimeout(() => refreshFiles(), 500);
      }
    } catch (err) {
      console.error('Erreur lors de la création du fichier:', err);
      throw err;
    }
  };

  // Gestion du téléchargement (download) des fichiers sélectionnés
  const handleDownload = async () => {
    if (selectedFiles.length === 0) {
      setError('Veuillez sélectionner au moins un fichier à télécharger');
      return;
    }

    try {
      setIsDownloading(true);
      setError(null);
      
      // Récupérer les chemins des fichiers sélectionnés
      const filePaths = getSelectedFilePaths();
      
      // Télécharger les fichiers
      await downloadFiles(filePaths);
    } catch (err) {
      console.error('Erreur lors du téléchargement des fichiers:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du téléchargement des fichiers');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="bg-[#23293a]/80 backdrop-blur-md border-b border-[#343c4e] px-2 sm:px-6 py-2 sm:py-4">
        {error && (
          <div className="mb-4 p-2 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        
        <div className="flex items-center space-x-2">
          <h2 className="text-base sm:text-lg font-semibold text-gray-200 truncate">{getPathName(currentPath)}</h2>
          <div className="flex items-center space-x-2">
            {selectedFiles.length > 0 ? (
              <>
                <div className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-100 text-blue-800 rounded-lg">
                  <span>{selectedFiles.length} fichier(s) sélectionné(s)</span>
                  <button onClick={clearSelection} className="hover:bg-blue-200 rounded p-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                {/* Menu d'actions pour mobile - uniquement visible sur mobile */}
                {isMobile && (
                  <div className="relative" ref={mobileMenuRef}>
                    <button 
                      onClick={() => setShowMobileMenu(!showMobileMenu)}
                      className="flex items-center space-x-1 px-2 py-1.5 text-sm rounded-lg bg-[#23293a] text-gray-300 hover:bg-[#343c4e] active:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <MoreVertical className="w-4 h-4" />
                      <span>Actions</span>
                    </button>
                    
                    {showMobileMenu && (
                      <div className="absolute top-full right-0 mt-1 bg-[#1e2233] border border-[#343c4e] rounded-lg shadow-lg z-50 w-48">
                        {hasPermission(currentUser, PERMISSIONS.RENAME) && selectedFiles.length === 1 && (
                          <button 
                            onClick={() => {
                              handleRename();
                              setShowMobileMenu(false);
                            }}
                            className="flex items-center space-x-2 px-3 py-2 text-sm w-full text-left text-gray-300 hover:bg-[#343c4e]"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>Renommer</span>
                          </button>
                        )}
                        
                        {hasPermission(currentUser, PERMISSIONS.DELETE) && (
                          <button 
                            onClick={() => {
                              handleDelete();
                              setShowMobileMenu(false);
                            }}
                            disabled={isDeleting}
                            className="flex items-center space-x-2 px-3 py-2 text-sm w-full text-left text-gray-300 hover:bg-[#343c4e]"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Supprimer</span>
                          </button>
                        )}
                        
                        {hasPermission(currentUser, PERMISSIONS.MOVE) && (
                          <button 
                            onClick={() => {
                              handleMove();
                              setShowMobileMenu(false);
                            }}
                            className="flex items-center space-x-2 px-3 py-2 text-sm w-full text-left text-gray-300 hover:bg-[#343c4e]"
                          >
                            <FolderOpen className="w-4 h-4" />
                            <span>Déplacer vers</span>
                          </button>
                        )}
                        
                        <button 
                          onClick={() => {
                            handleDownload();
                            setShowMobileMenu(false);
                          }}
                          disabled={isDownloading}
                          className="flex items-center space-x-2 px-3 py-2 text-sm w-full text-left text-gray-300 hover:bg-[#343c4e]"
                        >
                          <Download className="w-4 h-4" />
                          <span>Télécharger</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Boutons d'actions pour desktop - cachés sur mobile */}
                <div className={`${isMobile ? 'hidden' : 'flex'} items-center space-x-2`}>
                  {/* Bouton Renommer - Nécessite la permission 'rename' */}
                  {hasPermission(currentUser, PERMISSIONS.RENAME) && (
                    <button 
                      onClick={handleRename}
                      disabled={selectedFiles.length !== 1}
                      className={`flex items-center space-x-2 px-3 py-1.5 text-sm ${selectedFiles.length === 1 ? 'text-gray-200 hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'} rounded-lg`}
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Renommer</span>
                    </button>
                  )}
                  {/* Bouton Supprimer - Nécessite la permission 'delete' */}
                  {hasPermission(currentUser, PERMISSIONS.DELETE) && (
                    <button 
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className={`flex items-center space-x-2 px-3 py-1.5 text-sm ${!isDeleting ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 cursor-not-allowed'} rounded-lg`}
                    >
                      {isDeleting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600 mr-2"></div>
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      <span>Supprimer</span>
                    </button>
                  )}
                  {/* Bouton Déplacer - Nécessite la permission 'move' */}
                  {hasPermission(currentUser, PERMISSIONS.MOVE) && (
                    <button 
                      onClick={handleMove}
                      disabled={isDeleting}
                      className={`flex items-center space-x-2 px-3 py-1.5 text-sm ${!isDeleting ? 'text-gray-200 hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'} rounded-lg`}
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Déplacer vers</span>
                    </button>
                  )}
                  {/* Bouton Partager par lien - Nécessite la permission 'share' */}
                  {hasPermission(currentUser, PERMISSIONS.SHARE) && selectedFiles.length > 0 && (
                    <button 
                      onClick={() => {
                        if (selectedFiles.length === 1) {
                          // Cas d'un seul élément sélectionné
                          const selectedFileId = selectedFiles[0];
                          const selectedFile = files.find(file => file.id === selectedFileId);
                          
                          console.log('Bouton partager cliqué, élément sélectionné:', selectedFile);
                          
                          if (selectedFile) {
                            onShareFile(selectedFile.name, selectedFile.path);
                          } else {
                            alert('Élément sélectionné introuvable');
                          }
                        } else if (selectedFiles.length > 1) {
                          // Cas de plusieurs éléments sélectionnés
                          const selectedFileId = selectedFiles[0];
                          const selectedFile = files.find(file => file.id === selectedFileId);
                          
                          console.log('Partage multi-éléments, premier élément:', selectedFile);
                          
                          if (selectedFile) {
                            onShareFile(selectedFile.name, selectedFile.path);
                          } else {
                            alert('Élément sélectionné introuvable');
                          }
                        }
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg bg-[#23293a] text-gray-300 hover:bg-[#343c4e]"
                    >
                      <Link className="w-4 h-4" />
                      <span>Partager par lien</span>
                    </button>
                  )}
                  {/* Bouton Télécharger - Toujours disponible (permission 'read') */}
                  <button 
                    onClick={handleDownload}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg transition-colors font-medium bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow hover:from-blue-600 hover:to-purple-700"
                    disabled={isDownloading}
                  >
                    <Download className="w-4 h-4" />
                    <span>{isDownloading ? 'Téléchargement...' : 'Télécharger'}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Bouton Nouveau - Nécessite la permission 'write' */}
                {hasPermission(currentUser, PERMISSIONS.WRITE) && (
                  <button 
                    onClick={() => setShowNewItemModal(true)}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg transition-colors font-medium bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow hover:from-blue-600 hover:to-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-2">
          {/* Bouton de retour */}
          {canGoBack && (
            <button
              onClick={onGoBack}
              className="flex items-center justify-center h-[34px] px-3 mr-2 text-sm border border-[#343c4e] bg-[#23293a] text-gray-200 rounded-lg hover:bg-[#343c4e] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              title="Retour au dossier précédent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Retour
            </button>
          )}
          
          {/* Sélecteur de tri */}
          <div className="flex items-center">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-[#343c4e] bg-[#23293a] text-gray-200 rounded-l-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center justify-center h-[34px] w-[34px] text-sm border border-l-0 border-[#343c4e] bg-[#23293a] text-gray-200 rounded-r-lg hover:bg-[#343c4e] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              title={sortOrder === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de renommage */}
      {fileToRename && (
        <RenameModal
          isOpen={showRenameModal}
          onClose={() => setShowRenameModal(false)}
          fileName={fileToRename.name}
          filePath={fileToRename.path}
          onRename={handleRenameSubmit}
        />
      )}

      {/* Modal de déplacement */}
      <MoveModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        selectedFiles={selectedFiles}
        filePaths={getSelectedFilePaths()}
        onMove={handleMoveSubmit}
        currentUser={currentUser}
      />

      {/* Modal de création de nouveau dossier/fichier */}
      <NewItemModal
        isOpen={showNewItemModal}
        onClose={() => setShowNewItemModal(false)}
        currentPath={currentPath}
        onCreateFolder={handleCreateFolder}
        onCreateFile={handleCreateFile}
      />

      {/* Pas de modal de téléchargement nécessaire, le téléchargement se fait directement */}
    </>
  );
};

export default Toolbar;
