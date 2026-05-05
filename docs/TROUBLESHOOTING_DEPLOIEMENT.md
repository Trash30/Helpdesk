# Troubleshooting Déploiement — Helpdesk VOGO

Problèmes réels rencontrés lors des déploiements, avec causes et solutions.

---

## 1. Serveur en crash loop — `P1000` Authentication failed (Prisma)

**Symptôme**
```
[FATAL] Failed to start server: PrismaClientInitializationError:
Authentication failed against database server at `localhost`,
the provided database credentials for `(not available)` are not valid.
```
PM2 redémarre en boucle, `pm2 list` affiche des dizaines de restarts.

**Cause**
PM2 a été démarré une première fois sans la variable `DATABASE_URL` dans son environnement. Il conserve un dump de ces variables vides. Les redémarrages suivants (`pm2 restart`) réutilisent ce dump — la `DATABASE_URL` de `ecosystem.config.js` n'est jamais rechargée.

Le message `(not available)` pour le nom d'utilisateur confirme que Prisma ne reçoit pas la variable.

**Diagnostic**
```bash
pm2 env 0 | grep -i database
# Si DATABASE_URL n'apparaît pas → c'est ce bug
```

**Solution**
```bash
cd /opt/helpdesk
sudo pm2 delete helpdesk-server
sudo pm2 start ecosystem.config.js
sudo pm2 save
```
Le `delete` + `start` force PM2 à relire `ecosystem.config.js` depuis zéro.

**Règle à retenir** : toujours utiliser `sudo pm2` sur ce serveur. Le process tourne en tant que `root`.

---

## 2. Double instance PM2 (root + non-root)

**Symptôme**
`pm2 list` et `sudo pm2 list` montrent deux entrées `helpdesk-server` séparées. Port 3001 en conflit (`EADDRINUSE`).

**Cause**
Un `pm2 start` sans `sudo` crée une instance dans l'espace utilisateur (`/home/supportadmin/.pm2/`), alors que la vraie instance tourne en root (`/root/.pm2/`). Les deux tentent de démarrer sur le port 3001.

**Solution**
```bash
# Supprimer l'instance non-root
pm2 delete helpdesk-server
pm2 save

# Garder uniquement l'instance root
sudo pm2 list   # doit afficher une seule entrée
```

**Règle à retenir** : **toujours `sudo pm2`** pour toutes les opérations sur ce serveur (start, restart, stop, logs, save).

---

## 3. Login impossible — identifiants incorrects (base de test)

**Symptôme**
Le login retourne `{"error": "Identifiants incorrects"}` alors que le mot de passe est correct sur l'environnement de développement.

**Cause**
La base de données du serveur de test contient des hashs bcrypt différents de ceux de dev. Les bases ne sont pas synchronisées.

**Diagnostic**
```bash
# Tester le login directement sur localhost (contourne Nginx)
set +H
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"email@vogo-group.com","password":"MonMotDePasse"}' | python3 -m json.tool

# Vérifier que l'utilisateur existe en base
psql postgresql://hduser:hdpass123@localhost:5432/helpdesk_prod \
  -c 'SELECT email, "firstName" FROM "User";'
```

> **Important** : le `!` dans les mots de passe est interprété par bash. Toujours lancer `set +H` avant d'utiliser un mot de passe avec `!` dans un terminal.

**Solution — réinitialiser le mot de passe en base**
```bash
set +H
# 1. Générer le hash bcrypt
HASH=$(node -e "const b = require('/opt/helpdesk/server/node_modules/bcrypt'); b.hash('NouveauMDP!', 10).then(h => console.log(h));")

# 2. Mettre à jour en base
psql postgresql://hduser:hdpass123@localhost:5432/helpdesk_prod \
  -c "UPDATE \"User\" SET password = '$HASH' WHERE email = 'email@vogo-group.com';"
```

---

## 4. Frontend appelle l'ancienne IP — "Route introuvable"

**Symptôme**
Après un déploiement sur un nouveau serveur (IP différente), le login depuis le navigateur échoue avec "Route introuvable". Les logs PM2 montrent des requêtes sans préfixe `/api` :
```
"POST /auth/login HTTP/1.1" 404
"GET /settings/public HTTP/1.1" 404
```

