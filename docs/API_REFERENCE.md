# Référence API — Helpdesk VOGO

**Dernière mise à jour :** novembre 2026 (suppression du module ticketing, ajout Rapports CR hebdomadaires et Groupes WhatsApp)

**Base URL :** `http://<serveur>:3001`  
**Authentification :** Cookie `helpdesk_token` (httpOnly) **ou** header `Authorization: Bearer <token>`  
**Format :** JSON (`Content-Type: application/json`)

---

## Authentification

### POST /api/auth/login
Connexion et obtention du token JWT.

**Body**
```json
{ "email": "agent@vogo.fr", "password": "MonMotDePasse1" }
```

**Réponse 200**
```json
{
  "user": {
    "id": "uuid",
    "firstName": "Nicolas",
    "lastName": "Broutin",
    "email": "agent@vogo.fr",
    "sportCompetitions": ["TOP14", "ESTONIE"],
    "role": { "name": "Admin", "permissions": ["sports.edit", "admin.access"] }
  }
}
```

**Erreurs**
| Code | Message |
|------|---------|
| 401 | Identifiants incorrects |
| 429 | Trop de tentatives (rate limit : 10 req/min) |

---

### GET /api/auth/me
Retourne l'utilisateur courant et ses permissions.

**Réponse 200** — même structure que `/login`

---

### PATCH /api/auth/change-password
Change le mot de passe de l'utilisateur connecté.

**Body**
```json
{ "currentPassword": "...", "newPassword": "..." }
```

> Sur première connexion (`mustChangePassword=true`), `currentPassword` est ignoré.

---

### POST /api/auth/logout
Supprime le cookie de session.

---

### PATCH /api/auth/sport-competitions
Met à jour les préférences de compétitions sportives de l'utilisateur connecté. Le widget sports n'affiche que les compétitions sélectionnées. Si la liste est vide, toutes les compétitions sont affichées.

**Body**
```json
{ "sportCompetitions": ["TOP14", "ESTONIE"] }
```

**Valeurs acceptées :** `TOP14`, `PRO_D2`, `LNH`, `EPCR`, `EPCR_CHALLENGE`, `ELMS`, `ESTONIE`, `SKI_CROSS`, `SNOWBOARD`, `FREESTYLE_EC`, `LIGUE1`, `CONFERENCE_LEAGUE` (12 valeurs ; la taille maximale du tableau suit automatiquement la longueur de cette liste)

**Réponse 200**
```json
{ "data": { "sportCompetitions": ["TOP14", "ESTONIE"] } }
```

| Code | Message |
|------|---------|
| 400 | Valeur de compétition invalide |

---

### GET /api/auth/validate-reset-token/:token
Vérifie qu'un token de réinitialisation est valide et non expiré (rate limit auth).

---

### POST /api/auth/reset-password
Réinitialise le mot de passe via token email.

**Body**
```json
{ "token": "abc123", "newPassword": "NouveauMDP1" }
```

---

## Administration

### Catégories — /api/admin/categories
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/categories | Liste avec compteurs d'articles KB |
| POST | /api/admin/categories | Créer (slug auto-généré) |
| PUT | /api/admin/categories/:id | Modifier |
| DELETE | /api/admin/categories/:id | Supprimer (catégories de la base de connaissance) |
| PATCH | /api/admin/categories/reorder | Réordonner `[{id, position}]` |

### Rôles agents — /api/admin/roles
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/roles | Liste avec compteurs utilisateurs |
| POST | /api/admin/roles | Créer rôle personnalisé |
| PUT | /api/admin/roles/:id | Modifier permissions (invalide les tokens) |
| DELETE | /api/admin/roles/:id | Supprimer (rôles système protégés) |
| POST | /api/admin/roles/:id/duplicate | Dupliquer un rôle |

### Utilisateurs agents — /api/admin/users
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/users | Liste agents (filtre par rôle) |
| POST | /api/admin/users | Créer agent |
| PUT | /api/admin/users/:id | Modifier agent |
| POST | /api/admin/users/:id/send-reset-email | Email reset (token 24h) |
| DELETE | /api/admin/users/:id | Supprimer un agent |

### Paramètres — /api/admin/settings
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/settings | Tous les paramètres |
| PUT | /api/admin/settings | Mettre à jour |
| POST | /api/admin/settings/logo | Uploader logo |

**Paramètres disponibles :** `company_name`, `logo_url` (toute autre clé est rejetée en 400). `GET /api/settings/public` (sans authentification) expose uniquement `logo_url` et `company_name`.

---

## Base de connaissances

### GET /api/kb
Permission : `kb.read`.

