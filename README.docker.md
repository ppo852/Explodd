# Déploiement Docker pour Explodd

Ce document explique comment déployer l'application Explodd en utilisant Docker et Docker Compose.

## Configuration Docker pour Explodd

Explodd utilise une architecture monolithique où le frontend et le backend sont combinés dans une seule image Docker, avec Nginx servant le frontend et faisant office de proxy pour le backend.

## Structure des fichiers

- `Dockerfile` : Configuration multi-étapes construisant le frontend et le backend, puis les assemblant avec Nginx
- `docker-compose.yml` : Orchestration du service unique explodd
- `nginx.conf` : Configuration Nginx pour servir le frontend et rediriger les requêtes API vers le backend

## Exemples de docker-compose.yml

### Version pour développement local (build local)

Cette configuration construit l'image localement à partir du Dockerfile :

```yaml
version: '3.8'

services:
  # Service monolithique (frontend + backend)
  explodd:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      # Port pour le frontend (qui inclut aussi le proxy vers le backend)
      - "5173:80"
    volumes:
      # Volume pour persister la base de données
      - ./data:/app/server/dist/data
      # Montage pour accéder aux fichiers locaux (à adapter selon vos besoins)
      - ./localfiles:/app/files/utilisateur
    environment:
      - NODE_ENV=production
    networks:
      - explodd-network
    restart: unless-stopped
    
networks:
  explodd-network:
    driver: bridge
```

### Version pour déploiement avec l'image GitHub Container Registry

Cette configuration utilise l'image pré-construite depuis GitHub Container Registry :

```yaml
version: '3.8'

services:
  # Service monolithique (frontend + backend)
  explodd:
    # Utilisation de l'image publiée sur GitHub Container Registry
    image: ghcr.io/ppo852/explodd:latest
    ports:
      # Port pour le frontend (qui inclut aussi le proxy vers le backend)
      - "5173:80"
    volumes:
      # Volume pour persister la base de données
      - ./data:/app/server/dist/data
      # Montage pour accéder aux fichiers locaux (à adapter selon vos besoins)
      - ./localfiles:/app/files/utilisateur
    environment:
      - NODE_ENV=production
    networks:
      - explodd-network
    restart: unless-stopped
    
networks:
  explodd-network:
    driver: bridge
```

## Configuration

### Volumes et chemins de fichiers

Dans le fichier `docker-compose.yml`, vous pouvez configurer :

1. Le chemin de la base de données SQLite :
   ```yaml
   volumes:
     - ./data:/app/server/dist/data
   ```

2. Le chemin des fichiers utilisateurs :
   ```yaml
   volumes:
     - ./localfiles:/app/files/utilisateur 
   ```
   
   Remplacez `./localfiles` par le chemin sur votre machine hôte où vous souhaitez stocker les fichiers.
   Remplacez `utilisateur` par le nom d'utilisateur concerné.

## Déploiement

### Première exécution

```bash
# Construire et démarrer tous les services
docker-compose up --build

# Exécuter en arrière-plan
docker-compose up -d --build
```

### Exécutions suivantes

```bash
# Démarrer les services
docker-compose up

# Exécuter en arrière-plan
docker-compose up -d
```

### Arrêter les services

```bash
docker-compose down
```

## Accès à l'application

- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:5173/api

## Gestion des données

Les données sont persistantes grâce aux volumes Docker configurés dans le fichier docker-compose.yml :

1. **Base de données SQLite** : Persistante via le montage `./data:/app/server/dist/data`
2. **Fichiers utilisateurs** : Persistants via le montage `./localfiles:/app/files/utilisateur`

Pour supprimer complètement les données :

```bash
# Arrêter les conteneurs et supprimer les volumes
docker-compose down -v

# Puis supprimer manuellement les dossiers data et localfiles
rm -rf ./data ./localfiles
```

## Logs

Pour voir les logs des conteneurs :

```bash
# Tous les services
docker-compose logs

# Service explodd spécifiquement
docker-compose logs explodd

# Suivre les logs en temps réel
docker-compose logs -f
```

## Dépannage

### Problèmes d'accès au backend

Si le frontend ne peut pas accéder au backend, vérifiez :

1. Que le port 3001 est bien exposé dans le Dockerfile
2. Que la configuration Nginx redirige correctement les requêtes `/api` vers le backend
3. Que les appels API dans le frontend utilisent le chemin relatif `/api` et non une URL absolue

### Problèmes d'accès aux fichiers

Assurez-vous que les chemins de montage dans docker-compose.yml sont corrects et que les permissions sont bien configurées.

### Erreur "port already in use"

Si le port 5173 est déjà utilisé par un autre service, modifiez le mapping de port dans `docker-compose.yml` :

```yaml
ports:
  - "8080:80"  # Utiliser le port 8080 au lieu de 5173:80
```
