# Étape de construction du frontend
FROM node:20-alpine as frontend-build

# Définir le répertoire de travail
WORKDIR /app/frontend

# Copier les fichiers de dépendances du frontend
COPY package.json package-lock.json* ./

# Installer les dépendances du frontend
RUN npm ci --ignore-scripts

# Copier le reste des fichiers du frontend
COPY . .

# Construire l'application frontend
RUN npm run build

# Étape de construction du backend
FROM node:20-alpine as stage-1

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers package.json et installer les dépendances du backend
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --ignore-scripts

# Copier le code source du backend
COPY server/ ./server/

# Compiler le backend TypeScript en JavaScript
RUN cd server && npm run build

# Étape de construction finale
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de build du frontend depuis l'étape précédente
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copier les fichiers de build du backend depuis l'étape précédente
COPY --from=stage-1 /app/server/dist ./server/dist
COPY server/package.json server/package-lock.json* ./server/

# Installer les dépendances de compilation nécessaires pour bcrypt
RUN apk add --no-cache python3 make g++

# Installer uniquement les dépendances de production pour le backend (sans ignorer les scripts)
RUN cd server && npm ci --only=production

# Installer Nginx pour servir le frontend
RUN apk add --no-cache nginx

# Copier la configuration Nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Créer les répertoires nécessaires
RUN mkdir -p /app/data /app/files

# Exposer les ports
EXPOSE 80 3001

# Créer un script de démarrage
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'nginx &' >> /app/start.sh && \
    echo 'cd /app/server/dist && node index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Vérifier que le script existe
RUN ls -la /app/start.sh

# Commande pour démarrer le serveur
CMD ["/app/start.sh"]
