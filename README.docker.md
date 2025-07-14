# Déploiement Docker pour Explodd

Ce document explique comment déployer l'application Explodd en utilisant Docker et Docker Compose.

## Configuration Docker pour Explodd

Ce document décrit la configuration Docker pour l'application Explodd, permettant un déploiement facile et cohérent avec une architecture monolithique (frontend et backend dans la même image).

## Structure des fichiers

- `Dockerfile` : Configuration monolithique incluant l'application React et le serveur Node.js
- `docker-compose.yml` : Orchestration du service Explodd et variables d'environnement
- `nginx.conf` : Configuration Nginx pour le frontend

## Configuration

### Variables d'environnement

Avant de démarrer les conteneurs, vous pouvez configurer le chemin vers vos fichiers locaux en définissant la variable d'environnement `EXPLODD_FILES_PATH` :

```bash
# Windows
set EXPLODD_FILES_PATH=D:\Chemin\Vers\Vos\Fichiers

# Linux/macOS
export EXPLODD_FILES_PATH=/chemin/vers/vos/fichiers
```

Si cette variable n'est pas définie, le dossier `./files` sera utilisé par défaut.

### Sécurité

Pour un déploiement en production, modifiez les informations sensibles dans le fichier `docker-compose.yml` :
- Ajoutez des variables d'environnement sécurisées pour JWT_SECRET et autres données sensibles

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

Les données sont persistantes grâce aux volumes Docker :
- `explodd-data` : Stocke les données des fichiers de l'application

Pour supprimer complètement les données :

```bash
docker-compose down -v
```

## Logs

Pour voir les logs des conteneurs :

```bash
# Tous les services
docker-compose logs

# Un service spécifique
docker-compose logs frontend
docker-compose logs backend
docker-compose logs mongodb

# Suivre les logs en temps réel
docker-compose logs -f
```

## Dépannage



### Problèmes d'accès aux fichiers

Assurez-vous que le chemin défini dans `EXPLODD_FILES_PATH` est accessible par Docker et que les permissions sont correctement configurées.

### Erreur "port already in use"

Un autre service utilise peut-être déjà les ports 80 ou 3000. Modifiez les mappings de ports dans `docker-compose.yml` :

```yaml
ports:
  - "8080:80"  # Utiliser le port 8080 au lieu de 80
```
