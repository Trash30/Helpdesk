# Référence API — Helpdesk VOGO

**Dernière mise à jour :** août 2026 (ajout Missions Support + Cartes BMC, renommage Daikin Starligue)

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
    "role": { "name": "Admin", "permissions": ["tickets.view", "admin.access"] }
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

**Valeurs acceptées :** `TOP14`, `PRO_D2`, `LNH`, `EPCR`, `EPCR_CHALLENGE`, `ELMS`, `ESTONIE`

**Réponse 200**
```json
{ "data": { "sportCompetitions": ["TOP14", "ESTONIE"] } }
```

| Code | Message |
|------|---------|
| 400 | Valeur de compétition invalide |

---

### POST /api/auth/reset-password
Réinitialise le mot de passe via token email.

**Body**
```json
{ "token": "abc123", "newPassword": "NouveauMDP1" }
```

---

## Tickets

### GET /api/tickets
Liste paginée des tickets. Les agents voient uniquement leurs tickets assignés (sauf permission `tickets.viewAll`).

**Query params**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `page` | number | Page (défaut 1) |
| `limit` | number | Par page (défaut 20) |
| `status[]` | string | OPEN, IN_PROGRESS, PENDING, CLOSED |
| `priority[]` | string | LOW, MEDIUM, HIGH, CRITICAL |
| `categoryId` | uuid | Filtrer par catégorie |
| `assignedToId` | uuid | Filtrer par agent assigné |
| `assignedToMe` | boolean | Mes tickets uniquement |
| `staleDays` | number | Tickets sans mise à jour depuis N jours |
| `search` | string | Recherche dans titre/description |

**Réponse 200**
```json
{
  "data": [{ "id": "uuid", "ticketNumber": "TK-0042", "title": "...", "status": "OPEN", "priority": "HIGH", ... }],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

---

### POST /api/tickets
Crée un nouveau ticket. Permission requise : `tickets.create`

**Body**
```json
{
  "title": "Problème de connexion",
  "description": "...",
  "clientId": "uuid",
  "categoryId": "uuid",
  "typeId": "uuid",
  "priority": "MEDIUM",
  "poleId": "uuid"
}
```

---

### GET /api/tickets/:id
Détail complet d'un ticket (commentaires, pièces jointes, logs d'activité).

---

### PUT /api/tickets/:id
Met à jour les champs d'un ticket. Permission requise : `tickets.edit`

**Body** (tous les champs sont optionnels)
```json
{
  "title": "...",
  "description": "...",
  "categoryId": "uuid",
  "priority": "HIGH",
  "assignedToId": "uuid"
}
```

---

### PATCH /api/tickets/:id/status
Change le statut d'un ticket.

**Body**
```json
{ "status": "CLOSED", "closingNote": "Résolu après redémarrage serveur." }
```

> `closingNote` obligatoire pour le statut `CLOSED`.

**Transitions valides :** OPEN → IN_PROGRESS → PENDING → CLOSED

---

### DELETE /api/tickets/:id
Suppression douce (champ `deletedAt`). Permission requise : `tickets.delete`

---

## Commentaires

### POST /api/tickets/:id/comments
Ajoute un commentaire. Supporte jusqu'à 5 fichiers joints (multipart/form-data).

**Body (form-data)**
```
content     : "Texte du commentaire"
isInternal  : false    (note interne cachée aux clients)
files[]     : <fichier>
```

---

### DELETE /api/comments/:id
Supprime un commentaire. Permission `comments.deleteAny` pour supprimer celui d'un autre utilisateur.

---

## Pièces jointes

### POST /api/tickets/:id/attachments
Upload de fichiers (multipart/form-data, max 5 fichiers, 5 Mo chacun). Permission : `tickets.edit`

### GET /api/attachments/:id/download
Télécharge un fichier. Protection anti path-traversal intégrée.

### DELETE /api/attachments/:id
Supprime le fichier du disque et de la base.

---

## Clients

### GET /api/clients
**Query params :** `page`, `limit`, `search`, `roleId`, `organisationId`, `clubId`, `hasOpenTickets`

### POST /api/clients
**Body**
```json
{
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@club.fr",
  "phone": "0600000000",
  "company": "Club Rugby Bayonne",
  "roleId": "uuid",
  "organisationId": "uuid",
  "clubId": "uuid"
}
```

### GET /api/clients/:id
Détail client avec statistiques : total tickets, ouverts, résolus, temps moyen de résolution.

### PUT /api/clients/:id
Met à jour les informations du client.

### DELETE /api/clients/:id
Suppression en cascade (tickets fermés + historique).

---

## Administration

### Catégories — /api/admin/categories
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/categories | Liste avec compteurs tickets |
| POST | /api/admin/categories | Créer (slug auto-généré) |
| PUT | /api/admin/categories/:id | Modifier |
| DELETE | /api/admin/categories/:id | Supprimer (si aucun ticket actif) |
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
| DELETE | /api/admin/users/:id | Supprimer (bloqué si tickets ouverts) |

### Paramètres — /api/admin/settings
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/settings | Tous les paramètres |
| PUT | /api/admin/settings | Mettre à jour |
| POST | /api/admin/settings/logo | Uploader logo |

**Paramètres disponibles :** `company_name`, `default_priority`, `auto_close_days`, `survey_delay_hours`

---

## Dashboard

### GET /api/dashboard/stats
Statistiques agrégées.

**Réponse 200**
```json
{
  "openCount": 12,
  "inProgressCount": 5,
  "closedToday": 3,
  "staleTickets": 2,
  "byPriority": { "CRITICAL": 1, "HIGH": 4, "MEDIUM": 6, "LOW": 1 },
  "byCategory": [{ "name": "Informatique", "count": 7 }],
  "byAgent": [{ "name": "Nicolas B.", "count": 3 }]
}
```

### GET /api/dashboard/trends
Tendance tickets créés sur les 30 derniers jours (tableau de points date/count).

---

## Base de connaissances

### GET /api/kb
**Query params :** `search`, `categoryId`, `status` (DRAFT/PUBLISHED), `tags[]`, `page`, `limit`

### POST /api/kb
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

### POST /api/kb/from-ticket/:ticketId
Crée un brouillon KB pré-rempli depuis un ticket et ses commentaires.

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
Retourne tous les matchs de la semaine (cache 1h par compétition).

**Compétitions :** TOP14, PRO_D2, EPCR, EPCR_CHALLENGE, LNH, LIGUE1, ELMS, ESTONIE

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
Crée ou met à jour la note d'un match (upsert). Permission requise : `tickets.create`

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
Upload d'une image collée ou insérée dans l'éditeur de notes TipTap. Permission requise : `tickets.create`

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

### GET /api/sports/match-notes/report/week
Notes de la semaine ISO courante avec bornes lundi/dimanche. Chaque note inclut `broadcasterLogo` si disponible.

### POST /api/sports/refresh
Vide le cache scraper et relance la collecte de tous les matchs de la semaine. Permission requise : `tickets.create`

**Rate limit :** cooldown de 30 secondes. Si appelé avant la fin du cooldown, retourne `HTTP 429` avec le délai restant :
```json
{ "error": "Refresh disponible dans 18 secondes" }
```

### DELETE /api/sports/match-notes/:matchKey
Supprime la note d'un match. Route authentifiée.

### POST /api/sports/match-attachments
Upload PDF pour un match (max 10 Mo, champ `file`). Permission requise : `tickets.create`. Dédoublonnage par matchKey + nom de fichier.

### POST /api/sports/match-attachments/query
Liste les pièces jointes de plusieurs matchs. Body `{ "matchKeys": ["...", "..."] }` (array, max 200 — évite les limites de longueur d'URL). Route authentifiée.

### GET /api/sports/match-attachments/:id/download
Téléchargement sécurisé (protection path-traversal). Route authentifiée.

### DELETE /api/sports/match-attachments/:id
Suppression d'une pièce jointe. Permission requise : `admin.access`.

> Les pièces jointes de match sont **temporaires** : un job cron les purge automatiquement 6 h après le coup d'envoi.

---

## Enquêtes de satisfaction

### GET /api/survey/:token *(public)*
Page enquête accessible sans authentification (token 30 jours).

### POST /api/survey/:token/respond *(public)*
Soumettre les réponses (scores NPS et CSAT extraits automatiquement).

### GET /api/admin/surveys/csat-live
CSAT en temps réel : global, mois courant, mois précédent, tendance.

### GET /api/admin/surveys/results
Résultats paginés avec calcul NPS et graphique hebdomadaire.

---

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
