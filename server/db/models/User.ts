import db from '../database';
import bcrypt from 'bcrypt';

export interface User {
  id?: number;
  username: string;
  password?: string;
  role: string;
  created_at?: string;
  permissions: string[]; // ['read', 'write', 'share', 'rename', 'delete', 'move']
}

export interface UserPath {
  id?: number;
  user_id: number;
  virtual_path: string;
  real_path: string;
}

class UserModel {
  /**
   * Récupère tous les utilisateurs
   */
  getAll(): User[] {
    const rows = db.prepare('SELECT id, username, role, created_at, permissions FROM users').all();
    return rows.map((row: any) => {
      // Conversion des anciennes permissions au nouveau format si nécessaire
      let permissions = ['read'];
      if (row.permissions) {
        permissions = JSON.parse(row.permissions);
      }
      
      return {
        id: row.id,
        username: row.username,
        role: row.role,
        created_at: row.created_at,
        permissions: permissions
      } as User;
    });
  }

  getById(id: number): User | undefined {
    const row = db.prepare('SELECT id, username, role, created_at, permissions FROM users WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    
    // Conversion des anciennes permissions au nouveau format si nécessaire
    let permissions = ['read'];
    if (row.permissions) {
      permissions = JSON.parse(row.permissions);
    }
    
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      created_at: row.created_at,
      permissions: permissions
    };
  }

  getByUsername(username: string): User | undefined {
    const row = db.prepare('SELECT id, username, role, created_at, permissions FROM users WHERE username = ?').get(username) as any;
    if (!row) return undefined;
    
    // Conversion des anciennes permissions au nouveau format si nécessaire
    let permissions = ['read'];
    if (row.permissions) {
      permissions = JSON.parse(row.permissions);
    }
    
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      created_at: row.created_at,
      permissions: permissions
    };
  }

  /**
   * Vérifie les identifiants d'un utilisateur
   */
  authenticate(username: string, password: string): User | null {
    const row = db.prepare('SELECT id, username, role, created_at, permissions, password FROM users WHERE username = ?').get(username) as any;
    
    if (!row) {
      return null;
    }
    
    const passwordMatch = bcrypt.compareSync(password, row.password || '');
    
    if (!passwordMatch) {
      return null;
    }
    
    // Conversion des anciennes permissions au nouveau format si nécessaire
    let permissions = ['read'];
    if (row.permissions) {
      permissions = JSON.parse(row.permissions);
    }
    
    // Créer un objet utilisateur correctement typé sans le mot de passe
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      created_at: row.created_at,
      permissions: permissions
    };
  }

  /**
   * Crée un nouvel utilisateur
   */
  create(user: User): number {
    try {
      const saltRounds = 10;
      const hashedPassword = bcrypt.hashSync(user.password || 'password123', saltRounds);
      const permissions = JSON.stringify(user.permissions || ['read']);
      
      console.log('Insertion en base avec les valeurs:', {
        username: user.username,
        role: user.role,
        permissions
      });
      
      const result = db.prepare(`
        INSERT INTO users (username, password, role, permissions)
        VALUES (?, ?, ?, ?)
      `).run(
        user.username,
        hashedPassword,
        user.role || 'user',
        permissions
      );
      
      console.log('Résultat de l\'insertion:', result);
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Erreur lors de la création d\'un utilisateur:', error);
      throw error;
    }
  }

  /**
   * Met à jour un utilisateur
   */
  update(id: number, user: Partial<User>): boolean {
    let query = 'UPDATE users SET ';
    const params: any[] = [];
    
    if (user.username) {
      query += 'username = ?, ';
      params.push(user.username);
    }
    
    if (user.password) {
      const saltRounds = 10;
      const hashedPassword = bcrypt.hashSync(user.password, saltRounds);
      query += 'password = ?, ';
      params.push(hashedPassword);
    }
    
    if (user.role) {
      query += 'role = ?, ';
      params.push(user.role);
    }
    
    if (user.permissions !== undefined) {
      query += 'permissions = ?, ';
      params.push(JSON.stringify(user.permissions));
    }
    
    // Enlever la virgule finale
    query = query.slice(0, -2);
    
    query += ' WHERE id = ?';
    params.push(id);
    
    const result = db.prepare(query).run(...params);
    return result.changes > 0;
  }

  /**
   * Supprime un utilisateur
   */
  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

export default new UserModel();
