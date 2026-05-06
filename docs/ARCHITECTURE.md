# Architecture Fonctionnelle — Helpdesk VOGO

> Document destiné aux architectes et équipes de développement.  
> Version : mai 2026 — Branche `feat/client-organisation-tickettype`

---

## 1. Vue d'ensemble

**Helpdesk VOGO** est une application web interne de gestion de tickets de support pour le groupe VOGO. Elle couvre le cycle complet du support : création de ticket, assignation, commentaires, pièces jointes, enquêtes de satisfaction, base de connaissance et suivi des événements sportifs de la semaine.

### Acteurs principaux

| Acteur | Description |
|--------|-------------|
| **Agent support** | Traite les tickets, commente, ferme, voit ses tickets assignés |
| **Superviseur** | Voit tous les tickets, assigne, accède au dashboard global |
| **Administrateur** | Gère les utilisateurs, rôles, catégories, paramètres |
| **Client** | Entité externe — ne se connecte pas, reçoit des enquêtes par email |

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVIGATEUR                              │
│  React 18 + Vite + TailwindCSS + shadcn/ui + TanStack Query    │
│  Port 5173 (dev) / servi par Nginx (prod)                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / REST JSON
                               │ Cookie httpOnly (JWT)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY — Nginx                       │
│  /api/* → backend:3001   /uploads/* → fichiers statiques       │
│  / → frontend build statique                                    │
└──────────┬───────────────────────────────────────┬─────────────┘
           │                                       │
           ▼                                       ▼
┌──────────────────────┐                ┌─────────────────────────┐
│  API — Express/Node  │                │  Fichiers uploadés      │
│  Port 3001           │                │  /uploads/ (disque)     │
│  TypeScript          │                │  Protégés par auth      │
│  Géré par PM2        │                └─────────────────────────┘
└──────────┬───────────┘
           │ Prisma ORM
           ▼
┌──────────────────────┐
│  PostgreSQL           │
│  Port 5432            │
└──────────────────────┘
           │
           ▼ (scraping externe, SMTP)
┌──────────────────────────────────────────────────────────────────┐
│  Services externes                                               │
│  • Sites sportifs (LNR, LNH, EPCR, ELMS, AS Monaco…) — scraping│
│  • Serveur SMTP (SMTP_HOST) — envoi d'enquêtes de satisfaction  │
└──────────────────────────────────────────────────────────────────┘
```

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
├── components/               # Composants réutilisables
├── contexts/                 # Context React
└── lib/
    └── axios.ts              # Client HTTP configuré
```

### 3.2 Routing (React Router v6)

#### Routes publiques (sans authentification)
| Path | Composant | Description |
|------|-----------|-------------|
| `/login` | `LoginPage` | Formulaire de connexion |
| `/reset-password/:token` | `ResetPasswordPage` | Réinitialisation mot de passe |
| `/survey/:token` | `SurveyPage` | Enquête satisfaction client (accès par lien email) |
| `/403` | `ForbiddenPage` | Page d'accès refusé |
| `/404` | `NotFoundPage` | Page introuvable |

#### Routes protégées (JWT requis)
| Path | Composant | Permission requise |
|------|-----------|-------------------|
| `/dashboard` | `DashboardPage` | Authentifié |
| `/profile` | `ProfilePage` | Authentifié |
| `/change-password` | `ChangePasswordPage` | Authentifié |
| `/tickets` | `TicketListPage` | `tickets.view` |
| `/tickets/new` | `TicketNewPage` | `tickets.create` |
| `/tickets/:id` | `TicketDetailPage` | `tickets.view` |
| `/clients` | `ClientListPage` | `clients.view` |
| `/clients/:id` | `ClientDetailPage` | `clients.view` |
| `/evenements/aujourd-hui` | `TodayEventsPage` | Authentifié |
| `/kb` | `KbListPage` | `kb.read` |
| `/kb/new` | `KbArticlePage` | `kb.write` |
| `/kb/:id` | `KbArticlePage` | `kb.read` |

#### Routes admin
| Path | Composant | Permission requise |
|------|-----------|-------------------|
| `/admin/settings` | `AdminSettingsPage` | `admin.settings` |
| `/admin/categories` | `AdminCategoriesPage` | `admin.categories` |
| `/admin/client-roles` | `AdminClientRolesPage` | `admin.clientRoles` |
| `/admin/roles` | `AdminRolesPage` | `admin.roles` |
| `/admin/users` | `AdminUsersPage` | `admin.users` |
| `/admin/surveys` | `AdminSurveysPage` | `surveys.view` |
| `/admin/organisations` | `AdminOrganisationsPage` | `admin.clientRoles` |
| `/admin/clubs` | `AdminClubsPage` | `admin.clientRoles` |
| `/admin/poles` | `AdminPolesPage` | `admin.clientRoles` |
| `/admin/ticket-types` | `AdminTicketTypesPage` | `admin.clientRoles` |

### 3.3 Composants clés

#### Layout
- **`MainLayout`** — Sidebar navigation + header utilisateur + zone de contenu. Wrap toutes les pages authentifiées.
- **`ProtectedRoute`** — HOC vérifiant la présence du JWT et optionnellement une permission spécifique. Redirige vers `/login` ou `/403`.
- **`ErrorBoundary`** — Capture les erreurs React non gérées dans l'arbre des composants.

#### Composants communs
| Composant | Fichier | Rôle |
|-----------|---------|------|
| `PriorityBadge` | `components/common/` | Badge coloré selon la priorité (LOW/MEDIUM/HIGH/CRITICAL) |
| `StatusBadge` | `components/common/` | Badge coloré selon le statut du ticket |
| `ConfirmDialog` | `components/common/` | Dialog de confirmation générique |
| `Pagination` | `components/common/` | Composant de pagination réutilisable |
| `MultiSelect` | `components/common/` | Sélecteur multiple (filtres tickets) |
| `ClientSlideOver` | `components/clients/` | Panel latéral fiche client (contexte global) |

#### Composants Sports
| Composant | Rôle |
|-----------|------|
| `SportsMatchesWidget` | Widget dashboard — liste des matchs de la semaine par compétition |
| `MatchNoteEditor` | Éditeur de notes de match (Tiptap rich text) avec feu tricolore VERT/ORANGE/ROUGE |
| `MatchReportExport` | Export DOCX du compte-rendu hebdomadaire — feux tricolores via canvas, groupement par compétition |

#### UI (shadcn/ui)
`button`, `card`, `dialog`, `input`, `label`, `badge`, `sheet`, `switch`, `tabs`, `progress`, `tooltip`, `select`, `separator`, `skeleton`, `dropdown-menu`, `PasswordStrength`

### 3.4 State management

- **Serveur** : TanStack Query v5 — cache, invalidation, pagination. `staleTime: 30s` global, `1h` pour les matchs sportifs.
- **UI locale** : `useState` / `useReducer` React — pas de store global (Zustand non utilisé).
- **Context** : `ClientPanelContext` — contrôle l'affichage du `ClientSlideOver` depuis n'importe quelle page.

### 3.5 Client HTTP

```typescript
// @/lib/axios — instance configurée
baseURL: VITE_API_URL || 'http://localhost:3001'
withCredentials: true  // envoie le cookie httpOnly
```

> Exception : routes auth → préfixe `/api/auth/...`  
> Exception : SurveyPage (publique) → `axios.create({ baseURL: '/api' })` via proxy Vite

---

## 4. Backend

### 4.1 Structure

```
server/src/
├── index.ts              # Démarrage serveur + jobs cron
├── app.ts                # Express app — middlewares + routes
├── config/
│   └── permissions.ts    # Définition des 23 permissions et groupes
├── middleware/
│   ├── auth.ts           # authMiddleware — vérifie JWT cookie
│   └── permissions.ts    # requirePermission() + hasPermission()
├── routes/               # 19 fichiers de routes
├── services/
│   └── sportsScraper.ts  # Scraping 8 compétitions sportives
├── jobs/
│   ├── surveyJob.ts      # Cron horaire — envoi enquêtes satisfaction
│   └── matchAttachmentPurgeJob.ts  # Cron horaire — purge fichiers H+6
├── utils/
│   ├── jwt.ts            # signToken / verifyToken
│   ├── password.ts       # hashPassword / comparePassword (bcrypt)
│   ├── email.ts          # sendEmail + template HTML brandé
│   ├── upload.ts         # Config multer (10 Mo, types autorisés)
│   └── ticketNumber.ts   # Génération numéro ticket (HDK-XXXXX)
└── lib/
    └── prisma.ts         # Instance Prisma singleton
```

### 4.2 Middlewares globaux (dans l'ordre d'application)

| Middleware | Rôle |
|-----------|------|
| `trust proxy 1` | Confiance au proxy Nginx — IP client correcte pour rate-limiter |
| `helmet` | Headers sécurité (CSP, HSTS…) + CORP cross-origin pour les assets |
| `cors` | Dev : `*` / Prod : allowlist via `ALLOWED_ORIGINS` |
| `morgan` | Logs HTTP (`dev` / `combined` selon NODE_ENV) |
| `cookieParser` | Parse le cookie `helpdesk_token` |
| `express.json` | Body JSON — limite 10 Mo |
| `express.static` | Sert `/uploads/*` (sauf `/uploads/match-attachments` → 403) |

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
- Token aléatoire SHA-256 — persisté en base, expiration configurable
- Lien envoyé par email SMTP

### 4.4 Autorisation (RBAC)

Le système est basé sur des **rôles** portant une liste de **permissions** (string[]).

#### 23 permissions définies

| Domaine | Permissions |
|---------|-------------|
| **Tickets** | `tickets.view`, `tickets.create`, `tickets.edit`, `tickets.close`, `tickets.delete`, `tickets.assign`, `tickets.viewAll` |
| **Clients** | `clients.view`, `clients.create`, `clients.edit`, `clients.delete` |
| **Commentaires** | `comments.create`, `comments.delete`, `comments.deleteAny` |
| **Enquêtes** | `surveys.view`, `surveys.configure` |
| **Admin** | `admin.access`, `admin.users`, `admin.roles`, `admin.categories`, `admin.clientRoles`, `admin.settings` |
| **Base de connaissance** | `kb.read`, `kb.write` |

#### Principe d'application
```typescript
// Middleware sur une route
requirePermission('tickets.create')

// Vérification inline (logique métier)
if (!hasPermission(req.user!, 'tickets.viewAll')) {
  where.assignedToId = req.user!.id;  // filtre sur ses propres tickets
}
```

### 4.5 Catalogue des routes API

#### Auth — `/api/auth`
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| POST | `/login` | Non | Connexion, génère cookie JWT |
| POST | `/logout` | Non | Supprime le cookie |
| GET | `/me` | Oui | Profil utilisateur courant |
| PATCH | `/change-password` | Oui | Changement de mot de passe |
| GET | `/validate-reset-token/:token` | Non | Vérifie validité du lien de reset |
| POST | `/reset-password` | Non | Reset mot de passe via token |

#### Tickets — `/api/tickets`
| Méthode | Path | Permission | Description |
|---------|------|-----------|-------------|
| GET | `/tickets` | `tickets.view` | Liste paginée avec filtres multiples |
| POST | `/tickets` | `tickets.create` | Créer un ticket |
| GET | `/tickets/:id` | `tickets.view` | Détail + commentaires + pièces jointes + logs |
| PUT | `/tickets/:id` | `tickets.edit` | Modifier titre, description, catégorie, priorité, type, pôle |
| PATCH | `/tickets/:id/status` | `tickets.edit` ou `tickets.close` | Changer le statut (note de fermeture obligatoire pour CLOSED) |
| PATCH | `/tickets/:id/assign` | `tickets.assign` | Assigner/désassigner un agent |
| DELETE | `/tickets/:id` | `tickets.delete` | Suppression logique (soft delete via `deletedAt`) |

**Filtres disponibles sur GET /tickets :**
`status[]`, `priority[]`, `categoryId`, `assignedToId`, `dateFrom`, `dateTo`, `search`, `organisationId`, `clubId`, `typeId`, `page`, `limit`

#### Commentaires — `/api/comments`
| Méthode | Path | Permission |
|---------|------|-----------|
| POST | `/tickets/:id/comments` | `comments.create` |
| DELETE | `/comments/:id` | `comments.delete` (son propre) / `comments.deleteAny` |

#### Pièces jointes — `/api/attachments`
| Méthode | Path | Description |
|---------|------|-------------|
| POST | `/tickets/:id/attachments` | Upload (multer, 10 Mo max) |
| GET | `/attachments/:id/download` | Téléchargement avec check d'accès |
| DELETE | `/attachments/:id` | Suppression fichier + BDD |

#### Clients — `/api/clients`
| Méthode | Path | Permission |
|---------|------|-----------|
| GET | `/clients` | `clients.view` |
| POST | `/clients` | `clients.create` |
| GET | `/clients/:id` | `clients.view` |
| PUT | `/clients/:id` | `clients.edit` |
| DELETE | `/clients/:id` | `clients.delete` (bloqué si tickets ouverts) |

#### Dashboard — `/api/dashboard`
| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/stats` | KPI : tickets ouverts/en cours/résolus, CSAT, répartition par priorité/catégorie/agent, tickets par club/organisation (admin only), tickets stale |
| GET | `/trends` | Courbe de création de tickets sur 30 jours |

#### Sports — `/api/sports`
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/matches` | Oui | Matchs de la semaine (cache 1h, 8 compétitions) |
| POST | `/match-attachments` | `tickets.create` | Upload pièce jointe match (PDF/image) |
| POST | `/match-attachments/query` | Authentifié | Liste des pièces jointes par matchKey |
| GET | `/match-attachments/:id/download` | Authentifié | Téléchargement sécurisé |
| DELETE | `/match-attachments/:id` | `admin.access` | Suppression |
| GET | `/match-notes/by-key` | Authentifié | Note de match par matchKey |
| POST | `/match-notes` | Authentifié | Créer/mettre à jour une note de match |

#### Administration — `/api/admin`
| Ressource | Routes disponibles |
|-----------|-------------------|
| Users | GET list, POST create, GET :id, PUT :id, PATCH :id/toggle-active, POST :id/reset-password |
| Roles | GET list, POST create, GET :id, PUT :id, DELETE :id |
| Categories | CRUD + PATCH reorder |
| ClientRoles | CRUD + PATCH reorder |
| Organisations | CRUD + PATCH reorder |
| Clubs | CRUD + PATCH reorder |
| Poles | CRUD + PATCH reorder |
| TicketTypes | CRUD + PATCH reorder |
| Surveys | GET template, PUT configure, GET responses |
| Settings | GET all, PUT :key, POST logo/upload |
| KB | GET list, POST create, GET :id, PUT :id, DELETE :id |

---

## 5. Modèles de données (Prisma / PostgreSQL)

### 5.1 Domaine Tickets

```
User ──────────────────────────────────────────────────────┐
  │ (role)                                                  │
Role (permissions: String[])                               │
                                                           │
Ticket                                                     │
  ├── ticketNumber       String (HDK-XXXXX, unique)        │
  ├── title / description                                   │
  ├── status             OPEN|IN_PROGRESS|PENDING|CLOSED   │
  ├── priority           LOW|MEDIUM|HIGH|CRITICAL           │
  ├── clientId ─────────► Client                           │
  ├── categoryId ────────► Category                        │
  ├── typeId ────────────► TicketType                      │
  ├── poleId ────────────► ClientPole                      │
  ├── assignedToId ──────► User                            │
  ├── createdById ───────► User                            │
  ├── resolvedAt / closedAt / deletedAt (soft delete)      │
  ├── Comment[] ──────── (isInternal: bool)                │
  ├── Attachment[]                                         │
  ├── ActivityLog[]                                        │
  ├── SurveySend[]                                         │
  └── KbArticle[] (sourceTicket)                           │
                                                           │
Attachment                                                 │
  ├── ticketId / commentId (nullable — pièce jointe ticket ou commentaire)
  ├── filename, originalName, mimetype, size, path
  └── uploadedById ─────────────────────────────────────────┘

ActivityLog
  ├── ticketId, userId, action
  └── oldValue / newValue (string)
```

### 5.2 Domaine Clients

```
ClientOrganisation (ex: Ligue 1, Rugby Pro...)
  └── ClientClub[] (many — ex: PSG, OL...)
       └── Client[] (many — contacts physiques)
            ├── ClientRole (rôle fonctionnel du contact)
            └── isSurveyable (booléen — opt-in enquêtes)
```

### 5.3 Domaine Enquêtes

```
SurveyTemplate
  └── questions: Json (tableau de questions configurables)

SurveySend (1 par ticket fermé éligible)
  ├── token (UUID unique — lien email)
  ├── status: PENDING|SENT|FAILED
  └── SurveyResponse (1:1)
        ├── answers: Json
        ├── npsScore: Int?
        └── vocScore: Float? (score CSAT 1-5)
```

### 5.4 Domaine Sports

```
MatchAttachment
  ├── matchKey   String  "{competition}_{homeTeam}_{awayTeam}_{date}"
  ├── matchDate  DateTime (pour purge H+6)
  └── filename, originalName, size, path

MatchNote
  ├── matchKey   String @unique (même format)
  ├── content    String (HTML Tiptap)
  ├── status     VERT|ORANGE|ROUGE
  ├── competition, homeTeam, awayTeam, matchTime, venue
  └── homeTeamLogo, awayTeamLogo, broadcasterLogo
```

### 5.5 Base de connaissance

```
KbArticle
  ├── title, content (HTML Tiptap)
  ├── categoryId → Category
  ├── tags: String[]
  ├── status: DRAFT|PUBLISHED
  ├── sourceTicketId → Ticket (optionnel — article issu d'un ticket)
  ├── authorId → User
  └── KbAttachment[]
```

### 5.6 Référentiel (tables de configuration)

| Table | Description |
|-------|-------------|
| `Role` | Rôles agents avec permissions |
| `ClientRole` | Rôles fonctionnels des clients (Directeur, Responsable IT…) |
| `Category` | Catégories de tickets (couleur, icône, slug) |
| `TicketType` | Types de tickets (Incident, Demande, Question…) |
| `ClientPole` | Pôles organisationnels internes VOGO |
| `Settings` | Configuration clé/valeur (logo, SMTP, délais enquêtes…) |

---

## 6. Jobs background (Node-cron)

### 6.1 SurveyJob — toutes les heures (`:00`)

```
Déclencheur : tickets CLOSED depuis N heures (survey_delay_hours, défaut 48h)
Condition client : email non null + isSurveyable = true
Cooldown : pas d'enquête envoyée à cet email dans les X derniers jours (survey_cooldown_days, défaut 10)
Condition ticket : pas de SurveySend existant

Flux :
  1. Créer SurveySend (PENDING)
  2. Générer email brandé VOGO avec lien /survey/{UUID}
  3. Envoyer via SMTP
  4. Mettre à jour SurveySend → SENT (ou FAILED si erreur)

Kill-switch : settings.survey_enabled = 'false'
```

### 6.2 MatchAttachmentPurgeJob — toutes les heures (`:00`)

```
Supprime les MatchAttachment dont matchDate < now - 6h
Suppression fichier disque + enregistrement BDD
Objectif : éviter l'accumulation de fichiers temporaires post-match
```

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
      { key: 'LNH',             fetch: scrapeLNH },
      { key: 'SUPER_LEAGUE',    fetch: scrapeSuperLeague },
      { key: 'LIGUE1',          fetch: scrapeLigue1 },
      { key: 'ELMS',            fetch: scrapeELMS },
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
| Starligue (LNH) | POST AJAX (seasons_id + key) | Tous |
| Super League | HTML Cheerio + fallback statique | Catalans Dragons domicile |
| Ligue 1 | HTML Cheerio (AS Monaco) | AS Monaco domicile |
| ELMS | JSON-LD Schema.org | Tous les rounds (slugs dynamiques) |

### 7.3 Interface Match

```typescript
interface Match {
  competition: 'LNH' | 'PRO_D2' | 'TOP14' | 'EPCR' | 'EPCR_CHALLENGE' 
             | 'SUPER_LEAGUE' | 'LIGUE1' | 'ELMS';
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

## 8. Déploiement

### 8.1 Stack de production

```
Ubuntu 22.04 LTS
├── Node.js 18+
├── PostgreSQL 14+
├── PM2 (process manager — restart auto, logs)
└── Nginx (reverse proxy, SSL, static files)
```

### 8.2 Variables d'environnement clés

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/helpdesk` |
| `JWT_SECRET` | Clé secrète JWT — minimum 32 caractères |
| `PORT` | Port backend (défaut 3001) |
| `NODE_ENV` | `production` en prod |
| `ALLOWED_ORIGINS` | Liste CSV des origines autorisées CORS en prod |
| `COOKIE_SECURE` | `true` en prod (cookie HTTPS only) |
| `APP_URL` | URL publique — utilisé dans les liens email d'enquête |
| `SMTP_HOST/PORT/USER/PASS` | Configuration envoi email |
| `UPLOADS_PATH` | Répertoire des uploads (défaut `./uploads`) |

### 8.3 PM2 — processus gérés

```javascript
// ecosystem.config.js
apps: [
  { name: 'helpdesk-backend', script: 'dist/index.js' },
]
```

### 8.4 Nginx — routing

```nginx
/api/*          → proxy_pass http://localhost:3001
/uploads/*      → servi directement (sauf /uploads/match-attachments → 403)
/*              → servi depuis /client/dist (SPA — fallback index.html)
```

---

## 9. Sécurité — synthèse

| Mécanisme | Implémentation |
|-----------|----------------|
| Auth | JWT httpOnly cookie, 8h, HS256 |
| Session invalidation | `token.iat < role.roleUpdatedAt` → 401 |
| Rate limiting | 10 req/min sur toutes les routes auth |
| Headers | Helmet (CSP, HSTS, X-Frame-Options…) |
| CORS | Allowlist en production (`ALLOWED_ORIGINS`) |
| Validation | Zod sur tous les body et query strings |
| Upload | Multer — types MIME filtrés, limite 10 Mo |
| Soft delete | Tickets supprimés logiquement (champ `deletedAt`) |
| Données sensibles | Password exclus des réponses API (select explicite) |
| Logs | Pas de tokens ni mots de passe dans les logs |
| Proxy | `trust proxy 1` — IP client réelle pour rate-limiter |

---

## 10. Points d'attention pour une équipe entrante

1. **Permissions fraîches à chaque requête** — le backend recharge le rôle depuis PostgreSQL à chaque appel. Un changement de permission est effectif immédiatement (sans redémarrage).

2. **Pas de WebSocket** — l'application est full REST. Les mises à jour en temps réel passent par le rechargement manuel ou les durées de cache TanStack Query.

3. **Sports scraper stateless** — le cache est en mémoire dans le process Node. Un redémarrage PM2 vide le cache (les matchs sont re-scrappés à la prochaine requête).

4. **`seasons_id` LNH** — paramètre critique à mettre à jour chaque début de saison (août-septembre). Si les matchs Starligue n'apparaissent plus, c'est la cause n°1.

5. **Tickets supprimés logiquement** — tous les `WHERE` incluent `deletedAt: null`. Ne jamais faire `findMany` sur Ticket sans ce filtre.

6. **`mustChangePassword`** — les nouveaux utilisateurs créés par un admin ont ce flag à `true`. Tout appel API est bloqué jusqu'au changement de mot de passe.

7. **Upload match-attachments** — fichiers temporaires. Le cron purge automatiquement après H+6. Ne pas les référencer côté frontend au-delà de cette durée.
