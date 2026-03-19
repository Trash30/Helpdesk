# SPEC.md — Helpdesk Ticketing Web Application
# Document de référence complet pour Claude Code
# Lire intégralement avant d'écrire la moindre ligne de code

---

## 1. Vue d'ensemble

Application web interne de gestion de support technique permettant à une équipe
d'agents de créer et suivre des tickets clients, avec tableau de bord d'activité,
gestion des pièces jointes, enquêtes de satisfaction automatisées et administration
complète de la plateforme.

Déploiement cible : serveur Linux Ubuntu 22.04 en local, sans Docker.
Évolution prévue : migration cloud possible ultérieurement.

---

## 2. Stack technique

| Couche         | Technologie                                      |
|----------------|--------------------------------------------------|
| Frontend       | React 18 + Vite + TailwindCSS + shadcn/ui        |
| Routing        | React Router v6                                  |
| État global    | Zustand                                          |
| Requêtes API   | TanStack Query (React Query)                     |
| Icônes         | Lucide Icons                                     |
| Graphiques     | Recharts                                         |
| Drag & drop    | @dnd-kit/core                                    |
| Backend        | Node.js + Express                                |
| ORM            | Prisma                                           |
| Base de données| PostgreSQL 15                                    |
| Upload fichiers| Multer (stockage disque local)                   |
| Authentification| JWT                                             |
| Validation     | Zod                                              |
| Emails         | Nodemailer                                       |
| Tâches planif. | node-cron                                        |
| Process manager| PM2                                              |
| Reverse proxy  | Nginx                                            |

---

## 3. Architecture des dossiers

```
/opt/helpdesk/          (Linux production)
C:\HelpDesk\app\        (Windows dev)
├── client/
├── server/
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
└── uploads/
    ├── attachments/
    └── logo/
```

---

## 4. Modèle de données (Prisma schema)

### Role
- id: String (uuid, @id)
- name: String (@unique)
- description: String?
- isSystem: Boolean (@default(false))
- permissions: String[]
- roleUpdatedAt: DateTime (@default(now()))
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)
- users: User[]

### User
- id: String (uuid, @id)
- firstName: String
- lastName: String
- email: String (@unique)
- password: String
- roleId: String
- role: Role (@relation)
- isActive: Boolean (@default(true))
- mustChangePassword: Boolean (@default(true))
- passwordResetToken: String?
- passwordResetExpiry: DateTime?
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)

### ClientRole
- id: String (uuid, @id)
- name: String (@unique)
- description: String?
- color: String
- isActive: Boolean (@default(true))
- position: Int
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)
- clients: Client[]

### Client
- id: String (uuid, @id)
- firstName: String
- lastName: String
- email: String?
- phone: String?
- company: String?
- roleId: String?
- role: ClientRole? (@relation)
- isSurveyable: Boolean (@default(true))
- notes: String?
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)
- tickets: Ticket[]

### Category
- id: String (uuid, @id)
- name: String (@unique)
- slug: String (@unique)
- color: String
- icon: String
- description: String?
- isActive: Boolean (@default(true))
- position: Int
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)
- tickets: Ticket[]

### Ticket
- id: String (uuid, @id)
- ticketNumber: String (@unique)
- title: String
- description: String
- status: Status (@default(OPEN))
- priority: Priority (@default(MEDIUM))
- categoryId: String?
- category: Category? (@relation)
- clientId: String
- client: Client (@relation)
- assignedToId: String?
- assignedTo: User? (@relation "AssignedTickets")
- createdById: String
- createdBy: User (@relation "CreatedTickets")
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)
- resolvedAt: DateTime?
- closedAt: DateTime?
- comments: Comment[]
- attachments: Attachment[]
- activityLogs: ActivityLog[]
- surveySends: SurveySend[]

### Comment
- id: String (uuid, @id)
- ticketId: String
- ticket: Ticket (@relation)
- authorId: String
- author: User (@relation)
- content: String
- isInternal: Boolean (@default(false))
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)

### Attachment
- id: String (uuid, @id)
- ticketId: String
- ticket: Ticket (@relation)
- filename: String
- originalName: String
- mimetype: String
- size: Int
- path: String
- uploadedById: String
- uploadedBy: User (@relation)
- createdAt: DateTime (@default(now()))

### ActivityLog
- id: String (uuid, @id)
- ticketId: String
- ticket: Ticket (@relation)
- userId: String?
- user: User? (@relation)
- action: String
- oldValue: String?
- newValue: String?
- createdAt: DateTime (@default(now()))

### Settings
- id: String (uuid, @id)
- key: String (@unique)
- value: String
- updatedAt: DateTime (@updatedAt)

