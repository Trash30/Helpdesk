#!/usr/bin/env bash
##############################################################
# install.sh — Installation complète Helpdesk (Ubuntu 22.04)
# Usage : bash install.sh
# Idempotent : peut être relancé sans danger
##############################################################
set -euo pipefail

APP_DIR="/opt/helpdesk"
LOG_FILE="/tmp/helpdesk-install.log"
NODE_VERSION="20"
PG_VERSION="15"

# Couleurs
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*" | tee -a "$LOG_FILE"; }
step() { echo -e "\n${CYAN}${BOLD}── $* ──${NC}" | tee -a "$LOG_FILE"; }
die()  { echo -e "\n${RED}${BOLD}✗ ERREUR : $*${NC}" | tee -a "$LOG_FILE"; exit 1; }

# ── Bannière ──────────────────────────────────────────────────
clear
cat << 'EOF'
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║          HelpDesk — Installateur Linux                   ║
  ║          Ubuntu 22.04 · Node.js 20 · PostgreSQL 15       ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
EOF
echo ""

# ── Prérequis ─────────────────────────────────────────────────
step "Vérification des prérequis"

[ "$(id -u)" -eq 0 ] || die "Ce script doit être exécuté en tant que root (sudo bash install.sh)"

# OS
if ! lsb_release -d 2>/dev/null | grep -qi "ubuntu"; then
    warn "OS non Ubuntu détecté — continuer à vos risques et périls"
fi

# Espace disque (2 GB minimum)
AVAIL_KB=$(df /opt --output=avail | tail -1)
[ "$AVAIL_KB" -ge 2097152 ] || die "Espace disque insuffisant (min 2 GB sur /opt)"
ok "Espace disque : OK ($(( AVAIL_KB / 1024 / 1024 )) GB disponibles)"

# Mémoire (2 GB minimum)
TOTAL_MB=$(awk '/MemTotal/ { print int($2/1024) }' /proc/meminfo)
[ "$TOTAL_MB" -ge 1800 ] || warn "Mémoire faible (${TOTAL_MB} MB) — minimum recommandé : 2 GB"
ok "Mémoire : ${TOTAL_MB} MB"

# Internet
curl -fsSL --connect-timeout 5 https://registry.npmjs.org/ &>/dev/null || die "Pas d'accès Internet"
ok "Connexion Internet : OK"

# ── Mise à jour des paquets ───────────────────────────────────
step "1/10 — Mise à jour du système"
apt-get update -qq 2>&1 | tee -a "$LOG_FILE"
apt-get install -y -qq curl gnupg2 lsb-release ca-certificates \
    build-essential git unzip 2>&1 | tee -a "$LOG_FILE"
ok "Paquets de base installés"

# ── nvm + Node.js 20 LTS ──────────────────────────────────────
step "2/10 — Installation de Node.js ${NODE_VERSION} LTS via nvm"

export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    log "Téléchargement de nvm..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash 2>&1 | tee -a "$LOG_FILE"
    ok "nvm installé"
else
    ok "nvm déjà présent — mise à jour ignorée"
fi

# Charger nvm dans ce shell
# shellcheck disable=SC1091
\. "$NVM_DIR/nvm.sh"

if ! node -v 2>/dev/null | grep -q "^v${NODE_VERSION}"; then
    log "Installation de Node.js ${NODE_VERSION}..."
    nvm install "$NODE_VERSION" 2>&1 | tee -a "$LOG_FILE"
    nvm alias default "$NODE_VERSION"
    ok "Node.js $(node -v) installé"
else
    ok "Node.js $(node -v) déjà installé"
fi

# Rendre node/npm disponibles globalement
NODE_BIN=$(dirname "$(which node)")
ln -sf "$(which node)"  /usr/local/bin/node  2>/dev/null || true
ln -sf "$(which npm)"   /usr/local/bin/npm   2>/dev/null || true
ln -sf "$(which npx)"   /usr/local/bin/npx   2>/dev/null || true

# ── PostgreSQL 15 ─────────────────────────────────────────────
step "3/10 — Installation de PostgreSQL ${PG_VERSION}"

if ! command -v psql &>/dev/null || ! psql --version | grep -q "${PG_VERSION}"; then
    log "Ajout du dépôt PostgreSQL..."
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    echo "deb [signed-by=/etc/apt/trusted.gpg.d/postgresql.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    apt-get install -y -qq "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}" 2>&1 | tee -a "$LOG_FILE"
    ok "PostgreSQL ${PG_VERSION} installé"
else
    ok "PostgreSQL $(psql --version | awk '{print $3}') déjà installé"
fi

