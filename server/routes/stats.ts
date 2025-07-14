import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import db from '../db/database';
import { getPhysicalPath } from '../utils/fileUtils';
import { formatSize } from '../utils/formatters';
import diskusage from 'diskusage';
import os from 'os';

const router = express.Router();

// Route pour obtenir les statistiques d'utilisation par utilisateur
router.get('/user-storage', async (req, res) => {
  try {
    // Récupérer tous les utilisateurs
    const UserModel = require('../db/models/User').default;
    const users = UserModel.getAll();
    
    // Tableau pour stocker les résultats
    const userStats = [];
    
    // Pour chaque utilisateur, calculer la taille totale
    for (const user of users) {
      if (user.username === 'admin') continue; // Ignorer l'admin
      
      // Récupérer le chemin virtuel de l'utilisateur
      const userVirtualPath = `/${user.username}`;
      
      // Calculer la taille totale à partir de la base de données
      // Cette requête somme la taille de tous les fichiers dont le chemin virtuel commence par /username
      const query = db.prepare(`
        SELECT SUM(size) as totalSize 
        FROM file_metadata 
        WHERE virtual_path LIKE ? AND is_directory = 0
      `);
      
      const result = query.get(`${userVirtualPath}%`) as { totalSize?: number } | undefined;
      const totalSize = result && typeof result.totalSize === 'number' ? result.totalSize : 0;
      
      userStats.push({
        id: user.id,
        username: user.username,
        totalSize: totalSize,
        formattedSize: formatSize(totalSize)
      });
    }
    
    res.json({
      success: true,
      stats: userStats
    });
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du calcul des statistiques'
    });
  }
});

// Route pour obtenir les statistiques d'utilisation du disque
router.get('/disk-usage', async (req, res) => {
  try {
    // Obtenir le chemin racine du stockage
    const storagePath = path.resolve('.');
    
    // Obtenir l'utilisation du disque
    let diskInfo;
    try {
      diskInfo = await diskusage.check(storagePath);
    } catch (diskError) {
      // Fallback pour Windows si le chemin spécifique échoue
      const rootPath = os.platform() === 'win32' ? 'C:' : '/';
      diskInfo = await diskusage.check(rootPath);
    }
    
    res.json({
      success: true,
      diskInfo: {
        total: diskInfo.total,
        free: diskInfo.free,
        used: diskInfo.total - diskInfo.free,
        formattedTotal: formatSize(diskInfo.total),
        formattedFree: formatSize(diskInfo.free),
        formattedUsed: formatSize(diskInfo.total - diskInfo.free)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisation du disque:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'utilisation du disque'
    });
  }
});

export default router;
