import React, { useState, useEffect } from 'react';
import {  
  Folder, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive,
  File,
  Link,
  UserPlus,
  Camera,
  FolderOpen,
  Share2,
  Check,
  Edit3,
  Trash2,
  MoveIcon,
  Download
} from 'lucide-react';
import { FileItem } from '../types';

interface FileGridProps {
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
  viewMode?: 'grid' | 'list';
  selectedFiles?: string[];
  setSelectedFiles?: (fileIds: string[]) => void;
  onShareFile?: (fileName: string, filePath: string) => void;
  onToggleFavorite?: (fileId: string) => Promise<void>;
  onRenameFile?: (fileName: string, filePath: string) => void;
  onDeleteFile?: (fileName: string, filePath: string) => void;
  onMoveFile?: (fileName: string, filePath: string) => void;
  onDownloadFile?: (fileName: string, filePath: string) => void;
}

const FileGrid: React.FC<FileGridProps> = ({ 
  files, 
  onFileClick, 
  viewMode, 
  selectedFiles, 
  setSelectedFiles,
  onShareFile,
  onRenameFile,
  onDeleteFile,
  onMoveFile,
  onDownloadFile
}) => {
  // État pour déterminer si nous sommes sur mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // État pour gérer l'appui long sur mobile
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [longPressFileId, setLongPressFileId] = useState<string | null>(null);
  
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
  
  // Fonction pour basculer la sélection d'un fichier
  const toggleFileSelection = (fileId: string) => {
    if (!setSelectedFiles || !selectedFiles) return;
    
    if (selectedFiles.includes(fileId)) {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    } else {
      setSelectedFiles([...selectedFiles, fileId]);
    }
  };
  
  // Gérer l'appui long sur mobile
  const handleTouchStart = (fileId: string) => {
    if (!isMobile) return;
    
    // Démarrer un timer pour détecter l'appui long
    const timer = setTimeout(() => {
      toggleFileSelection(fileId);
      // Vibrer pour donner un retour tactile (si disponible)
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }, 500); // 500ms pour considérer comme un appui long
    
    setLongPressTimer(timer);
    setLongPressFileId(fileId);
  };
  
  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressFileId(null);
  };
  
  const handleTouchMove = () => {
    // Annuler l'appui long si l'utilisateur déplace son doigt
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressFileId(null);
  };
  
  // Fonction pour gérer le clic sur un fichier/dossier
  const handleClick = (file: FileItem) => {
    // Sur mobile, le clic simple navigue dans les dossiers mais ne sélectionne pas les fichiers
    // La sélection se fait via le bouton dédié ou l'appui long
    if (file.type === 'folder') {
      // Si c'est un dossier, on navigue vers ce dossier
      onFileClick(file);
    } else if (!isMobile) {
      // Sur desktop, on sélectionne/désélectionne le fichier au clic
      toggleFileSelection(file.id);
    }
  };
  
  // Fonction pour sélectionner explicitement un fichier (pour le bouton de sélection sur mobile)
  const handleSelectButtonClick = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation(); // Empêcher la propagation pour éviter de déclencher handleClick
    toggleFileSelection(fileId);
  };
  
  // Fonction pour gérer le double-clic sur un fichier/dossier
  const handleDoubleClick = (file: FileItem) => {
    onFileClick(file);
  };
  
  // La fonction handleFileSelect a été supprimée car elle n'est plus utilisée
  // La sélection se fait maintenant directement dans les gestionnaires d'événements des cases à cocher

  // La fonction handleContextMenu a été supprimée car elle n'est plus utilisée
  // suite à la suppression des boutons de menu contextuel

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') {
      // Special folder icons based on name
      if (file.name.toLowerCase().includes('camera')) return Camera;
      if (file.name.toLowerCase().includes('photo')) return Image;
      if (file.name.toLowerCase().includes('link')) return Link;
      if (file.name.toLowerCase().includes('change') || file.name.toLowerCase().includes('process')) return UserPlus;
      return Folder;
    }
    
    if (file.extension) {
      const ext = file.extension.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return Image;
      if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) return Video;
      if (['mp3', 'wav', 'flac', 'ogg'].includes(ext)) return Music;
      if (['zip', 'rar', '7z', 'tar'].includes(ext)) return Archive;
      if (['txt', 'doc', 'docx', 'pdf'].includes(ext)) return FileText;
    }
    
    return File;
  };

  const getFileColor = (file: FileItem) => {
    if (file.type === 'folder') return 'bg-blue-500';
    if (file.extension) {
      const ext = file.extension.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'bg-green-500';
      if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) return 'bg-red-500';
      if (['mp3', 'wav', 'flac', 'ogg'].includes(ext)) return 'bg-purple-500';
      if (['zip', 'rar', '7z', 'tar'].includes(ext)) return 'bg-orange-500';
      if (['txt', 'doc', 'docx', 'pdf'].includes(ext)) return 'bg-blue-600';
    }
    return 'bg-gray-500';
  };

  const formatDate = (date: Date) => {
    // Format jour/mois/année plus heure
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Les mois commencent à 0
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '';
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    // Pour les petits fichiers, ne pas afficher de décimales
    if (i === 0) {
      return `${bytes} ${sizes[i]}`;
    }
    
    // Pour les fichiers plus grands, afficher une décimale
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Forcer le mode liste sur mobile pour une meilleure expérience utilisateur
  const effectiveViewMode = isMobile ? 'list' : (viewMode || 'grid');
  
  // Utiliser la valeur par défaut 'grid' si viewMode n'est pas défini
  if (effectiveViewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-1 sm:gap-2 md:gap-4 p-1 sm:p-2 md:p-4 border-b border-gray-200 text-xs sm:text-sm font-medium text-gray-500">
          <div className="col-span-1"></div>
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2">Actions</div>
        </div>
        {files.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>Ce dossier est vide</p>
          </div>
        ) : (
          files.map((file) => {
            const Icon = getFileIcon(file);
            const isSelected = selectedFiles ? selectedFiles.includes(file.id) : false;
            return (
              <div 
                key={file.id}
                onClick={() => handleClick(file)}
                onDoubleClick={() => handleDoubleClick(file)}
                onTouchStart={() => handleTouchStart(file.id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                className={`grid grid-cols-12 gap-2 sm:gap-4 p-2 sm:p-4 hover:bg-gray-50 border-b border-gray-100 cursor-pointer ${selectedFiles && selectedFiles.includes(file.id) ? 'bg-blue-50' : ''} ${longPressFileId === file.id ? 'bg-gray-100' : ''}`}
              >
                <div className="col-span-1 flex items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Inverser directement la sélection au clic
                      if (!setSelectedFiles || !selectedFiles) return;
                      
                      if (isSelected) {
                        // Désélectionner
                        setSelectedFiles(selectedFiles.filter(id => id !== file.id));
                      } else {
                        // Sélectionner
                        setSelectedFiles([...selectedFiles, file.id]);
                      }
                    }}
                    className={`w-6 h-6 mr-2 flex items-center justify-center border rounded ${isSelected ? 'bg-blue-500 text-white' : 'bg-white'}`}
                  >
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getFileColor(file)}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="col-span-5 flex items-center">
                  <span className="text-sm font-medium text-gray-900">{file.name}</span>
                </div>
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-gray-500">{formatSize(file.size)}</span>
                </div>
                <div className="col-span-2 flex items-center">
                  <span className="text-xs sm:text-sm text-gray-500">{formatDate(file.modified)}</span>
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  {/* Bouton Renommer */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRenameFile) onRenameFile(file.name, file.path);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Renommer"
                  >
                    <Edit3 className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {/* Bouton Supprimer */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteFile) onDeleteFile(file.name, file.path);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {/* Bouton Déplacer */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMoveFile) onMoveFile(file.name, file.path);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Déplacer"
                  >
                    <MoveIcon className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {/* Bouton Télécharger */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDownloadFile) onDownloadFile(file.name, file.path);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Télécharger"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {/* Bouton Partager */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onShareFile) onShareFile(file.name, file.path);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Partager"
                  >
                    <Share2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  } else {
    return (
      <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
        {files.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>Dossier vide</p>
          </div>
        ) : (
          files.map((file) => {
            const Icon = getFileIcon(file);
            const isSelected = selectedFiles?.includes(file.id) || false;
            return (
              <div
                key={file.id}
                className={`bg-white rounded-lg p-2 sm:p-4 hover:shadow-md transition-shadow cursor-pointer group relative ${isSelected ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
                onClick={() => handleClick(file)}
                onDoubleClick={() => handleDoubleClick(file)}
              >
                {setSelectedFiles && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (!setSelectedFiles || !selectedFiles) return;
                      
                      if (e.target.checked) {
                        // Ajouter à la sélection
                        if (!selectedFiles.includes(file.id)) {
                          setSelectedFiles([...selectedFiles, file.id]);
                        }
                      } else {
                        // Retirer de la sélection
                        setSelectedFiles(selectedFiles.filter(id => id !== file.id));
                      }
                    }}
                    className="absolute top-2 left-2 rounded cursor-pointer z-10"
                  />
                )}
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className={"w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center " + getFileColor(file)}>
                      <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    {isMobile && file.type !== 'folder' && selectedFiles && (
                      <button 
                        onClick={(e) => handleSelectButtonClick(e, file.id)}
                        className={`absolute -bottom-1 -right-1 rounded-full w-6 h-6 flex items-center justify-center ${selectedFiles.includes(file.id) ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                        <div className={`w-3 h-3 rounded-sm ${selectedFiles.includes(file.id) ? 'bg-white' : 'bg-gray-100'}`}></div>
                      </button>
                    )}
                  </div>
                  
                  <div className="text-center w-full">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-900 truncate">{file.name}</h3>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                      {file.type === 'file' && formatSize(file.size)}
                      {file.type === 'file' && ' • '}
                      {formatDate(file.modified)}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Bouton Renommer */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRenameFile) onRenameFile(file.name, file.path);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Renommer"
                    >
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    {/* Bouton Supprimer */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteFile) onDeleteFile(file.name, file.path);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    {/* Bouton Déplacer */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onMoveFile) onMoveFile(file.name, file.path);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Déplacer"
                    >
                      <MoveIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    {/* Bouton Télécharger */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDownloadFile) onDownloadFile(file.name, file.path);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Télécharger"
                    >
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    {/* Bouton Partager */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onShareFile) onShareFile(file.name, file.path);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Partager"
                    >
                      <Share2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }
};

export default FileGrid;