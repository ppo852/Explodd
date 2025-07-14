import React, { useState, useEffect } from 'react';
import { 
  Files, 

  FileText, 
  Image,
  Video,
  Music,
  Folder
} from 'lucide-react';

interface NavigationBarProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ 
  currentPath, 
  setCurrentPath, 
  filterType, 
  setFilterType 
}) => {
  // État pour déterminer si nous sommes sur mobile
  const [isMobile, setIsMobile] = useState(false);
  
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
  // Le tableau navigationItems est vide car le bouton "Tous les fichiers" a été supprimé
  const navigationItems: { icon: any, label: string, path: string, filter: string }[] = [];

  const filterItems = [
    { icon: Files, label: 'Tous', filter: 'all' },
    { icon: Folder, label: 'Dossiers', filter: 'folder' },
    { icon: Image, label: 'Images', filter: 'image' },
    { icon: Video, label: 'Vidéos', filter: 'video' },
    { icon: Music, label: 'Musique', filter: 'audio' },
    { icon: FileText, label: 'Documents', filter: 'document' },
  ];

  const NavItem = ({ icon: Icon, label, path, filter, isActive }: { 
    icon: any, 
    label: string, 
    path?: string, 
    filter: string, 
    isActive: boolean 
  }) => (
    <button
      onClick={() => {
        if (path) setCurrentPath(path);
        setFilterType(filter);
      }}
      className={`flex items-center ${isMobile ? 'px-2 py-1.5' : 'px-3 py-2'} text-sm rounded-lg transition-colors font-medium ${
        isActive
          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow' 
          : 'text-gray-300 hover:bg-[#343c4e]'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className={isMobile ? 'hidden sm:inline ml-2' : 'ml-2'}>{label}</span>
    </button>
  );

  return (
    <div className="bg-[#23293a]/80 backdrop-blur-md border-b border-[#343c4e] px-2 sm:px-6 py-2 sm:py-3">
      <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
        {/* Navigation Items */}
        {navigationItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            filter={item.filter}
            isActive={currentPath === item.path}
          />
        ))}
        
        <div className="w-px h-6 bg-[#343c4e] mx-2" />
        
        {/* Filter Items */}
        {filterItems.map((item) => (
          <NavItem
            key={item.filter}
            icon={item.icon}
            label={item.label}
            filter={item.filter}
            isActive={filterType === item.filter}
          />
        ))}
      </div>
    </div>
  );
};

export default NavigationBar;