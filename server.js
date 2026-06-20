const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
// Création du fichier de base de données SQLite sur le disque
const db = new Database('secure_data.db');

// Middlewares
app.use(cors()); // Autorise le frontend à communiquer avec le backend
app.use(express.json()); // Permet de lire le JSON envoyé par le frontend

// Création de la table sécurisée au démarrage
db.exec(`
  CREATE TABLE IF NOT EXISTS encrypted_vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Route de réception des données chiffrées
app.post('/api/save', (req, res) => {
  const { salt, iv, ciphertext } = req.body;

  if (!salt || !iv || !ciphertext) {
    return res.status(400).json({ error: "Données cryptographiques manquantes." });
  }

  try {
    // Utilisation d'une requête préparée (?) pour éviter les injections SQL
    const stmt = db.prepare('INSERT INTO encrypted_vault (salt, iv, ciphertext) VALUES (?, ?, ?)');
    stmt.run(salt, iv, ciphertext);
    
    res.status(200).json({ message: "Succès : Données chiffrées enregistrées en base." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement en base de données." });
  }
});

// Lancement du serveur
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur sécurisé démarré sur http://localhost:${PORT}`);
});

// Route pour récupérer toutes les données chiffrées
app.get('/api/data', (req, res) => {
  try {
    // On récupère les données, de la plus récente à la plus ancienne
    const stmt = db.prepare('SELECT * FROM encrypted_vault ORDER BY created_at DESC');
    const rows = stmt.all();
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération des données." });
  }
});
