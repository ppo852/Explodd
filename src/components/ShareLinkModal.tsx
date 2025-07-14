import React, { useState } from 'react';
import { X, Link, QrCode, Copy, Calendar, Lock, AlertCircle } from 'lucide-react';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  filePath: string;
}

const ShareLinkModal: React.FC<ShareLinkModalProps> = ({ isOpen, onClose, fileName, filePath }) => {
  // Déboguer les props reçues
  
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [shareLink, setShareLink] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const generateLink = async () => {
    // Valider que le mot de passe est présent
    if (!password.trim()) {
      setPasswordError('Le mot de passe est obligatoire');
      return;
    }
    
    // Déboguer les valeurs
    console.log('Création de lien pour:', { fileName, filePath, password, expiryDays });
    
    // S'assurer que le chemin du fichier est valide
    if (!filePath) {
      setError('Chemin du fichier manquant');
      return;
    }
    
    // Normaliser le chemin du fichier pour s'assurer qu'il est au format attendu par le serveur
    // Conserver le format original pour les chemins Windows absolus (commençant par X:\)
    const isWindowsAbsolutePath = /^[a-zA-Z]:\\/.test(filePath);
    
    // Si c'est un chemin Windows absolu, le laisser tel quel
    // Sinon, convertir tous les backslashes en forward slashes pour les chemins virtuels
    const normalizedFilePath = isWindowsAbsolutePath ? filePath : filePath.replace(/\\/g, '/');
    
    setPasswordError(null);
    setError(null);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/share/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('authData') || '{}').token}`
        },
        body: JSON.stringify({
          filePath: normalizedFilePath,
          password,
          expiryDays
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du lien');
      }
      
      const data = await response.json();
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/share/${data.linkId}`;
      setShareLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du lien');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    // TODO: Afficher une notification de succès
  };

  const generateQRCode = () => {
    // Simulation d'un QR code - en production, utiliser une vraie librairie QR
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#23293a] rounded-lg w-full max-w-md border border-[#343c4e] shadow-xl text-gray-200">
        {/* En-tête avec dégradé */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-5 flex items-center justify-between">
          <div className="flex items-center">
            <Link className="w-5 h-5 text-white mr-2" />
            <h2 className="text-xl font-semibold text-white">Partager par lien</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm text-gray-400 mb-2">Fichier à partager:</p>
            <p className="font-medium text-gray-200">{fileName}</p>
          </div>

          {/* Password Protection */}
          <div>
            <label className="flex items-center space-x-2 mb-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-300">Protection par mot de passe</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (e.target.value.trim()) setPasswordError(null);
              }}
              placeholder="Mot de passe requis"
              className="w-full border border-[#343c4e] bg-[#1a202c] text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            {passwordError && (
              <p className="text-red-400 text-xs mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                {passwordError}
              </p>
            )}
          </div>

          {/* Expiry Date */}
          <div>
            <label className="flex items-center space-x-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-gray-300">Durée de validité</span>
            </label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="w-full border border-[#343c4e] bg-[#1a202c] text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>1 jour</option>
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={0}>Pas d'expiration</option>
            </select>
          </div>

          {/* Generate Link Button */}
          {!shareLink && (
            <button
              onClick={generateLink}
              disabled={isLoading}
              className={`w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all duration-200`}
            >
              <Link className="w-4 h-4" />
              <span className="ml-2">{isLoading ? 'Génération en cours...' : 'Générer le lien'}</span>
            </button>
          )}
          
          {/* Error message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Share Link Display */}
          {shareLink && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Lien de partage</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 border border-[#343c4e] bg-[#1a202c] text-gray-200 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={copyToClipboard}
                    title="Copier le lien"
                    className="p-2 bg-[#343c4e] hover:bg-[#3a4358] text-gray-200 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* QR Code */}
              <div className="text-center">
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="flex items-center space-x-2 mx-auto text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{showQR ? 'Masquer' : 'Afficher'} le QR Code</span>
                </button>
                
                {showQR && (
                  <div className="mt-4 p-4 bg-white rounded-lg inline-block">
                    <img
                      src={generateQRCode()}
                      alt="QR Code"
                      className="mx-auto"
                      width="150"
                      height="150"
                    />
                  </div>
                )}
              </div>

              {/* Link Info */}
              <div className="mt-2 p-3 bg-[#1a202c]/50 rounded-lg border border-[#343c4e]">
                <div className="text-sm text-gray-300 space-y-2">
                  {password && (
                    <div className="flex items-center">
                      <Lock className="w-4 h-4 text-purple-400 mr-2" />
                      <span>Protégé par mot de passe</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-blue-400 mr-2" />
                    <span>Expire dans {expiryDays > 0 ? `${expiryDays} jour(s)` : 'jamais'}</span>
                  </div>
                </div>
              </div>
              
              {/* Bouton pour générer un nouveau lien */}
              <button
                onClick={() => {
                  setShareLink(''); // Réinitialiser le lien actuel
                  setShowQR(false); // Masquer le QR code
                }}
                className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white py-2 rounded-lg flex items-center justify-center transition-all duration-200 mt-2"
              >
                <Link className="w-4 h-4 mr-2" />
                <span>Générer un nouveau lien</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end p-5 border-t border-[#343c4e] bg-[#1a202c]/30">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-400 hover:bg-[#343c4e] rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareLinkModal;