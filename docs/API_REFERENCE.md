# Référence API — Helpdesk VOGO

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

## Sports

### GET /api/sports/matches
Retourne tous les matchs de la semaine (cache 1h par compétition).

**Compétitions :** TOP14, PRO_D2, EPCR, EPCR_CHALLENGE, LNH, SUPER_LEAGUE, LIGUE1, ELMS

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

### GET /api/sports/match-notes/report/week
Notes de la semaine ISO courante avec bornes lundi/dimanche. Chaque note inclut `broadcasterLogo` si disponible.

### POST /api/sports/refresh
Vide le cache scraper et relance la collecte de tous les matchs de la semaine. Permission requise : `tickets.create`

**Rate limit :** cooldown de 30 secondes. Si appelé avant la fin du cooldown, retourne `HTTP 429` avec le délai restant :
```json
{ "error": "Refresh disponible dans 18 secondes" }
```

### POST /api/sports/match-attachments
Upload PDF pour un match (max 10 Mo). Dédoublonnage par matchKey + nom de fichier.

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