### SurveyTemplate
- id: String (uuid, @id)
- name: String
- isActive: Boolean (@default(false))
- questions: Json
- createdAt: DateTime (@default(now()))
- updatedAt: DateTime (@updatedAt)

### SurveySend
- id: String (uuid, @id)
- ticketId: String
- ticket: Ticket (@relation)
- clientEmail: String
- sentAt: DateTime?
- status: SurveySendStatus (@default(PENDING))
- token: String (@unique)
- createdAt: DateTime (@default(now()))
- response: SurveyResponse?

### SurveyResponse
- id: String (uuid, @id)
- surveySendId: String (@unique)
- surveySend: SurveySend (@relation)
- ticketId: String
- clientEmail: String
- answers: Json
- npsScore: Int?
- vocScore: Float?
- completedAt: DateTime (@default(now()))
- createdAt: DateTime (@default(now()))

### Enums

```
enum Status {
  OPEN
  IN_PROGRESS
  PENDING
  RESOLVED
  CLOSED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum SurveySendStatus {
  PENDING
  SENT
  FAILED
}

enum QuestionType {
  nps
  csat
  rating
  text
  textarea
  select
  multiselect
}
```

---

## 5. Numérotation des tickets

Format : VG + année 4 chiffres + numéro séquentiel sur 4 chiffres
Exemples : VG20250001, VG20250002, VG20260001

- Générée côté serveur à la création
- Compteur repart à 0001 chaque 1er janvier automatiquement
- Contrainte unique en base de données
- Gestion des accès concurrents : transaction Prisma avec retry (max 3 tentatives)
- Si VG20250099 existe, le prochain est VG20250100

---

## 6. Système de permissions

### Liste complète des permissions

```
TICKETS:
  tickets.view        Voir les tickets
  tickets.create      Créer un ticket
  tickets.edit        Modifier un ticket
  tickets.close       Fermer / résoudre un ticket
  tickets.delete      Supprimer un ticket
  tickets.assign      Assigner un ticket à un agent
  tickets.viewAll     Voir les tickets de tous les agents
                      (sans ce droit : l'agent ne voit que ses tickets)

CLIENTS:
  clients.view        Voir les clients
  clients.create      Créer un client
  clients.edit        Modifier un client
  clients.delete      Supprimer un client

COMMENTAIRES:
  comments.create     Ajouter un commentaire
  comments.delete     Supprimer ses propres commentaires
  comments.deleteAny  Supprimer n'importe quel commentaire

ENQUÊTES:
  surveys.view        Voir les résultats des enquêtes
  surveys.configure   Modifier le modèle d'enquête

ADMINISTRATION:
  admin.access        Accéder au panneau d'administration
  admin.users         Gérer les agents
  admin.roles         Gérer les rôles et permissions
  admin.categories    Gérer les catégories de tickets
  admin.clientRoles   Gérer les rôles clients
  admin.settings      Modifier les paramètres généraux
```

### Rôles système par défaut (isSystem: true, non supprimables)

**Administrateur** : toutes les permissions ci-dessus

**Agent** :
  tickets.view, tickets.create, tickets.edit, tickets.close,
  tickets.assign, tickets.viewAll,
  clients.view, clients.create, clients.edit,
  comments.create, comments.delete

### Règles de dépendance automatique (UI uniquement)

- tickets.edit     → active automatiquement tickets.view
- tickets.close    → active automatiquement tickets.view + tickets.edit
- tickets.delete   → active automatiquement tickets.view
- tickets.assign   → active automatiquement tickets.view
- comments.deleteAny → active automatiquement comments.delete
- admin.users / admin.roles / admin.categories / admin.clientRoles / admin.settings
  → activent tous automatiquement admin.access

### Invalidation JWT

Champ roleUpdatedAt sur le modèle Role.
Si token.iat < role.roleUpdatedAt → retourner 401, forcer re-login.
Les changements de permissions prennent effet immédiatement pour tous les utilisateurs du rôle.

---

## 7. Routes API complètes

