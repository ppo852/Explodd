import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/auth';
import { Trash2, RefreshCw, Calendar, Key, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface SharedLink {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  isMulti: boolean;
  creatorName?: string; // Nom de l'utilisateur qui a créé le lien
}

interface UpdateLinkParams {
  linkId: string;
  expiryDays?: number;
  newPassword?: string;
}

const SharedLinksManager: React.FC = () => {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLink, setEditingLink] = useState<SharedLink | null>(null);
  const [newExpiryDays, setNewExpiryDays] = useState<number>(7);
  const [newPassword, setNewPassword] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [linkToDelete, setLinkToDelete] = useState<string>('');

  // Récupérer la liste des liens partagés
  const fetchLinks = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/share/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des liens');
      }
      
      const data = await response.json();
      setLinks(data.links || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Impossible de récupérer les liens partagés');
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir la modale de confirmation de suppression
  const openDeleteModal = (linkId: string) => {
    setLinkToDelete(linkId);
    setShowDeleteModal(true);
  };

  // Fermer la modale de confirmation de suppression
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setLinkToDelete('');
  };

  // Supprimer un lien
  const deleteLink = async (linkId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/share/delete/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression du lien');
      }
      
      toast.success('Lien supprimé avec succès');
      fetchLinks(); // Rafraîchir la liste
      closeDeleteModal();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Impossible de supprimer le lien');
      closeDeleteModal();
    }
  };

  // Confirmer la suppression du lien
  const confirmDelete = () => {
    if (linkToDelete) {
      deleteLink(linkToDelete);
    }
  };

  // Mettre à jour un lien (expiration ou mot de passe)
  const updateLink = async ({ linkId, expiryDays, newPassword }: UpdateLinkParams) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/share/update/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expiryDays,
          newPassword: newPassword || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour du lien');
      }
      
      toast.success('Lien mis à jour avec succès');
      setEditingLink(null);
      setNewPassword('');
      fetchLinks(); // Rafraîchir la liste
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Impossible de mettre à jour le lien');
    }
  };

  // Copier le lien dans le presse-papier
  const copyLink = (linkId: string) => {
    const linkUrl = `${window.location.origin}/share/${linkId}`;
    navigator.clipboard.writeText(linkUrl)
      .then(() => toast.success('Lien copié dans le presse-papier'))
      .catch(() => toast.error('Impossible de copier le lien'));
  };

  // Filtrer les liens selon les critères
  const filteredLinks = links.filter(link => {
    // Filtre par état (actif/expiré)
    if (filter === 'active' && link.isExpired) return false;
    if (filter === 'expired' && !link.isExpired) return false;
    
    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return link.fileName.toLowerCase().includes(term) || 
             link.filePath.toLowerCase().includes(term);
    }
    
    return true;
  });

  // Charger les liens au chargement du composant
  useEffect(() => {
    fetchLinks();
  }, []);

  // Formater la date relative (il y a X jours)
  const formatRelativeDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: fr });
    } catch (e) {
      return 'Date invalide';
    }
  };

  // Formater la date absolue (JJ/MM/AAAA)
  const formatAbsoluteDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch (e) {
      return 'Date invalide';
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Gestion des liens partagés</h2>
        <button 
          onClick={fetchLinks}
          className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-white mb-1">Filtrer par état</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les liens</option>
            <option value="active">Liens actifs</option>
            <option value="expired">Liens expirés</option>
          </select>
        </div>
        <div className="flex-[2] min-w-[300px]">
          <label className="block text-sm font-medium text-white mb-1">Rechercher</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom ou chemin..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-white">Chargement des liens partagés...</p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-black">
            {searchTerm || filter !== 'all' 
              ? 'Aucun lien ne correspond à vos critères de recherche.' 
              : 'Vous n\'avez pas encore créé de liens de partage.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fichier
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé par
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé le
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expire le
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  État
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLinks.map((link) => (
                <tr key={link.id} className={link.isExpired ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-start">
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[250px]">
                          {link.fileName}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[250px]">
                          {link.filePath}
                        </div>
                        {link.isMulti && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            Multiple
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{link.creatorName || 'Utilisateur inconnu'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatAbsoluteDate(link.createdAt)}</div>
                    <div className="text-xs text-gray-500">{formatRelativeDate(link.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {link.expiresAt ? (
                      <>
                        <div className="text-sm text-gray-900">{formatAbsoluteDate(link.expiresAt)}</div>
                        <div className="text-xs text-gray-500">{formatRelativeDate(link.expiresAt)}</div>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">Jamais</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {link.isExpired ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Expiré
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Actif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => copyLink(link.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Copier le lien"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => window.open(`/share/${link.id}`, '_blank')}
                        className="text-green-600 hover:text-green-900"
                        title="Ouvrir le lien"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingLink(link)}
                        className="text-amber-600 hover:text-amber-900"
                        title="Modifier l'expiration"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(link.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer le lien"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de modification d'un lien */}
      {editingLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Modifier le lien</h3>
            <p className="text-sm text-gray-600 mb-4">
              Fichier : <span className="font-medium">{editingLink.fileName}</span>
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration
              </label>
              <select
                value={newExpiryDays}
                onChange={(e) => setNewExpiryDays(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Jamais</option>
                <option value={1}>1 jour</option>
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
                <option value={90}>90 jours</option>
                <option value={365}>1 an</option>
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe (laisser vide pour ne pas changer)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe..."
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setEditingLink(null);
                  setNewPassword('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={() => updateLink({
                  linkId: editingLink.id,
                  expiryDays: newExpiryDays,
                  newPassword: newPassword || undefined
                })}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation de suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmer la suppression</h3>
            <p className="text-gray-600 mb-6">Êtes-vous sûr de vouloir supprimer ce lien de partage ?</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedLinksManager;
