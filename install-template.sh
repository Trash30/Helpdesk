#!/usr/bin/env bash
##############################################################
#  HelpDesk -- Installateur USB
#  Usage : sudo bash install.sh
#
#  Ce script fait TOUT :
#    1. Installe Node.js 20 + PostgreSQL 15 + Nginx + PM2
#    2. Deploie l'application pre-compilee
#    3. Restaure la base de donnees
#    4. Configure Nginx, cree le .env, demarre PM2
#
#  Requiert : Ubuntu 22.04, acces Internet
##############################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/helpdesk"
LOG_FILE="/tmp/helpdesk-install.log"
NODE_VERSION="20"
PG_VERSION="15"

# Valeurs pre-configurees par build-usb-package.ps1
SERVER_IP="{{SERVER_IP}}"
SERVER_PORT="{{SERVER_PORT}}"
DB_NAME="{{DB_NAME}}"
DB_USER="{{DB_USER}}"
DB_PASS="{{DB_PASS}}"
JWT_SECRET="{{JWT_SECRET}}"
APP_URL="http://{{SERVER_IP}}:{{SERVER_PORT}}"
COMPANY_NAME="HelpDesk"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}  [OK]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}  [!] ${NC} $*" | tee -a "$LOG_FILE"; }
step() { echo -e "\n${CYAN}${BOLD}==> $*${NC}" | tee -a "$LOG_FILE"; }
die()  { echo -e "\n${RED}${BOLD}ERREUR : $*${NC}" | tee -a "$LOG_FILE"; echo "Log : $LOG_FILE"; exit 1; }

> "$LOG_FILE"

clear
echo "============================================================"
echo "   HelpDesk -- Installation depuis cle USB"
echo "   Ubuntu 22.04 . Node.js 20 . PostgreSQL 15"
echo "============================================================"
echo ""

# ---- Verifications initiales --------------------------------
[ "$(id -u)" -eq 0 ] || die "Executer en root : sudo bash install.sh"

DUMP_FILE="$SCRIPT_DIR/db/helpdesk_dev.sql"
[ -f "$DUMP_FILE" ] || die "Dump SQL introuvable : $DUMP_FILE"
DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
ok "Dump SQL present ($DUMP_SIZE)"

AVAIL_KB=$(df /opt --output=avail 2>/dev/null | tail -1)
[ "${AVAIL_KB:-0}" -ge 2097152 ] || die "Espace insuffisant sur /opt (min 2 GB)"
ok "Espace disque OK"

# ---- 1. Paquets systeme -------------------------------------
step "1/8 -- Paquets systeme"
apt-get update -qq 2>&1 | tee -a "$LOG_FILE" \
    || die "apt-get update a echoue"
apt-get install -y -qq curl gnupg2 lsb-release ca-certificates build-essential unzip 2>&1 | tee -a "$LOG_FILE" \
    || die "Installation des paquets de base echouee"
ok "Paquets systeme OK"

# ---- 2. Node.js 20 ------------------------------------------
step "2/8 -- Node.js $NODE_VERSION"
if node -v 2>/dev/null | grep -q "^v${NODE_VERSION}"; then
    ok "Node.js $(node -v) deja present"
else
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>&1 | tee -a "$LOG_FILE" \
        || die "Telechargement NodeSource echoue"
    apt-get install -y -qq nodejs 2>&1 | tee -a "$LOG_FILE" \
        || die "Installation Node.js echouee"
    ok "Node.js $(node -v) installe"
fi

# ---- 3. PostgreSQL 15 ---------------------------------------
step "3/8 -- PostgreSQL $PG_VERSION"
if ! command -v psql &>/dev/null; then
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg 2>&1 | tee -a "$LOG_FILE"
    echo "deb [signed-by=/etc/apt/trusted.gpg.d/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq 2>&1 | tee -a "$LOG_FILE"
    apt-get install -y -qq "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}" 2>&1 | tee -a "$LOG_FILE" \
        || die "Installation PostgreSQL echouee"
    ok "PostgreSQL $PG_VERSION installe"
else
    ok "PostgreSQL $(psql --version | awk '{print $3}') deja present"
fi
systemctl enable postgresql --now 2>&1 | tee -a "$LOG_FILE" || true
sleep 2

# ---- 4. Nginx -----------------------------------------------
step "4/8 -- Nginx"
if ! command -v nginx &>/dev/null; then
    apt-get install -y -qq nginx 2>&1 | tee -a "$LOG_FILE" \
        || die "Installation Nginx echouee"
    ok "Nginx installe"
else
    ok "Nginx deja present"
fi
systemctl enable nginx --now 2>&1 | tee -a "$LOG_FILE" || true

# ---- 5. PM2 -------------------------------------------------
step "5/8 -- PM2"
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2 2>&1 | tee -a "$LOG_FILE" \
        || die "Installation PM2 echouee"
    ok "PM2 installe"
else
    ok "PM2 $(pm2 -v) deja present"
fi

# ---- 6. Deploiement de l'application -----------------------
step "6/8 -- Deploiement"