```
AUTH
POST   /api/auth/login                           public
GET    /api/auth/me                              auth
PATCH  /api/auth/change-password                 auth (agents uniquement, pas admins)
POST   /api/auth/reset-password                  public
GET    /api/auth/validate-reset-token/:token     public

TICKETS
GET    /api/tickets                              tickets.view
POST   /api/tickets                              tickets.create
GET    /api/tickets/:id                          tickets.view
PUT    /api/tickets/:id                          tickets.edit
PATCH  /api/tickets/:id/status                   tickets.close ou tickets.edit
PATCH  /api/tickets/:id/assign                   tickets.assign
DELETE /api/tickets/:id                          tickets.delete

COMMENTAIRES
POST   /api/tickets/:id/comments                 comments.create
DELETE /api/comments/:id                         comments.delete ou comments.deleteAny

PIÈCES JOINTES
POST   /api/tickets/:id/attachments              tickets.edit
GET    /api/attachments/:id/download             tickets.view
DELETE /api/attachments/:id                      tickets.edit

CLIENTS
GET    /api/clients                              clients.view
POST   /api/clients                              clients.create
GET    /api/clients/:id                          clients.view
PUT    /api/clients/:id                          clients.edit
DELETE /api/clients/:id                          clients.delete

RÔLES CLIENTS
GET    /api/client-roles                         auth (actifs uniquement)
GET    /api/admin/client-roles                   admin.clientRoles
POST   /api/admin/client-roles                   admin.clientRoles
PUT    /api/admin/client-roles/:id               admin.clientRoles
DELETE /api/admin/client-roles/:id               admin.clientRoles
PATCH  /api/admin/client-roles/reorder           admin.clientRoles

CATÉGORIES
GET    /api/categories                           auth (actives uniquement)
GET    /api/admin/categories                     admin.categories
POST   /api/admin/categories                     admin.categories
PUT    /api/admin/categories/:id                 admin.categories
DELETE /api/admin/categories/:id                 admin.categories
PATCH  /api/admin/categories/reorder             admin.categories

RÔLES UTILISATEURS
GET    /api/admin/roles                          admin.roles
POST   /api/admin/roles                          admin.roles
PUT    /api/admin/roles/:id                      admin.roles
DELETE /api/admin/roles/:id                      admin.roles
POST   /api/admin/roles/:id/duplicate            admin.roles

AGENTS
GET    /api/admin/users                          admin.users
POST   /api/admin/users                          admin.users
PUT    /api/admin/users/:id                      admin.users
POST   /api/admin/users/:id/send-reset-email     admin.users

PARAMÈTRES
GET    /api/settings/public                      public
POST   /api/admin/settings/logo                  admin.settings
PUT    /api/admin/settings                       admin.settings

DASHBOARD
GET    /api/dashboard/stats                      auth
GET    /api/dashboard/trends                     auth

ENQUÊTES
GET    /api/survey/:token                        public
POST   /api/survey/:token/respond                public (rate limit 10/min)
GET    /api/admin/surveys/csat-live              surveys.view
GET    /api/admin/surveys/results                surveys.view
GET    /api/admin/surveys/sends                  surveys.view
GET    /api/admin/surveys/template               surveys.view
PUT    /api/admin/surveys/template               surveys.configure
```

---

## 8. Fonctionnalités détaillées

### 8.1 Tableau de bord (/dashboard)

KPI row — 4 cartes :
- Tickets ouverts (bleu) — count status=OPEN
- En cours (orange) — count status=IN_PROGRESS
- Résolus aujourd'hui (vert) — count resolvedAt = today
- CSAT global (couleur dynamique) :
  - Valeur : (vocScore >= 4 count) / total responses * 100
  - Barre de progression colorée : <50% rouge / 50-75% orange / >75% vert
  - Sous-label : "X réponses sur Y"
  - Badge évolution : "+X% vs mois dernier" vert ou "-X%" rouge
  - Tooltip au survol : détail satisfaits/neutres/non satisfaits

Row 2 :
- Gauche 60% : graphique linéaire "Tickets créés — 30 derniers jours" (Recharts)
- Droite 40% : graphique donut "Par priorité"
  CRITICAL=#E24B4A / HIGH=#EF9F27 / MEDIUM=#378ADD / LOW=#639922

Row 3 :
- Gauche 50% : graphique barres horizontales "Tickets par agent"
- Droite 50% : liste "Activité récente" — 10 derniers ActivityLog

Row 4 : tableau "Tickets urgents" (CRITICAL ou HIGH + OPEN ou IN_PROGRESS)
  Colonnes : # / Client / Titre / Priorité / Statut / Assigné / Créé le

Rafraîchissement : TanStack Query refetchInterval 60000ms

### 8.2 Tickets

**Liste (/tickets) :**
- Filtres : status[] / priority[] / categoryId / assignedToId / dateFrom / dateTo
- Recherche full-text : title, description, ticketNumber, client name
- Colonnes : ticketNumber (mono bleu) / client+phone / title / category badge /
  priority badge / status badge / assigned agent avatar+name / createdAt relative
- Priority badges : CRITICAL=rouge / HIGH=orange / MEDIUM=bleu / LOW=vert
- Status badges : OPEN=bleu / IN_PROGRESS=orange / PENDING=rose / RESOLVED=vert / CLOSED=gris
- Pagination 25/page, click row → /tickets/:id

**Création (/tickets/new) :**