**Query params :** `search`, `categoryId`, `status` (DRAFT/PUBLISHED), `tag`, `page`, `limit` (max 100)

### GET /api/kb/:id
Détail d'un article. Permission : `kb.read`.

### POST /api/kb
Permission : `kb.write`.

**Body**
```json
{
  "title": "Comment réinitialiser son mot de passe",
  "content": "<p>HTML TipTap</p>",
  "categoryId": "uuid",
  "tags": ["mot de passe", "accès"],
  "status": "PUBLISHED"
}
```

### PUT /api/kb/:id  ·  DELETE /api/kb/:id
Modification et suppression douce (`deletedAt`) d'un article. Permission : `kb.write`.

### POST /api/kb/:id/images
Upload d'une image inline pour l'éditeur TipTap (multipart, champ `file`). Permission : `kb.write`.

---

## Missions Support

Suivi des missions Support terrain (ex-« événements commerciaux »). Toutes les routes exigent l'authentification. Permission `events.create` pour la liste et la création ; l'édition et la suppression sont réservées au **créateur** ou à un utilisateur `admin.access`.

### GET /api/commercial-events
Liste des missions **créées par l'utilisateur courant**.

**Query params**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `horizon` | string | `30` → limite aux missions dont `startDate` est dans les 30 prochains jours |

**Réponse 200**
```json
{ "data": [
  {
    "id": "uuid",
    "clientName": "LNR",
    "startDate": "2026-09-12T08:00:00.000Z",
    "endDate": "2026-09-12T20:00:00.000Z",
    "location": "Stade Chaban-Delmas, Bordeaux",
    "competition": "TOP 14",
    "techContactFirstName": "Jean",
    "techContactLastName": "Dupont",
    "techContactEmail": "jean.dupont@lnr.fr",
    "techContactPhone": "0600000000",
    "notes": "Prévoir 2 caméras tribune.",
    "createdBy": { "id": "uuid", "firstName": "Nicolas", "lastName": "Broutin" }
  }
] }
```

### GET /api/commercial-events/today
Missions dont `startDate` tombe aujourd'hui. Accessible à **tout utilisateur authentifié** (alimente la page « Événements du jour »). Réponse allégée (pas d'email ni de notes).

### GET /api/commercial-events/upcoming
Missions dont `startDate` est dans les 30 prochains jours, **tous créateurs confondus**. Accessible à tout utilisateur authentifié (widget dashboard agents/admins).

### POST /api/commercial-events
Crée une mission. Permission requise : `events.create`. `createdById` est forcé à l'utilisateur courant.

**Body** (tous les champs sont requis)
```json
{
  "clientName": "LNR",
  "startDate": "2026-09-12T08:00:00.000Z",
  "endDate": "2026-09-12T20:00:00.000Z",
  "location": "Stade Chaban-Delmas, Bordeaux",
  "techContactFirstName": "Jean",
  "techContactLastName": "Dupont",
  "techContactEmail": "jean.dupont@lnr.fr",
  "techContactPhone": "0600000000",
  "competition": "TOP 14",
  "notes": "Prévoir 2 caméras tribune."
}
```

| Code | Message |
|------|---------|
| 400 | Champ manquant ou invalide (détail dans `error`) |

### PUT /api/commercial-events/:id
Met à jour une mission. Autorisé au créateur (avec `events.create`) **ou** à un `admin.access`. Même schéma de body que POST.

| Code | Message |
|------|---------|
| 403 | Permission refusée (ni créateur ni admin) |
| 404 | Événement introuvable |

### DELETE /api/commercial-events/:id
Supprime une mission. Autorisé au créateur **ou** à un `admin.access`.

---

## Cartes BMC (serveurs LNR)

Répertoire des interfaces d'administration matérielle (iDRAC/iLO) des serveurs internes LNR. Toutes les routes exigent l'authentification.

### GET /api/bmc-cards
Liste complète, triée par `name`. Permission requise : `bmc.view`.

**Réponse 200**
```json
{ "data": [
  {
    "id": "uuid",
    "name": "srv-prod-01 iDRAC",
    "ip": "192.168.10.25",
    "division": "TOP14",
    "createdBy": { "id": "uuid", "firstName": "Nicolas", "lastName": "Broutin" }
  }
] }
```

### POST /api/bmc-cards
Crée une carte. Permission requise : `bmc.manage`.

**Body**
```json
{ "name": "srv-prod-01 iDRAC", "ip": "192.168.10.25", "division": "TOP14" }
```

- `ip` **doit** être une IPv4 privée RFC 1918 (`10.x`, `172.16-31.x`, `192.168.x`). Toute adresse publique est rejetée.
- `division` : `TOP14` ou `PRO_D2` uniquement.

