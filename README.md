# secure-app
Un POC pour montrer comment stoquer des info de manière sécurisé. 

# Sécurité des données : chiffrement de bout en bout

Ce projet intègre une architecture de sécurité visant à garantir la confidentialité absolue des données saisies par l'utilisateur. Le principe fondamental est que le serveur backend agit uniquement comme un espace de stockage passif. Les données sont chiffrées localement sur le pc/téléphone de l'utilisateur, et le serveur n'a jamais connaissance de la clé de déchiffrement ni des données en clair.

## Utilisation 
Pour lancer l'app sous Linux :
```
node server.js
```
Puis ouvir index.html

Voici le détail du processus de sécurisation, étape par étape, tel qu'il est implémenté dans la fonction `encryptAndSendCO2` côté client.

## 1. Préparation et structuration des données
Avant de procéder au chiffrement, les informations saisies par l'utilisateur (transport, énergie, alimentation) sont regroupées, puis converties en format binaire.

```
const jsonString = JSON.stringify(co2Data);
const dataBuffer = encoder.encode(jsonString);
```

- `JSON.stringify` : Transforme l'objet contenant les données structurées en une simple chaîne de caractères.
- `encoder.encode` : Convertit ce texte en format binaire (buffer), car les algorithmes de cryptographie ne manipulent que des données binaires.

## 2. Dérivation de la clé cryptographique (Algorithme PBKDF2)
Pour des raisons de sécurité, le mot de passe de l'utilisateur n'est jamais utilisé directement comme clé. L'application dérive une clé cryptographique robuste à partir de ce mot de passe.

```
const salt = window.crypto.getRandomValues(new Uint8Array(16));
const baseKey = await window.crypto.subtle.importKey("raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveKey"]);
const cryptoKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
);
```

- `getRandomValues` : Génère un sel cryptographique aléatoire. Cela garantit que deux mots de passe identiques ne produiront jamais la même clé de chiffrement.
- `deriveKey` : Utilise l'algorithme PBKDF2 avec 100 000 itérations de hachage. Cette lenteur volontaire rend les attaques par force brute (tentatives automatisées pour deviner le mot de passe) mathématiquement irréalisables dans un temps raisonnable.

## 3. Chiffrement local des données (Standard AES-GCM)
Une fois la clé dérivée générée, l'application procède au chiffrement des données de consommation CO2.

```
const iv = window.crypto.getRandomValues(new Uint8Array(12));
const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    dataBuffer
);
```

- `iv` : Une valeur aléatoire générée pour chaque nouvelle opération de sauvegarde. Elle assure que si l'utilisateur chiffre deux fois exactement les mêmes données, le résultat chiffré sera totalement différent, empêchant l'analyse de modèles de données.
- `encrypt` : Applique l'algorithme AES-256 en mode GCM. Ce mode chiffre la donnée et y appose une signature d'intégrité. Si un bit de la base de données est altéré ultérieurement, le processus de déchiffrement sera bloqué.

## 4. Transmission sécurisée
Les éléments nécessaires au futur déchiffrement (le sel, le vecteur d'initialisation et le texte chiffré) sont encodés en Base64 pour être transmis au serveur via une requête réseau.

```
const payload = {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(encryptedBuffer)
};
```

- Il est crucial de noter qu'à aucun moment le mot de passe brut ou la clé `cryptoKey` ne sont inclus dans cet envoi. Ils restent confinés de manière éphémère dans la mémoire vive du navigateur et sont détruits par le système d'exploitation à la fin de la fonction.

## 5. Impossibilité d'interception et de lecture par des tiers
L'architecture mise en place protège les données contre deux vecteurs d'attaque majeurs :
- **L'interception réseau** : La requête vers l'API transite obligatoirement via le protocole HTTPS (TLS). Cela crée un tunnel de communication chiffré. Un tiers interceptant le trafic réseau ne verrait qu'un flux de données illisible entre le client et le serveur.
- **Vol de la base de données** : Le backend Node.js ne possède aucune logique de déchiffrement. Il se contente d'enregistrer le ciphertext dans la base SQLite. En cas d'intrusion sur le serveur ou de vol physique du fichier de base de données, l'attaquant n'aura accès qu'à des chaînes de caractères aléatoires. Sans la clé de l'utilisateur, l'algorithme AES-256 est considéré comme inviolable par la puissance de calcul actuelle.