Section Client :
- Recherche live (nom, téléphone, email) debounced 300ms
- Dropdown résultats : name / company / phone / role badge
- Aucun résultat : "Aucun client trouvé" + bouton "Créer ce client"
- Client sélectionné : carte avec avatar initiales / nom / company / phone / role
  + bouton "Changer" + lien "Modifier" → openClientPanel(id)
- Formulaire inline création (slide-down) :
  firstName + lastName (côte à côte)
  phone + email (côte à côte)
  company + role select (côte à côte)
  isSurveyable toggle
  "Créer et sélectionner" → POST /api/clients, auto-sélection
  "Annuler" → collapse

Section Ticket : title (requis) / description (markdown) / category / priority / assignedTo
Section Attachments : drag & drop zone + liste fichiers avec preview
Validation : client obligatoire
On success : toast "Ticket VGxxxxxxxx créé" + redirect /tickets/:id

**Détail (/tickets/:id) — 2 colonnes :**

Colonne gauche (65%) :
- Titre éditable inline (save on Enter/blur)
- Description éditable inline (markdown rendu quand non-édité)
- Timeline chronologique (commentaires + ActivityLog mélangés) :
  - Commentaire : avatar / auteur / timestamp / markdown rendu /
    badge "Note interne" jaune si isInternal /
    bouton delete (propre ou deleteAny)
  - ActivityLog : texte italique gris
    "Marie a changé le statut : OPEN → IN_PROGRESS · il y a 2h"
- Zone commentaire bas :
  Textarea + toolbar markdown (gras, italique, code) +
  toggle "Note interne" (fond jaune si actif) +
  bouton "Ajouter" + Ctrl+Enter

Colonne droite (35%) :
- Status dropdown (optimistic update + ActivityLog)
- Priority dropdown (coloré)
- Category dropdown
- Assigned agent dropdown (avec avatars)
- Séparateur
- Carte client : avatar initiales / nom / company / phone (tel:) / email (mailto:) /
  role badge / lien "Voir la fiche client"
- Séparateur
- Infos ticket : numéro / créé par / créé le / mis à jour le / résolu le
- Séparateur
- Pièces jointes : liste (icône + nom + taille + date + download + delete) +
  bouton "Ajouter une pièce jointe"
- Séparateur
- Boutons action (avec confirm modal) :
  "Résoudre" (→ RESOLVED) si OPEN ou IN_PROGRESS
  "Fermer" (→ CLOSED) si RESOLVED
  "Rouvrir" (→ OPEN) si RESOLVED ou CLOSED

### 8.3 Clients

**Slide-over réutilisable (ClientSlideOver) :**
- firstName + lastName (requis, côte à côte)
- company (optionnel)
- phone + email (côte à côte, au moins un requis)
- role (select depuis GET /api/client-roles)
- isSurveyable toggle :
  Label : "Enquêtes de satisfaction"
  Info-bulle : "Si désactivé, ce client ne recevra aucune enquête NPS/CSAT
  même s'il possède une adresse email"
- notes (textarea)
Exposé via ClientPanelContext : openClientPanel() / openClientPanel(clientId)
Avertissement modifications non enregistrées à la fermeture

**Liste (/clients) :**
- Recherche : nom, téléphone, email, société
- Filtres : role / "Tickets ouverts uniquement"
- Colonnes : nom (lien) / company / phone (tel:) / email (mailto:) /
  role badge / icône cloche barrée si isSurveyable=false /
  tickets ouverts (badge bleu) / total tickets / dernière activité
- Actions : Voir / Modifier / Nouveau ticket
- "Nouveau client" → openClientPanel()

**Fiche (/clients/:id) :**
- Header : grand avatar initiales + nom + role badge + bouton "Modifier"
- Grille infos : company / phone / email / statut enquêtes / notes / membre depuis
- Stats : total / ouverts / résolus / temps moyen résolution
- Tableau historique tickets
- "Créer un ticket" → /tickets/new avec client pré-sélectionné
- Suppression admin only (bloquée si tickets ouverts)

### 8.4 Pièces jointes

- Max 5 fichiers par upload, max 10 MB par fichier
- Formats acceptés : images (jpg/png/gif/webp), pdf, doc, docx, zip, txt
- Stockage : uploads/attachments/[uuid]-[originalname]
- Prévisualisation : thumbnail si image, icône type sinon
- Téléchargement avec Content-Disposition: attachment
- Suppression : fichier disque + enregistrement DB

### 8.5 Personnalisation interface (branding)

- Logo : PNG/JPG/SVG/WebP, max 2 MB, stocké dans uploads/logo/
- Login page : logo centré max 200x80px + company name sous le logo
- Sidebar : logo max 140x40px + company name à droite
- Fallback : company name en texte stylisé si aucun logo uploadé
- Hook useBranding() : fetch GET /api/settings/public une fois, cache Zustand
- Tous les emails branded : logo + company name dans le header

