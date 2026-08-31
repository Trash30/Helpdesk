# Stack technique — Helpdesk VOGO

Référence rapide des technologies sur lesquelles l'application s'appuie.
Versions indiquées = celles des `package.json` (août 2026). Voir `ARCHITECTURE.md` pour le détail de fonctionnement.

## Vue d'ensemble

Monorepo npm à 3 `package.json` : racine (orchestration), `server/`, `client/`.
Langage unique : **TypeScript 5.4** (front + back).

| Script racine | Effet |
|---------------|-------|
| `npm run dev` | Lance `server` + `client` en parallèle (`concurrently`) |
| `npm run install:all` | `npm install` dans `server/` puis `client/` |
| `npm run build` | `tsc` serveur + `tsc && vite build` client |

## Frontend (`client/`)

| Domaine | Techno | Version |
|---------|--------|---------|
| Framework UI | React | 18.3 |
| Build / dev server | Vite | 5.3 (`@vitejs/plugin-react` 4.3) |
| Langage | TypeScript | 5.4 |
| Styles | TailwindCSS | 3.4 (+ `postcss`, `autoprefixer`) |
| Composants | shadcn/ui (sur Radix UI) | `@radix-ui/react-*` 1.x–2.x |
| Icônes | lucide-react | 0.400 |
| Data fetching / cache | TanStack Query | 5.x |
| Client HTTP | axios | 1.6 |
| State global léger | Zustand | 4.5 (`authStore`, `brandingStore`) |
| Routing | React Router DOM | 6.26 |
| i18n | i18next / react-i18next | 26.x / 17.x (FR + EN) |
| Éditeur riche (notes de match, KB) | TipTap | 3.22 (`starter-kit`, `image`, `link`, `underline`, `placeholder`) |
| Graphiques (dashboard) | Recharts | 2.12 |
| Export DOCX (CR hebdo sports) | docx | 9.6 |
| Export PDF / CSV (tickets) | jspdf + jspdf-autotable, papaparse | 4.2 / 5.0 / 5.5 |
| Markdown (rendu) | react-markdown + rehype-sanitize | 9.x / 6.x |
| Drag & drop (réordonnancement admin) | @dnd-kit | 6.x |
| Notifications toast | react-hot-toast | 2.4 |
| Utilitaires classes | clsx, tailwind-merge, class-variance-authority | — |

## Backend (`server/`)

| Domaine | Techno | Version |
|---------|--------|---------|
| Runtime | Node.js | 20 LTS |
| Framework HTTP | Express | 4.19 |
| Langage | TypeScript | 5.4 (exécution dev via `ts-node`, prod via `node dist/`) |
| ORM | Prisma | 5.14 (`@prisma/client` 5.14) |
| Base de données | PostgreSQL | 15 |
| Auth | jsonwebtoken (JWT HS256, cookie httpOnly) | 9.0 |
| Hash mots de passe | bcrypt | 5.1 |
| Validation | Zod | 3.23 |
| Sécurité HTTP | helmet | 7.1 |
| CORS | cors | 2.8 |
| Rate limiting | express-rate-limit | 7.3 |
| Cookies | cookie-parser | 1.4 |
| Upload fichiers | multer | 1.4 |
| Emails (reset, enquêtes) | nodemailer | 8.0 (SMTP) |
| Jobs planifiés | node-cron | 3.0 (enquêtes horaires, purge pièces jointes match H+6) |
| Logs HTTP | morgan | 1.10 |
| Sanitisation HTML (notes, KB) | sanitize-html | 2.17 |
| Config | dotenv | 16.4 |

## Scraping sportif (`server/src/services/sportsScraper.ts`)

| Techno | Version | Usage |
|--------|---------|-------|
| axios | 1.14 | Requêtes HTTP vers les sites sportifs |
| cheerio | 1.2 | Parsing HTML (LNR, AS Monaco) |
| — | — | Parsing natif : JSON-LD (ELMS), payload Nuxt SSR (EPCR), iCal regex (Estonie), POST AJAX (Daikin Starligue / LNH) |

8 compétitions : TOP 14, Pro D2, Champions Cup, Challenge Cup, Daikin Starligue, Ligue 1 (AS Monaco), ELMS, Premium Liiga (Estonie). Exécution en `Promise.allSettled` (un scraper en échec n'impacte pas les autres), cache mémoire 1 h.

## Déploiement

| Élément | Détail |
|---------|--------|
| OS cible | Ubuntu 22.04 LTS |
| Process manager | PM2 (`sudo pm2`, process `helpdesk-server` en root, `ecosystem.config.js`) |
| Reverse proxy | Nginx (`nginx.conf` — `/api/*` → :3001, `/uploads/*`, SPA fallback) |
| Mise à jour | `git pull origin main` + `npm ci` + `prisma migrate deploy` + `npm run build` + `sudo pm2 restart` — ou `sync-to-server.ps1` (SCP depuis Windows) |
| Hostname | `helpdesk.local` via avahi/mDNS (optionnel) |

Détails : `GUIDE_TRANSFERT_COMPETENCES.md` §5.5, `TROUBLESHOOTING_DEPLOIEMENT.md`.

## Prérequis poste de développement

- Node.js 20 LTS + npm
- PostgreSQL 15 (locale ou distante)
- Git

---

> **Notes**
> - `puppeteer` figure dans `server/package.json` mais n'est plus importé dans le code — dépendance résiduelle, candidate à suppression.
> - `xlsx` (devDependency racine) : utilitaire ponctuel, non utilisé par l'application au runtime.
