import React, { useEffect, useState } from 'react';
import { 
  User as UserIcon,
  HardDrive,
  X
} from 'lucide-react';
import { User } from '../types';
import { formatSize } from '../utils/formatters';
import { getAuthToken } from '../utils/auth';

// Utilisation du type User importé depuis types/index.ts

interface SidebarProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
  users: User[];
  // currentUser a été supprimé car il n'est pas utilisé
}

interface UserStorageStats {
  id: string;
  username: string;
  totalSize: number;
  formattedSize: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPath, setCurrentPath, users }) => {
  // État pour déterminer si nous sommes sur mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // Détecter si nous sommes sur mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px est le breakpoint md de Tailwind
    };
    
    // Vérifier au chargement
    checkIfMobile();
    
    // Vérifier au redimensionnement
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  // Gestion des statistiques d'utilisation par utilisateur
  const [userStats, setUserStats] = useState<UserStorageStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Récupérer les statistiques d'utilisation par utilisateur
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        setIsLoading(true);
        const token = getAuthToken();
        const response = await fetch('/api/stats/user-storage', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.stats) {
            setUserStats(data.stats);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserStats();
  }, []);
  
  // Fonction pour obtenir les statistiques d'un utilisateur
  const getUserStats = (username: string) => {
    return userStats.find(stat => stat.username === username);
  };
  
  // Calculer la taille totale de tous les utilisateurs
  const getTotalSize = () => {
    const total = userStats.reduce((acc, stat) => acc + stat.totalSize, 0);
    return formatSize(total);
  };
  // Le composant MenuItem a été remplacé par des boutons inline pour pouvoir afficher les statistiques

  return (
    <div className={`w-64 bg-[#23293a]/80 backdrop-blur-md border-r border-[#343c4e] min-h-screen overflow-y-auto flex-shrink-0 ${isMobile ? 'pt-14' : ''}`}>
      {isMobile && (
        <div className="absolute top-0 right-0 p-2">
          <button 
            onClick={() => setCurrentPath(currentPath)} // Astuce pour fermer le drawer en réutilisant la prop setCurrentPath
            className="p-2 rounded-full hover:bg-[#343c4e] focus:outline-none"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      )}
      <div className="p-4 space-y-6">
        {/* Users Section */}
        <div>
          <div className="space-y-1">

            <button
              onClick={() => setCurrentPath('/stats')}
              className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                currentPath === '/stats' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-r-2 border-purple-500 shadow' 
                  : 'text-gray-300 hover:bg-[#343c4e]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <HardDrive className="w-4 h-4" />
                <span className="font-medium">Stats</span>
              </div>
              {/* Pas d'affichage de taille pour la route spéciale Stats */}
            </button>
            {users
              .filter(user => user.username !== 'admin') // Filtrer l'utilisateur admin
              .map((user) => (
                <button
                  key={user.id}
                  onClick={() => setCurrentPath(`/${user.username}`)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                    currentPath === `/${user.username}` 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-r-2 border-purple-500 shadow' 
                      : 'text-gray-300 hover:bg-[#343c4e]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <UserIcon className="w-4 h-4" />
                    <span className="font-medium">{user.username}</span>
                  </div>
                  <div className="flex items-center text-xs text-gray-400">
                    <HardDrive className="w-3 h-3 mr-1" />
                    <span>
                      {isLoading ? '...' : 
                        (getUserStats(user.username)?.formattedSize || '0 B')}
                    </span>
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;