**Cause**
Le fichier `client/.env` contient `VITE_API_URL=http://192.168.102.XXX:3001` hardcodé avec l'ancienne IP. Le frontend build intègre cette URL et contourne Nginx — les appels API arrivent directement sur le port 3001 sans le préfixe `/api`.

**Vérification**
```bash
grep -o 'baseURL.*3001' /opt/helpdesk/client/dist/assets/*.js | head -3
cat /opt/helpdesk/client/.env
```

**Solution**
`VITE_API_URL` ne doit pas être définie sur le serveur. Le frontend utilise alors le fallback `/api` (chemin relatif), et Nginx proxy vers `localhost:3001`.

```bash
# Vider VITE_API_URL
echo "VITE_API_URL=" > /opt/helpdesk/client/.env

# Corriger le server_name Nginx si nécessaire
sudo sed -i 's/ANCIENNE_IP/NOUVELLE_IP/g' /etc/nginx/sites-available/helpdesk
sudo nginx -t && sudo nginx -s reload

# Rebuild
cd /opt/helpdesk/client
npm run build
sudo chmod -R 755 /opt/helpdesk/client/dist
```

**Architecture correcte**
```
Navigateur → Nginx :5173 → /api/* → proxy_pass localhost:3001
                          → /*     → fichiers dist/ (SPA)
```
`VITE_API_URL` vide = le frontend utilise `/api` relatif = tout passe par Nginx.

---

## 5. Matchs sportifs LNR absents (TOP14 / Pro D2)

**Symptôme**
Le widget Sports affiche LNH et Ligue 1 mais pas TOP14 ni Pro D2. Aucune erreur visible dans les logs.

**Cause**
Le site `lnr.fr` est inaccessible (maintenance, panne réseau sortante, changement de structure HTML). Le scraper LNR échoue silencieusement — `Promise.allSettled` isole l'erreur sans casser les autres compétitions.

**Diagnostic**
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://www.lnr.fr/rugby-top-14/calendrier-et-resultats"
# 200 = site OK, problème ailleurs
# 5xx / timeout = site down
```

**Solution**
Attendre le retour du site, puis vider le cache scraper :
```bash
sudo pm2 restart helpdesk-server
```

Les notes déjà saisies sont préservées en base (ghost matches).

---

## 6. Warning `trust proxy` — express-rate-limit

**Symptôme** (dans server-error.log)
```
ValidationError: The 'X-Forwarded-For' header is set but the Express
'trust proxy' setting is false (default).
ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
```

**Cause**
Nginx envoie le header `X-Forwarded-For` mais Express ne fait pas confiance aux proxys. Le rate limiter ne peut pas identifier correctement l'IP des utilisateurs.

**Impact** : non bloquant en l'état, mais le rate limiting de `/api/auth/login` se base sur l'IP de Nginx (`127.0.0.1`) plutôt que l'IP réelle du client — toutes les tentatives de brute force partagent la même "IP".

**Correction à appliquer dans le code** (`server/src/app.ts` ou `server/src/index.ts`) :
```typescript
app.set('trust proxy', 1);  // Faire confiance au premier proxy (Nginx)
```
À ajouter avant la configuration du rate limiter.

---

## Checklist déploiement rapide

```bash
cd /opt/helpdesk

# 1. Récupérer les changements
git pull origin feat/client-organisation-tickettype

# 2. Backend
cd server && npm ci && npx prisma migrate deploy && npm run build

# 3. Frontend
cd ../client && npm run build

# 4. Redémarrer (toujours sudo)
sudo pm2 restart helpdesk-server
sudo chmod -R 755 /opt/helpdesk/client/dist
```

> Si la migration contient un `ALTER TABLE` sur une grosse table, prévoir une fenêtre de maintenance.

### Variables d'environnement requises (server/.env)

```
DATABASE_URL=postgresql://hduser:hdpass123@localhost:5432/helpdesk_prod
JWT_SECRET=<secret>
NODE_ENV=production
ALLOWED_ORIGINS=http://192.168.102.90:5173
```

`ALLOWED_ORIGINS` est obligatoire en production depuis le commit `50c752b`. Sans cette variable, le CORS bloque toutes les requêtes frontend.
