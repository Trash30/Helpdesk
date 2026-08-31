# Documentation Sécurité — Helpdesk VOGO

**Version :** 1.1  
**Date :** Août 2026  
**Auteur :** Équipe technique VOGO

---

## 1. Vue d'ensemble

L'application Helpdesk VOGO est une application web interne déployée sur le réseau de l'entreprise. Elle n'est pas exposée sur Internet. Ce document décrit l'ensemble des mesures de sécurité implémentées.

---

## 2. Authentification

### 2.1 Mécanisme JWT

L'authentification repose sur des tokens **JSON Web Token (JWT)** signés avec l'algorithme **HS256** (HMAC-SHA256).

| Paramètre | Valeur |
|-----------|--------|
| Algorithme | HS256 |
| Durée de vie | 8 heures |
| Stockage | Cookie httpOnly (inaccessible au JavaScript) |
| Nom du cookie | `helpdesk_token` |
| SameSite | `lax` (protection CSRF) |
| Secure | `true` en production (HTTPS uniquement) |

**Pourquoi httpOnly ?** Un cookie httpOnly ne peut pas être lu par du JavaScript malveillant injecté dans la page (attaque XSS). C'est la meilleure pratique actuelle pour stocker des tokens d'authentification.

### 2.2 Flux de connexion

```
1. POST /api/auth/login  →  vérification email + mot de passe (bcrypt)
2. Génération du token JWT (payload: userId, roleId, iat)
3. Token stocké dans cookie httpOnly, chemin /
4. Chaque requête suivante : middleware lit le cookie, vérifie signature + expiry
5. Middleware charge rôle + permissions depuis la BDD (à chaque requête)
6. Si token valide → requête autorisée selon permissions
```

### 2.3 Invalidation des tokens

Les tokens sont invalidés dans deux cas :
- **Expiry naturelle :** après 8 heures
- **Changement de permissions de rôle :** chaque rôle possède un champ `roleUpdatedAt`. Si le token a été émis *avant* la dernière modification du rôle, il est rejeté et l'utilisateur doit se reconnecter.

### 2.4 Protection contre le brute force

Les endpoints sensibles sont protégés par un rate limiter :

| Endpoint | Limite |
|----------|--------|
| POST /api/auth/login | 10 requêtes / 60 secondes / IP |
| POST /api/auth/reset-password | 10 requêtes / 60 secondes / IP |
| POST /api/sports/refresh | Cooldown 30 secondes (rejet 429 avec délai restant) |

Au-delà : réponse `HTTP 429` avec message localisé.

---

## 3. Mots de passe

### 3.1 Politique de mots de passe

| Règle | Valeur |
|-------|--------|
| Longueur minimale | 8 caractères |
| Majuscule requise | Oui (au moins 1) |
| Chiffre requis | Oui (au moins 1) |
| Algorithme de hachage | bcrypt |
| Rounds bcrypt | 10 |

Le mot de passe brut n'est **jamais stocké**. Seul le hash bcrypt est persisté en base.

### 3.2 Réinitialisation

