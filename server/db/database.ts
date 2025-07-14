import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import bcrypt from 'bcrypt';

// Chemin vers le fichier de base de données
const DB_PATH = path.join(__dirname, '..', 'data', 'explodd.db');

// S'assurer que le répertoire data existe
fs.ensureDirSync(path.join(__dirname, '..', 'data'));

// Vérifier si la base de données existe déjà
const dbExists = fs.existsSync(DB_PATH);

// Créer une instance de la base de données
const db = new Database(DB_PATH);

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

// Initialiser la base de données avec les tables nécessaires
function initDatabase() {
  // Table des utilisateurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      permissions TEXT,
      canRename BOOLEAN DEFAULT 1,
      canDelete BOOLEAN DEFAULT 0,
      canMove BOOLEAN DEFAULT 1
    );
  `);

  // Table des chemins personnalisés
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      virtual_path TEXT NOT NULL,
      real_path TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  
  // Table des métadonnées de fichiers
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_metadata (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_directory BOOLEAN NOT NULL,
      size INTEGER,
      last_modified TIMESTAMP,
      last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      parent_path TEXT,
      virtual_path TEXT
    );
  `);
  
  // Index pour accélérer les recherches
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_file_metadata_parent_path ON file_metadata(parent_path);
    CREATE INDEX IF NOT EXISTS idx_file_metadata_virtual_path ON file_metadata(virtual_path);
  `);

  // Vérifier si l'utilisateur admin existe déjà
  const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  
  // Si l'admin n'existe pas, le créer avec un mot de passe par défaut et toutes les permissions
  if (!adminUser) {
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync('admin', saltRounds);
    
    // Toutes les permissions possibles pour l'admin
    const allPermissions = ['read', 'write', 'share', 'rename', 'delete', 'move', 'admin'];
    const permissionsJson = JSON.stringify(allPermissions);
    
    const insertUser = db.prepare(`
      INSERT INTO users (username, password, role, permissions)
      VALUES (?, ?, ?, ?)
    `);
    
    insertUser.run('admin', hashedPassword, 'admin', permissionsJson);
    console.log('Utilisateur admin créé avec le mot de passe par défaut: admin et toutes les permissions');
  }
}

// Initialiser la base de données uniquement si elle n'existe pas déjà
if (!dbExists) {
  console.log('Création de la base de données...');
  initDatabase();
  console.log('Base de données créée avec succès!');
} else {
  console.log('Base de données existante détectée.');
}

export default db;