systemctl enable "postgresql@${PG_VERSION}-main" --now 2>&1 | tee -a "$LOG_FILE" || true
systemctl start  "postgresql" 2>&1 | tee -a "$LOG_FILE" || true
ok "Service PostgreSQL démarré"

# ── Nginx ─────────────────────────────────────────────────────
step "4/10 — Installation de Nginx"
if ! command -v nginx &>/dev/null; then
    apt-get install -y -qq nginx 2>&1 | tee -a "$LOG_FILE"
    ok "Nginx installé"
else
    ok "Nginx $(nginx -v 2>&1 | grep -oP '[\d.]+') déjà installé"
fi
systemctl enable nginx --now 2>&1 | tee -a "$LOG_FILE" || true

# ── PM2 ───────────────────────────────────────────────────────
step "5/10 — Installation de PM2"
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2 2>&1 | tee -a "$LOG_FILE"
    ln -sf "$(which pm2)" /usr/local/bin/pm2 2>/dev/null || true
    ok "PM2 installé"
else
    ok "PM2 $(pm2 -v) déjà installé"
fi

# ── Répertoires uploads ───────────────────────────────────────
step "6/10 — Création des répertoires"
mkdir -p "$APP_DIR/uploads/attachments" "$APP_DIR/uploads/logo" "$APP_DIR/logs"
chown -R www-data:www-data "$APP_DIR/uploads" 2>/dev/null || true
chmod -R 755 "$APP_DIR/uploads"
ok "Répertoires créés : $APP_DIR/uploads/{attachments,logo}"

# ── Code source ───────────────────────────────────────────────
step "7/10 — Déploiement du code source"
if [ ! -d "$APP_DIR/server" ] || [ ! -d "$APP_DIR/client" ]; then
    echo ""
    echo -e "${YELLOW}Le code source n'est pas encore dans $APP_DIR.${NC}"
    echo "Options :"
    echo "  a) Cloner depuis un dépôt git"
    echo "  b) Copier manuellement puis relancer ce script"
    echo ""
    read -rp "URL du dépôt git (laisser vide pour copie manuelle) : " GIT_URL
    if [ -n "$GIT_URL" ]; then
        git clone "$GIT_URL" "$APP_DIR" 2>&1 | tee -a "$LOG_FILE"
        ok "Code cloné depuis $GIT_URL"
    else
        die "Copiez le code source dans $APP_DIR puis relancez : sudo bash $APP_DIR/install.sh"
    fi
else
    ok "Code source déjà présent dans $APP_DIR"
fi

# ── Configuration .env ────────────────────────────────────────
step "8/10 — Configuration de l'environnement"

ENV_FILE="$APP_DIR/server/.env"

if [ -f "$ENV_FILE" ]; then
    echo ""
    read -rp "Un fichier .env existe déjà. Écraser ? (o/N) : " OVERWRITE
    [[ "$OVERWRITE" =~ ^[Oo]$ ]] || { ok ".env existant conservé"; goto_step9=1; }
fi

if [ "${goto_step9:-0}" -eq 0 ]; then
    echo ""
    echo -e "${CYAN}Configuration de la base de données :${NC}"
    read -rp "  Mot de passe PostgreSQL pour helpdesk_user : " DB_PASS
    [ -n "$DB_PASS" ] || die "Le mot de passe ne peut pas être vide"

    echo -e "${CYAN}Configuration JWT :${NC}"
    JWT_AUTO=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || openssl rand -hex 48)
    read -rp "  JWT Secret (Entrée pour générer automatiquement) : " JWT_SECRET
    JWT_SECRET="${JWT_SECRET:-$JWT_AUTO}"

    echo -e "${CYAN}Configuration SMTP (pour les emails) :${NC}"
    read -rp "  Hôte SMTP (ex: smtp.gmail.com) : " SMTP_HOST
    read -rp "  Port SMTP (ex: 587) : " SMTP_PORT
    SMTP_PORT="${SMTP_PORT:-587}"
    read -rp "  Utilisateur SMTP : " SMTP_USER
    read -rsp "  Mot de passe SMTP : " SMTP_PASS; echo ""
    read -rp "  Adresse expéditeur (ex: helpdesk@monentreprise.com) : " SMTP_FROM_ADDR

    echo -e "${CYAN}Configuration application :${NC}"
    read -rp "  URL publique de l'application (ex: http://mon-serveur.com) : " APP_URL
    APP_URL="${APP_URL:-http://localhost}"
    read -rp "  Nom de l'entreprise (ex: Mon Helpdesk) : " COMPANY_NAME
    COMPANY_NAME="${COMPANY_NAME:-Mon Helpdesk}"

    # Créer l'utilisateur et la DB PostgreSQL
    log "Création de l'utilisateur et de la base de données PostgreSQL..."
    sudo -u postgres psql -c "
        DO \$\$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'helpdesk_user') THEN
            CREATE USER helpdesk_user WITH PASSWORD '${DB_PASS}';
          ELSE
            ALTER USER helpdesk_user WITH PASSWORD '${DB_PASS}';
          END IF;
        END
        \$\$;
    " 2>&1 | tee -a "$LOG_FILE"
    sudo -u postgres psql -c "
        SELECT 'CREATE DATABASE helpdesk_db OWNER helpdesk_user'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'helpdesk_db')
    " -t | sudo -u postgres psql 2>&1 | tee -a "$LOG_FILE" || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE helpdesk_db TO helpdesk_user;" 2>&1 | tee -a "$LOG_FILE"
    ok "Base de données configurée"

    # Écrire le .env
    cat > "$ENV_FILE" << EOF
