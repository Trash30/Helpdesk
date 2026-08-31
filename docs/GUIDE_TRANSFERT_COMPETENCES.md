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

# Origines CORS autorisées en production (séparées par virgule)
# Obligatoire en NODE_ENV=production — sans cette variable, toutes les requêtes cross-origin sont refusées
ALLOWED_ORIGINS="http://192.168.x.x:5173"
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
├── routes/               # Un fichier par ressource (21 fichiers)
│   ├── auth.ts           # Authentification + préférences compétitions
│   ├── tickets.ts        # Gestion des tickets
│   ├── clients.ts        # Gestion des clients
│   ├── comments.ts       # Commentaires
│   ├── attachments.ts    # Pièces jointes tickets
│   ├── categories.ts     # Catégories tickets
│   ├── clientRoles.ts / organisations.ts / clubs.ts / poles.ts / ticketTypes.ts  # Référentiels
│   ├── users.ts          # Agents
│   ├── roles.ts          # Rôles et permissions
│   ├── dashboard.ts      # Statistiques
│   ├── sports.ts         # Matchs de la semaine + refresh
│   ├── matchNotes.ts     # Notes de match + images + rapport hebdo
│   ├── matchAttachments.ts  # PDF joints aux matchs (purge H+6)
│   ├── commercialEvents.ts  # Missions Support terrain
│   ├── bmcCards.ts       # Cartes BMC des serveurs LNR
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
    ├── colors.ts          # Source de vérité des tokens couleur (PRIORITY_TOKENS, STATUS_TOKENS)
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

