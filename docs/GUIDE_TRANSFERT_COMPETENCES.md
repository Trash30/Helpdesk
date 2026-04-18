# Guide de transfert de compétences — Helpdesk VOGO

**Objectif :** permettre à tout développeur Node.js/React compétent de reprendre, maintenir et faire évoluer cette application sans connaissance préalable du projet.

**Niveau requis :** développeur web avec 2+ ans d'expérience JavaScript/TypeScript.  
**Temps d'onboarding estimé :** 1 à 2 jours pour comprendre l'ensemble.

---

## 1. Vue d'ensemble rapide

L'application est découpée en deux parties indépendantes :

```
HELPDESK PROJECT/
├── client/          # Frontend React (port 5173 en dev)
├── server/          # Backend API Node.js (port 3001)
├── docs/            # Documentation (ce dossier)
└── ecosystem.config.js  # Configuration PM2 (déploiement)
```

**Flux de données simplifié :**
```
Navigateur → React (client/) → Appels API → Express (server/) → PostgreSQL
```

---

## 2. Prérequis d'installation

### Outils requis
- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **PostgreSQL 15+** — base de données
- **Git** — gestion de version

### Première installation

```bash
# 1. Cloner le dépôt
git clone <url-depot> helpdesk
cd helpdesk

# 2. Installer les dépendances
npm install          # dépendances racine
cd server && npm install
cd ../client && npm install

# 3. Configurer l'environnement
cd server
cp .env.example .env
# Éditer .env avec vos valeurs (voir section 3)

# 4. Initialiser la base de données
npx prisma migrate dev    # applique les migrations
npx prisma db seed        # charge les données de test

# 5. Lancer en développement
cd ..
npm run dev    # lance client + serveur simultanément
```

**Client :** http://localhost:5173  
**API :** http://localhost:3001  
**Compte admin par défaut après seed :** voir `server/prisma/seed.ts`

---

## 3. Configuration (variables d'environnement)

Fichier `server/.env` — **ne jamais committer ce fichier**.

```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/helpdesk"

# Clé secrète JWT (minimum 32 caractères aléatoires)
JWT_SECRET="remplacez-par-une-chaine-aleatoire-longue"

# Environnement
NODE_ENV="development"   # ou "production"

# SMTP pour les emails (reset password, enquêtes)
SMTP_HOST="smtp.votre-serveur.fr"
SMTP_PORT=587
SMTP_USER="helpdesk@vogo.fr"
SMTP_PASS="mot-de-passe-smtp"
SMTP_FROM="Helpdesk VOGO <helpdesk@vogo.fr>"

# URL du frontend (pour les liens dans les emails)
FRONTEND_URL="http://192.168.x.x:5173"
```

**Comment générer un JWT_SECRET sécurisé :**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 4. Structure du code

### Backend — `server/src/`

```
server/src/
├── index.ts              # Point d'entrée — démarre Express
├── app.ts                # Configuration Express (middlewares, routes)
├── routes/               # Un fichier par ressource
│   ├── auth.ts           # Authentification
│   ├── tickets.ts        # Gestion des tickets
│   ├── clients.ts        # Gestion des clients
│   ├── comments.ts       # Commentaires
│   ├── attachments.ts    # Pièces jointes
│   ├── categories.ts     # Catégories tickets
│   ├── users.ts          # Agents
│   ├── roles.ts          # Rôles et permissions
│   ├── dashboard.ts      # Statistiques
│   ├── sports.ts         # Matchs + notes + pièces jointes matchs
│   ├── kb.ts             # Base de connaissances
│   ├── surveys.ts        # Enquêtes satisfaction
│   └── settings.ts       # Paramètres système
├── middleware/
│   ├── auth.ts           # Vérifie le token JWT
│   └── permissions.ts    # Vérifie les permissions RBAC
├── config/
│   └── permissions.ts    # Définition de toutes les permissions
├── services/
│   └── sportsScraper.ts  # Scraping calendriers sportifs
└── jobs/
    ├── surveyJob.ts           # Envoi automatique enquêtes
    └── matchAttachmentPurgeJob.ts  # Nettoyage PDFs matchs (H+6)
```

### Frontend — `client/src/`

```
client/src/
├── main.tsx              # Point d'entrée React
├── App.tsx               # Router principal (React Router v6)
├── pages/                # Une page = une route
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── tickets/          # Liste, détail, création
│   ├── clients/          # Liste, détail
│   ├── admin/            # Panneau administration
│   └── sports/           # Événements du jour
├── components/
│   ├── ui/               # Composants de base (shadcn/ui)
│   ├── common/           # Composants partagés
│   ├── sports/           # Widget calendrier sportif
│   └── clients/          # SlideOver client
├── hooks/
│   ├── useAuth.ts        # Utilisateur courant
│   └── usePermissions.ts # Vérification des droits
└── lib/
    ├── axios.ts           # Client HTTP configuré
    └── utils.ts           # Fonctions utilitaires
```

---

## 5. Tâches de maintenance courantes

### 5.1 Ajouter un champ à un modèle de données

Exemple : ajouter un champ `phone2` à la table `Client`.

