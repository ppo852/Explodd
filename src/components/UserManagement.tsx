import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, User, Folder, Key } from 'lucide-react';

import { getAuthToken } from '../utils/auth';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  homePath: string;
  permissions: string[];
  canRename?: boolean;
  canDelete?: boolean;
  canMove?: boolean;
}

interface UserManagementProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const UserManagement: React.FC<UserManagementProps> = ({ isOpen, onClose, users, setUsers }) => {
  

  // Charger les utilisateurs depuis l'API à chaque ouverture de la gestion
  React.useEffect(() => {
    if (!isOpen) return;
    const fetchUsers = async () => {
      try {
        
        const token = getAuthToken() || localStorage.getItem('token');
        
        const res = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) throw new Error('Erreur lors de la récupération des utilisateurs');
        const data = await res.json();
        
        setUsers(data.map((u: any) => ({
          ...u,
          id: String(u.id), // force id en string
          homePath: u.homePath || `/home/${u.username}`, // Utiliser le chemin personnalisé fourni par le serveur
          permissions: u.permissions || ['read'],
          canRename: u.canRename !== undefined ? u.canRename : true,
          canDelete: u.canDelete !== undefined ? u.canDelete : (u.role === 'admin'),
          canMove: u.canMove !== undefined ? u.canMove : true
        })));
      } catch (err) {
        
        setUsers([]);
      }
    };
    fetchUsers();
  }, [isOpen]);

  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    homePath: '',
    permissions: ['read'],
    canRename: true,
    canDelete: false,
    canMove: true
  });

  const handleAddUser = async () => {
    try {
      const token = getAuthToken() || localStorage.getItem('token');
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
          permissions: newUser.permissions,
          canRename: newUser.canRename,
          canDelete: newUser.canDelete,
          canMove: newUser.canMove
        })
      });
      if (!res.ok) throw new Error('Erreur lors de la création de l\'utilisateur');
      const created = await res.json();
      setUsers([...users, {
        ...created,
        homePath: `/home/${created.username}`,
        permissions: ['read'],
        canRename: true,
        canDelete: created.role === 'admin',
        canMove: true
      }]);
      setNewUser({
        username: '',
        password: '',
        role: 'user',
        homePath: '',
        permissions: ['read'],
        canRename: true,
        canDelete: false,
        canMove: true
      });
      setShowAddUser(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la création');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const token = getAuthToken() || localStorage.getItem('token');
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression de l\'utilisateur');
      setUsers(users.filter(user => user.id !== userId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const handlePasswordChange = async () => {
    try {
      if (!passwordChangeUser) return;
      
      // Vérifier que les mots de passe correspondent
      if (newPassword !== confirmPassword) {
        setPasswordError('Les mots de passe ne correspondent pas');
        return;
      }

      // Vérifier que le mot de passe est assez long
      if (newPassword.length < 6) {
        setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }

      const token = getAuthToken() || localStorage.getItem('token');
      const res = await fetch(`/api/users/${passwordChangeUser.id}/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erreur lors du changement de mot de passe');
      }

      // Réinitialiser les champs
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setPasswordChangeUser(null);

      alert('Mot de passe modifié avec succès');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe');
    }
  };

  const togglePermission = (permission: string) => {
    const permissions = newUser.permissions.includes(permission)
      ? newUser.permissions.filter(p => p !== permission)
      : [...newUser.permissions, permission];
    setNewUser({ ...newUser, permissions });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Gestion des Utilisateurs</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">Utilisateurs</h3>
            <button
              onClick={() => setShowAddUser(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter Utilisateur</span>
            </button>
          </div>

          {showAddUser && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="font-medium mb-4">Nouvel Utilisateur</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom d'utilisateur</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Mot de passe</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rôle</label>
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
                  <label className="block text-sm font-medium mb-1">Chemin du dossier personnel</label>
                  <input
                    type="text"
                    value={newUser.homePath}
                    onChange={(e) => setNewUser({ ...newUser, homePath: e.target.value })}
                    placeholder={`/home/${newUser.username}`}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Permissions</label>
                  <div className="flex flex-wrap gap-2">
                    {['read', 'write', 'delete', 'share', 'admin'].map((permission) => (
                      <label key={permission} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={newUser.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Droits d'actions</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newUser.canRename}
                        onChange={(e) => setNewUser({ ...newUser, canRename: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Peut renommer</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newUser.canDelete}
                        onChange={(e) => setNewUser({ ...newUser, canDelete: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Peut supprimer</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newUser.canMove}
                        onChange={(e) => setNewUser({ ...newUser, canMove: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Peut déplacer</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="font-medium mb-4">Changer le mot de passe - {passwordChangeUser.username}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Minimum 6 caractères"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              {passwordError && (
                <div className="mt-2 text-red-500 text-sm">{passwordError}</div>
              )}
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => {
                    setPasswordChangeUser(null);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handlePasswordChange}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Changer le mot de passe
                </button>
              </div>
            </div>
          )}

          {editingUser && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="font-medium mb-4">Modifier Utilisateur</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom d'utilisateur</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Chemin personnalisé</label>
                  <input
                    type="text"
                    value={editingUser.homePath}
                    onChange={(e) => setEditingUser({ ...editingUser, homePath: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rôle</label>
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
                  <label className="block text-sm font-medium mb-2">Permissions</label>
                  <div className="flex flex-wrap gap-2">
                    {['read', 'write', 'delete', 'share', 'admin'].map((permission) => (
                      <label key={permission} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editingUser.permissions.includes(permission)}
                          onChange={() => {
                            const permissions = editingUser.permissions.includes(permission)
                              ? editingUser.permissions.filter(p => p !== permission)
                              : [...editingUser.permissions, permission];
                            setEditingUser({ ...editingUser, permissions });
                          }}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    // Sauvegarder les modifications localement
                    setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
                    
                    // Si le chemin d'accès a été modifié, l'envoyer au backend
                    try {
                      const originalUser = users.find(u => u.id === editingUser.id);
                      if (originalUser && originalUser.homePath !== editingUser.homePath) {
                        // Extraire le nom d'utilisateur du chemin (format: /home/username)
                        const username = editingUser.username;
                        // Récupérer le token d'authentification
                        const token = getAuthToken();
                        if (!token) {
                          throw new Error('Token d\'authentification non trouvé');
                        }
                        
                        // Envoyer le nouveau chemin au backend avec le token
                        const response = await fetch(`/api/users/${username}/path`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ 
                            customPath: editingUser.homePath.startsWith('/') 
                              ? editingUser.homePath.substring(1) // Enlever le slash initial si présent
                              : editingUser.homePath 
                          }),
                        });
                        
                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || 'Failed to update path');
                        }
                        
                        console.log(`Chemin personnalisé pour ${username} mis à jour avec succès`);
                      }
                    } catch (error) {
                      console.error('Erreur lors de la mise à jour du chemin:', error);
                      alert(`Erreur lors de la mise à jour du chemin: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
                    }
                    
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
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
                      className="p-2 hover:bg-gray-100 rounded-lg text-blue-600"
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
                      className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Folder className="w-4 h-4" />
                    <span>{user.homePath}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Key className="w-4 h-4" />
                    <span>
                      <div className="flex flex-wrap items-center gap-2">
  <span className="font-semibold">Permissions :</span>
  {Array.isArray(user.permissions) && user.permissions.length > 0 ? (
    user.permissions.map((perm) => (
      <span key={perm} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{perm}</span>
    ))
  ) : (
    <span className="text-gray-400">Aucune</span>
  )}
</div>
<div className="flex flex-wrap items-center gap-2 mt-1">
  <span className="font-semibold">Actions :</span>
  {user.canRename && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Renommer</span>}
  {user.canDelete && <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Supprimer</span>}
  {user.canMove && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Déplacer</span>}
  {!user.canRename && !user.canDelete && !user.canMove && (
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
      </div>
    </div>
  );
};

export default UserManagement;