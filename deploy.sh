#!/usr/bin/env bash
##############################################################
# deploy.sh — Mise à jour idempotente du Helpdesk (Linux)
# Usage : cd /opt/helpdesk && bash deploy.sh
##############################################################
set -euo pipefail

APP_DIR="/opt/helpdesk"
LOG_FILE="$APP_DIR/logs/deploy.log"

# Couleurs
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}✓${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}⚠${NC} $*" | tee -a "$LOG_FILE"; }
die()  { echo -e "${RED}✗ ERREUR : $*${NC}" | tee -a "$LOG_FILE"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     HelpDesk — Mise à jour           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

mkdir -p "$APP_DIR/logs"

# ── Charger nvm ───────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
command -v node &>/dev/null || die "Node.js introuvable. Relancer install.sh"

log "Version Node.js : $(node -v)"

# ── 1. Pull du code ───────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
    log "Récupération des dernières modifications (git pull)..."
    git -C "$APP_DIR" pull --ff-only 2>&1 | tee -a "$LOG_FILE"
    ok "Code mis à jour"
else
    warn "Pas de dépôt git — copie manuelle du code requise avant de continuer"
fi

# ── 2. Dépendances serveur ────────────────────────────────────
log "Installation des dépendances serveur..."
npm ci --prefix "$APP_DIR/server" --omit=dev 2>&1 | tee -a "$LOG_FILE"
ok "Dépendances serveur installées"

# ── 3. Migrations Prisma ──────────────────────────────────────
log "Application des migrations Prisma..."
cd "$APP_DIR/server"
npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"
ok "Migrations appliquées"

# ── 4. Dépendances client + build ────────────────────────────
log "Installation des dépendances client..."
npm ci --prefix "$APP_DIR/client" 2>&1 | tee -a "$LOG_FILE"
ok "Dépendances client installées"

log "Build du frontend..."
npm run build --prefix "$APP_DIR/client" 2>&1 | tee -a "$LOG_FILE"
ok "Frontend compilé"

# ── 5. Redémarrage PM2 ───────────────────────────────────────
log "Redémarrage du serveur Node.js (PM2)..."
pm2 restart helpdesk-server --update-env 2>&1 | tee -a "$LOG_FILE"
pm2 save 2>&1 | tee -a "$LOG_FILE"
ok "Serveur redémarré"

# ── 6. Rechargement Nginx ─────────────────────────────────────
log "Vérification de la configuration Nginx..."
nginx -t 2>&1 | tee -a "$LOG_FILE" && sudo nginx -s reload
ok "Nginx rechargé"

echo ""
echo -e "${GREEN}${BOLD}✓ Mise à jour terminée avec succès !${NC}"
echo -e "  Statut PM2 : ${BLUE}pm2 status${NC}"
echo -e "  Logs       : ${BLUE}pm2 logs helpdesk-server${NC}"
echo ""
