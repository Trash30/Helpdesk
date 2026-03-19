# Helpdesk Ticketing — Application Web

Application interne de gestion de support technique.
Stack : React 18 + Vite + TailwindCSS (frontend) / Node.js + Express + Prisma + PostgreSQL (backend).

---

## Prérequis (Windows)

- **Node.js 20 LTS** — https://nodejs.org/en/download
- **PostgreSQL 15** — https://www.postgresql.org/download/windows/
- **Git** — https://git-scm.com/download/win

---

## Installation locale pas à pas (Windows)

### 1. Cloner le dépôt

```bat
git clone <url-du-depot> C:\HelpDesk\app
cd C:\HelpDesk\app
```

### 2. Installer PostgreSQL et créer la base de données

Ouvrir **pgAdmin** ou **psql** en tant qu'administrateur, puis exécuter :

```sql
CREATE USER helpdesk_user WITH PASSWORD 'votre_mot_de_passe';
CREATE DATABASE helpdesk_db OWNER helpdesk_user;
GRANT ALL PRIVILEGES ON DATABASE helpdesk_db TO helpdesk_user;
```

### 3. Configurer les variables d'environnement du serveur

```bat
copy server\.env.example server\.env
```

Ouvrir `server\.env` dans un éditeur et renseigner les valeurs :

```env
DATABASE_URL=postgresql://helpdesk_user:votre_mot_de_passe@localhost:5432/helpdesk_db
JWT_SECRET=une-cle-secrete-minimum-32-caracteres-aleatoires
PORT=3001
UPLOADS_PATH=./uploads
APP_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=votre@email.com
SMTP_PASS=votre_mot_de_passe_smtp
SMTP_FROM="Mon Helpdesk <noreply@helpdesk.com>"
```

> **Astuce JWT_SECRET** : générer une clé avec Node.js :
> ```bat
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

### 4. Installer les dépendances

Depuis la racine du projet :

```bat
npm install
npm run install:all
```

### 5. Initialiser la base de données

```bat
cd server
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
cd ..
```

### 6. Créer le dossier uploads

```bat
mkdir server\uploads\attachments
mkdir server\uploads\logo
```

### 7. Lancer l'application en mode développement

Depuis la racine :

```bat
npm run dev
```

Cela démarre en parallèle :
- **Backend** Express sur http://localhost:3001
- **Frontend** Vite sur http://localhost:5173

Ouvrir http://localhost:5173 dans le navigateur.

### 8. Identifiants par défaut (seed)

| Email                  | Mot de passe | Rôle          |
|------------------------|--------------|---------------|
| admin@helpdesk.com     | admin123     | Administrateur |
| agent1@helpdesk.com    | agent123     | Agent          |
| agent2@helpdesk.com    | agent123     | Agent          |
| agent3@helpdesk.com    | agent123     | Agent          |

> **Important** : changer les mots de passe en production.

---

## Scripts disponibles

| Commande               | Description                                      |
|------------------------|--------------------------------------------------|
| `npm run dev`          | Démarre frontend + backend en développement      |
| `npm run install:all`  | Installe les dépendances client et serveur       |
| `npm run build`        | Compile client et serveur pour la production     |

### Scripts serveur (depuis `/server`)

| Commande                        | Description                     |
|---------------------------------|---------------------------------|
| `npx prisma migrate dev`        | Crée et applique une migration  |
| `npx prisma migrate deploy`     | Applique les migrations en prod |
| `npx ts-node prisma/seed.ts`    | Charge les données initiales    |
| `npx prisma studio`             | Interface visuelle de la DB     |

---

## Structure du projet

```
/
├── client/          # Frontend React + Vite
├── server/          # Backend Express + Prisma
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── jobs/
│   │   ├── utils/
│   │   └── config/
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
├── uploads/         # Fichiers uploadés (non versionné)
├── ecosystem.config.js  # Config PM2 (production Linux)
├── package.json
└── README.md
```

---

## Résolution de problèmes courants

**PostgreSQL introuvable dans le PATH :**
Ajouter `C:\Program Files\PostgreSQL\15\bin` aux variables d'environnement système.

**Port 3001 ou 5173 déjà utilisé :**
Modifier `PORT` dans `server\.env` et/ou le port Vite dans `client\vite.config.ts`.

**Erreur Prisma "Can't reach database server" :**
Vérifier que le service PostgreSQL est démarré : `Services Windows > postgresql-x64-15 > Démarrer`.

**node_modules manquants :**
Relancer `npm run install:all` depuis la racine.
