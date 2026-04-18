# Documentation Sécurité — Helpdesk VOGO

**Version :** 1.0  
**Date :** Avril 2026  
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

### 4.2 Rôles système

Deux rôles système non supprimables :

| Rôle | Permissions |
|------|------------|
| **Admin** | Toutes les permissions (23) |
| **Agent** | tickets.* (sauf delete/viewAll), clients.view/create/edit, comments.create/delete |

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

Le middleware CORS est configuré pour n'autoriser que les origines légitimes. En production, seul le domaine interne de l'application est autorisé.

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

Le proxy d'images (utilisé pour afficher les logos des équipes sportives) bloque :
- Toutes les adresses IP privées (RFC 1918 : 10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Les adresses de loopback (127.x.x.x)
- Les adresses link-local (169.254.x.x)
- Les adresses IPv6 privées
- Les protocoles autres que http/https

Timeout de 5 secondes pour éviter les attaques de type Slowloris.

---

## 10. Audit et traçabilité

### 10.1 Logs d'activité tickets

Chaque modification d'un ticket génère un enregistrement `ActivityLog` en base de données contenant :
- L'utilisateur auteur de la modification
- L'action effectuée
- L'ancienne valeur
- La nouvelle valeur
- L'horodatage exact

Ces logs sont immuables et servent de piste d'audit.

### 10.2 Logs serveur

Morgan est configuré pour journaliser toutes les requêtes HTTP avec horodatage, méthode, route, statut et durée. Les logs sont écrits dans `/opt/helpdesk/logs/` sur le serveur.

### 10.3 Suppressions douces

Les tickets et articles KB ne sont jamais vraiment supprimés — un champ `deletedAt` est renseigné. L'historique est toujours consultable en base de données par un administrateur.

---

## 11. Sécurité du déploiement

| Aspect | Mesure |
|--------|--------|
| Processus | PM2 en mode fork, redémarrage automatique |
| Mémoire max | 512 Mo (protection contre les fuites mémoire) |
| Variables d'environnement | Fichier `.env` non versionné (gitignore) |
| Base de données | Accès uniquement depuis localhost (connexion Prisma) |
| Réseau | Application interne, non exposée sur Internet |

---

## 12. Récapitulatif des vecteurs d'attaque et contre-mesures

| Vecteur | Risque | Contre-mesure |
|---------|--------|---------------|
| Vol de token | Session hijacking | Cookie httpOnly — inaccessible au JS |
| CSRF | Action non souhaitée | SameSite=lax + token JWT |
| XSS | Injection de script | Helmet CSP + validation Zod |
| Brute force | Deviner un mot de passe | Rate limiting 10 req/min |
| Path traversal | Accès fichiers hors upload | `path.resolve()` + vérification préfixe |
| Injection SQL | Lecture/modification BDD | Prisma ORM (requêtes préparées) |
| Privilege escalation | Accès non autorisé | RBAC vérifié côté serveur à chaque requête |
| SSRF | Appels internes via proxy | Blocage IP privées dans proxy image |
| Enumération token | Reset password brute force | Token haché SHA-256, one-time, 24h |
| Permissions obsolètes | Token avec droits révoqués | Vérification `roleUpdatedAt` à chaque requête |