- Génération d'un token aléatoire cryptographiquement sûr
- Token haché en **SHA-256** avant stockage en base (le token brut est uniquement dans l'email)
- Expiry : **24 heures**
- Invalidé après utilisation (one-time use)
- L'email de reset ne contient pas le mot de passe, seulement un lien à usage unique

### 3.3 Première connexion

Un agent créé par l'administrateur doit changer son mot de passe lors de sa première connexion (`mustChangePassword=true`). Jusqu'à ce changement, toutes les routes sont bloquées sauf `/api/auth/me` et `/api/auth/change-password`.

---

## 4. Contrôle d'accès (RBAC)

### 4.1 Modèle de permissions

L'application utilise un contrôle d'accès basé sur les rôles (**RBAC — Role-Based Access Control**) avec des permissions granulaires.

**Liste des permissions disponibles :**

| Groupe | Permission | Description |
|--------|-----------|-------------|
| Tickets | `tickets.view` | Consulter les tickets |
| Tickets | `tickets.create` | Créer des tickets |
| Tickets | `tickets.edit` | Modifier les champs |
| Tickets | `tickets.close` | Fermer un ticket |
| Tickets | `tickets.delete` | Supprimer (soft) |
| Tickets | `tickets.assign` | Assigner à un agent |
| Tickets | `tickets.viewAll` | Voir tous les tickets (pas seulement assignés) |
| Clients | `clients.view` | Voir la liste clients |
| Clients | `clients.create` | Créer des clients |
| Clients | `clients.edit` | Modifier les clients |
| Clients | `clients.delete` | Supprimer des clients |
| Commentaires | `comments.create` | Poster des commentaires |
| Commentaires | `comments.delete` | Supprimer ses propres commentaires |
| Commentaires | `comments.deleteAny` | Supprimer n'importe quel commentaire |
| Enquêtes | `surveys.view` | Voir les résultats CSAT/NPS |
| Enquêtes | `surveys.configure` | Configurer les templates |
| Administration | `admin.access` | Accéder au panneau admin |
| Administration | `admin.users` | Gérer les agents |
| Administration | `admin.roles` | Gérer les rôles |
| Administration | `admin.categories` | Gérer les catégories |
| Administration | `admin.clientRoles` | Gérer les rôles clients |
| Administration | `admin.settings` | Modifier les paramètres système |
| Base de connaissances | `kb.read` | Lire les articles |
| Base de connaissances | `kb.write` | Créer/modifier des articles |
| Missions Support | `events.create` | Enregistrer et consulter ses propres missions Support |
| Cartes BMC | `bmc.view` | Consulter les cartes BMC des serveurs LNR |
| Cartes BMC | `bmc.manage` | Créer et modifier des cartes BMC |
| Cartes BMC | `bmc.delete` | Supprimer définitivement une carte BMC |

> Total : **28 permissions** réparties en 8 groupes.

### 4.2 Rôles système

Deux rôles système non supprimables :

| Rôle | Permissions |
|------|------------|
| **Admin** | Toutes les permissions (28) |
| **Agent** | tickets.* (sauf delete), clients.view/create/edit, comments.create/delete, bmc.view, bmc.manage |

Des rôles personnalisés peuvent être créés et configurés librement.

### 4.3 Application des permissions côté serveur

Les permissions sont vérifiées **exclusivement côté serveur** — le frontend ne fait qu'afficher/masquer des éléments pour l'ergonomie, mais chaque endpoint API vérifie indépendamment les droits. Un utilisateur malveillant ne peut pas contourner les permissions en manipulant le frontend.

---

## 5. Sécurité des fichiers

### 5.1 Protection contre le path traversal

Tout téléchargement de fichier utilise `path.resolve()` et vérifie que le chemin résolu commence bien par le répertoire `uploads/`. Un nom de fichier contenant `../` ne peut pas accéder à des fichiers hors du répertoire autorisé.

### 5.2 Nommage des fichiers

Les fichiers sont renommés avec un **UUID v4** à l'upload. Le nom original est conservé uniquement dans la base de données pour l'affichage. Cela empêche :
- L'exécution de fichiers avec une extension dangereuse
- La collision de noms
- La devinette d'URL

### 5.3 Limites de taille

| Type de fichier | Limite |
|----------------|--------|
| Pièces jointes tickets | 5 Mo par fichier, max 5 fichiers |
| PDFs matchs sportifs | 10 Mo par fichier |
| Logo entreprise | Limité par configuration Multer |

### 5.4 Validation des types MIME

Les routes de pièces jointes valident le type MIME côté serveur. Pour les matchs sportifs, seuls les PDFs sont acceptés.

---

## 6. Sécurité des en-têtes HTTP

Le middleware **Helmet.js** est activé et configure automatiquement les en-têtes de sécurité HTTP :

| En-tête | Protection |
|---------|-----------|
| `X-Content-Type-Options: nosniff` | Empêche le MIME sniffing |
| `X-Frame-Options: DENY` | Protection clickjacking |
| `X-XSS-Protection` | Protection XSS navigateur |
| `Strict-Transport-Security` | Force HTTPS (HSTS) |
| `Content-Security-Policy` | Restreint les sources de contenu |
| `Referrer-Policy` | Contrôle les informations de référent |

---

## 7. Protection CORS

En développement (`NODE_ENV !== 'production'`), toutes les origines sont acceptées pour faciliter le travail local.

En production, une origine est autorisée si **l'une** de ces conditions est vraie :
- elle correspond à une IP privée / loopback (`localhost`, `127.0.0.1`, `10.x`, `172.16–31.x`, `192.168.x`, avec port optionnel) — regex `PRIVATE_IP_RE` dans `app.ts` ;
- elle figure dans `ALLOWED_ORIGINS` (liste CSV, optionnelle — utile pour un hostname comme `http://helpdesk.local`).

```
# .env (production) — optionnel, uniquement pour les origines non-IP privées
ALLOWED_ORIGINS=http://helpdesk.local
```

Conséquence pratique : un changement d'IP locale du serveur ne nécessite **aucune** mise à jour de configuration CORS.

`credentials: true` est activé pour permettre l'envoi du cookie `helpdesk_token`.

---

## 8. Validation des entrées

**Toutes** les entrées utilisateur sont validées avec la bibliothèque **Zod** avant traitement :
- Format email (regex RFC 5322)
- UUIDs (format strict)
- Enums (statuts, priorités — seules valeurs connues acceptées)
- Longueurs de chaînes
- Types de données

Une entrée qui ne correspond pas au schéma attendu est rejetée avec `HTTP 400` avant d'atteindre la logique métier ou la base de données. Cela protège notamment contre les injections.

---

## 9. Proxy image sécurisé

Le proxy d'images (utilisé pour les logos des équipes sportives, les favicons de compétition et les logos des diffuseurs TV) bloque :
- Toutes les adresses IP privées (RFC 1918 : 10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Les adresses de loopback (127.x.x.x)
- Les adresses link-local (169.254.x.x)
- Les adresses IPv6 privées
- Les protocoles autres que http/https
- Les redirections HTTP (`maxRedirects: 0`) — empêche les redirections vers des ressources internes

**Protection DNS rebinding** : avant d'envoyer la requête HTTP, le proxy résout le hostname en IPv4 (et IPv6 si disponible) et vérifie que l'IP résolue n'est pas privée. Cela bloque les domaines publics qui pointeraient vers une IP interne.

Timeout de 5 secondes pour éviter les attaques de type Slowloris.

---

## 10. Cartes BMC — restriction réseau

Les cartes BMC désignent les interfaces d'administration matérielle (iDRAC / iLO) des serveurs internes LNR. Ces adresses ne doivent **jamais** pointer vers une ressource publique.

| Contrôle | Implémentation |
|----------|----------------|
| Plage d'adresses | `ip` validé par Zod contre une regex RFC 1918 stricte — seules `10.x`, `172.16–31.x`, `192.168.x` sont acceptées (chaque octet ≤ 255). Toute IP publique, loopback ou non conforme → `HTTP 400`. |
| Type de division | `division` restreint à l'enum Prisma `BmcDivision` — `TOP14` ou `PRO_D2` uniquement. |
| Unicité | Contrainte `@@unique` sur `ip` — une même adresse ne peut pas être enregistrée deux fois (`HTTP 400` sur violation `P2002`). |
| Accès | Toutes les routes derrière `authMiddleware` + permissions granulaires `bmc.view` / `bmc.manage` / `bmc.delete`. |
| Traçabilité | `createdById` enregistre l'auteur de la création de chaque carte. |

> Même logique que le blocage RFC 1918 du proxy image (§9), appliquée en sens inverse : ici on **impose** une IP privée au lieu de l'interdire.

---

## 11. Audit et traçabilité

### 11.1 Logs d'activité tickets

Chaque modification d'un ticket génère un enregistrement `ActivityLog` en base de données contenant :
- L'utilisateur auteur de la modification
- L'action effectuée
- L'ancienne valeur
- La nouvelle valeur
- L'horodatage exact

Ces logs sont immuables et servent de piste d'audit.

### 11.2 Logs serveur

Morgan est configuré pour journaliser toutes les requêtes HTTP avec horodatage, méthode, route, statut et durée. Les logs sont écrits dans `/opt/helpdesk/logs/` sur le serveur.

### 11.3 Suppressions douces

Les tickets et articles KB ne sont jamais vraiment supprimés — un champ `deletedAt` est renseigné. L'historique est toujours consultable en base de données par un administrateur.

---

## 12. Sécurité du déploiement

| Aspect | Mesure |
|--------|--------|
| Processus | PM2 en mode fork, redémarrage automatique |
| Mémoire max | 512 Mo (protection contre les fuites mémoire) |
| Variables d'environnement | Fichier `.env` non versionné (gitignore) |
| Base de données | Accès uniquement depuis localhost (connexion Prisma) |
| Réseau | Application interne, non exposée sur Internet |

---

## 13. Récapitulatif des vecteurs d'attaque et contre-mesures

| Vecteur | Risque | Contre-mesure |
|---------|--------|---------------|
| Vol de token | Session hijacking | Cookie httpOnly — inaccessible au JS |
| CSRF | Action non souhaitée | SameSite=lax + token JWT |
| XSS | Injection de script | Helmet CSP + validation Zod |
| Brute force | Deviner un mot de passe | Rate limiting 10 req/min |
| Path traversal | Accès fichiers hors upload | `path.resolve()` + vérification préfixe |
| Injection SQL | Lecture/modification BDD | Prisma ORM (requêtes préparées) |
| Privilege escalation | Accès non autorisé | RBAC vérifié côté serveur à chaque requête |
| SSRF | Appels internes via proxy | Blocage IP privées + résolution DNS pre-request + maxRedirects:0 |
| Pivot via carte BMC | Enregistrement d'une IP publique/externe comme cible d'admin | `ip` restreinte aux plages privées RFC 1918 (validation Zod), enum division, unicité |
| DNS rebinding | Contournement blocage IP via DNS | Résolution DNS pré-requête + vérification IP résolue |
| Origine non autorisée | Requêtes cross-origin avec credentials | CORS allowlist via ALLOWED_ORIGINS en production |
| Enumération token | Reset password brute force | Token haché SHA-256, one-time, 24h |
| Permissions obsolètes | Token avec droits révoqués | Vérification `roleUpdatedAt` à chaque requête |
