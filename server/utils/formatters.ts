/**
 * Formate une taille en octets en une chaîne lisible (KB, MB, GB)
 * @param bytes Taille en octets
 * @returns Chaîne formatée
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
