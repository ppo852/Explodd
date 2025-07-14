import React, { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { HardDrive } from 'lucide-react';
import { getAuthToken } from '../utils/auth';
import { formatSize } from '../utils/formatters';

interface UserStorageStats {
  id: string;
  username: string;
  totalSize: number;
  formattedSize: string;
}

interface DiskUsageInfo {
  total: number;
  free: number;
  used: number;
  formattedTotal: string;
  formattedFree: string;
  formattedUsed: string;
}

interface StatsPageProps {
  currentPath: string;
}

// Couleurs pour le graphique camembert
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', 
  '#82CA9D', '#A4DE6C', '#D0ED57', '#FF6B6B', '#4ECDC4', 
  '#C7F464', '#FF9F1C', '#2EC4B6', '#E71D36', '#011627'
];

const StatsPageNew: React.FC<StatsPageProps> = ({ currentPath }) => {
  const [userStats, setUserStats] = useState<UserStorageStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState<number>(0);
  const [diskInfo, setDiskInfo] = useState<DiskUsageInfo | null>(null);

  // Récupérer les statistiques d'utilisation par utilisateur et du disque
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const token = getAuthToken();
        
        // Récupérer les statistiques d'utilisation par utilisateur
        const response = await fetch('/api/stats/user-storage', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Erreur lors de la récupération des statistiques: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success && data.stats) {
          setUserStats(data.stats);
          
          // Calculer la taille totale
          const total = data.stats.reduce((acc: number, stat: UserStorageStats) => acc + stat.totalSize, 0);
          setTotalSize(total);
        } else {
          throw new Error('Format de réponse invalide');
        }
        
        // Récupérer les informations sur l'utilisation du disque
        const diskResponse = await fetch('/api/stats/disk-usage', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!diskResponse.ok) {
          throw new Error(`Erreur lors de la récupération de l'utilisation du disque: ${diskResponse.status}`);
        }
        
        const diskData = await diskResponse.json();
        if (diskData.success && diskData.diskInfo) {
          setDiskInfo(diskData.diskInfo);
        }
      } catch (error) {
        console.error('Erreur:', error);
        setError(error instanceof Error ? error.message : 'Une erreur est survenue');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (currentPath === '/stats') {
      fetchUserStats();
    }
  }, [currentPath]);

  // Trier les utilisateurs par taille (du plus grand au plus petit)
  const sortedUsers = useMemo(() => {
    return [...userStats].sort((a, b) => b.totalSize - a.totalSize);
  }, [userStats]);
  
  // Préparer les données pour le graphique
  // Limiter à 10 utilisateurs les plus importants + regrouper les autres
  const chartData = useMemo(() => {
    if (!userStats.length) return [];
    
    // Copier et trier les utilisateurs par taille
    const sortedStats = [...userStats].sort((a, b) => b.totalSize - a.totalSize);
    
    // Prendre les 10 premiers utilisateurs
    const topUsers = sortedStats.slice(0, 10);
    
    // Calculer la taille totale des autres utilisateurs
    const otherUsers = sortedStats.slice(10);
    const otherSize = otherUsers.reduce((acc, user) => acc + user.totalSize, 0);
    
    // Créer les données pour le graphique
    const data = topUsers.map(user => ({
      name: user.username,
      value: user.totalSize
    }));
    
    // Ajouter les autres utilisateurs si nécessaire
    if (otherUsers.length > 0) {
      data.push({
        name: `Autres (${otherUsers.length} utilisateurs)`,
        value: otherSize
      });
    }
    
    // Ajouter l'espace libre si disponible
    if (diskInfo) {
      data.push({
        name: 'Espace libre',
        value: diskInfo.free
      });
    }
    
    return data;
  }, [userStats, diskInfo]);
  
  // Calculer le pourcentage pour chaque utilisateur
  const getPercentage = (size: number): string => {
    // Si on a l'info du disque total, on utilise ça pour calculer le pourcentage
    if (diskInfo && diskInfo.total > 0) {
      return `${((size / diskInfo.total) * 100).toFixed(1)}%`;
    }
    // Sinon on utilise le total des utilisateurs (moins précis)
    else if (totalSize > 0) {
      return `${((size / totalSize) * 100).toFixed(1)}%`;
    }
    return '0%';
  };

  return (
    <div className="p-4 md:p-6">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Erreur:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-6 flex items-center text-white">
            <HardDrive className="mr-2" /> Statistiques d'utilisation de l'espace disque
          </h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-white">Espace total utilisé: {formatSize(totalSize)}</h3>
            {diskInfo && (
              <div className="flex flex-col md:flex-row gap-4 mb-4 text-sm">
                <div className="bg-blue-100 p-3 rounded-lg flex-1">
                  <span className="font-medium">Espace disque total:</span> {diskInfo.formattedTotal}
                </div>
                <div className="bg-green-100 p-3 rounded-lg flex-1">
                  <span className="font-medium">Espace libre:</span> {diskInfo.formattedFree}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Colonne gauche: Tableau des utilisateurs */}
            <div className="lg:w-1/2 order-2 lg:order-1">
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b text-left">Utilisateur</th>
                      <th className="py-2 px-4 border-b text-right">Espace utilisé</th>
                      <th className="py-2 px-4 border-b text-right">Pourcentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="py-2 px-4 border-b">
                          <span className="font-medium">{user.username}</span>
                        </td>
                        <td className="py-2 px-4 border-b text-right">
                          <span className="text-gray-600">{user.formattedSize}</span>
                        </td>
                        <td className="py-2 px-4 border-b text-right">
                          <div className="flex items-center justify-end">
                            <div className="w-16 md:w-24 bg-gray-200 rounded-full h-2.5 mr-2">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full" 
                                style={{ width: getPercentage(user.totalSize) }}
                              ></div>
                            </div>
                            <span className="text-gray-500 whitespace-nowrap">{getPercentage(user.totalSize)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Colonne droite: Graphique camembert */}
            <div className="lg:w-1/2 h-72 md:h-96 order-1 lg:order-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={window.innerWidth < 768 ? 80 : 150}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value, percent }) => 
                      (percent && percent > 0) ? 
                        `${name}: ${formatSize(value as number)}` : 
                        ''
                    }
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatSize(value)}
                    labelFormatter={(name) => `Utilisateur: ${name}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StatsPageNew;