### 8.6 Enquêtes de satisfaction

**Déclenchement (cron job toutes les heures) :**

Conditions pour envoyer :
1. ticket.status = CLOSED
2. ticket.resolvedAt <= NOW() - [settings.survey_delay_hours, défaut 48] heures
3. client.email IS NOT NULL
4. client.isSurveyable = true
5. Aucun SurveySend existant pour ce ticketId
6. Aucun SurveySend avec status=SENT à cette adresse email
   dans les [settings.survey_cooldown_days, défaut 10] derniers jours

Token : UUID v4, single-use, valide 30 jours
Email : HTML branded (logo + company name) avec bouton CTA

**Formulaire standard — 7 questions dans cet ordre exact :**

Q1 — CSAT (type: csat, required: true)
  label: "Comment évaluez-vous votre satisfaction globale concernant
  le traitement de votre demande ?"
  Rendu: 5 boutons numériques carrés (1, 2, 3, 4, 5)
  Bouton non sélectionné: fond blanc, bordure grise 1px
  Bouton sélectionné: fond #185FA5, texte blanc (même couleur pour tous)
  Légende: "1 = Très insatisfait" (gauche) / "5 = Très satisfait" (droite)

Q1b — Commentaire CSAT (type: textarea, required: false, conditionnel)
  showIf: { questionId: "q1", operator: "lte", value: 3 }
  label: "Qu'est-ce qui vous a déplu ou pourrait être amélioré ?"
  helpText: "Votre retour nous aide à progresser"
  Animation: slide-down 300ms quand CSAT <= 3, slide-up sinon
  Jamais obligatoire même quand visible

Q2 — NPS (type: nps, required: true)
  label: "Sur une échelle de 0 à 10, quelle est la probabilité que
  vous nous recommandiez à un proche ou un collègue ?"
  Rendu: 11 boutons numériques carrés (0, 1, 2, ..., 10)
  Bouton non sélectionné: fond blanc, bordure grise 1px
  Bouton sélectionné: fond #185FA5, texte blanc (même couleur pour tous)
  Légende: "0 = Pas du tout probable" (gauche) / "10 = Très probable" (droite)
  IMPORTANT: NE PAS afficher les labels Détracteur/Passif/Promoteur
  sur la page publique. Ces catégories sont réservées au dashboard admin.

Q3 — Rapidité (type: rating, scale: 1-5, required: true)
  label: "Comment évaluez-vous la rapidité de traitement de votre demande ?"
  Légende: "1 = Très lent" / "5 = Très rapide"
  Rendu: 5 boutons numériques (même règle que ci-dessus)

Q4 — Qualité (type: rating, scale: 1-5, required: true)
  label: "Comment évaluez-vous la qualité de la solution apportée ?"
  Légende: "1 = Insuffisante" / "5 = Excellente"

Q5 — Professionnalisme (type: select, required: false)
  label: "Le technicien qui a traité votre demande était-il ?"
  options: ["Très professionnel", "Professionnel", "Correct", "Peu professionnel"]

Q6 — Commentaire libre (type: textarea, required: false)
  label: "Avez-vous des commentaires ou suggestions pour améliorer notre service ?"
  helpText: "Votre retour nous aide à progresser"

**Règle de rendu universelle (CRITIQUE) :**
nps, csat, rating → TOUJOURS rendu comme rangée de boutons numériques carrés.
JAMAIS d'emoji. JAMAIS d'étoiles. UNIQUEMENT des chiffres.
Bouton sélectionné : #185FA5 uniforme pour toutes les valeurs.
Pas de code couleur rouge/orange/vert visible par le répondant.

**Calcul CSAT :**
- Satisfaits   : vocScore >= 4
- Neutres      : vocScore = 3
- Non satisfaits: vocScore <= 2
- Score CSAT % = (satisfaits) / total * 100
- vocScore extrait de la réponse Q1 (type: csat)
- npsScore extrait de la réponse Q2 (type: nps)

**Page publique /survey/:token :**
- Layout standalone (sans sidebar, sans topbar, sans auth)
- Logo société centré + company name + référence ticket
- Barre de progression (required answered / total required)
- Submit désactivé jusqu'aux questions required répondues
- États : token invalide / expiré (>30j) / déjà répondu
- Écran succès après soumission, pas de re-soumission

**Dashboard admin /admin/surveys — 3 onglets :**

Onglet "Résultats" :
- Carte CSAT global (toutes périodes, au-dessus du filtre) :
  3 barres : Satisfaits(>=4) vert / Neutres(=3) orange / Non satisfaits(<=2) rouge
  Total réponses + évolution vs mois précédent
  Source : GET /api/admin/surveys/csat-live
  Refetch toutes les 30 secondes
