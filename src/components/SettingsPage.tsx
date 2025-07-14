import React, { useState, useEffect } from 'react';
import { Link2, Settings as SettingsIcon, User as UserIcon, X, Plus, Edit, Trash2, Folder, Key } from 'lucide-react';
import SharedLinksManager from './SharedLinksManager';
import { toast } from 'react-hot-toast';
import { getAuthToken } from '../utils/auth';
import { User } from '../types';

type TabType = 'links' | 'account';

interface SettingsPageProps {
  onClose: () => void;
  currentUser?: User | null;
}

interface UserType {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  homePath: string;
  customPath: string; // Ajout du champ pour le chemin personnalisé
  password: string; // Pour la création d'utilisateur
  permissions: string[];
  canRename?: boolean;
  canDelete?: boolean;
  canMove?: boolean;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>('links');
  const [users, setUsers] = useState<UserType[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState<UserType | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // Initialisation avec des valeurs par défaut pour éviter les erreurs de typage
  // Toutes les permissions sont activées par défaut, l'admin pourra les décocher si nécessaire
  const [newUser, setNewUser] = useState<Partial<User>>({
    username: '',
    password: '',
    role: 'user',
    homePath: '',
    customPath: '',
    permissions: ['read', 'write', 'share', 'rename', 'delete', 'move']
  });
  
  // État pour gérer les messages d'erreur
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Récupérer les utilisateurs depuis le backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Erreur lors de la récupération des utilisateurs');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error('Erreur lors de la récupération des utilisateurs:', err);
        setUsers([]);
      }
    };
    
    fetchUsers();
  }, []);
  
  const togglePermission = (permission: string) => {
    const permissions = [...(newUser.permissions || ['read'])];
    const index = permissions.indexOf(permission);
    if (index === -1) {
      permissions.push(permission);
    } else {
      permissions.splice(index, 1);
    }
    setNewUser({ ...newUser, permissions });
  };

  const handleAddUser = async () => {
    try {
      // Réinitialiser le message d'erreur
      setErrorMessage('');
      
      // Vérifier que les champs obligatoires sont remplis
      if (!newUser.username || !newUser.password) {
        setErrorMessage('Nom d\'utilisateur et mot de passe obligatoires');
        return;
      }
      
      // Vérifier que le chemin personnalisé est fourni pour tous les utilisateurs créés manuellement
      if (!newUser.customPath) {
        setErrorMessage('Chemin personnalisé obligatoire pour tous les utilisateurs créés manuellement');
        return;
      }
      
      const token = getAuthToken();
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          customPath: newUser.customPath, // Ajout du chemin personnalisé
          permissions: newUser.permissions
        })
      });
      
      if (!res.ok) {
        // Essayer de récupérer le message d'erreur du serveur
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Erreur lors de la création de l\'utilisateur');
      }
      
      const created = await res.json();
      // Utiliser le chemin personnalisé réel pour l'affichage
      console.log(`Utilisateur créé avec succès. Chemin personnalisé: ${created.customPath}`);
      
      setUsers([...users, {
        ...created,
        // Afficher le chemin personnalisé réel dans l'interface utilisateur
        homePath: created.customPath,
        customPath: created.customPath,
        permissions: created.permissions || ['read']
      }]);
      
      setNewUser({
        username: '',
        password: '',
        role: 'user',
        homePath: '',
        customPath: '', // Réinitialiser le chemin personnalisé
        permissions: ['read', 'write', 'share', 'rename', 'delete', 'move'] // Toutes les permissions activées par défaut
      });
      
      setShowAddUser(false);
    } catch (err) {
      // Afficher l'erreur dans le modal au lieu d'utiliser alert()
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors de la création');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordChangeUser) return;
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/users/${passwordChangeUser.id}/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (!res.ok) throw new Error('Erreur lors de la modification du mot de passe');
      
      toast.success('Mot de passe modifié avec succès');
      
      // Attendre un court instant avant de fermer le modal
      setTimeout(() => {
        setPasswordChangeUser(null);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
      }, 1000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erreur lors de la modification du mot de passe');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: editingUser.username,
          role: editingUser.role,
          permissions: editingUser.permissions || [],
          customPath: editingUser.customPath || editingUser.homePath // Utiliser le chemin personnalisé réel
        })
      });
      
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      
      setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
      toast.success('Utilisateur mis à jour avec succès');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    }
  };
  return (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
    <div className="w-full max-w-lg sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[90vh] bg-[#23293a]/95 border border-[#343c4e] shadow-2xl flex flex-col rounded-none md:rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center border-b p-4">
        <h2 className="text-xl font-semibold flex items-center text-white">
          <SettingsIcon className="w-5 h-5 mr-2" />
          Paramètres
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-[#343c4e] rounded">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
      {/* Content */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <div className="flex md:flex-col flex-row md:w-56 w-full flex-shrink-0 md:border-r border-b md:border-b-0 border-[#343c4e] bg-[#23293a]/80 backdrop-blur-lg p-2 md:p-4">
          <nav className="flex flex-row md:flex-col w-full gap-2 md:gap-0">
            <button
              onClick={() => setActiveTab('links')}
              className={`flex items-center justify-center md:justify-start space-x-2 md:space-x-3 w-full px-2 md:px-3 py-2 rounded-lg text-sm md:text-base ${
                activeTab === 'links' ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow' : 'text-gray-300 hover:bg-[#343c4e]'
              }`}
            >
              <Link2 className="w-5 h-5" />
              <span>Liens partagés</span>
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center justify-center md:justify-start space-x-2 md:space-x-3 w-full px-2 md:px-3 py-2 rounded-lg text-sm md:text-base ${
                activeTab === 'account' ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow' : 'text-gray-300 hover:bg-[#343c4e]'
              }`}
            >
              <UserIcon className="w-5 h-5" />
              <span>Compte utilisateur</span>
            </button>
          </nav>
        </div>
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-auto p-2 md:p-6">
          {activeTab === 'links' && <SharedLinksManager />}
          {activeTab === 'account' && (
            <div className="p-0 md:p-6 overflow-y-auto max-h-[calc(80vh-120px)] w-full">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-white">Gestion des utilisateurs</h3>
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 md:px-4 py-2 rounded-lg shadow hover:from-blue-600 hover:to-purple-700 w-full md:w-auto text-sm md:text-base"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter Utilisateur</span>
                  </button>
                </div>

                {showAddUser && (
                  <div className="bg-[#23293a]/80 border border-[#343c4e] p-2 md:p-4 rounded-lg md:rounded-xl shadow-lg mb-4 md:mb-6 w-full">
                    <h4 className="font-medium mb-4 text-white">Nouvel Utilisateur</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-white">Nom d'utilisateur</label>
                        <input
                          type="text"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1 text-white">Mot de passe</label>
                        <input
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-white">Rôle</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                          <option value="user">Utilisateur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1 text-white">Chemin personnalisé (obligatoire)</label>
                        <input
                          type="text"
                          value={newUser.customPath}
                          onChange={(e) => setNewUser({ ...newUser, customPath: e.target.value })}
                          placeholder={'C:\\Chemin\\vers\\dossier\\utilisateur'}
                          className={`w-full border ${!newUser.customPath ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2`}
                        />
                        {!newUser.customPath && (
                          <p className="text-xs text-red-500 mt-1">Chemin personnalisé obligatoire pour tous les utilisateurs créés manuellement</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-2 text-white">Permissions</label>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center space-x-2 text-white">
                            <input
                              type="checkbox"
                              checked={newUser.permissions?.includes('read') || false}
                              onChange={() => togglePermission('read')}
                              className="rounded"
                            />
                            <span className="text-sm text-white">Lecture</span>
                          </label>
                          <label className="flex items-center space-x-2 text-white">
                            <input
                              type="checkbox"
                              checked={newUser.permissions?.includes('write') || false}
                              onChange={() => togglePermission('write')}
                              className="rounded"
                            />
                            <span className="text-sm text-white">Écriture</span>
                          </label>
                          <label className="flex items-center space-x-2 text-white">
                            <input
                              type="checkbox"
                              checked={newUser.permissions?.includes('share') || false}
                              onChange={() => togglePermission('share')}
                              className="rounded"
                            />
                            <span className="text-sm text-white">Partage</span>
                          </label>
                          <label className="flex items-center space-x-2 text-white">
                            <input
                              type="checkbox"
                              checked={newUser.permissions?.includes('rename') || false}
                              onChange={() => togglePermission('rename')}
                              className="rounded"
                            />
                            <span className="text-sm text-white">Renommer</span>
                          </label>
                          <label className="flex items-center space-x-2 text-white">
                            <input
                              type="checkbox"
                              checked={newUser.permissions?.includes('delete') || false}
                              onChange={() => togglePermission('delete')}
                              className="rounded"
                            />
                            <span className="text-sm text-white">Supprimer</span>
                          </label>
                          <label className="flex items-center space-x-2 text-white">
                            <input
                              type="checkbox"
                              checked={newUser.permissions?.includes('move') || false}
                              onChange={() => togglePermission('move')}
                              className="rounded"
                            />
                            <span className="text-sm text-white">Déplacer</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    {/* Affichage des messages d'erreur */}
                    {errorMessage && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                        {errorMessage}
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-3 mt-4">
                      <button
                        onClick={() => {
                          setShowAddUser(false);
                          setErrorMessage('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-white"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleAddUser}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                )}

                {passwordChangeUser && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Changer le mot de passe</h3>
                        <button
                          onClick={() => {
                            setPasswordChangeUser(null);
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordError('');
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-white">Nouveau mot de passe</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-white">Confirmer le mot de passe</label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        {passwordError && (
                          <p className="text-red-500 text-sm">{passwordError}</p>
                        )}
                      </div>
                      <div className="mt-6 flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setPasswordChangeUser(null);
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordError('');
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handlePasswordChange}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Changer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {editingUser && (
                  <div className="bg-[#23293a]/80 border border-[#343c4e] p-2 md:p-4 rounded-lg md:rounded-xl shadow-lg mb-4 md:mb-6 w-full">
                    <h4 className="font-medium mb-4 text-white">Modifier l'utilisateur</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-white">Nom d'utilisateur</label>
                        <input
                          type="text"
                          value={editingUser.username}
                          onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-white">Rôle</label>
                        <select
                          value={editingUser.role}
                          onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'user' })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                          <option value="user">Utilisateur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1 text-white">Chemin physique personnalisé</label>
                        <input
                          type="text"
                          value={editingUser.customPath || editingUser.homePath}
                          onChange={(e) => setEditingUser({ 
                            ...editingUser, 
                            customPath: e.target.value,
                            homePath: e.target.value // Mettre à jour les deux pour la compatibilité
                          })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-2 text-white">Permissions</label>
                        <div className="flex flex-wrap gap-4">
                          {[
                            { id: 'read', label: 'Lecture' },
                            { id: 'write', label: 'Écriture' },
                            { id: 'share', label: 'Partage' },
                            { id: 'rename', label: 'Renommer' },
                            { id: 'delete', label: 'Supprimer' },
                            { id: 'move', label: 'Déplacer' }
                          ].map((permission) => (
                            <label key={permission.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={editingUser.permissions?.includes(permission.id) || false}
                                onChange={() => {
                                  const permissions = [...(editingUser.permissions || [])];
                                  const index = permissions.indexOf(permission.id);
                                  if (index === -1) {
                                    permissions.push(permission.id);
                                  } else {
                                    permissions.splice(index, 1);
                                  }
                                  setEditingUser({ ...editingUser, permissions });
                                }}
                                className="rounded"
                              />
                              <span className="text-sm text-white">{permission.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setEditingUser(null);
                          setErrorMessage(''); // Réinitialiser le message d'erreur à la fermeture
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-white"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleUpdateUser}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Sauvegarder
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 w-full max-w-xl mx-auto">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{user.username}</h4>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span>
                            {user.role}
                          </span>
                          <button className="p-2 hover:bg-gray-100 rounded-lg">
                            <Edit 
                              className="w-4 h-4" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingUser(user);
                              }}
                            />
                          </button>
                          <button 
                            className="p-2 hover:bg-[#343c4e] rounded-lg text-blue-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPasswordChangeUser(user);
                              setNewPassword('');
                              setConfirmPassword('');
                              setPasswordError('');
                            }}
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 hover:bg-[#343c4e] rounded-lg text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center space-x-4 text-sm text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Folder className="w-4 h-4" />
                          <span>{user.customPath || user.homePath}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Key className="w-4 h-4" />
                          <span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">Permissions :</span>
                              {Array.isArray(user.permissions) && user.permissions.length > 0 ? (
                                user.permissions.map((perm) => {
                                  let bgColor = "bg-blue-100";
                                  let textColor = "text-blue-800";
                                  let label = perm;
                                  
                                  // Personnalisation des badges selon le type de permission
                                  switch(perm) {
                                    case 'read':
                                      label = "Lecture";
                                      break;
                                    case 'write':
                                      label = "Écriture";
                                      bgColor = "bg-green-100";
                                      textColor = "text-green-800";
                                      break;
                                    case 'share':
                                      label = "Partage";
                                      bgColor = "bg-purple-100";
                                      textColor = "text-purple-800";
                                      break;
                                    case 'rename':
                                      label = "Renommer";
                                      bgColor = "bg-indigo-100";
                                      textColor = "text-indigo-800";
                                      break;
                                    case 'delete':
                                      label = "Supprimer";
                                      bgColor = "bg-red-100";
                                      textColor = "text-red-800";
                                      break;
                                    case 'move':
                                      label = "Déplacer";
                                      bgColor = "bg-yellow-100";
                                      textColor = "text-yellow-800";
                                      break;
                                  }
                                  
                                  return (
                                    <span key={perm} className={`px-2 py-1 bg-gradient-to-br from-[#23293a] to-[#343c4e] border border-[#343c4e] text-purple-300 rounded text-xs font-semibold shadow-sm`}>{label}</span>
                                  );
                                })
                              ) : (
                                <span className="text-gray-400">Aucune</span>
                              )}
                            </div>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Section Stockage supprimée car non utilisée */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