```bash
# 1. Modifier server/prisma/schema.prisma
# Ajouter dans le model Client :
#   phone2   String?

# 2. Créer la migration
cd server
npx prisma migrate dev --name add-phone2-to-client

# 3. Adapter la route backend (server/src/routes/clients.ts)
# 4. Adapter le formulaire frontend (client/src/pages/clients/)
```

### 5.2 Ajouter une nouvelle permission

```typescript
// server/src/config/permissions.ts
export const PERMISSION_GROUPS = {
  // ...
  REPORTING: ['reporting.view', 'reporting.export'],  // Nouveau groupe
}
```

Puis assigner la permission aux rôles via l'interface d'administration.

### 5.3 Ajouter une compétition sportive

```typescript
// server/src/services/sportsScraper.ts

// 1. Ajouter à l'union de types
type Competition = 'TOP14' | '...' | 'NOUVELLE_COMPETITION';

// 2. Créer la fonction de scraping
async function scrapeNouvelleCompetition(): Promise<Match[]> {
  // Utiliser axios + cheerio pour parser le HTML
  // OU axios pour consommer une API JSON
  return matchs.filter(m => isInCurrentWeek(m.date));
}

// 3. Enregistrer dans fetchAllMatches()
{ key: 'NOUVELLE_COMPETITION', fetch: scrapeNouvelleCompetition }
```

```typescript
// client/src/components/sports/SportsMatchesWidget.tsx
// 4. Ajouter dans COMPETITION_META et COMPETITION_ORDER
```

### 5.4 Mettre à jour les clés LNH (annuellement)

Les paramètres `seasons_id` et `key` du scraper LNH expirent chaque saison.

```
1. Ouvrir lnh.fr dans un navigateur
2. Ouvrir l'onglet Réseau (F12 → Network)
3. Filtrer sur "XHR" / "Fetch"
4. Naviguer sur la page des matchs
5. Repérer la requête vers l'API LNH (contient seasons_id et key)
6. Mettre à jour server/src/services/sportsScraper.ts fonction scrapeLNH()
7. Redémarrer le serveur (pm2 restart helpdesk-server)
```

### 5.5 Déployer une mise à jour

**Méthode recommandée (depuis Windows) :** utiliser le script PowerShell qui automatise build + SCP + migrations + redémarrage.

```powershell
# Depuis la machine de développement
.\sync-to-server.ps1                  # build + sync
.\sync-to-server.ps1 -WithDb          # + dump et restaure la DB
.\sync-to-server.ps1 -RestartOnly     # juste pm2 restart
.\sync-to-server.ps1 -MigrateOnly     # juste migrations Prisma
```

Le script gère automatiquement :
- `chmod -R 755` sur `client/dist` après SCP (requis pour Nginx/www-data)
- `npm ci`, `prisma generate`, `prisma migrate deploy` sur le serveur
- Redémarrage PM2

**Méthode manuelle (sur le serveur) :**

```bash
cd /opt/helpdesk
cd server && npm install && npx prisma migrate deploy && npm run build
cd ../client && npm install && npm run build
sudo pm2 restart helpdesk-server
sudo chmod -R 755 /opt/helpdesk/client/dist  # si SCP manuel
```

**Prérequis SSH (Windows) :** clé SSH chargée dans l'agent.

```powershell
# En admin PowerShell (une seule fois) :
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

---

## 6. Débogage

### Voir les logs en production

```bash
pm2 logs helpdesk-server          # Temps réel
pm2 logs helpdesk-server --lines 200  # 200 dernières lignes
cat /opt/helpdesk/logs/server-error.log
```

### Requêter la base de données directement

```bash
cd server
npx prisma studio    # Interface graphique sur http://localhost:5555
```

### Tester un endpoint API

```bash
# Login
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vogo.fr","password":"MonMotDePasse1"}'

