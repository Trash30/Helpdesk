# Guide utilisateur — Helpdesk VOGO

**Public :** agents support, superviseurs  
**Niveau :** utilisateurs informatique courant  
**Application :** http://helpdesk.local

> **Captures d'écran :** les emplacements `📷` indiquent où ajouter une capture. Outil recommandé : Win+Maj+S (Snipping Tool Windows).

---

## Sommaire

1. [Connexion](#1-connexion)
2. [Dashboard](#2-dashboard)
3. [Tickets](#3-tickets)
4. [Clients](#4-clients)
5. [Événements sportifs](#5-événements-sportifs)
6. [Base de connaissances](#6-base-de-connaissances)
7. [Mon profil](#7-mon-profil)
8. [Administration](#8-administration-admins-uniquement)

---

## 1. Connexion

Accéder à **http://helpdesk.local** depuis n'importe quel poste du réseau.

> 📷 *Capture : page de connexion (champs email + mot de passe + bouton Connexion)*

- Saisir l'**email** et le **mot de passe** fournis par l'administrateur
- Cliquer **Connexion**
- **Premier accès :** un changement de mot de passe est imposé avant d'accéder à l'application

### Mot de passe oublié
Cliquer **"Mot de passe oublié ?"** → saisir l'email → un lien de réinitialisation est envoyé (valable 24h).

### Déconnexion
Cliquer l'avatar en haut à droite → **Déconnexion**. La session expire automatiquement après 8h.

---

## 2. Dashboard

Page d'accueil après connexion. Vue d'ensemble de l'activité support en temps réel.

> 📷 *Capture : dashboard complet (KPIs en haut, graphiques, tableau tickets urgents, widget sports en bas)*

### Compteurs (ligne du haut)
Chaque carte est **cliquable** et ouvre la liste de tickets filtrée correspondante.

| Carte | Ce qu'elle affiche |
|-------|-------------------|
| Tickets ouverts | Tickets en statut OPEN |
| En cours | Tickets en statut IN_PROGRESS |
| Fermés aujourd'hui | Tickets clôturés dans la journée |
| Événements aujourd'hui | Matchs du jour pour vos compétitions suivies |
| Événements cette semaine | Total des matchs de la semaine |
| En attente de MAJ | Tickets sans mise à jour depuis +5 jours |

Les compteurs se rafraîchissent **toutes les 60 secondes** automatiquement.

### Graphiques
- **Courbe** (gauche) : tickets créés sur les 30 derniers jours
- **Donut** (droite) : répartition des tickets actifs par priorité

### Tableau tickets urgents
Les 10 tickets CRITICAL ou HIGH non fermés, pour ne rien manquer d'important.

### Widget sports
En bas de page — matchs de la semaine avec vos notes de support. Voir [section 5](#5-événements-sportifs).

---

## 3. Tickets

### 3.1 Liste des tickets

> 📷 *Capture : liste des tickets avec filtres actifs et résultats*

Accès via **Tickets** dans la barre de navigation gauche.

**Filtres disponibles** (combinables) :

| Filtre | Utilisation |
|--------|------------|
| Recherche texte | Cherche dans le numéro, titre, nom du client |
| Statut | OPEN / IN_PROGRESS / PENDING / CLOSED (multi-sélection) |
| Priorité | CRITICAL / HIGH / MEDIUM / LOW (multi-sélection) |
| Catégorie | Filtre par type de problème |
| Mes tickets | Affiche uniquement les tickets assignés à vous |
| Organisation / Club | Filtre par structure cliente |
| Date de création | Période début / fin |

Bouton **"Réinitialiser"** pour revenir aux filtres par défaut.

**Export** (boutons en haut à droite) :
- **CSV** — ouvrable dans Excel
- **PDF** — format paysage, limité à 1000 lignes

---

### 3.2 Créer un ticket

> 📷 *Capture : formulaire de création de ticket*

Bouton **"+ Nouveau ticket"** en haut de la liste.

Champs à remplir :

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| Titre | Oui | Résumé court du problème |
| Description | Non | Détail du problème (Markdown supporté) |
| Client | Oui | Contact concerné |
| Catégorie | Oui | Type de demande |
| Type | Non | Sous-catégorie |
| Priorité | Oui | LOW / MEDIUM / HIGH / CRITICAL |
| Pôle | Non | Pôle support interne concerné |

---

### 3.3 Traiter un ticket

> 📷 *Capture : page détail d'un ticket (vue desktop deux colonnes)*

#### Changer le statut
Dans le panneau droit, sélectionner le nouveau statut :

```
OPEN → IN_PROGRESS → PENDING → CLOSED
```

- **PENDING** : une dialog demande le motif de mise en attente
- **CLOSED** : une note de fermeture est **obligatoire** (max 500 caractères)

> 📷 *Capture : dialog de fermeture avec champ note obligatoire*

#### Modifier les informations
Titre éditable directement par clic. Catégorie, priorité, pôle et agent assigné modifiables dans le panneau droit.

#### Ajouter un commentaire
Zone en bas à gauche de la page.

> 📷 *Capture : zone de commentaire avec toggle "Note interne" et zone pièce jointe*

- **Mise en forme** : Gras (Ctrl+B), Italique (Ctrl+I), Code (Ctrl+`)
- **Note interne** : toggle orange → commentaire visible uniquement par les agents, pas par les clients
- **Pièces jointes** : jusqu'à 5 fichiers par commentaire (5 Mo max chacun)
- Envoi via **Ctrl+Entrée** ou bouton "Envoyer"

#### Créer un article de connaissance depuis un ticket fermé
Après fermeture, si vous avez les droits `kb.write`, une dialog propose de créer automatiquement un article depuis le ticket (titre prérempli, sélection des commentaires à inclure, choix brouillon/publié).

---

## 4. Clients

> 📷 *Capture : liste clients avec barre de recherche*

Accès via **Clients** dans la navigation.

**Recherche** par nom, email, organisation, club. Filtre "Tickets ouverts" pour voir les contacts avec des demandes actives.

### Fiche client

> 📷 *Capture : fiche client détaillée (informations + historique tickets)*

- Informations : nom, email, téléphone, organisation, club, rôle
- Statistiques : nombre total de tickets, ouverts, résolus, temps moyen de résolution
- Historique complet des tickets du contact

**Accès rapide depuis un ticket :** cliquer sur le nom du client dans le panneau droit → ouvre la fiche sans quitter le ticket (panneau latéral).

---

## 5. Événements sportifs

Deux points d'accès :
- **Dashboard** → bas de page (widget semaine complète)
- **Événements → Aujourd'hui** dans la navigation → matchs du jour uniquement

> 📷 *Capture : widget sports sur le dashboard (matchs groupés par compétition)*

### 5.1 Lire le calendrier

Les matchs sont groupés par compétition, filtrés selon vos préférences (voir [section 7](#7-mon-profil)). Si aucune préférence configurée, toutes les compétitions s'affichent.

Compétitions supportées : TOP 14, PRO D2, EPCR Champions Cup, EPCR Challenge Cup, Liqui Moly Starligue, ELMS, Premium Liiga (Estonie).

Bouton **↻** en haut du widget pour forcer un rechargement des données du scraper (cooldown 30s).

### 5.2 Pièces jointes PDF

Sur chaque match, bouton d'upload pour joindre un PDF (ordre de mission, feuille de match, etc.). Taille max 10 Mo. Les fichiers sont **automatiquement supprimés 6h après le match**.

### 5.3 Notes de support

> 📷 *Capture : éditeur de note de match ouvert (feu tricolore + éditeur rich text)*

Cliquer **"Ajouter des notes"** sur un match pour ouvrir l'éditeur.

**Feu tricolore** (obligatoire pour le CR) :

| Couleur | Signification |
|---------|--------------|
| 🟢 VERT | Aucun incident — RAS |
| 🟠 ORANGE | Point à surveiller |
| 🔴 ROUGE | Incident ou point d'attention |

**Autres champs :**
- **Production** : sélectionner la régie (BeIN / Via Storia / AMP Visual / IXI Live / Aucune)
- **Chaperonnage** : cocher + sélectionner le technicien responsable
- **Contenu libre** : éditeur rich text avec Gras, Italique, Souligné, listes, images

**Images dans les notes** : coller (Ctrl+V), glisser-déposer ou bouton d'upload dans la toolbar. L'image est hébergée sur le serveur et intégrée dans le CR exporté.

Bouton **Enregistrer** pour sauvegarder. La note reste visible même après le match (reconstruite depuis les métadonnées si le match disparaît du scraper).

### 5.4 Export du compte-rendu hebdomadaire

> 📷 *Capture : bouton "Exporter CR" en haut du widget*

Bouton **"Exporter CR"** → télécharge un fichier Word `CR_Sxx.docx` contenant :

- Titre : "CR SUPPORT SEMAINE xx — [année]"
- Champ Techniciens (éditable dans Word)
- Un bloc par match noté : feu tricolore visuel, logos des équipes, heure, diffuseur TV, production, technicien chaperonné, contenu de la note
- Les matchs VERT sans contenu ni production ni chaperonnage sont **omis** du CR

---

## 6. Base de connaissances

> 📷 *Capture : liste des articles de la base de connaissances avec barre de recherche et filtres*

Accès via **Base de connaissances** dans la navigation.

**Recherche** par mot-clé, catégorie, tags. Filtres : Brouillon / Publié.

### Créer un article
Bouton **"+ Nouvel article"** → éditeur rich text (même que les notes de match). Choisir catégorie, tags et statut (Brouillon ou Publié directement).

**Depuis un ticket fermé** : voir [section 3.3](#33-traiter-un-ticket) — la dialog de création préremplie est plus rapide.

---

## 7. Mon profil

> 📷 *Capture : page profil (section compétitions avec cases à cocher)*

Accès via l'**avatar** en haut à droite → **Mon profil**.

### Compétitions sportives suivies

Sélectionner les championnats pour lesquels vous assurez le support. Ces préférences filtrent :
- Le widget sports du dashboard
- La page "Événements aujourd'hui"
- Les compteurs KPI "Événements" du dashboard

Si **aucune compétition cochée**, toutes s'affichent. Cliquer **Enregistrer** après modification.

### Changer de mot de passe

Saisir le mot de passe actuel + le nouveau (8 caractères minimum, 1 majuscule, 1 chiffre). L'indicateur de force s'affiche en temps réel.

Après changement : déconnexion automatique, reconnexion requise avec le nouveau mot de passe.

---

## 8. Administration (admins uniquement)

Accessible via **Administration** dans la navigation (visible uniquement si permission `admin.access`).

> 📷 *Capture : menu administration déroulé dans la sidebar*

### Utilisateurs (`/admin/users`)
Créer, modifier, activer/désactiver les comptes agents. L'envoi d'un email de reset de mot de passe se fait depuis cette page.

### Rôles (`/admin/roles`)
Créer des rôles personnalisés et configurer leurs permissions. Un changement de permissions est **effectif immédiatement** sur toutes les sessions actives.

### Catégories (`/admin/categories`)
Gérer les catégories de tickets (couleur, nom). Réordonnables par glisser-déposer.

### Organisations & Clubs (`/admin/organisations`, `/admin/clubs`)
Hiérarchie clients : une organisation contient des clubs, un club contient des contacts.

### Pôles (`/admin/poles`)
Pôles support internes VOGO (ex. Technique, Commercial, Production).

### Types de tickets (`/admin/ticket-types`)
Sous-catégories de tickets (ex. Incident, Demande, Question).

### Enquêtes de satisfaction (`/admin/surveys`)

> 📷 *Capture : tableau de bord enquêtes (scores CSAT/NPS + tendances)*

Résultats des enquêtes envoyées automatiquement après fermeture de ticket. Scores CSAT et NPS disponibles par mois.

### Paramètres (`/admin/settings`)
- **Apparence** : logo de l'entreprise (glisser-déposer PNG/JPG/SVG), nom affiché
- **Tickets** : priorité par défaut, assignation par défaut, fermeture automatique après N jours (0 = désactivé)
- **Enquêtes** : délai avant envoi (heures), cooldown entre deux enquêtes (jours)

---

## Raccourcis utiles

| Action | Raccourci |
|--------|-----------|
| Envoyer un commentaire | Ctrl + Entrée |
| Mettre en gras | Ctrl + B |
| Mettre en italique | Ctrl + I |
| Format code inline | Ctrl + ` |
| Copier-coller une image dans une note | Ctrl + V (dans l'éditeur) |

---

*Document généré le 14 juin 2026 — Helpdesk VOGO v2*
