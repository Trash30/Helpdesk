# Architecture Fonctionnelle — Helpdesk VOGO

> Document destiné aux architectes et équipes de développement.  
> Version : novembre 2026 — Branche `main` (après suppression du module ticketing)

---

## 1. Vue d'ensemble

**Helpdesk VOGO** est une application web interne de support opérationnel pour le groupe VOGO. Depuis novembre 2026, le module de gestion de tickets (tickets, clients, commentaires, enquêtes de satisfaction) a été retiré. L'application couvre désormais :

- le **calendrier sportif** de la semaine (scraping de 12 compétitions), avec notes de match, PDF joints, export et archivage du compte-rendu hebdomadaire (CR) ;
- la préparation et la création des **groupes WhatsApp** des matchs ;
- les **Missions Support** terrain ;
- les **cartes BMC** des serveurs LNR ;
- la **base de connaissance** (KB) ;
- l'administration (agents, rôles, catégories KB, paramètres).

### Acteurs principaux

| Acteur | Description |
|--------|-------------|
| **Agent** | Rôle système par défaut : notes/PDF de matchs (`sports.edit`), consultation et édition des cartes BMC |
| **Administrateur** | Toutes les permissions : gère agents, rôles, catégories KB, paramètres, suppressions |
| **Rôles personnalisés** | Combinaisons libres des 13 permissions (ex. KB seule, WhatsApp seul…) |

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVIGATEUR                              │
│  React 18 + Vite + TailwindCSS + shadcn/ui + TanStack Query    │
│  Port 5173 (dev) / servi par Nginx sur le port 5173 (prod)      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (réseau interne) / REST JSON
                               │ Cookie httpOnly (JWT)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY — Nginx                       │
