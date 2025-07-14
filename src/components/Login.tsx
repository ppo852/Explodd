import React, { useState } from 'react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  error: string | null;
  isLoading: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, error, isLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation basique
    if (!username.trim()) {
      setLocalError('Le nom d\'utilisateur est requis');
      return;
    }
    
    if (!password) {
      setLocalError('Le mot de passe est requis');
      return;
    }
    
    setLocalError(null);
    await onLogin(username, password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-2 sm:px-0">
      <div className="w-full max-w-md p-4 sm:p-8 space-y-8 bg-gray-800 rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-purple-600">Explodd</h1>
          <h2 className="mt-2 text-lg sm:text-xl font-semibold text-gray-400">Explorateur de fichiers</h2>
        </div>
        
        <form className="mt-6 sm:mt-8 space-y-6" onSubmit={handleSubmit}>
          {(error || localError) && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
              {error || localError}
            </div>
          )}
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-400">
              Nom d'utilisateur
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-gray-700 text-gray-400"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-400">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-gray-700 text-gray-400"
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 rounded-lg text-base font-semibold text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-md ${
                isLoading
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 hover:from-blue-600 hover:via-purple-600 hover:to-purple-700'
              }`}
            >
              {isLoading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </div>
          

        </form>
      </div>
    </div>
  );
};

export default Login;