# Requête authentifiée
curl -b cookies.txt http://localhost:3001/api/tickets
```

### Erreurs fréquentes

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `401 Unauthorized` sur toutes les requêtes | Token expiré ou cookie absent | Se reconnecter |
| `Cannot find module '@prisma/client'` | Client Prisma pas généré | `npx prisma generate` |
| Matchs sportifs absents | Cache scraper / compétition down | Redémarrer le serveur |
| `ECONNREFUSED 5432` | PostgreSQL arrêté | `sudo service postgresql start` |
| Emails non reçus | Config SMTP incorrecte | Vérifier `.env` SMTP_* |
| Note de match disparue le lendemain | Scraper LNR — voir ci-dessous | Ghost match reconstruit automatiquement |
| Note absente sur match scrapé | Heure ISO différente entre scraper et DB | Lookup fuzzy par fingerprint date-only |
| Matchs en doublon dans le widget | Ghost + scrapé même match heure différente | Déduplication par fingerprint date-only |

### Bug connu — notes Pro D2 / Top 14 disparaissent le lendemain

**Cause :** le site LNR déplace les matchs joués vers la section "résultats" le lendemain. Le scraper ne les trouve plus → la card disparaît du widget → la note semble perdue.

**Solution implémentée (avril 2026) :** le widget charge les notes indépendamment du scraper. Si une note existe en DB pour la semaine courante mais que le match n'est plus dans les résultats du scraper, un **"ghost match"** est reconstruit depuis les métadonnées stockées dans `MatchNote` (`homeTeam`, `awayTeam`, `competition`, `matchDate`…). La card réapparaît automatiquement avec sa note.

**Pourquoi LNH n'a pas ce problème :** le scraper Starligue utilise un endpoint AJAX qui retourne le calendrier complet de la saison (`days_id: all`) — les matchs passés restent donc visibles.

**Fichier concerné :** `client/src/components/sports/SportsMatchesWidget.tsx` — fonction `MatchesList`, logiques `ghostMatches` et `getNoteForMatch`.

### Bug connu — notes absentes sur match scrapé (doublons d'heure)

**Cause :** le scraper LNR peut retourner un match avec une heure ISO légèrement différente de celle stockée en base lors de la création de la note (ex. `T20:00:00Z` vs `T19:00:00Z`). La clé exacte (`matchKey`) ne correspond plus → la note n'est pas affichée sur le match scrapé.

**Solution implémentée (avril 2026) :** lookup en deux passes dans `getNoteForMatch()` :
1. Recherche exacte par `matchKey`
2. Si non trouvé, recherche par **fingerprint date-only** : `${competition}_${homeTeam}_${awayTeam}_${YYYY-MM-DD}`

Cela résout aussi les faux doublons (ghost + scrapé affichés simultanément) : le ghost est exclu si le fingerprint existe déjà dans les résultats du scraper.

**Fichier concerné :** `SportsMatchesWidget.tsx` — maps `notesByKey` + `notesByFingerprint`, helper `getNoteForMatch`.

---

## 7. Architecture de décision — comprendre les choix techniques

| Choix | Alternative considérée | Raison du choix |
|-------|----------------------|-----------------|
| PostgreSQL | MySQL, MongoDB | ACID, support JSON, Prisma mature |
| Prisma ORM | Sequelize, TypeORM | Typage TypeScript natif, migrations versionées |
| JWT + Cookie httpOnly | Sessions serveur | Stateless, pas de gestion de session Redis |
| React 18 + Vite | Next.js | SSR inutile pour app interne, build plus rapide |
| TailwindCSS | Bootstrap, MUI | Customisation totale, taille bundle réduite |
| shadcn/ui | MUI, Ant Design | Composants copiés (pas de dépendance npm) |
| PM2 | Docker | Déploiement simple sans orchestration |
| Scraping sports | API payante | Économie de coût, données publiques |

---

## 8. Conventions de code

### Backend

```typescript
// Route : validation Zod → logique métier → réponse JSON
router.post('/', requirePermission('tickets.create'), async (req, res) => {
  const body = CreateTicketSchema.parse(req.body);  // Valide ou throw 400
  const ticket = await prisma.ticket.create({ data: body });
  res.status(201).json(ticket);
});

// Toujours utiliser try/catch ou un wrapper async
```

### Frontend

```typescript
// TanStack Query v5 pour les données serveur
const { data, isLoading } = useQuery({
  queryKey: ['tickets', filters],
  queryFn: async () => (await api.get('/tickets', { params: filters })).data,
  staleTime: 1000 * 60,  // 1 minute
});

// Vérification des permissions
const { can } = usePermissions();
{can('tickets.create') && <Button>Nouveau ticket</Button>}
```

### Commits

```
feat(tickets): ajouter filtre par pôle
fix(scraper): corriger scraping TOP14 après refonte LNR
refactor(auth): simplifier middleware validation token
```

---

## 9. Points de contact et ressources

| Ressource | Emplacement |
|-----------|-------------|
| Documentation API | `docs/API_REFERENCE.md` |
| Documentation sécurité | `docs/SECURITE.md` |
| Schéma base de données | `server/prisma/schema.prisma` |
| Configuration déploiement | `ecosystem.config.js` |
| Guide installation Linux | `GUIDE-DEPLOIEMENT-UBUNTU.html` |
| Guide installation Windows | `GUIDE-DEPLOIEMENT-WINDOWS.html` |
| Données de test | `server/prisma/seed.ts` |

---

## 10. Checklist reprise du projet

- [ ] Node.js 20+ et PostgreSQL 15+ installés
- [ ] Dépôt cloné, `npm install` exécuté dans `server/` et `client/`
- [ ] Fichier `server/.env` créé avec les bonnes valeurs
- [ ] `npx prisma migrate dev` exécuté sans erreur
- [ ] `npx prisma db seed` exécuté — accès admin fonctionnel
- [ ] `npm run dev` lancé — dashboard visible sur http://localhost:5173
- [ ] Lu `docs/API_REFERENCE.md` pour comprendre les endpoints
- [ ] Lu `docs/SECURITE.md` pour comprendre le modèle d'accès
- [ ] Créé un ticket de test complet (création → assignation → clôture)
- [ ] Testé l'upload d'un fichier
- [ ] Consulté Prisma Studio (`npx prisma studio`) pour visualiser la BDD
