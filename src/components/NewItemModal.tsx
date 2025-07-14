import React, { useState } from 'react';
import { X, Folder, File } from 'lucide-react';

interface NewItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onCreateFolder: (path: string, name: string) => Promise<void>;
  onCreateFile: (path: string, name: string) => Promise<void>;
}

const NewItemModal: React.FC<NewItemModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  onCreateFolder,
  onCreateFile
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'folder' | 'file'>('folder');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Le nom ne peut pas être vide');
      return;
    }

    // Vérifier si le nom contient des caractères invalides
    const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/;
    if (invalidChars.test(name)) {
      setError('Le nom contient des caractères non autorisés');
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      if (type === 'folder') {
        await onCreateFolder(currentPath, name);
      } else {
        await onCreateFile(currentPath, name);
      }
      
      // Réinitialiser et fermer la modale
      setName('');
      setType('folder');
      onClose();
    } catch (err) {
      console.error('Erreur lors de la création:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Créer un nouvel élément</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Type</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setType('folder')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                  type === 'folder' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Folder className="w-5 h-5" />
                <span>Dossier</span>
              </button>
              <button
                type="button"
                onClick={() => setType('file')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                  type === 'file' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <File className="w-5 h-5" />
                <span>Fichier</span>
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="name" className="block text-gray-700 mb-2">
              Nom
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={type === 'folder' ? 'Nom du dossier' : 'Nom du fichier'}
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={isCreating}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              disabled={isCreating}
            >
              {isCreating ? 'Création en cours...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewItemModal;