- Filtre date : 7j / 30j / 90j / custom
- Carte CSAT filtré (respecte filtre de date, même layout)
- Score NPS global coloré :
  <0=rouge / 0-30=orange / 30-70=bleu / >70=vert
  Labels Détracteur/Passif/Promoteur visibles ICI (admin only)
- Graphique tendance NPS par semaine (Recharts)
- Tableau réponses : date / ticket# / client / NPS badge / CSAT / délai / commentaire / "Voir"
- Slide-over détail : toutes les réponses par question

Onglet "Envois" :
- Table : date / ticket# / email / statut / répondu / "Renvoyer" (FAILED only)

Onglet "Modèle" :
- Éditeur drag & drop (@dnd-kit/core)
- Chaque question : handle / type badge / label / required / conditionnel / edit / delete
- Formulaire ajout/édition question avec preview live
- Sauvegarde crée une nouvelle version, désactive l'ancienne
- Bouton "Restaurer le modèle par défaut" (avec confirmation)

---

## 9. Interface d'administration (/admin)

Requiert admin.access pour accéder à toutes les pages /admin/*.

| Page                   | URL                    | Permission requis   |
|------------------------|------------------------|---------------------|
| Paramètres généraux    | /admin/settings        | admin.settings      |
| Catégories tickets     | /admin/categories      | admin.categories    |
| Rôles clients          | /admin/client-roles    | admin.clientRoles   |
| Rôles & permissions    | /admin/roles           | admin.roles         |
| Gestion des agents     | /admin/users           | admin.users         |
| Enquêtes               | /admin/surveys         | surveys.view        |

### /admin/settings — 3 sections

Apparence :
- Preview logo actuel (ou placeholder)
- Zone upload drag & drop (PNG/JPG/SVG/WebP, max 2MB)
- Bouton "Supprimer le logo"
- Champ company name

Tickets :
- Priorité par défaut (select)
- Agent assigné par défaut (select ou "Non assigné")
- Auto-fermeture tickets résolus après N jours (0 = désactivé)

Enquêtes :
- Délai envoi après fermeture en heures (défaut: 48)
- Cooldown entre deux enquêtes en jours (défaut: 10)

Bouton Save par section + toast succès.

### /admin/categories

Liste drag & drop (@dnd-kit/core) :
Chaque ligne : handle / point couleur / icône Lucide / nom / description / toggle actif / edit / delete
Suppression bloquée si tickets utilisent la catégorie (afficher le compte)

Modal création/édition :
- name (requis), description, toggle actif
- Color picker : 12 swatches prédéfinis + champ hex
  Couleurs : #185FA5 #534AB7 #0F6E56 #854F0B #5F5E5A
             #E24B4A #EF9F27 #639922 #D4537E #0C447C #3B6D11 #A32D2D
- Icon picker : grille searchable 30 icônes Lucide :
  Monitor Code Wifi Lock Printer Mail Phone Database Server HardDrive
  Cpu Globe Shield AlertTriangle Settings Wrench Package Users FileText
  Cloud Smartphone Headphones Camera Mic Battery Zap Link Key Bug LifeBuoy
- Preview badge live : [point couleur] [icône] [nom]

### /admin/client-roles

Même structure que /admin/categories sans icon picker.
Suppression bloquée si clients utilisent ce rôle.

### /admin/roles

Cards grid :
- nom / description / badge "Système" si isSystem
- nombre agents / pills permissions preview
- boutons : edit / duplicate / delete
- delete désactivé si isSystem ou agents assignés (tooltip)

Slide-over éditeur :
- name (requis, désactivé si isSystem)
- description
- 5 groupes checkboxes (Tickets / Clients / Commentaires / Enquêtes / Administration) :
  Header groupe : icône + label + bouton "Tout cocher/décocher"
  Chaque permission : checkbox + label + description subtile
  Dépendances auto : toast "X activé automatiquement (requis par Y)"
- Footer sticky : "Ce rôle dispose de X droits sur Y"
  Pills : Tickets(3/7) · Clients(2/4) · Commentaires(1/3) · Enquêtes(0/2) · Admin(0/6)
- Avertissement modifications non enregistrées

### /admin/users

Table : avatar(initiales) / nom / email / role badge / tickets assignés / statut / edit
Filtre par rôle.

Slide-over (création + édition) :
- firstName + lastName / email
- Mot de passe (création uniquement, avec indicateur de force)
- Role selector + aperçu permissions en lecture seule (même layout checkboxes, tout désactivé)
- Toggle isActive
- Bouton "Envoyer un email de réinitialisation" (édition uniquement) :
  Dialog confirmation : "Envoyer un email à [email] ?"
  POST /api/admin/users/:id/send-reset-email
  Toast "Email envoyé à [email]"
  Sous le bouton : "Dernier envoi : il y a Xh" ou "Jamais envoyé"

---

## 10. Gestion des mots de passe

### Agents (non-admins)

Peuvent changer leur mot de passe depuis /profile :
- Champ "Mot de passe actuel" (requis pour vérification)
- Champ "Nouveau mot de passe" avec indicateur de force
- Champ "Confirmer le nouveau mot de passe"
- Règles : min 8 caractères, 1 majuscule, 1 chiffre
- Après changement : déconnexion forcée + redirect /login + toast

### Administrateurs

NE PEUVENT PAS changer leur mot de passe via l'interface.
Page /profile pour les admins : section sécurité affiche un encadré informatif.
Aucun champ mot de passe affiché pour les admins.
La seule façon : un autre admin envoie un email de réinitialisation depuis /admin/users.

### Réinitialisation par email (admin → agent)

1. Admin clique "Envoyer un email de réinitialisation" sur la fiche agent
2. Backend génère UUID token, le hash bcrypt, stocke dans passwordResetToken
3. passwordResetExpiry = now() + 24 heures
4. Envoie email HTML branded :
   Header : logo société (max 180px) + company name
   Corps : "Bonjour [firstName], une demande de réinitialisation..."
   CTA : "Réinitialiser mon mot de passe" → [APP_URL]/reset-password/[raw_token]
   "Ce lien est valable 24 heures."
   Footer : company name + "Ne pas répondre à cet email"
5. Agent clique le lien → /reset-password/:token (page publique)
6. Validation du token : GET /api/auth/validate-reset-token/:token
7. Si valide : formulaire nouveau mot de passe + confirmation
8. Submit : POST /api/auth/reset-password
9. Backend : vérifie bcrypt.compare(token, hash), vérifie expiry
10. Hash + sauvegarde, clear token fields, mustChangePassword=false
11. Redirect /login + toast "Mot de passe mis à jour"

---

## 11. Navigation et routes frontend

```
Routes publiques (sans auth) :
  /login
  /reset-password/:token
  /survey/:token
  /403
  /404

Routes protégées (auth requise) :
  /dashboard
  /tickets
  /tickets/new
  /tickets/:id
  /clients
  /clients/:id
  /profile
  /change-password          (si mustChangePassword=true)

Routes admin protégées (admin.access + permission spécifique) :
  /admin/settings           admin.settings
  /admin/categories         admin.categories
  /admin/client-roles       admin.clientRoles
  /admin/roles              admin.roles
  /admin/users              admin.users
  /admin/surveys            surveys.view
```

Sidebar navigation :
```
Dashboard
Tickets          [badge nombre tickets ouverts]
Clients
Administration   [visible si admin.access]
  ├── Paramètres
  ├── Catégories tickets
  ├── Rôles clients
  ├── Rôles & permissions
  ├── Équipe
  └── Enquêtes
```

Topbar :
- Recherche globale (tickets + clients, dropdown groupé, debounce 300ms, Escape pour fermer)
- Avatar menu : "Mon profil" → /profile / "Déconnexion"
- Bouton "Nouveau ticket" (si tickets.create)

---

## 12. Déploiement

### Linux Ubuntu 22.04 (production)

Stack : Node.js 20 LTS (nvm) + PostgreSQL 15 natif + Nginx + PM2

Nginx configuration :
```
location /api/      → proxy_pass http://localhost:3001
location /uploads/  → alias /opt/helpdesk/uploads/
location /          → root /opt/helpdesk/client/dist; try_files $uri /index.html
```

Fichiers à générer :
- ecosystem.config.js (PM2)
- nginx.conf (vhost)
- deploy.sh (mise à jour idempotente)
- install.sh (installation complète from scratch, idempotente)

install.sh étapes :
1. Installer nvm + Node.js 20 LTS
2. Installer PostgreSQL 15 + démarrer service
3. Installer nginx + pm2 global
4. Créer /opt/helpdesk/uploads/attachments/ et /logo/ avec permissions
5. Prompts interactifs : DB password / JWT secret / SMTP / APP_URL / company name
   → écrire /opt/helpdesk/server/.env
6. npm ci dans /server et /client
7. prisma migrate deploy + prisma db seed
8. npm run build dans /client
9. pm2 start ecosystem.config.js + pm2 startup + pm2 save
10. Configurer nginx + reload
11. Afficher résumé coloré avec URL + identifiants

### Windows (développement)

- cross-env dans tous les scripts npm
- path.join() pour tous les chemins de fichiers (jamais de slashes hardcodés)
- npm run dev à la racine : concurrently démarre Vite (5173) + Express (3001)

### Installateur Windows (/installer/)

Fichiers :
- setup.bat (entry point → appelle setup.ps1)
- setup.ps1 (script principal PowerShell, 10 étapes)
- start.bat / stop.bat / update.bat / uninstall.ps1
- config/helpdesk.conf (configuration éditable)
- Log : C:\HelpDesk\install.log

setup.ps1 étapes :
1. Bannière ASCII + message bienvenue
2. Vérification prérequis : Windows 10/11 / droits admin / internet / disque >2GB / RAM >2GB
3. Vérifier/installer Node.js 20 LTS (MSI silencieux)
4. Vérifier/installer PostgreSQL 15 (install silencieux → C:\HelpDesk\pgdata)
5. Créer user helpdesk_user + DB helpdesk_db (password 16 chars aléatoires → .env)
6. Copier app → C:\HelpDesk\app\, écrire .env, npm ci + migrate + seed + build
7. NSSM : installer HelpDesk-Server comme service Windows (auto-start)
8. Nginx Windows portable → C:\HelpDesk\nginx\, nginx.conf, service Windows via NSSM
9. Raccourci bureau + dossier Start Menu
10. Résumé final + offre d'ouvrir le navigateur
Idempotent : détecte installation existante, propose mode réparation

---

## 13. Sécurité

- JWT expiration 8h
- Invalidation immédiate si role.roleUpdatedAt > token.iat → 401
- Routes publiques sans auth : voir section 11
- requirePermission() middleware sur toutes les routes sensibles
- Rate limiting enquêtes publiques : 10 req/min par IP
- Bcrypt pour mots de passe (rounds: 12) et tokens de reset
- mustChangePassword : redirect forcé /change-password après login
- Validation Zod sur tous les inputs API
- Multer : validation MIME type + taille côté serveur
- Helmet.js pour headers HTTP sécurisés
- CORS configuré pour APP_URL uniquement en production

---

## 14. UX et gestion des erreurs

- React Hot Toast : toutes les actions (succès + erreur), durée 4s, position top-right
- Loading skeletons : toutes les pages et listes pendant le chargement
- Empty states : toutes les listes avec illustration + CTA pertinent
- Page /403 : "Accès refusé — vous n'avez pas les droits nécessaires"
- Page /404 : page non trouvée avec lien retour
- ConfirmDialog (composant réutilisable) avant : suppression ticket/client/catégorie/
  rôle/agent/pièce jointe/commentaire, fermeture/résolution ticket,
  restauration modèle enquête, envoi email reset
- useBeforeUnload : avertissement si navigation avec données non sauvegardées
- Dates : format relatif ("il y a 2h", "hier") avec date complète au hover
- Ctrl+Enter : envoyer commentaire dans le détail ticket
- Sidebar : icon-only sur écrans < 1024px avec tooltips au survol
- Indicateur force mot de passe : weak=rouge / medium=orange / strong=vert
- Tous les messages d'erreur API → toast user-friendly (jamais les erreurs brutes)

---

## 15. Données de seed (prisma/seed.ts)

Rôles système :
- Administrateur : isSystem=true, toutes les permissions
- Agent : isSystem=true, permissions standard (voir section 6)

Utilisateurs :
- admin@helpdesk.com / admin123 (rôle Administrateur, mustChangePassword: false)
- agent1@helpdesk.com / agent123 (rôle Agent, mustChangePassword: true)
- agent2@helpdesk.com / agent123 (rôle Agent, mustChangePassword: true)
- agent3@helpdesk.com / agent123 (rôle Agent, mustChangePassword: true)

Catégories (5) :
- Matériel (icon: Monitor, color: #185FA5, position: 1)
- Logiciel (icon: Code, color: #534AB7, position: 2)
- Réseau (icon: Wifi, color: #0F6E56, position: 3)
- Accès (icon: Lock, color: #854F0B, position: 4)
- Autre (icon: LifeBuoy, color: #5F5E5A, position: 5)

Rôles clients (5) :
- Responsable IT (color: #185FA5, position: 1)
- Utilisateur (color: #534AB7, position: 2)
- Direction (color: #3B6D11, position: 3)
- Prestataire (color: #854F0B, position: 4)
- Autre (color: #5F5E5A, position: 5)

Clients (10) : mix de rôles variés, isSurveyable mixte (8 true, 2 false)

Tickets (25) : mix de statuts / priorités / catégories / agents
  Avec commentaires et ActivityLog pour chaque ticket

Modèle enquête : 7 questions exactement comme défini en section 8.6

Settings :
- company_name = "Mon Helpdesk"
- survey_delay_hours = "48"
- survey_cooldown_days = "10"