| Code | Message |
|------|---------|
| 400 | `Adresse IPv4 privée invalide (...)` / `Cette adresse IP est déjà utilisée par une autre carte` |

### PUT /api/bmc-cards/:id
Met à jour une carte. Permission requise : `bmc.manage`. Même body et mêmes règles que POST.

| Code | Message |
|------|---------|
| 400 | IP invalide ou déjà utilisée |
| 404 | Carte BMC introuvable |

### DELETE /api/bmc-cards/:id
Supprime définitivement une carte. Permission requise : `bmc.delete`.

---

## Sports

### GET /api/sports/matches
Retourne tous les matchs de la semaine (cache en mémoire par source, expirant en fin de journée).

**Compétitions :** TOP14, PRO_D2, EPCR, EPCR_CHALLENGE, LNH, LIGUE1, CONFERENCE_LEAGUE, ELMS, ESTONIE, SKI_CROSS, SNOWBOARD, FREESTYLE_EC

> `LIGUE1` et `CONFERENCE_LEAGUE` (UEFA Conference League) proviennent de la même page asmonaco.com (une seule requête, clé de cache `AS_MONACO`) et ne contiennent que les matchs de l'AS Monaco à domicile (Stade Louis-II).

> `LNH` = Daikin Starligue (naming sponsor du handball français — anciennement « Liqui Moly Starligue »). Le label affiché est géré côté frontend, la clé de compétition reste `LNH`.

**Réponse 200**
```json
[
  {
    "competition": "LNH",
    "homeTeam": "Paris Saint-Germain HB",
    "awayTeam": "Montpellier HB",
    "date": "2026-05-06T19:00:00.000Z",
    "time": "21:00",
    "venue": "Paris La Défense Arena",
    "homeTeamLogo": "https://...",
    "awayTeamLogo": "https://...",
    "broadcasterLogo": "https://..."
  }
]
```

> `broadcasterLogo` est l'URL du logo du diffuseur TV (chaîne qui retransmet le match). Champ optionnel — absent si le match n'a pas de diffuseur identifié.

### GET /api/sports/match-notes
Retourne **toutes** les notes de match (avec auteur et technicien chaperon), triées par `matchDate`. Route authentifiée — utilisée au chargement du widget pour rapprocher notes et matchs scrapés.

### GET /api/sports/match-notes/team-members
Liste des agents pouvant être désignés comme technicien chaperon d'un match. Route authentifiée.

### PUT /api/sports/match-notes/:matchKey
Crée ou met à jour la note d'un match (upsert). Permission requise : `sports.edit`

**Body**
```json
{
  "content": "<p>Note HTML TipTap</p>",
  "status": "VERT",
  "matchDate": "2026-05-06T19:00:00.000Z",
  "competition": "LNH",
  "homeTeam": "Paris Saint-Germain HB",
  "awayTeam": "Montpellier HB",
  "matchTime": "21:00",
  "venue": "Paris La Défense Arena",
  "homeTeamLogo": "https://...",
  "awayTeamLogo": "https://...",
  "broadcasterLogo": "https://..."
}
```

> `broadcasterLogo` doit être une URL valide (`https://...`). Il est persisté en base à la création et mis à jour à chaque save. Il est ensuite inclus dans le CR exporté.

### POST /api/sports/match-notes/upload-image
Upload d'une image collée ou insérée dans l'éditeur de notes TipTap. Permission requise : `sports.edit`

**Content-Type :** `multipart/form-data`  
**Champ :** `image` (fichier unique, max 10 Mo, formats : JPEG, PNG, GIF, WebP)

**Réponse 200**
```json
{ "url": "/api/sports/match-notes/images/uuid.png" }
```

**Erreurs**
| Code | Message |
|------|---------|
| 400 | Aucun fichier image fourni |
| 415 | Format non autorisé |

> L'URL retournée est relative (`/api/...`) et est stockée directement dans le HTML TipTap (`<img src="/api/...">`). Elle est ensuite résolue côté client lors de l'export CR.

---

### GET /api/sports/match-notes/images/:filename
Sert une image précédemment uploadée. Route authentifiée — le cookie JWT est requis (envoyé automatiquement par le navigateur).

**Paramètre :** `filename` — UUID + extension (ex : `b724a3bd-85eb-460b-a681-6013e641d67f.png`)  
**Réponse 200 :** Fichier image avec `Content-Type` correspondant (`image/png`, `image/jpeg`, etc.)

| Code | Message |
|------|---------|
| 404 | Image non trouvée |