# Stopper l'ancienne instance proprement
pm2 stop helpdesk-server  2>/dev/null | tee -a "$LOG_FILE" || true
pm2 delete helpdesk-server 2>/dev/null | tee -a "$LOG_FILE" || true

# Nettoyer et reinstaller
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/uploads/attachments" "$APP_DIR/uploads/logo" "$APP_DIR/logs"

cp -r "$SCRIPT_DIR/app/client"              "$APP_DIR/"
cp -r "$SCRIPT_DIR/app/server"              "$APP_DIR/"
cp    "$SCRIPT_DIR/app/ecosystem.config.js" "$APP_DIR/"

chown -R www-data:www-data "$APP_DIR/uploads" 2>/dev/null || true
chmod -R 755 "$APP_DIR/uploads"
ok "Fichiers deployes dans $APP_DIR"

# ---- 7. Dependances Node.js + Prisma -----------------------
step "7/8 -- Dependances Node.js"
cd "$APP_DIR/server"

log "npm install --omit=dev ..."
npm install --omit=dev 2>&1 | tee -a "$LOG_FILE" \
    || die "npm install echoue"
ok "Dependances installes"

log "prisma generate ..."
npx prisma generate 2>&1 | tee -a "$LOG_FILE" \
    || die "prisma generate echoue"
ok "Client Prisma genere"

# ---- 8. Base de donnees ------------------------------------
step "8/8 -- Base de donnees"

# Creer l'utilisateur (idempotent)
if sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
    log "Utilisateur $DB_USER deja present, mise a jour du mot de passe..."
else
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>&1 | tee -a "$LOG_FILE" \
        || die "Creation de l'utilisateur DB echouee"
fi
sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>&1 | tee -a "$LOG_FILE"

# Recreer la base proprement (supprime l'ancienne si elle existe)
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}';" 2>/dev/null | tee -a "$LOG_FILE" || true
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>&1 | tee -a "$LOG_FILE"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>&1 | tee -a "$LOG_FILE" \
    || die "Creation de la base echouee"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>&1 | tee -a "$LOG_FILE"

# Restaurer le dump EN TANT QUE postgres (evite les erreurs de droits sur les owners)
log "Restauration du dump (peut prendre quelques secondes)..."
sudo -u postgres psql -d "${DB_NAME}" < "$DUMP_FILE" 2>&1 | tee -a "$LOG_FILE"
ok "Dump restaure"

# Donner les droits sur tous les objets du dump a l'utilisateur applicatif
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>&1 | tee -a "$LOG_FILE"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};" 2>&1 | tee -a "$LOG_FILE"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" 2>&1 | tee -a "$LOG_FILE"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};" 2>&1 | tee -a "$LOG_FILE"
sudo -u postgres psql -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};" 2>&1 | tee -a "$LOG_FILE"
sudo -u postgres psql -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};" 2>&1 | tee -a "$LOG_FILE"
ok "Permissions accordees a $DB_USER"

# Fichier .env
cat > "$APP_DIR/server/.env" << EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
PORT=3001
NODE_ENV=production
UPLOADS_PATH=/opt/helpdesk/uploads
APP_URL=${APP_URL}
COMPANY_NAME=${COMPANY_NAME}
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@helpdesk.local
EOF
ok ".env cree"

# ---- Nginx --------------------------------------------------
cp "$SCRIPT_DIR/app/nginx.conf" /etc/nginx/sites-available/helpdesk
ln -sf /etc/nginx/sites-available/helpdesk /etc/nginx/sites-enabled/helpdesk
rm -f /etc/nginx/sites-enabled/default
nginx -t 2>&1 | tee -a "$LOG_FILE" || die "Configuration Nginx invalide"
systemctl reload nginx
ok "Nginx configure (port $SERVER_PORT)"

# ---- PM2 ---------------------------------------------------
cd "$APP_DIR"
pm2 start ecosystem.config.js 2>&1 | tee -a "$LOG_FILE"
pm2 save 2>&1 | tee -a "$LOG_FILE"

# Autostart au boot
STARTUP_CMD=$(env PATH="$PATH:/usr/bin" pm2 startup systemd -u root --hp /root 2>&1 | grep "sudo env" || true)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD" 2>&1 | tee -a "$LOG_FILE" || warn "pm2 startup : echec non bloquant"
fi
pm2 save 2>&1 | tee -a "$LOG_FILE"
ok "PM2 configure (autostart au boot)"

# ---- Verification finale -----------------------------------
log "Verification demarrage de l'application (attente 8s)..."
sleep 8
if curl -sf http://127.0.0.1:3001/api/health &>/dev/null; then
    ok "API repond sur le port 3001"
else
    warn "L'API ne repond pas encore -- consultez : pm2 logs helpdesk-server"
fi

echo ""
echo "============================================================"
echo "   Installation terminee !"
echo ""
echo "   Application : http://${SERVER_IP}:${SERVER_PORT}"
echo ""
echo "   Comptes : ceux du dump restaure (mots de passe inchanges)"
echo ""
echo "   En cas de probleme : cat $LOG_FILE"
echo "   Etat PM2           : pm2 status"
echo "   Logs app           : pm2 logs helpdesk-server"
echo "============================================================"
echo ""
