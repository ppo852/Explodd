import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import { getAuthToken } from './utils/auth';
import Sidebar from './components/Sidebar';
import NavigationBar from './components/NavigationBar';
import Toolbar from './components/Toolbar';
import FileGrid from './components/FileGrid';
// UserManagement est maintenant intégré dans SettingsPage
import AdvancedSearch from './components/AdvancedSearch';
import ShareLinkModal from './components/ShareLinkModal';
import SharedLinkAccess from './components/SharedLinkAccess';
import Login from './components/Login';
import SettingsPage from './components/SettingsPage';
import StatsPage from './components/StatsPage';
import RenameModal from './components/RenameModal';
import MoveModal from './components/MoveModal';
import { useFiles } from './hooks/useFiles';
import { useAuth } from './hooks/useAuth';
import { FileItem } from './types/index';
import { renameFile, deleteFiles, moveFiles, downloadFiles } from './utils/fileOperations';

// Composant principal de l'application
const MainApp = () => {
  // État pour le drawer mobile
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  
  // Fonction pour ouvrir/fermer le drawer mobile
  const toggleMobileDrawer = useCallback(() => {
    setIsMobileDrawerOpen(prev => !prev);
  }, []);
  
  // Fermer le drawer mobile lors d'un changement de chemin
  const handlePathChange = useCallback((path: string) => {
    setCurrentPath(path);
    setIsMobileDrawerOpen(false);
  }, []);
  
  // Utilisation du hook d'authentification
  const { user, isAuthenticated, isLoading: authLoading, error: authError, login, logout: originalLogout } = useAuth();
  
  // Wrapper pour la fonction de déconnexion qui réinitialise également l'état de l'application
  const logout = () => {
    // Réinitialiser la sélection de fichiers
    setSelectedFiles([]);
    // Appeler la fonction de déconnexion originale
    originalLogout();
  };
  
  // Initialiser le chemin avec le dossier personnel de l'utilisateur si authentifié
  const [currentPath, setCurrentPath] = useState('/');
  const [pathHistory, setPathHistory] = useState<string[]>(['/']);

  // Mettre à jour le chemin vers le dossier personnel lorsque l'utilisateur se connecte
  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirige vers le dossier racine de l'utilisateur, par ex. /adam
      setCurrentPath(`/${user.username}`);
    } else {
      // Si déconnecté, redirige vers la racine (qui affichera la page de connexion)
      setCurrentPath('/');
    }
  }, [isAuthenticated, user]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState('all');
  
  // Fonction pour mettre à jour le filtre et appliquer le filtrage côté serveur
  const handleFilterTypeChange = (type: string) => {
    setFilterType(type);
    // Utiliser la nouvelle fonction applyFilters pour filtrer côté serveur
    applyFilters(searchQuery, type as 'all' | 'folder' | 'image' | 'video' | 'audio' | 'document');
  };
  // La gestion des utilisateurs est maintenant intégrée dans la page de paramètres
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [fileToShare, setFileToShare] = useState('');
  const [fileToSharePath, setFileToSharePath] = useState('');
  
  // États pour le renommage de fichier
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [fileToRename, setFileToRename] = useState<{ name: string, path: string } | null>(null);
  
  // États pour le déplacement de fichier
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [filesToMove, setFilesToMove] = useState<string[]>([]);
  
  // État pour les erreurs d'opérations sur les fichiers
  const [fileOpError, setFileOpError] = useState<string | null>(null);

  // Utilisateurs récupérés depuis le backend
  const [users, setUsers] = useState<any[]>([]);
  
  // Récupérer les utilisateurs depuis le backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Erreur lors de la récupération des utilisateurs');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setUsers([]);
      }
    };
    if (isAuthenticated && user) {
      fetchUsers();
    }
  }, [isAuthenticated, user]);

  
  // Utiliser le hook useFiles avec les options de pagination, tri et filtrage
  const { 
    files, 
    loading, 
    error, 
    toggleFavorite, 
    applyFilters, // Fonction pour filtrer côté serveur
    refreshFiles // Fonction pour rafraîchir la liste des fichiers
  } = useFiles(
    isAuthenticated ? currentPath : null,
    { page: 1, limit: 100 },
    { sortBy: sortBy as 'name' | 'modified' | 'size', sortOrder: sortOrder },
    { search: searchQuery, type: filterType as 'all' | 'folder' | 'image' | 'video' | 'audio' | 'document' }
  );
  

  const handleFileClick = (file: FileItem) => {
    
    if (file.type === 'folder') {
      // Ouvrir le dossier uniquement lors d'un double-clic
      
      // S'assurer que le chemin est correctement formaté
      let newPath = file.path;
      
      // Si le chemin ne commence pas par /username ou /, le préfixer avec le nom d'utilisateur actuel
      if (!newPath.startsWith('/') || 
          (newPath.startsWith('/') && !newPath.startsWith(`/${user?.username}`) && newPath !== '/stats')) {
        // Vérifier si c'est un chemin relatif (sans slash au début)
        if (!newPath.startsWith('/')) {
          // Ajouter le chemin actuel comme préfixe
          const currentDir = currentPath.endsWith('/') ? currentPath : currentPath + '/';
          newPath = currentDir + newPath;
        } else {
          // Si le chemin commence par / mais pas par /username, le préfixer
          newPath = `/${user?.username}${newPath}`;
        }
      }
      
      setCurrentPath(newPath);
      // Ajouter le nouveau chemin à l'historique
      setPathHistory(prev => [...prev, newPath]);
    } else {
      // Ouvrir le fichier
      
      // Ici, vous pourriez ajouter une logique pour ouvrir le fichier
    }
  };
  
  // Fonction pour revenir au dossier précédent
  const handleGoBack = () => {
    if (pathHistory.length > 1) {
      // Créer une copie de l'historique
      const newHistory = [...pathHistory];
      // Retirer le dernier chemin (chemin actuel)
      newHistory.pop();
      // Définir le nouveau chemin actuel comme le dernier de l'historique
      const previousPath = newHistory[newHistory.length - 1];
      setCurrentPath(previousPath);
      // Mettre à jour l'historique
      setPathHistory(newHistory);
    }
  };

  // Utiliser directement les fichiers retournés par le hook useFiles
  // Les filtres et le tri sont maintenant gérés côté serveur
  const displayFiles = files;

  const handleAdvancedSearch = (query: string, filters: any) => {
    // Mettre à jour les variables d'état locales
    setSearchQuery(query);
    setFilterType(filters.fileType);
    
    // Utiliser la fonction applyFilters pour envoyer tous les paramètres au serveur
    applyFilters(
      query, 
      filters.fileType as 'all' | 'folder' | 'image' | 'video' | 'audio' | 'document',
      filters.dateRange as 'all' | 'today' | 'week' | 'month' | 'year',
      filters.sizeRange as 'all' | 'tiny' | 'small' | 'medium' | 'large' | 'xlarge',
      filters.extension || ''
    );
  };

  const handleShareFile = (fileName: string, filePath: string) => {
    console.log('handleShareFile appelé avec:', { fileName, filePath });
    setFileToShare(fileName);
    setFileToSharePath(filePath);
    setShowShareModal(true);
  };

  // Fonction pour renommer un fichier
  const handleRenameFile = (fileName: string, filePath: string) => {
    console.log('handleRenameFile appelé avec:', { fileName, filePath });
    setFileToRename({ name: fileName, path: filePath });
    setShowRenameModal(true);
  };

  // Fonction pour supprimer un fichier
  const handleDeleteFile = async (fileName: string, filePath: string) => {
    console.log('handleDeleteFile appelé avec:', { fileName, filePath });
    try {
      await deleteFiles([filePath]);
      // Rafraîchir la liste des fichiers
      refreshFiles();
    } catch (err) {
      console.error('Erreur lors de la suppression du fichier:', err);
      setFileOpError(err instanceof Error ? err.message : 'Erreur lors de la suppression du fichier');
    }
  };

  // Fonction pour déplacer un fichier
  const handleMoveFile = (fileName: string, filePath: string) => {
    console.log('handleMoveFile appelé avec:', { fileName, filePath });
    setFilesToMove([filePath]);
    setShowMoveModal(true);
  };

  // Fonction pour télécharger un fichier
  const handleDownloadFile = async (fileName: string, filePath: string) => {
    console.log('handleDownloadFile appelé avec:', { fileName, filePath });
    try {
      await downloadFiles([filePath]);
    } catch (err) {
      console.error('Erreur lors du téléchargement du fichier:', err);
      setFileOpError(err instanceof Error ? err.message : 'Erreur lors du téléchargement du fichier');
    }
  };

  

  // Si l'authentification est en cours, afficher un écran de chargement
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-[#181e2a] via-[#151a24] to-[#262c3a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas authentifié, afficher la page de connexion
  if (!isAuthenticated) {
    return <Login onLogin={login} error={authError} isLoading={authLoading} />;
  }

  // Si l'utilisateur est authentifié, afficher l'application
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#181e2a] via-[#151a24] to-[#262c3a] flex flex-col relative">
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenUserManagement={() => setShowSettings(true)}
        onOpenAdvancedSearch={() => setShowAdvancedSearch(true)}
        username={user?.username}
        userRole={user?.role}
        onLogout={logout}
        onToggleMobileDrawer={toggleMobileDrawer}
        isMobileDrawerOpen={isMobileDrawerOpen}
      />
      
      <div className="flex flex-1 relative">
        {/* Sidebar pour desktop */}
        <div className="hidden md:block flex-shrink-0">
          <Sidebar 
            currentPath={currentPath}
            setCurrentPath={setCurrentPath}
            users={users}
          />
        </div>
        
        {/* Overlay pour mobile quand le drawer est ouvert */}
        {isMobileDrawerOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity duration-300"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
        )}
        
        {/* Sidebar mobile (drawer) */}
        <div 
          className={`fixed top-0 left-0 h-full z-40 transform transition-transform duration-300 ease-in-out md:hidden ${isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <Sidebar 
            currentPath={currentPath}
            setCurrentPath={handlePathChange}
            users={users}
          />
        </div>
        
        <div className="flex-1 flex flex-col w-full">
          {/* Afficher la barre de navigation seulement si on n'est pas sur la page des statistiques */}
          {currentPath !== '/stats' && (
            <NavigationBar 
              currentPath={currentPath}
              setCurrentPath={setCurrentPath}
              filterType={filterType}
              setFilterType={handleFilterTypeChange}
            />
          )}
          
          {/* Afficher la toolbar seulement si on n'est pas sur la page des statistiques */}
          {currentPath !== '/stats' && (
            <Toolbar 
              currentPath={currentPath}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              filterType={filterType}
              setFilterType={setFilterType}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              onShareFile={handleShareFile}
              onGoBack={handleGoBack}
              canGoBack={pathHistory.length > 1}
              files={displayFiles}
              refreshFiles={refreshFiles}
              currentUser={user}
            />
          )}
          
          <div className="flex-1 p-6">
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Erreur !</strong>
                <span className="block sm:inline"> {error}</span>
              </div>
            ) : null}
            
            {fileOpError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Erreur d'opération sur fichier !</strong>
                <span className="block sm:inline"> {fileOpError}</span>
                <button 
                  className="absolute top-0 bottom-0 right-0 px-4 py-3" 
                  onClick={() => setFileOpError(null)}
                >
                  <span className="text-xl">&times;</span>
                </button>
              </div>
            ) : null}
            
            {loading ? (
              <div className="flex justify-center items-center h-full bg-gradient-to-br from-[#181e2a] via-[#151a24] to-[#262c3a]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : currentPath === '/stats' ? (
              <StatsPage currentPath={currentPath} />
            ) : (
              <FileGrid 
                files={displayFiles} 
                onFileClick={handleFileClick} 
                onToggleFavorite={toggleFavorite}
                viewMode={viewMode}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                onShareFile={handleShareFile}
                onRenameFile={handleRenameFile}
                onDeleteFile={handleDeleteFile}
                onMoveFile={handleMoveFile}
                onDownloadFile={handleDownloadFile}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Le composant UserManagement est maintenant intégré dans la page de paramètres */}
      
      {showSettings && (
        <SettingsPage 
          onClose={() => setShowSettings(false)} 
          currentUser={user}
        />
      )}
      <AdvancedSearch 
        isOpen={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        onSearch={handleAdvancedSearch}
      />
      
      <ShareLinkModal 
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        fileName={fileToShare}
        filePath={fileToSharePath}
      />
      
      {/* Modale pour renommer un fichier */}
      {fileToRename && (
        <RenameModal
          isOpen={showRenameModal}
          onClose={() => setShowRenameModal(false)}
          fileName={fileToRename.name}
          filePath={fileToRename.path}
          onRename={async (filePath: string, newName: string) => {
            try {
              await renameFile(filePath, newName);
              refreshFiles();
              setShowRenameModal(false);
            } catch (err) {
              console.error('Erreur lors du renommage:', err);
              setFileOpError(err instanceof Error ? err.message : 'Erreur lors du renommage');
            }
          }}
        />
      )}
      
      {/* Modale pour déplacer des fichiers */}
      <MoveModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        selectedFiles={filesToMove.map(path => path.split('/').pop() || '')}
        filePaths={filesToMove}
        onMove={async (filePaths: string[], destinationPath: string) => {
          try {
            await moveFiles(filePaths, destinationPath);
            refreshFiles();
            setShowMoveModal(false);
          } catch (err) {
            console.error('Erreur lors du déplacement:', err);
            setFileOpError(err instanceof Error ? err.message : 'Erreur lors du déplacement');
          }
        }}
        currentUser={user}
      />
    </div>
  );
}

// Composant App avec le routeur
function App() {
  return (
    <Router>
      <Routes>
        {/* Route pour accéder aux liens partagés */}
        <Route path="/share/:linkId" element={<SharedLinkAccess linkId={window.location.pathname.split('/').pop() || ''} />} />
        
        {/* Route principale de l'application */}
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;