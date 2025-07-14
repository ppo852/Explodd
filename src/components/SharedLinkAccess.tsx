import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Download, Folder, FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';

interface SharedLinkAccessProps {
  linkId: string;
}

interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'folder';
  modified: string;
  children?: FileInfo[];
}

const SharedLinkAccess: React.FC<SharedLinkAccessProps> = ({ linkId: propLinkId }) => {
  // Récupérer le linkId depuis l'URL
  const { linkId: urlLinkId } = useParams<{ linkId: string }>();
  
  // Utiliser le linkId de l'URL ou celui passé en prop
  const linkId = urlLinkId || propLinkId;
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAccessingFile, setIsAccessingFile] = useState(false);

  // Vérifier si un token d'accès existe déjà dans le localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(`share_access_${linkId}`);
    if (storedToken) {
      setAccessToken(storedToken);
      fetchFileInfo(storedToken);
    }
  }, [linkId]);

  const verifyPassword = async () => {
    if (!password.trim()) {
      setError('Veuillez entrer le mot de passe');
      return;
    }

    setError(null);
    setIsVerifying(true);

    try {
      const response = await fetch(`/api/share/verify/${linkId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Mot de passe incorrect');
      }

      const data = await response.json();
      setAccessToken(data.accessToken);
      
      // Stocker le token d'accès dans localStorage avec une expiration de 15 minutes
      localStorage.setItem(`share_access_${linkId}`, data.accessToken);
      setTimeout(() => {
        localStorage.removeItem(`share_access_${linkId}`);
      }, 15 * 60 * 1000); // 15 minutes
      
      fetchFileInfo(data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la vérification du mot de passe');
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchFileInfo = async (token: string) => {
    setIsAccessingFile(true);
    try {
      const response = await fetch(`/api/share/access/${token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'accès au fichier');
      }
      
      const data = await response.json();
      setFileInfo(data.fileInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'accès au fichier');
      setAccessToken(null);
      localStorage.removeItem(`share_access_${linkId}`);
    } finally {
      setIsAccessingFile(false);
    }
  };

  const handleDownload = async () => {
    if (!accessToken || !fileInfo) return;
    
    try {
      // Pour les fichiers, télécharger directement
      if (fileInfo.type === 'file') {
        window.location.href = `/api/share/download/${accessToken}`;
      } 
      // Pour les dossiers, demander une archive ZIP
      else if (fileInfo.type === 'folder') {
        setIsLoading(true);
        console.log('Téléchargement du dossier en ZIP:', fileInfo.name);
        
        // Utiliser directement window.location.href pour télécharger le ZIP
        window.location.href = `/api/share/download/${accessToken}?format=zip`;
        setIsLoading(false);
        return;
        
        // Le téléchargement se fait directement via window.location.href
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du téléchargement');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Si nous avons un token d'accès et les informations du fichier
  if (accessToken && fileInfo) {
    return (
      <div className="min-h-screen bg-[#1a202c] text-gray-200">
        {/* En-tête avec logo et titre */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm mr-4">
                  {fileInfo.type === 'folder' ? (
                    <Folder className="w-6 h-6 text-white" />
                  ) : (
                    <FileText className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{fileInfo.name}</h1>
                  <p className="text-white/80 text-sm">
                    {fileInfo.type === 'folder' ? 'Dossier' : 'Fichier'} • {fileInfo.type === 'file' && formatFileSize(fileInfo.size)}
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleDownload}
                disabled={isLoading}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors backdrop-blur-sm disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                <span className="ml-2">{isLoading ? 'Téléchargement...' : 'Télécharger'}</span>
              </button>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="max-w-6xl mx-auto mt-4 px-6">
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        
        <div className="max-w-6xl mx-auto p-6">
          {fileInfo.type === 'folder' && fileInfo.children && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-200">Contenu du dossier</h2>
                <div className="text-sm text-gray-400">{fileInfo.children.length} élément(s)</div>
              </div>
              
              <div className="border border-[#343c4e] rounded-lg overflow-hidden bg-[#23293a] shadow-lg">
                <table className="min-w-full divide-y divide-[#343c4e]">
                  <thead className="bg-[#2a3142]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Taille</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Modifié</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#343c4e]">
                    {fileInfo.children.map((item, index) => (
                      <tr key={index} className="hover:bg-[#2a3142] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {item.type === 'folder' ? (
                              <Folder className="w-5 h-5 text-blue-400 mr-2" />
                            ) : (
                              <FileText className="w-5 h-5 text-purple-400 mr-2" />
                            )}
                            <span className="text-sm text-gray-200">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {item.type === 'folder' ? 'Dossier' : 'Fichier'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {item.type === 'file' ? formatFileSize(item.size) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {formatDate(item.modified)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sinon, afficher le formulaire de saisie du mot de passe
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a202c] p-4">
      <div className="max-w-md w-full bg-[#23293a] rounded-lg shadow-xl border border-[#343c4e] overflow-hidden">
        {/* En-tête avec logo et titre */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-center text-white">Accès protégé par mot de passe</h1>
          <p className="text-white/80 text-center mt-2 text-sm">
            Ce contenu est protégé. Veuillez saisir le mot de passe pour y accéder.
          </p>
        </div>
        
        {/* Formulaire */}
        <div className="p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Entrez le mot de passe"
              className="w-full border border-[#343c4e] bg-[#1a202c] text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
            />
          </div>

          <button
            onClick={verifyPassword}
            disabled={isVerifying || isAccessingFile}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center transition-all duration-200"
          >
            {isVerifying ? 'Vérification...' : isAccessingFile ? 'Accès en cours...' : 'Accéder au contenu'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharedLinkAccess;
