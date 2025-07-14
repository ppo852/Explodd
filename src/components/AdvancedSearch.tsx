import React, { useState } from 'react';
import { Search, Filter, Calendar, FileType, Image, Video, Music, FileText, Archive, X } from 'lucide-react';

interface SearchFilters {
  fileType: string;
  dateRange: string;
  sizeRange: string;
  extension: string;
  tags: string[];
}

interface AdvancedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, filters: SearchFilters) => void;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ isOpen, onClose, onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    fileType: 'all',
    dateRange: 'all',
    sizeRange: 'all',
    extension: '',
    tags: []
  });

  const fileTypes = [
    { value: 'all', label: 'Tous les fichiers', icon: FileText },
    { value: 'image', label: 'Images', icon: Image },
    { value: 'video', label: 'Vidéos', icon: Video },
    { value: 'audio', label: 'Musique', icon: Music },
    { value: 'document', label: 'Documents', icon: FileText },
    { value: 'archive', label: 'Archives', icon: Archive },
    { value: 'folder', label: 'Dossiers', icon: FileText }
  ];

  const dateRanges = [
    { value: 'all', label: 'Toutes les dates' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'year', label: 'Cette année' }
  ];

  const sizeRanges = [
    { value: 'all', label: 'Toutes les tailles' },
    { value: 'small', label: 'Petit (< 1 MB)' },
    { value: 'medium', label: 'Moyen (1-10 MB)' },
    { value: 'large', label: 'Grand (10-100 MB)' },
    { value: 'xlarge', label: 'Très grand (> 100 MB)' }
  ];

  const commonExtensions = [
    'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'mp4', 'mp3', 'zip', 'rar'
  ];

  const handleSearch = () => {
    onSearch(searchQuery, filters);
    onClose();
  };

  const addTag = (tag: string) => {
    if (tag && !filters.tags.includes(tag)) {
      setFilters({ ...filters, tags: [...filters.tags, tag] });
    }
  };

  const removeTag = (tag: string) => {
    setFilters({ ...filters, tags: filters.tags.filter(t => t !== tag) });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Recherche Avancée</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Search Query */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Rechercher</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom du fichier, contenu, tags..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* File Type Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Type de fichier</label>
            <div className="grid grid-cols-2 gap-2">
              {fileTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setFilters({ ...filters, fileType: type.value })}
                    className={`flex items-center space-x-2 p-3 rounded-lg border text-left ${
                      filters.fileType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Date de modification</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {dateRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Size Range */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Taille du fichier</label>
            <select
              value={filters.sizeRange}
              onChange={(e) => setFilters({ ...filters, sizeRange: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sizeRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Extension Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Extension</label>
            <input
              type="text"
              value={filters.extension}
              onChange={(e) => setFilters({ ...filters, extension: e.target.value })}
              placeholder="ex: jpg, pdf, doc..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {commonExtensions.map((ext) => (
                <button
                  key={ext}
                  onClick={() => setFilters({ ...filters, extension: ext })}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {ext}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                >
                  <span>{tag}</span>
                  <button onClick={() => removeTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Ajouter un tag..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addTag(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Rechercher
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearch;