import db from '../database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface SharedLink {
  id?: number;
  file_path: string;
  link_id: string;
  password: string;
  created_at?: string;
  expires_at?: string;
  user_id: string;
  is_multi?: boolean; // Indique si c'est un lien multi-fichiers (ZIP)
}

class SharedLinkModel {
  constructor() {
    this.initTable();
  }

  private initTable() {
    // Créer la table si elle n'existe pas
    db.exec(`
      CREATE TABLE IF NOT EXISTS shared_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        link_id TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        user_id TEXT NOT NULL,
        is_multi BOOLEAN DEFAULT 0
      )
    `);
    
    // Vérifier si la colonne is_multi existe déjà
    const tableInfo = db.prepare("PRAGMA table_info(shared_links)").all();
    const hasIsMultiColumn = tableInfo.some((column: any) => column.name === 'is_multi');
    
    // Ajouter la colonne is_multi si elle n'existe pas
    if (!hasIsMultiColumn) {
      try {
        db.exec('ALTER TABLE shared_links ADD COLUMN is_multi BOOLEAN DEFAULT 0');
        console.log('Colonne is_multi ajoutée à la table shared_links');
      } catch (error) {
        console.error('Erreur lors de l\'ajout de la colonne is_multi:', error);
      }
    }
  }

  getAll(): SharedLink[] {
    return db.prepare('SELECT * FROM shared_links').all() as SharedLink[];
  }
  
  getAllByUserId(userId: string): SharedLink[] {
    return db.prepare('SELECT * FROM shared_links WHERE user_id = ?').all(userId) as SharedLink[];
  }

  getById(id: number): SharedLink | undefined {
    const row = db.prepare('SELECT * FROM shared_links WHERE id = ?').get(id);
    return row as SharedLink | undefined;
  }

  getByLinkId(linkId: string): SharedLink | undefined {
    const row = db.prepare('SELECT * FROM shared_links WHERE link_id = ?').get(linkId);
    return row as SharedLink | undefined;
  }

  create(sharedLink: Omit<SharedLink, 'id' | 'created_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO shared_links (file_path, link_id, password, expires_at, user_id, is_multi)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      sharedLink.file_path,
      sharedLink.link_id,
      sharedLink.password,
      sharedLink.expires_at || null,
      sharedLink.user_id,
      sharedLink.is_multi ? 1 : 0
    );
    
    return info.lastInsertRowid as number;
  }

  update(id: number, sharedLink: Partial<SharedLink>): boolean {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (sharedLink.file_path) {
      fields.push('file_path = ?');
      values.push(sharedLink.file_path);
    }
    
    if (sharedLink.password) {
      fields.push('password = ?');
      values.push(sharedLink.password);
    }
    
    if (sharedLink.expires_at) {
      fields.push('expires_at = ?');
      values.push(sharedLink.expires_at);
    }
    
    if (sharedLink.is_multi !== undefined) {
      fields.push('is_multi = ?');
      values.push(sharedLink.is_multi ? 1 : 0);
    }
    
    if (fields.length === 0) return false;
    
    values.push(id);
    
    const stmt = db.prepare(`
      UPDATE shared_links
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    const info = stmt.run(...values);
    return info.changes > 0;
  }

  delete(id: number): boolean {
    const stmt = db.prepare('DELETE FROM shared_links WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  deleteByLinkId(linkId: string): boolean {
    const stmt = db.prepare('DELETE FROM shared_links WHERE link_id = ?');
    const info = stmt.run(linkId);
    return info.changes > 0;
  }

  // Nettoyer les liens expirés
  cleanupExpired(): void {
    const now = new Date().toISOString();
    const stmt = db.prepare('DELETE FROM shared_links WHERE expires_at < ?');
    stmt.run(now);
  }
}

export default new SharedLinkModel();
