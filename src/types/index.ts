export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modified: Date;
  extension?: string;
  isFavorite?: boolean;
  isShared?: boolean;
  thumbnail?: string;
  path: string;
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  icon: string;
  itemCount?: number;
  isExpanded?: boolean;
  children?: FolderItem[];
}

export interface ViewSettings {
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'modified' | 'size' | 'type';
  sortOrder: 'asc' | 'desc';
  showHidden: boolean;
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  homePath?: string;
  customPath?: string;
  password?: string; // Pour la création d'utilisateur uniquement
  permissions: string[]; // ['read', 'write', 'share', 'rename', 'delete', 'move']
}