DATABASE_URL=postgresql://helpdesk_user:${DB_PASS}@localhost:5432/helpdesk_db
JWT_SECRET=${JWT_SECRET}
PORT=3001
NODE_ENV=production
UPLOADS_PATH=/opt/helpdesk/uploads
APP_URL=${APP_URL}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM="${COMPANY_NAME} <${SMTP_FROM_ADDR:-noreply@helpdesk.com}>"
EOF
    ok ".env créé dans $ENV_FILE"

    # Mettre le company_name de côté pour le seed
    export INITIAL_COMPANY_NAME="$COMPANY_NAME"
fi

# ── Dépendances npm ───────────────────────────────────────────
step "9/10 — Installation et build"

log "Dépendances serveur..."
npm ci --prefix "$APP_DIR/server" --omit=dev 2>&1 | tee -a "$LOG_FILE"
ok "Dépendances serveur installées"

log "Migrations Prisma..."
cd "$APP_DIR/server"
npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"
ok "Migrations appliquées"

log "Seed initial..."
npx ts-node prisma/seed.ts 2>&1 | tee -a "$LOG_FILE" || warn "Seed déjà effectué ou erreur non bloquante"
ok "Données initiales chargées"

log "Dépendances client..."
npm ci --prefix "$APP_DIR/client" 2>&1 | tee -a "$LOG_FILE"
ok "Dépendances client installées"

log "Build frontend..."
npm run build --prefix "$APP_DIR/client" 2>&1 | tee -a "$LOG_FILE"
ok "Frontend compilé dans $APP_DIR/client/dist"

# ── PM2 startup ───────────────────────────────────────────────
log "Démarrage de l'application avec PM2..."
cd "$APP_DIR"
pm2 start ecosystem.config.js 2>&1 | tee -a "$LOG_FILE" || pm2 restart helpdesk-server 2>&1 | tee -a "$LOG_FILE"
pm2 startup 2>&1 | tee -a "$LOG_FILE" | grep "sudo env" | bash 2>&1 | tee -a "$LOG_FILE" || true
pm2 save 2>&1 | tee -a "$LOG_FILE"
ok "PM2 configuré pour démarrage automatique"

# ── Configuration Nginx ───────────────────────────────────────
step "10/10 — Configuration Nginx"
cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/helpdesk
ln -sf /etc/nginx/sites-available/helpdesk /etc/nginx/sites-enabled/helpdesk
# Désactiver le site default si présent
rm -f /etc/nginx/sites-enabled/default

nginx -t 2>&1 | tee -a "$LOG_FILE" || die "Configuration Nginx invalide — vérifier $APP_DIR/nginx.conf"
systemctl reload nginx
ok "Nginx configuré et rechargé"

# ── Résumé final ──────────────────────────────────────────────
APP_URL_FINAL=$(grep -E "^APP_URL=" "$ENV_FILE" | cut -d= -f2)
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗"
echo -e "║        Installation terminée avec succès !               ║"
echo -e "╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}URL de l'application :${NC} ${CYAN}${APP_URL_FINAL}${NC}"
echo ""
echo -e "  ${BOLD}Identifiants par défaut :${NC}"
echo -e "    Admin  : admin@helpdesk.com  / admin123"
echo -e "    Agent  : agent1@helpdesk.com / agent123"
echo ""
echo -e "  ${YELLOW}IMPORTANT : changez ces mots de passe immédiatement !${NC}"
echo ""
echo -e "  ${BOLD}Commandes utiles :${NC}"
echo -e "    Statut    : ${BLUE}pm2 status${NC}"
echo -e "    Logs      : ${BLUE}pm2 logs helpdesk-server${NC}"
echo -e "    Mise à jour : ${BLUE}cd $APP_DIR && bash deploy.sh${NC}"
echo ""
echo -e "  Log d'installation : $LOG_FILE"
echo ""
