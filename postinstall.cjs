// Script Node.js pour installer automatiquement les dépendances dans le dossier server après un npm install à la racine
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, 'server');
const serverPackage = path.join(serverDir, 'package.json');

if (fs.existsSync(serverPackage)) {
  try {
    console.log('Installation des dépendances du backend (server/)...');
    execSync('npm install', { cwd: serverDir, stdio: 'inherit' });
    console.log('Dépendances backend installées avec succès.');
  } catch (err) {
    console.error('Erreur lors de l\'installation des dépendances backend:', err);
    process.exit(1);
  }
} else {
  console.log('Aucun package.json trouvé dans server/. Rien à installer.');
}
