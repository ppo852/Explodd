import { useState, useEffect } from 'react';
import { FileItem } from '../types';
import { fetchWithInterceptor } from '../utils/apiInterceptor';

// API URL configuration - can be moved to a config file
const API_URL = '/api';

// Types pour la pagination et les options de filtrage
interface PaginationOptions {
  page: number;
  limit: number;
}

interface SortOptions {
  sortBy: 'name' | 'modified' | 'size';
  sortOrder: 'asc' | 'desc';
}

interface FilterOptions {
  search: string;
  type: 'all' | 'folder' | 'image' | 'video' | 'audio' | 'document';
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'year';
  sizeRange?: 'all' | 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  extension?: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// L'intercepteur API gère maintenant l'authentification

export const useFiles = (
  currentPath: string | null,
  paginationOptions: PaginationOptions = { page: 1, limit: 100 },
  sortOptions: SortOptions = { sortBy: 'name', sortOrder: 'asc' },
  filterOptions: FilterOptions = { search: '', type: 'all' }
) => {
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 100, totalPages: 0 });
  const [refreshCounter, setRefreshCounter] = useState(0); // Compteur pour forcer le rafraîchissement

  useEffect(() => {
    
    // Si currentPath est null, ne pas charger les fichiers
    if (currentPath === null) {
      setFiles([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Fetch files from the backend API
    const fetchFiles = async () => {
      try {
        // Construire l'URL avec tous les paramètres de pagination, tri et filtrage
        const queryParams = new URLSearchParams();
        
        // Paramètre du chemin
        queryParams.append('path', currentPath);
        
        // Paramètres de pagination
        queryParams.append('page', paginationOptions.page.toString());
        queryParams.append('limit', paginationOptions.limit.toString());
        
        // Paramètres de tri
        queryParams.append('sortBy', sortOptions.sortBy);
        queryParams.append('sortOrder', sortOptions.sortOrder);
        
        // Paramètres de filtrage
        if (filterOptions.search) {
          queryParams.append('search', filterOptions.search);
        }
        if (filterOptions.type !== 'all') {
          queryParams.append('type', filterOptions.type);
        }
        
        // Paramètres de recherche avancée
        if (filterOptions.dateRange && filterOptions.dateRange !== 'all') {
          queryParams.append('dateRange', filterOptions.dateRange);
        }
        if (filterOptions.sizeRange && filterOptions.sizeRange !== 'all') {
          queryParams.append('sizeRange', filterOptions.sizeRange);
        }
        if (filterOptions.extension) {
          queryParams.append('extension', filterOptions.extension);
        }
        
        const apiUrl = `${API_URL}/files?${queryParams.toString()}`;
        
        const response = await fetchWithInterceptor(apiUrl);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch files');
        }
        
        const data = await response.json();
        
        // La structure de la réponse a changé, elle contient maintenant files et pagination
        const { files: fileData = [], pagination: paginationData } = data;
        
        // Vérifier si fileData est défini et est un tableau
        if (!Array.isArray(fileData)) {
          setError('Format de réponse invalide');
          setFiles([]);
          return;
        }
        
        // Mettre à jour les informations de pagination si disponibles
        if (paginationData) {
          setPagination(paginationData);
        }
        
        // Convert date strings to Date objects
        const processedFiles = fileData.map((file: any) => ({
          ...file,
          modified: new Date(file.modified)
        }));
        
        setFiles(processedFiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to empty array on error
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFiles();
  }, [currentPath, paginationOptions.page, paginationOptions.limit, sortOptions.sortBy, sortOptions.sortOrder, filterOptions.search, filterOptions.type, filterOptions.dateRange, filterOptions.sizeRange, filterOptions.extension, refreshCounter]);
  
  // Fonction pour changer de page
  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    paginationOptions.page = newPage;
    // Force le re-render
    setPagination({...pagination, page: newPage});
  };
  
  // Fonction pour changer le nombre d'éléments par page
  const changeLimit = (newLimit: number) => {
    paginationOptions.limit = newLimit;
    paginationOptions.page = 1; // Retour à la première page
    setPagination({...pagination, limit: newLimit, page: 1});
  };
  
  // Fonction pour changer le tri
  const changeSort = (newSortBy: SortOptions['sortBy'], newSortOrder: SortOptions['sortOrder']) => {
    sortOptions.sortBy = newSortBy;
    sortOptions.sortOrder = newSortOrder;
    // Force le re-render
    setFiles([...files]);
  };
  
  // Fonction pour filtrer les fichiers avec l'API
  const applyFilters = (
    search: string, 
    type: FilterOptions['type'] = 'all',
    dateRange: FilterOptions['dateRange'] = 'all',
    sizeRange: FilterOptions['sizeRange'] = 'all',
    extension: string = ''
  ) => {
    // Mettre à jour les options de filtrage
    filterOptions.search = search;
    filterOptions.type = type;
    filterOptions.dateRange = dateRange;
    filterOptions.sizeRange = sizeRange;
    filterOptions.extension = extension;
    
    // Retour à la première page
    paginationOptions.page = 1;
    setPagination({...pagination, page: 1});
  };

  const toggleFavorite = async (fileId: string) => {
    
    // Optimistic update in the UI
    const fileToUpdate = files.find(file => file.id === fileId);
    if (!fileToUpdate) return;
    
    const newFavoriteState = !fileToUpdate.isFavorite;
    
    // Update local state immediately for better UX
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { ...file, isFavorite: newFavoriteState }
          : file
      )
    );
    
    // In a real implementation, you would update this on the server
    // For now, we'll just log it as if it was sent to the server
    //console.log(`API call would be made to set favorite=${newFavoriteState} for file ${fileId}`);
    
    // Exemple d'appel API avec le token d'authentification
    /*
    try {
      // Récupération du token d'authentification
      const token = getAuthToken();
      
      if (!token) {
        throw new Error('Token d\'authentification non trouvé');
      }
      
      const response = await fetch(`${API_URL}/files/${fileId}/favorite`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isFavorite: newFavoriteState }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Revert the optimistic update if the API call fails
      setFiles(prevFiles => 
        prevFiles.map(file => 
          file.id === fileId 
            ? { ...file, isFavorite: fileToUpdate.isFavorite }
            : file
        )
      );
    }
    */
  };

  const filterFiles = (filterType: string, searchQuery: string) => {
    return files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filterType === 'all') return matchesSearch;
      if (filterType === 'folder') return file.type === 'folder' && matchesSearch;
      if (filterType === 'image') return file.extension && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file.extension.toLowerCase()) && matchesSearch;
      if (filterType === 'video') return file.extension && ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(file.extension.toLowerCase()) && matchesSearch;
      if (filterType === 'audio') return file.extension && ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(file.extension.toLowerCase()) && matchesSearch;
      if (filterType === 'document') return file.extension && ['txt', 'doc', 'docx', 'pdf'].includes(file.extension.toLowerCase()) && matchesSearch;
      
      return matchesSearch;
    });
  };

  const sortFiles = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    
    return [...files].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'modified':
          comparison = a.modified.getTime() - b.modified.getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  

  // Fonction pour rafraîchir la liste des fichiers
  const refreshFiles = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return { 
    files, 
    loading, 
    error, 
    pagination,
    toggleFavorite, 
    filterFiles, 
    sortFiles,
    // Nouvelles fonctions pour la pagination et le filtrage via l'API
    changePage,
    changeLimit,
    changeSort,
    applyFilters,
    refreshFiles
  };
};