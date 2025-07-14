import React from 'react';
import { Search, Settings, User, Grid3X3, List, Filter, Menu, X, LogOut } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onOpenUserManagement: () => void;
  onOpenAdvancedSearch: () => void;
  username?: string;
  userRole?: 'admin' | 'user'; // Ajout du rôle utilisateur
  onLogout?: () => void;
  // Nouvelles props pour la gestion du drawer mobile
  onToggleMobileDrawer?: () => void;
  isMobileDrawerOpen?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  setSearchQuery, 
  viewMode, 
  setViewMode, 
  onOpenUserManagement,
  onOpenAdvancedSearch,
  username,
  userRole,
  onLogout,
  onToggleMobileDrawer,
  isMobileDrawerOpen
}) => {
  
  
  return (
    <header className="bg-[#23293a]/80 backdrop-blur-md text-white px-4 py-3 flex items-center justify-between shadow-lg border-b border-[#343c4e]">
      <div className="flex items-center space-x-4">
        {/* Bouton hamburger pour mobile */}
        {onToggleMobileDrawer && (
          <button 
            onClick={onToggleMobileDrawer} 
            className="md:hidden p-1.5 hover:bg-[#343c4e] rounded-lg focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMobileDrawerOpen ? (
              <X className="w-5 h-5 text-gray-300" />
            ) : (
              <Menu className="w-5 h-5 text-gray-300" />
            )}
          </button>
        )}
        
        <div className="flex items-center space-x-2">
  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow">
    <Grid3X3 className="w-5 h-5 text-white" />
  </div>
  <span className="text-lg font-bold tracking-wide text-white">Explodd</span>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-2 md:mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Rechercher des fichiers et dossiers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#23293a] border border-[#343c4e] text-white placeholder-gray-400 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            onClick={onOpenAdvancedSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-400"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-1 md:space-x-3">
        <div className="hidden sm:flex items-center space-x-1 bg-[#23293a] border border-[#343c4e] rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' : 'hover:bg-[#343c4e] text-gray-300'}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' : 'hover:bg-[#343c4e] text-gray-300'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        {/* Bouton de notification supprimé car non utilisé */}
        {userRole === 'admin' && (
          <button 
            onClick={onOpenUserManagement}
            className="p-1.5 sm:p-2 hover:bg-purple-600 rounded-lg bg-[#23293a] border border-[#343c4e]"
            title="Paramètres (Admin uniquement)"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <div className="flex items-center">
            <User className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-blue-400" />
            {username && <span className="text-xs sm:text-sm">{username}</span>}
            {!username && <span className="text-xs sm:text-sm text-gray-400">Utilisateur</span>}
          </div>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="ml-1 sm:ml-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs py-1 px-2 sm:px-3 rounded shadow flex items-center"
              title="Déconnexion"
            >
              <span className="hidden xs:inline mr-1">Déconnexion</span>
              <LogOut className="xs:hidden w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;