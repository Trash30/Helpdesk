# Documentation — Helpdesk VOGO

Index du dossier `docs/`. Dernière revue : **août 2026**.

## Références techniques (Markdown — source de vérité)

| Document | Contenu | Public |
|----------|---------|--------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Architecture fonctionnelle : frontend, backend, RBAC (28 permissions), catalogue des routes API, modèles de données, jobs cron, module sports scraper, déploiement | Architectes, développeurs |
| [`API_REFERENCE.md`](API_REFERENCE.md) | Référence exhaustive des endpoints REST : auth, tickets, clients, KB, sports, Missions Support, Cartes BMC, enquêtes | Développeurs, intégrateurs |
| [`SECURITE.md`](SECURITE.md) | Mesures de sécurité : JWT, mots de passe, RBAC, upload, en-têtes HTTP, CORS, proxy image anti-SSRF, restriction réseau des cartes BMC, audit, récapitulatif des vecteurs d'attaque | RSSI, direction technique |
| [`GUIDE_TRANSFERT_COMPETENCES.md`](GUIDE_TRANSFERT_COMPETENCES.md) | Onboarding d'un nouveau mainteneur : installation, configuration, structure du code, tâches de maintenance courantes (ajout de compétition, clés LNH, déploiement, cartes BMC), débogage, bugs connus | Repreneur du projet |
| [`TROUBLESHOOTING_DEPLOIEMENT.md`](TROUBLESHOOTING_DEPLOIEMENT.md) | Problèmes réels rencontrés en déploiement (PM2 / Prisma / Nginx) avec cause et solution | Ops |

## Guides utilisateur

| Document | Contenu |
|----------|---------|
| [`GUIDE_UTILISATEUR_AGENT.md`](GUIDE_UTILISATEUR_AGENT.md) / [`.html`](GUIDE_UTILISATEUR_AGENT.html) | Guide de l'agent support (FR) — version imprimable HTML |
| [`GUIDE_UTILISATEUR_AGENT_EN.md`](GUIDE_UTILISATEUR_AGENT_EN.md) / [`.html`](GUIDE_UTILISATEUR_AGENT_EN.html) | Agent support guide (EN) |

## Supports direction

| Document | Contenu |
|----------|---------|
| `PRESENTATION_DIRECTION.html` / `PRESENTATION_DIRECTION_EN.html` | Présentation du projet à la direction (FR / EN) |
| `CALENDRIER_CHARGE_2026_2027.html` | Calendrier de charge 2026-2027 |
| `CALENDRIER_ETP_2026_2027.html` | Calendrier ETP 2026-2027 |

## Conventions de mise à jour

- Les `.md` de référence sont la **source de vérité** : les mettre à jour à chaque fonctionnalité validée (voir `CLAUDE.md`).
- Nouveaux endpoints → `API_REFERENCE.md` ; nouvelles permissions / mécanismes → `SECURITE.md` ; nouvelles tâches de maintenance → `GUIDE_TRANSFERT_COMPETENCES.md`.
- Les fichiers HTML de présentation sont des livrables figés — les régénérer uniquement si la présentation direction est impactée.