> Les fichiers sont stockés dans `UPLOADS_PATH/match-note-images/` sur le serveur. La route bloque le path traversal via `path.basename()`.

---

### GET /api/sports/season-calendar
Vue annuelle (projection) : instantané statique de la saison, indépendant du scraper hebdomadaire. Route authentifiée.

### GET /api/sports/match-notes/proxy-image
Proxy d'image distante utilisé pour l'export du CR (évite les blocages CORS). Route authentifiée.

### GET /api/sports/match-notes/report/week
Notes de la semaine ISO courante avec bornes lundi/dimanche. Chaque note inclut `broadcasterLogo` si disponible.

### POST /api/sports/refresh
Vide le cache scraper et relance la collecte de tous les matchs de la semaine. Permission requise : `sports.edit` **ou** `whatsapp.groups`.

**Rate limit :** cooldown de 30 secondes. Si appelé avant la fin du cooldown, retourne `HTTP 429` avec le délai restant :
```json
{ "error": "Refresh disponible dans 18 secondes" }
```

### DELETE /api/sports/match-notes/:matchKey
Supprime la note d'un match. Route authentifiée.

### POST /api/sports/match-attachments
Upload PDF pour un match (max 10 Mo, champ `file`). Permission requise : `sports.edit`. Dédoublonnage par matchKey + nom de fichier.

### POST /api/sports/match-attachments/query
Liste les pièces jointes de plusieurs matchs. Body `{ "matchKeys": ["...", "..."] }` (array, max 200 — évite les limites de longueur d'URL). Route authentifiée.

### GET /api/sports/match-attachments/:id/download
Téléchargement sécurisé (protection path-traversal). Route authentifiée.

### DELETE /api/sports/match-attachments/:id
Suppression d'une pièce jointe. Permission requise : `admin.access`.

> Les pièces jointes de match sont **temporaires** : un job cron les purge automatiquement 6 h après le coup d'envoi.

---

---

## Rapports CR hebdomadaires

Archivage des comptes rendus de la semaine, générés côté client en `.docx` et stockés en base (BYTEA, 25 Mo max). Toutes les routes exigent l'authentification.

### POST /api/sports/reports
Archive un CR. Permission requise : `sports.edit`.

**Corps :** le fichier `.docx` brut (`application/octet-stream`, signature ZIP `PK` vérifiée). **Métadonnées en query string :** `year`, `weekNumber` (1-53), `startOfWeek`, `endOfWeek`, `noteCount`. Le nom de fichier est généré côté serveur (`CR_S45_2026.docx`).

| Code | Message |
|------|---------|
| 201 | `{ "data": { id, year, weekNumber, filename, size, createdBy, ... } }` |
| 400 | Paramètres invalides / Fichier .docx invalide |

### GET /api/sports/reports
Historique (200 derniers, sans le contenu des fichiers), du plus récent au plus ancien.

### GET /api/sports/reports/:id/download
Télécharge le `.docx` archivé. 404 si introuvable.

### DELETE /api/sports/reports/:id
Supprime un rapport. Permission requise : `admin.access`.

---

## Groupes WhatsApp

Préparation des groupes WhatsApp des matchs. Toutes les routes exigent la permission `whatsapp.groups`.

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/whatsapp/status | État de la session WhatsApp (connectée, QR code à scanner…) |
| POST | /api/whatsapp/connect | Démarre la connexion / génère le QR code |
| POST | /api/whatsapp/logout | Déconnecte la session |
| POST | /api/whatsapp/groups | Lance un job de création de groupes (202 + job) |
| GET | /api/whatsapp/groups/jobs/:id | Suivi d'un job (404 si inconnu) |

**Body de `POST /api/whatsapp/groups`**
```json
{
  "groups": [
    { "key": "TOP14-2026-11-22-ASM-RCT", "name": "ASM - RCT", "participants": ["+33612345678"] }
  ],
  "picture": "data:image/png;base64,..."
}
```
- 1 à 40 groupes ; `participants` : numéros E.164 (`+` suivi de 8 à 15 chiffres), 10 maximum par groupe.
- `picture` (optionnel) : data URL PNG/JPEG, 3 Mo max.
- Un seul job à la fois : un second lancement renvoie **409**.

## Codes d'erreur standards

| Code | Signification |
|------|--------------|
| 400 | Données invalides (détail dans `error`) |
| 401 | Non authentifié |
| 403 | Permission insuffisante |
| 404 | Ressource introuvable |
| 409 | Conflit (ex : doublon fichier) |
| 413 | Fichier trop volumineux |
| 429 | Trop de requêtes |
| 500 | Erreur serveur interne |