Tout se passe dans `server/src/config/permissions.ts` — **source de vérité unique** (le seed `server/prisma/seed.ts` s'appuie dessus).

```typescript
// 1. Ajouter la/les clés dans PERMISSIONS
export const PERMISSIONS = {
  // ...
  REPORTING: { VIEW: 'reporting.view', EXPORT: 'reporting.export' },
} as const;

// 2. Étendre PERMISSIONS_LIST
export const PERMISSIONS_LIST: string[] = [
  // ...
  ...Object.values(PERMISSIONS.REPORTING),
];

// 3. Ajouter le groupe affiché dans l'éditeur de rôles (PERMISSION_GROUPS)
{
  key: 'reporting',
  label: 'Reporting',
  icon: 'BarChart2',            // nom d'icône lucide-react
  permissions: [
    { key: 'reporting.view',   label: 'Voir les rapports',      description: '...' },
    { key: 'reporting.export', label: 'Exporter les rapports',  description: '...' },
  ],
}

// 4. (optionnel) Ajouter aux rôles par défaut : ADMIN_PERMISSIONS / AGENT_PERMISSIONS
```

Puis `requirePermission('reporting.view')` sur les routes concernées, et assigner la permission aux rôles via l'interface d'administration.

> État actuel : **28 permissions**, 8 groupes (Tickets, Clients, Commentaires, Enquêtes, Admin, Base de connaissance, Missions Support, Cartes BMC).

### 5.3 Ajouter une compétition sportive

**Fichiers à modifier (4) :** `sportsScraper.ts`, `SportsMatchesWidget.tsx`, `auth.ts` (route), `ProfilePage.tsx`

**1. Backend — scraper** (`server/src/services/sportsScraper.ts`) :

```typescript
// Étendre l'union de types
type Competition = 'TOP14' | '...' | 'NOUVELLE_COMPETITION';

// Approche A — Scraping HTML (LNR, EPCR) :
async function scrapeNouvelleCompetition(): Promise<Match[]> {
  const resp = await createClient().get('https://...');
  const $ = cheerio.load(resp.data);
  // parser les matchs depuis le DOM
  return matches.filter(m => isInCurrentWeek(m.date));
}

// Approche B — Flux iCal (utilisé pour ESTONIE / jalgpall.ee) :
async function scrapeNouvelleCompetition(): Promise<Match[]> {
  const resp = await createClient().get('https://.../feed.ics', { responseType: 'arraybuffer' });
  const ical = Buffer.from(resp.data).toString('utf-8');
  const eventBlocks = ical.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  // parser SUMMARY (homeTeam vs awayTeam), DTSTART, LOCATION par regex
  // Convertir DTSTART (timezone locale) en UTC avant isInCurrentWeek()
  return matches.filter(m => isInCurrentWeek(m.date));
}

// Enregistrer dans fetchAllMatches()
{ key: 'NOUVELLE_COMPETITION', fetch: scrapeNouvelleCompetition }
```

**2. Frontend — widget** (`client/src/components/sports/SportsMatchesWidget.tsx`) :

```typescript
// Ajouter au type Competition
export type Competition = '...' | 'NOUVELLE_COMPETITION';

// Ajouter dans COMPETITION_META
NOUVELLE_COMPETITION: { label: 'Nom affiché', favicon: 'https://...', calendarUrl: 'https://...' }

// Ajouter dans COMPETITION_ORDER
const COMPETITION_ORDER: Competition[] = [..., 'NOUVELLE_COMPETITION'];
```

**3. Route API** (`server/src/routes/auth.ts`) — ajouter la valeur à `VALID_COMPETITIONS` **et** augmenter le `.max()` du schéma Zod :

```typescript
const VALID_COMPETITIONS = ['TOP14', ..., 'NOUVELLE_COMPETITION'] as const;
// ...
sportCompetitions: z.array(z.enum(VALID_COMPETITIONS)).max(7),  // ← passer à 8
```

> `VALID_COMPETITIONS` ne contient que les compétitions **sélectionnables en préférence utilisateur** (7 actuellement). `LIGUE1` est scrapée et affichée dans le widget mais n'est pas une préférence — elle n'est donc pas dans cette liste.

**4. Profil utilisateur** (`client/src/pages/ProfilePage.tsx`) — ajouter dans la liste `COMPETITIONS` :

```typescript
const COMPETITIONS = [
  ...
  { key: 'NOUVELLE_COMPETITION', label: 'Nom affiché' },
] as const;
```

> **Exemple concret :** la Premium Liiga estonienne (ESTONIE) utilise l'approche iCal B. Son flux est disponible sur `https://jalgpall.ee/voistlused/download.php?type=calendar.download&action=download&league_id=52`. Le `league_id` est à mettre à jour si la fédération change d'identifiant de saison.

> **Note diffuseur :** `broadcasterLogo` est automatiquement affiché dans le widget et persisté en base lors du premier save d'une note. Il apparaît ensuite dans le CR DOCX exporté sous la date du match (ligne `Diffuseur : [logo]`).

### 5.4 Mettre à jour les clés LNH (annuellement)

Les paramètres `seasons_id` et `key` du scraper LNH expirent chaque saison. L'URL du calendrier
dépend aussi du **naming sponsor**, qui change périodiquement : `/liquimoly-starligue/` →
`/daikin-starligue/` (août 2026). Vérifier le slug courant sur lnh.fr.

```
1. Ouvrir lnh.fr dans un navigateur
2. Ouvrir l'onglet Réseau (F12 → Network)
3. Filtrer sur "XHR" / "Fetch"
4. Naviguer sur la page des matchs (ex. https://www.lnh.fr/daikin-starligue/calendrier)
5. Repérer la requête POST /ajaxpost1 (contient seasons_id et key)
6. Mettre à jour server/src/services/sportsScraper.ts fonction scrapeLNH() :
   - seasons_id, key
   - LNH_BASE + slug dans l'URL et le header Referer si le naming sponsor a changé
7. Répercuter le label affiché ('Daikin Starligue') dans SportsMatchesWidget.tsx
   (COMPETITION_META) et ProfilePage.tsx (COMPETITIONS) — la clé reste 'LNH'
8. Redémarrer le serveur (sudo pm2 restart helpdesk-server)
```

### 5.5 Déployer une mise à jour

**Méthode recommandée (sur le serveur, via git) :**

Le serveur de test est configuré comme repo git — récupérer les changements directement :

```bash
cd /opt/helpdesk
git pull origin main

cd server && npm ci && npx prisma migrate deploy && npm run build
cd ../client && npm run build
sudo pm2 restart helpdesk-server       # toujours sudo pm2 sur ce serveur
sudo chmod -R 755 /opt/helpdesk/client/dist
```

> **Important :** utiliser `sudo pm2` pour toutes les opérations PM2 — le process tourne en `root`. Un `pm2` sans sudo crée une double instance et un conflit de port.

**Vérifications post-mise à jour selon le type de changement :**

| Type de modification | Actions supplémentaires |
|----------------------|------------------------|
| Nouvelles migrations Prisma | `npx prisma migrate deploy` (inclus dans la commande ci-dessus) |
| Nouvelle variable d'environnement | Éditer `server/.env` avant le build, puis `sudo pm2 restart` |
| Correctifs sécurité (CORS, rate-limit…) | Vérifier `ALLOWED_ORIGINS` dans `.env` (voir section 3) |
| Corrections design/frontend uniquement | `cd client && npm run build` + `sudo chmod -R 755 /opt/helpdesk/client/dist` — pas besoin de rebuild backend |
| Changements backend uniquement | `cd server && npm ci && npm run build` + `sudo pm2 restart helpdesk-server` — pas besoin de rebuild frontend |

**Méthode alternative (depuis Windows via SCP) :**

```powershell
# Depuis la machine de développement
.\sync-to-server.ps1                  # build + sync
.\sync-to-server.ps1 -WithDb          # + dump et restaure la DB
.\sync-to-server.ps1 -RestartOnly     # juste pm2 restart
.\sync-to-server.ps1 -MigrateOnly     # juste migrations Prisma
```

**Prérequis SSH (Windows) :** clé SSH chargée dans l'agent.

```powershell
# En admin PowerShell (une seule fois) :
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

**Configuration VITE_API_URL :** le fichier `client/.env` sur le serveur doit avoir `VITE_API_URL=` vide (ou absent). Nginx proxy `/api/*` vers le backend — une URL hardcodée contourne Nginx et casse le préfixe des routes.

---

### 5.6 Changer l'adresse IP locale du serveur

Le CORS est configuré pour accepter automatiquement toutes les IP privées (192.168.x.x, 10.x.x.x, 172.16–31.x.x) — **aucune modification de `ALLOWED_ORIGINS` n'est nécessaire** lors d'un changement d'IP.

La seule variable à mettre à jour est `FRONTEND_URL`, utilisée pour les liens dans les emails :

```bash
ssh ubuntu@<nouvelle-ip>
nano /opt/helpdesk/server/.env
```

```env
FRONTEND_URL=http://<nouvelle-ip>    # liens dans les emails (reset password, enquêtes)
```

```bash
sudo pm2 restart helpdesk-server
```

> **Nginx** utilise `server_name helpdesk.local _;` — il accepte toute IP ou le hostname `helpdesk.local` sans modification. Les appels API du frontend sont en URL relative (`/api/...`) — ils suivent automatiquement l'adresse de Nginx.

---

### 5.7 Rendre le serveur accessible par hostname fixe (recommandé)

Pour ne plus jamais avoir à changer l'IP dans la configuration, configurer `avahi-daemon` sur le serveur Ubuntu. Cela publie le nom `helpdesk.local` sur le réseau local via mDNS — les clients Windows 10+, macOS et Linux le résolvent automatiquement sans modifier leurs fichiers `hosts`.

**Installation sur le serveur (une seule fois) :**

```bash
sudo apt install avahi-daemon -y
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Définir le hostname du serveur
sudo hostnamectl set-hostname helpdesk
```

Le serveur sera accessible via `http://helpdesk.local` depuis tous les postes du réseau.

**Mettre à jour Nginx pour répondre au hostname :**

```nginx
# /etc/nginx/sites-available/helpdesk
server {
    listen 80;
    server_name helpdesk.local _;   # ajouter helpdesk.local
    ...
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Mettre à jour `server/.env` avec le hostname fixe :**

```env
FRONTEND_URL=http://helpdesk.local
ALLOWED_ORIGINS=http://helpdesk.local
```

```bash
sudo pm2 restart helpdesk-server
```

Désormais l'IP peut changer (DHCP) — le nom `helpdesk.local` continue de fonctionner sans aucune modification de configuration.

> **Compatibilité :** Windows 10+, macOS et Ubuntu supportent mDNS nativement. Sur d'autres Linux, installer `avahi-daemon` + `libnss-mdns` côté client.

---

### 5.8 Missions Support & Cartes BMC

Deux modules récents, tous deux 100 % CRUD REST + page React dédiée.

**Missions Support** (`/evenements/commercial`, ex-« événements commerciaux ») :
- Modèle `CommercialEvent`, routes `server/src/routes/commercialEvents.ts`, page `client/src/pages/commercial/CommercialEventsPage.tsx`.
- Permission `events.create` pour créer / lister ses missions ; édition et suppression réservées au **créateur** ou à un `admin.access`.
- `/commercial-events/today` et `/upcoming` sont ouverts à tout utilisateur authentifié (widget dashboard + page « Événements du jour »).

**Cartes BMC** (`/bmc-cards`) :
- Modèle `BmcCard` (`@@unique` sur `ip`), routes `server/src/routes/bmcCards.ts`, page `client/src/pages/BmcCardsPage.tsx`.
- Permissions `bmc.view` / `bmc.manage` / `bmc.delete`.
- **Règle de sécurité** : `ip` doit être une IPv4 privée RFC 1918 (regex `PRIVATE_IPV4_RE` dans `bmcCards.ts`, même esprit que `PRIVATE_IP_RE` du CORS). `division` ∈ `{ TOP14, PRO_D2 }`.
- Pas de migration à prévoir hors ajout de champ — suivre la procédure §5.1.

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

## 8. Gestion des images dans les notes de match

### Fonctionnement

Les opérateurs peuvent coller (Ctrl+V), glisser-déposer ou sélectionner une image via le bouton de la toolbar de l'éditeur TipTap. L'image est immédiatement uploadée sur le serveur et insérée dans l'éditeur via son URL relative.

**Flux complet :**
1. L'utilisateur colle/uploade une image → `POST /api/sports/match-notes/upload-image`
2. Le serveur stocke le fichier dans `UPLOADS_PATH/match-note-images/` et retourne `{ url: "/api/sports/match-notes/images/uuid.png" }`
3. TipTap insère `<img src="/api/sports/match-notes/images/uuid.png">` dans le HTML de la note
4. Lors du `PUT /:matchKey`, sanitize-html conserve la balise `<img>` avec son `src` relatif (whitelist explicite)
5. Lors de l'export CR Word, le client refetch l'image via `fetch(url, { credentials: 'include' })` et l'embarque dans le DOCX via `ImageRun`

### Stockage serveur

```
UPLOADS_PATH/
└── match-note-images/
    ├── b724a3bd-85eb-460b-b681-6013e641d67f.png
    └── d37e7a6d-265d-4475-a7cb-c84179a6ee67.png
```

`UPLOADS_PATH` est défini dans `server/.env` (ex : `/opt/helpdesk/uploads`). Si absent, fallback sur `<cwd>/uploads`.

### Points d'attention maintenance

- **Les images sont permanentes** : il n'y a pas de garbage collection automatique. Si une note est supprimée, ses images restent sur le disque. Un nettoyage manuel peut être nécessaire si l'espace disque devient critique.
- **Accès direct bloqué** : `/uploads/match-note-images/` est bloqué par Express avant le middleware `static` → retourne 403. Seule la route `/api/sports/match-notes/images/:filename` (authentifiée) permet d'accéder aux fichiers.
- **Compatibilité OOXML** : dans docx v9, un `<w:p>` contenant uniquement un `<w:drawing>` (ImageRun) sans `<w:r>` (TextRun) est ignoré par Word. La fonction `htmlToDocxParagraphs` ajoute systématiquement un `TextRun('')` à côté de chaque `ImageRun`.

---

## 9. Conventions de code

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

### Couleurs — ne jamais coder de hex en dur

Toutes les couleurs fonctionnelles (statuts, priorités) sont centralisées dans `client/src/lib/colors.ts`. Ne jamais écrire de valeur hex en dur dans les composants — importer depuis ce fichier.

```typescript
import { PRIORITY_TOKENS, STATUS_TOKENS, type PriorityKey } from '@/lib/colors';

// Utilisation dans un composant
const token = PRIORITY_TOKENS[priority as PriorityKey];
// → token.bg (fond), token.fg (texte), token.solid (Recharts charts)
```

La couleur primaire VOGO (`#185FA5`) est définie via le token CSS `--primary` dans `client/src/index.css`. Utiliser `bg-primary`, `text-primary`, `border-primary` (classes Tailwind) ou `hsl(var(--primary))` en CSS.

### Commits

```
feat(tickets): ajouter filtre par pôle
fix(scraper): corriger scraping TOP14 après refonte LNR
refactor(auth): simplifier middleware validation token
```

---

## 10. Points de contact et ressources

| Ressource | Emplacement |
|-----------|-------------|
| Index de la documentation | `docs/README.md` |
| Architecture fonctionnelle | `docs/ARCHITECTURE.md` |
| Documentation API | `docs/API_REFERENCE.md` |
| Documentation sécurité | `docs/SECURITE.md` |
| Troubleshooting déploiement | `docs/TROUBLESHOOTING_DEPLOIEMENT.md` |
| Guide utilisateur agent (FR/EN) | `docs/GUIDE_UTILISATEUR_AGENT.md` / `_EN.md` |
| Calendrier de charge 2026-2027 | `docs/CALENDRIER_CHARGE_2026_2027.html` |
| Calendrier ETP 2026-2027 | `docs/CALENDRIER_ETP_2026_2027.html` |
| Schéma base de données | `server/prisma/schema.prisma` |
| Configuration déploiement | `ecosystem.config.js` |
| Script de synchronisation Windows → serveur | `sync-to-server.ps1` |
| Données de test | `server/prisma/seed.ts` |

---

## 11. Checklist reprise du projet

- [ ] Node.js 20+ et PostgreSQL 15+ installés
- [ ] Dépôt cloné, `npm install` exécuté dans `server/` et `client/`
- [ ] Fichier `server/.env` créé avec les bonnes valeurs
- [ ] `npx prisma migrate dev` exécuté sans erreur
- [ ] `npx prisma db seed` exécuté — accès admin fonctionnel
- [ ] `npm run dev` lancé — dashboard visible sur http://localhost:5173
- [ ] Lu `docs/ARCHITECTURE.md` pour comprendre la structure globale
- [ ] Lu `docs/API_REFERENCE.md` pour comprendre les endpoints
- [ ] Lu `docs/SECURITE.md` pour comprendre le modèle d'accès
- [ ] Créé un ticket de test complet (création → assignation → clôture)
- [ ] Testé l'upload d'un fichier
- [ ] Consulté Prisma Studio (`npx prisma studio`) pour visualiser la BDD