│  :5173  /api/* → backend:3001   /uploads/* → fichiers statiques │
│         /  → frontend build statique (client/dist)              │
└──────────┬───────────────────────────────────────┬─────────────┘
           │                                       │
           ▼                                       ▼
┌──────────────────────┐                ┌─────────────────────────┐
│  API — Express/Node  │                │  Fichiers uploadés      │
│  Port 3001           │                │  /uploads/ (disque)     │
│  TypeScript          │                │  Protégés par auth      │
│  Géré par PM2 (root) │                └─────────────────────────┘
└──────────┬───────────┘
           │ Prisma ORM
           ▼
┌──────────────────────┐
│  PostgreSQL           │
│  Port 5432            │
└──────────────────────┘
           │
           ▼ (scraping externe, SMTP, WhatsApp Web)
┌──────────────────────────────────────────────────────────────────┐
│  Services externes                                               │
│  • Sites sportifs (LNR, LNH, EPCR, ELMS, AS Monaco, FIS…)       │
│  • Serveur SMTP (SMTP_HOST) — emails de réinitialisation        │
│  • WhatsApp Web (whatsapp-web.js + Chrome headless)             │
└──────────────────────────────────────────────────────────────────┘
```

> Le port 3001 est l'API seule : une requête sur `/` renvoie « Route introuvable ». L'interface est servie par Nginx.

---

## 3. Frontend

### 3.1 Structure générale

```
client/src/
├── main.tsx                  # Point d'entrée React
├── App.tsx                   # Router + QueryClient + Providers
├── layouts/
│   └── MainLayout.tsx        # Shell avec sidebar + header
├── pages/                    # Pages routées
├── components/               # auth/, common/, sports/, ui/ (shadcn)
├── hooks/                    # usePermissions, useBranding, useDebounce
├── stores/                   # authStore, brandingStore (Zustand)
└── lib/
    ├── axios.ts              # Client HTTP configuré
    ├── whatsappGroups.ts     # Préparation des groupes WhatsApp
    └── utils.ts
```

### 3.2 Routing (React Router v6)

#### Routes publiques (sans authentification)
| Path | Composant | Description |
|------|-----------|-------------|
| `/login` | `LoginPage` | Formulaire de connexion |
| `/reset-password/:token` | `ResetPasswordPage` | Réinitialisation mot de passe |
| `/403` | `ForbiddenPage` | Page d'accès refusé |
| `/404` | `NotFoundPage` | Page introuvable |

#### Routes protégées (JWT requis)
| Path | Composant | Permission requise |
|------|-----------|-------------------|
| `/` | `SmartDefaultRedirect` | Authentifié (redirige selon les droits) |
| `/dashboard` | `DashboardPage` | Authentifié |
| `/profile` | `ProfilePage` | Authentifié |
| `/change-password` | `ChangePasswordPage` | Authentifié |
| `/evenements/aujourd-hui` | `TodayEventsPage` | Authentifié |
| `/kb` | `KbListPage` | `kb.read` |
| `/kb/new` | `KbArticlePage` | `kb.write` |
| `/kb/:id` | `KbArticlePage` | `kb.read` |
| `/evenements/commercial` | `CommercialEventsPage` | `events.create` |
| `/whatsapp-groupes` | `WhatsAppGroupsPage` | `whatsapp.groups` |
| `/bmc-cards` | `BmcCardsPage` | `bmc.view` |

#### Routes admin
| Path | Composant | Permission requise |
|------|-----------|-------------------|
| `/admin/settings` | `AdminSettingsPage` | `admin.settings` |
| `/admin/categories` | `AdminCategoriesPage` | `admin.categories` |
| `/admin/roles` | `AdminRolesPage` | `admin.roles` |
| `/admin/users` | `AdminUsersPage` | `admin.users` |

### 3.3 Composants clés

#### Layout et auth
- **`MainLayout`** — Sidebar navigation + header utilisateur + zone de contenu. Wrap toutes les pages authentifiées.
- **`ProtectedRoute`** — Vérifie le JWT et optionnellement une permission (`requiredPermission`). Redirige vers `/login` ou `/403`.
- **`ErrorBoundary`** — Capture les erreurs React non gérées.
- **`ConfirmDialog`** — Dialog de confirmation générique.

#### Composants Sports
| Composant | Rôle |
|-----------|------|
| `SportsMatchesWidget` | Widget dashboard — liste des matchs de la semaine par compétition, notes et PDF |
| `MatchNoteEditor` | Éditeur de notes de match (Tiptap rich text) avec feu tricolore VERT/ORANGE/ROUGE |
| `MatchReportExport` | Export DOCX du compte-rendu hebdomadaire et archivage serveur — feux tricolores via canvas, groupement par compétition |
| `SeasonCalendarWidget` | Vue annuelle (projection de la saison) |

#### UI (shadcn/ui)
`badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `progress`, `select`, `separator`, `sheet`, `skeleton`, `switch`, `tabs`, `tooltip`, `PasswordStrength`

### 3.4 State management

- **Serveur** : TanStack Query v5 — cache, invalidation. `staleTime: 30s` global, `1h` pour les matchs sportifs.
- **Global léger** : Zustand — `authStore` (utilisateur courant + permissions, persisté dans `localStorage`) et `brandingStore` (logo, nom).
- **UI locale** : `useState` / `useReducer` React.

> Les permissions du `authStore` ne sont rafraîchies qu'au login : après un changement de rôle, l'utilisateur doit se reconnecter.

### 3.5 Client HTTP

```typescript
// @/lib/axios — instance configurée
baseURL: VITE_API_URL || 'http://localhost:3001'
withCredentials: true  // envoie le cookie httpOnly
```

> En production, `VITE_API_URL` doit rester **vide** : le frontend appelle `/api` en relatif et Nginx relaie vers le backend.  
> Exception : routes auth → préfixe `/api/auth/...`

---

## 4. Backend

### 4.1 Structure

```
server/src/
├── index.ts              # Démarrage serveur + jobs cron + reprise session WhatsApp
├── app.ts                # Express app — middlewares + routes
├── config/
│   └── permissions.ts    # Définition des 13 permissions et groupes
├── middleware/
│   ├── auth.ts           # authMiddleware — vérifie JWT cookie
│   └── permissions.ts    # requirePermission() + hasPermission()
├── routes/               # 13 fichiers de routes
├── services/
│   ├── sportsScraper.ts  # Scraping des compétitions sportives
│   └── whatsappService.ts # Session whatsapp-web.js + jobs de création de groupes
├── jobs/
│   └── matchAttachmentPurgeJob.ts  # Cron horaire — purge fichiers H+6
├── utils/
│   ├── jwt.ts            # signToken / verifyToken
│   ├── password.ts       # hashPassword / comparePassword (bcrypt)
│   ├── email.ts          # sendEmail + template HTML brandé
│   └── upload.ts         # Config multer (types autorisés, limites)
└── lib/
    └── prisma.ts         # Instance Prisma singleton
```

### 4.2 Middlewares globaux (dans l'ordre d'application)

| Middleware | Rôle |
|-----------|------|
| `trust proxy 1` | Confiance au proxy Nginx — IP client correcte pour rate-limiter |
| `helmet` | Headers sécurité (CSP, HSTS…) + CORP cross-origin pour les assets |
| `cors` | Dev : `*` / Prod : IP privées RFC 1918 autorisées d'office + origines de `ALLOWED_ORIGINS` |
| `morgan` | Logs HTTP (`dev` / `combined` selon NODE_ENV) |
| `cookieParser` | Parse le cookie `helpdesk_token` |
| `express.json` | Body JSON — limite 10 Mo |
| `express.static` | Sert `/uploads/*` (sauf `/uploads/match-attachments` et `/uploads/match-note-images` → 403, servis via routes authentifiées) |

### 4.3 Authentification

**Flux login :**
1. `POST /api/auth/login` — validation email/password (Zod)
2. Rate-limit : 10 requêtes/min par IP
3. Vérification bcrypt du mot de passe
4. Signature JWT (`HS256`, 8h) → cookie `helpdesk_token` httpOnly, SameSite=lax
5. La réponse inclut le profil utilisateur et ses permissions

**Validation par requête (`authMiddleware`) :**
1. Lecture du cookie `helpdesk_token` (fallback : header `Authorization: Bearer`)
2. Vérification signature JWT
3. Rechargement de l'utilisateur + rôle depuis PostgreSQL (permissions fraîches)
4. Vérification que `token.iat > role.roleUpdatedAt` — invalide les sessions si les permissions changent
5. Si `mustChangePassword = true` → seules `/api/auth/me` et `/api/auth/change-password` sont accessibles

**Reset mot de passe :**
- Token aléatoire haché en SHA-256 — persisté en base, expiration 24 h, usage unique
- Lien envoyé par email SMTP (`APP_URL/reset-password/<token>`)

### 4.4 Autorisation (RBAC)

Le système est basé sur des **rôles** portant une liste de **permissions** (string[]). Source de vérité : `server/src/config/permissions.ts`.

#### 13 permissions définies

| Domaine | Permissions |
|---------|-------------|
| **Admin** | `admin.access`, `admin.users`, `admin.roles`, `admin.categories`, `admin.settings` |
| **Base de connaissance** | `kb.read`, `kb.write` |
| **Calendrier sportif** | `sports.edit` (notes, PDF, rapports CR, refresh) |
| **Missions Support** | `events.create` |
| **Cartes BMC** | `bmc.view`, `bmc.manage`, `bmc.delete` |
| **Groupes WhatsApp** | `whatsapp.groups` |

Rôles système : **Admin** (toutes) et **Agent** (`sports.edit`, `bmc.view`, `bmc.manage`).

> La migration `20261117120000_remove_ticketing` a converti `tickets.create` en `sports.edit` et retiré les permissions `tickets.*`, `clients.*`, `comments.*`, `surveys.*` et `admin.clientRoles` de tous les rôles.

#### Principe d'application
```typescript
// Middleware sur une route
requirePermission('sports.edit')

// Vérification inline (logique métier)
if (!hasPermission(req.user!, 'admin.access')) {
  res.status(403).json({ error: 'Permission refusée' });
}
```

### 4.5 Catalogue des routes API

Détail complet (corps, réponses, erreurs) : `docs/API_REFERENCE.md`.

#### Auth — `/api/auth`
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| POST | `/login` | Non | Connexion, génère cookie JWT |
| POST | `/logout` | Non | Supprime le cookie |
| GET | `/me` | Oui | Profil utilisateur courant |
| PATCH | `/change-password` | Oui | Changement de mot de passe |
| PATCH | `/sport-competitions` | Oui | Met à jour les préférences de compétitions sportives |
| GET | `/validate-reset-token/:token` | Non | Vérifie validité du lien de reset |
| POST | `/reset-password` | Non | Reset mot de passe via token |

#### Sports — `/api/sports`
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/matches` | Oui | Matchs de la semaine (cache en mémoire, 12 compétitions) |
| GET | `/season-calendar` | Oui | Calendrier de saison (projection statique) |
| POST | `/refresh` | `sports.edit` ou `whatsapp.groups` | Vide le cache et re-scrape (cooldown 30s) |
| POST | `/match-attachments` | `sports.edit` | Upload pièce jointe match (PDF, 10 Mo) |
| POST | `/match-attachments/query` | Authentifié | Pièces jointes de plusieurs matchs (`matchKeys[]`) |
| GET | `/match-attachments/:id/download` | Authentifié | Téléchargement sécurisé |
| DELETE | `/match-attachments/:id` | `admin.access` | Suppression |
| GET | `/match-notes` | Authentifié | Toutes les notes de match |
| GET | `/match-notes/team-members` | Authentifié | Agents éligibles technicien chaperon |
| GET | `/match-notes/report/week` | Authentifié | Notes de la semaine ISO courante |
| GET | `/match-notes/proxy-image` | Authentifié | Proxy d'image distante (export CR) |
| POST | `/match-notes/upload-image` | `sports.edit` | Upload image collée dans l'éditeur TipTap |
| GET | `/match-notes/images/:filename` | Authentifié | Sert une image de note |
| PUT | `/match-notes/:matchKey` | `sports.edit` | Créer/mettre à jour une note (upsert) |
| DELETE | `/match-notes/:matchKey` | Authentifié | Supprimer une note |
| POST | `/reports` | `sports.edit` | Archiver un CR hebdomadaire (.docx, 25 Mo max) |
| GET | `/reports` | Authentifié | Historique des CR archivés |
| GET | `/reports/:id/download` | Authentifié | Télécharger un CR |
| DELETE | `/reports/:id` | `admin.access` | Supprimer un CR |

#### Groupes WhatsApp — `/api/whatsapp` (permission `whatsapp.groups`)
| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/status` | État de la session WhatsApp |
| POST | `/connect` | Démarre la connexion (QR code) |
| POST | `/logout` | Déconnecte la session |
| POST | `/groups` | Lance un job de création de groupes (202) |
| GET | `/groups/jobs/:id` | Suivi du job |

#### Missions Support — `/api/commercial-events`
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/commercial-events` | `events.create` | Missions de l'utilisateur courant (`?horizon=30`) |
| GET | `/commercial-events/today` | Authentifié | Missions du jour (tous créateurs) |
| GET | `/commercial-events/upcoming` | Authentifié | Missions J+30 (tous créateurs — widget dashboard) |
| POST | `/commercial-events` | `events.create` | Créer une mission |
| PUT | `/commercial-events/:id` | Créateur ou `admin.access` | Modifier |
| DELETE | `/commercial-events/:id` | Créateur ou `admin.access` | Supprimer |

#### Cartes BMC — `/api/bmc-cards`
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/bmc-cards` | `bmc.view` | Liste des cartes BMC serveurs LNR |
| POST | `/bmc-cards` | `bmc.manage` | Créer (IP privée RFC 1918 obligatoire, division TOP14/PRO_D2) |
| PUT | `/bmc-cards/:id` | `bmc.manage` | Modifier |
| DELETE | `/bmc-cards/:id` | `bmc.delete` | Supprimer définitivement |

#### Base de connaissance — `/api/kb`
| Méthode | Path | Permission | Description |
|---------|------|-----------|-------------|
| GET | `/kb`, `/kb/:id` | `kb.read` | Liste filtrable (`search`, `categoryId`, `status`, `tag`) / détail |
| POST | `/kb` | `kb.write` | Créer un article |
| PUT / DELETE | `/kb/:id` | `kb.write` | Modifier / supprimer (soft delete) |
| POST | `/kb/:id/images` | `kb.write` | Image inline TipTap |

#### Administration
| Ressource | Routes | Permission |
|-----------|--------|-----------|
| Users — `/api/admin/users` | GET, POST, PUT :id, DELETE :id, POST :id/send-reset-email | `admin.users` |
| Roles — `/api/admin/roles` | GET, POST, PUT :id, DELETE :id, POST :id/duplicate | `admin.roles` |
| Categories — `/api/admin/categories` | GET, POST, PUT :id, DELETE :id, PATCH reorder | `admin.categories` |
| Settings — `/api/admin/settings` | GET, PUT, POST logo | `admin.settings` |
| Paramètres publics — `GET /api/settings/public` | `logo_url`, `company_name` | Aucune |
| Catégories publiques — `GET /api/categories` | Liste pour la KB | Authentifié |

---

## 5. Modèles de données (Prisma / PostgreSQL)

### 5.1 Utilisateurs et rôles

```
Role
  ├── name @unique, description, isSystem
  ├── permissions   String[]
  └── roleUpdatedAt DateTime   (invalide les tokens émis avant)

User
  ├── firstName, lastName, email @unique, password (bcrypt)
  ├── roleId ──────► Role
  ├── isActive, mustChangePassword
  ├── passwordResetToken (SHA-256) / passwordResetExpiry
  └── sportCompetitions String[]   (préférences widget — vide = toutes)
```

### 5.2 Domaine Sports

```
MatchAttachment  (PDF temporaires — purge H+6)
  ├── matchKey   String  "{competition}_{homeTeam}_{awayTeam}_{date}"
  ├── matchDate  DateTime
  ├── filename (UUID), originalName, size, path
  └── uploadedById ──► User

MatchNote
  ├── matchKey   String @unique (même format)
  ├── content    String (HTML Tiptap), matchDate, matchTime
  ├── status     VERT|ORANGE|ROUGE
  ├── competition, homeTeam, awayTeam, venue
  ├── discipline, gender        (compétitions FIS uniquement)
  ├── production, chaperonnage, chaperonneTechnicienId ──► User
  ├── homeTeamLogo, awayTeamLogo, broadcasterLogo
  └── authorId ──► User

MatchReport  (CR hebdomadaire archivé)
  ├── year, weekNumber, startOfWeek, endOfWeek, noteCount
  ├── filename, size
  ├── data       Bytes  (.docx tel que généré, images incluses)
  └── createdById ──► User
```

### 5.3 Base de connaissance

```
Category  (catégories de la KB — couleur, icône, slug, position)

KbArticle
  ├── title, content (HTML Tiptap)
  ├── categoryId → Category
  ├── tags: String[]
  ├── status: DRAFT|PUBLISHED
  ├── deletedAt (soft delete)
  ├── authorId → User
  └── KbAttachment[]
```

### 5.4 Missions Support & infrastructure

```
CommercialEvent  (missions Support terrain)
  ├── clientName, competition (texte libre), location, notes
  ├── startDate / endDate         DateTime
  ├── techContact{FirstName,LastName,Email,Phone}
  └── createdById ──────► User    (créateur — seul lui ou un admin peut éditer/supprimer)

BmcCard  (interfaces d'administration matérielle des serveurs LNR)
  ├── name
  ├── ip          String  @@unique  (IPv4 privée RFC 1918 uniquement — validé par Zod)
  ├── division    BmcDivision  (TOP14 | PRO_D2)
  └── createdById ──────► User
```

### 5.5 Configuration

| Table | Description |
|-------|-------------|
| `Role` | Rôles agents avec permissions |
| `Category` | Catégories de la base de connaissance |
| `Settings` | Configuration clé/valeur — uniquement `company_name` et `logo_url` |

> Les tables du module ticketing (`Ticket`, `Comment`, `Attachment`, `ActivityLog`, `Client*`, `Survey*`, `TicketType`) ont été supprimées par la migration `20261117120000_remove_ticketing`.

---

## 6. Jobs et services en arrière-plan

### 6.1 MatchAttachmentPurgeJob — toutes les heures (`:00`)

```
Supprime les MatchAttachment dont matchDate < now - 6h
Suppression fichier disque + enregistrement BDD
Objectif : éviter l'accumulation de fichiers temporaires post-match
```

### 6.2 Service WhatsApp

- Basé sur `whatsapp-web.js` + Puppeteer (Chrome headless, `WHATSAPP_CHROME_PATH` si besoin).
- La session est persistée sur disque (`WHATSAPP_SESSION_DIR`, défaut `./.wwebjs_auth`) et **reprise automatiquement au démarrage** du serveur.
- La création de groupes est un **job asynchrone en mémoire** : un seul job à la fois, suivi par polling (`GET /api/whatsapp/groups/jobs/:id`). Un redémarrage du serveur perd les jobs en cours.

---

## 7. Module Sports Scraper

### 7.1 Architecture

```typescript
// server/src/services/sportsScraper.ts

fetchAllMatches()
  → Promise.allSettled([
      { key: 'TOP14',           fetch: scrapeTOP14 },
      { key: 'PRO_D2',          fetch: scrapePROD2 },
      { key: 'EPCR',            fetch: scrapeEPCR },
      { key: 'EPCR_CHALLENGE',  fetch: scrapeEPCRChallenge },
      { key: 'LNH',             fetch: scrapeLNH },       // Daikin Starligue
      { key: 'AS_MONACO',       fetch: scrapeMonaco },    // LIGUE1 + CONFERENCE_LEAGUE, AS Monaco à domicile
      { key: 'ELMS',            fetch: scrapeELMS },
      { key: 'ESTONIE',         fetch: scrapeEstonie },
      { key: 'SKI_CROSS',       fetch: scrapeSkiCross },
      { key: 'SNOWBOARD',       fetch: scrapeSnowboard },
      { key: 'FREESTYLE_EC',    fetch: scrapeFreestyleEC },
    ])
  → Filtre par isInCurrentWeek(match.date)
  → Cache en mémoire (expire fin de journée)
```

**Principe** : un scraper qui échoue n'interrompt pas les autres (`Promise.allSettled`).

### 7.2 Compétitions supportées

| Compétition | Méthode | Filtre |
|-------------|---------|--------|
| TOP14 | HTML Cheerio (LNR) | Tous |
| Pro D2 | HTML Cheerio (LNR) | Tous |
| Champions Cup (EPCR) | Nuxt SSR payload JSON | Clubs français en home team |
| Challenge Cup (EPCR) | Nuxt SSR payload JSON | Clubs français en home team |
| Daikin Starligue (LNH) | POST AJAX (seasons_id + key) | Tous |
| Ligue 1 | HTML Cheerio (AS Monaco, `data-competition="L1"`) | AS Monaco domicile |
| UEFA Conference League | HTML Cheerio (AS Monaco, `data-competition="CL"`, même requête que Ligue 1) | AS Monaco domicile |
| Coupe du Monde Ski Cross / Snowboard, Coupe d'Europe Freestyle | iCal data.fis-ski.com | Tous |
| ELMS | JSON-LD Schema.org | Tous les rounds (slugs dynamiques) |
| Premium Liiga (ESTONIE) | iCal jalgpall.ee | Tous |

### 7.3 Interface Match

```typescript
interface Match {
  competition: 'LNH' | 'PRO_D2' | 'TOP14' | 'EPCR' | 'EPCR_CHALLENGE'
             | 'LIGUE1' | 'CONFERENCE_LEAGUE' | 'ELMS' | 'ESTONIE'
             | 'SKI_CROSS' | 'SNOWBOARD' | 'FREESTYLE_EC';
  homeTeam: string;
  awayTeam: string;
  date: string;        // ISO string
  time: string;        // "HH:mm"
  venue?: string;
  country?: string;    // code ISO 2 lettres (ELMS uniquement)
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;
}
```

> **Attention LNH** : `seasons_id` et `key` sont spécifiques à la saison et expirent chaque année. À renouveler en début de saison via inspection des requêtes réseau sur lnh.fr.

---

---


---

## 8. Déploiement

### 8.1 Stack de production

```
Ubuntu 22.04 LTS
├── Node.js 20+
├── PostgreSQL 15+
├── PM2 (process manager — instance unique lancée avec sudo/root)
└── Nginx (reverse proxy, fichiers statiques — port 5173)
```

### 8.2 Variables d'environnement clés

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql://hduser:pass@localhost:5432/helpdesk_prod` (le rôle doit être propriétaire de toutes les tables) |
| `JWT_SECRET` | Clé secrète JWT — minimum 32 caractères |
| `PORT` | Port backend (défaut 3001) |
| `NODE_ENV` | `production` en prod |
| `ALLOWED_ORIGINS` | Liste CSV des origines autorisées CORS en prod |
| `APP_URL` / `FRONTEND_URL` | URL du frontend — utilisée dans les liens des emails de reset |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Configuration envoi email |
| `UPLOADS_PATH` | Répertoire des uploads (défaut `./uploads`) |
| `WHATSAPP_SESSION_DIR` | Dossier de session WhatsApp (défaut `./.wwebjs_auth`) |
| `WHATSAPP_CHROME_PATH` | Chemin de Chrome/Chromium pour Puppeteer (optionnel) |

### 8.3 PM2 — processus gérés

```javascript
// ecosystem.config.js
apps: [
  { name: 'helpdesk-server', script: './dist/src/index.js', cwd: '/opt/helpdesk/server',
    instances: 1, exec_mode: 'fork', max_memory_restart: '512M' },
]
```

Toujours `sudo pm2 …` : le process tourne en `root`. Seule l'unité systemd `pm2-root` doit être activée (pas `pm2-supportadmin`), sinon une instance parasite provoque `EADDRINUSE` sur le port 3001.

### 8.4 Nginx — routing

```nginx
listen 5173;                       # server_name helpdesk.local _
/api/*          → proxy_pass http://127.0.0.1:3001
/uploads/*      → servi directement (sauf match-attachments / match-note-images → 403)
/*              → servi depuis /opt/helpdesk/client/dist (SPA — fallback index.html)
```

### 8.5 Migrations

`npx prisma migrate deploy` applique les migrations. Faire un `pg_dump -Fc` avant toute migration destructive. En cas d'échec (P3018) : corriger la cause, `npx prisma migrate resolve --rolled-back <nom>`, relancer. Procédure complète : `docs/GUIDE_TRANSFERT_COMPETENCES.md` §5.5.

---

## 9. Sécurité — synthèse

| Mécanisme | Implémentation |
|-----------|----------------|
| Auth | JWT httpOnly cookie, 8h, HS256 |
| Session invalidation | `token.iat < role.roleUpdatedAt` → 401 |
| Rate limiting | 10 req/min sur les routes auth ; cooldown 30 s sur `/sports/refresh` |
| Headers | Helmet (CSP, HSTS, X-Frame-Options…) |
| CORS | Prod : IP privées RFC 1918 d'office + `ALLOWED_ORIGINS` (hostnames) |
| Validation | Zod sur tous les body et query strings |
| Upload | Multer — types MIME filtrés (PDF, images, `.docx` vérifié par signature ZIP) |
| Soft delete | Articles KB supprimés logiquement (champ `deletedAt`) |
| Cartes BMC | IP restreinte aux plages privées RFC 1918, contrainte d'unicité sur l'IP |
| Groupes WhatsApp | Permission dédiée, 40 groupes / 10 participants max, numéros E.164, un job à la fois |
| Données sensibles | Password exclus des réponses API (select explicite) |
| Logs | Pas de tokens ni mots de passe dans les logs |
| Proxy | `trust proxy 1` — IP client réelle pour rate-limiter |

Détail : `docs/SECURITE.md`.

---

## 10. Points d'attention pour une équipe entrante

1. **Permissions fraîches à chaque requête côté serveur** — le backend recharge le rôle depuis PostgreSQL à chaque appel. Côté client en revanche, le menu repose sur les permissions mises en cache au login (`authStore`) : se reconnecter après un changement de rôle.

2. **Pas de WebSocket** — l'application est full REST. Les mises à jour en temps réel passent par le rechargement manuel ou les durées de cache TanStack Query.

3. **Sports scraper stateless** — le cache est en mémoire dans le process Node. Un redémarrage PM2 vide le cache (les matchs sont re-scrappés à la prochaine requête).

4. **`seasons_id` / `key` LNH** — paramètres critiques à mettre à jour chaque début de saison (août-septembre). Si les matchs Starligue n'apparaissent plus ou tombent le mauvais jour, c'est la cause n°1.

5. **Articles KB supprimés logiquement** — tous les `WHERE` incluent `deletedAt: null`. Ne jamais faire `findMany` sur KbArticle sans ce filtre.

6. **`mustChangePassword`** — les nouveaux utilisateurs créés par un admin ont ce flag à `true`. Tout appel API est bloqué jusqu'au changement de mot de passe.

7. **Upload match-attachments** — fichiers temporaires. Le cron purge automatiquement après H+6. Ne pas les référencer côté frontend au-delà de cette durée.

8. **Session WhatsApp** — dépend de Chrome headless et d'un dossier de session sur disque ; si la connexion est perdue, se reconnecter depuis la page « Groupes WhatsApp » (nouveau QR code).

9. **Droits PostgreSQL** — toutes les tables appartiennent à `hduser`. Une table créée par un autre rôle (ex. `postgres`) fait échouer les migrations (`42501`).
