###############################################################
# sync-to-server.ps1
# Pousse les modifications DEV vers le serveur Ubuntu
# Usage :
#   .\sync-to-server.ps1                  (build + sync app)
#   .\sync-to-server.ps1 -WithDb          (+ dump et restaure la DB)
#   .\sync-to-server.ps1 -RestartOnly     (juste pm2 restart)
#   .\sync-to-server.ps1 -MigrateOnly     (juste migrations Prisma)
###############################################################
#Requires -Version 5.1
param(
    [switch]$WithDb,
    [switch]$RestartOnly,
    [switch]$MigrateOnly,
    [string]$DbPassDev = "postgres",   # mot de passe DB dev local — surcharger si besoin : -DbPassDev "monmdp"
    [string]$DbUserDev = "postgres"    # utilisateur DB dev local
)
$ErrorActionPreference = "Stop"

# -- Config --------------------------------------------------
$SERVER_IP    = "192.168.102.152"
$SERVER_PORT  = "5173"
$SERVER_USER  = "root"
$APP_DIR      = "/opt/helpdesk"

$DB_HOST      = "localhost"
$DB_PORT      = "5432"
$DB_NAME_DEV  = "helpdesk_dev"
$DB_USER_DEV  = $DbUserDev
$DB_PASS_DEV  = $DbPassDev
$DB_NAME_PROD = "helpdesk_prod"
$DB_USER_PROD = "helpdesk_user"
# ------------------------------------------------------------

$PROJECT_ROOT = $PSScriptRoot
$TMP_DIR      = "$env:TEMP\helpdesk-sync"

function Write-Step { param($msg) Write-Host "`n-- $msg --" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "`n[ERREUR] $msg`n" -ForegroundColor Red; exit 1 }

function Invoke-Ssh {
    param($cmd)
    ssh "${SERVER_USER}@${SERVER_IP}" $cmd
    if ($LASTEXITCODE -ne 0) { Write-Err "Commande SSH echouee : $cmd" }
}

function Find-PgDump {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    @(
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

Clear-Host
Write-Host ""
Write-Host "  HelpDesk -- Sync DEV vers Serveur local" -ForegroundColor Cyan
Write-Host "  Serveur : ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Cyan
Write-Host "  App     : $APP_DIR" -ForegroundColor Cyan
Write-Host ""

# -- Verification SSH ----------------------------------------
Write-Step "Verification de la connexion SSH"
if (!(Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Err "ssh introuvable. Activez OpenSSH dans Parametres > Applications."
}
ssh -o ConnectTimeout=5 -o BatchMode=yes "${SERVER_USER}@${SERVER_IP}" "echo ok" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Pas de cle SSH -- saisie du mot de passe requise"
    Write-Host "  (Conseil : ssh-copy-id ${SERVER_USER}@${SERVER_IP} pour eviter ca)" -ForegroundColor Gray
}
Write-Ok "Connexion SSH : $SERVER_USER@$SERVER_IP"

# -- Mode : Restart seulement --------------------------------
if ($RestartOnly) {
    Write-Step "Redemarrage PM2"
    Invoke-Ssh "sudo pm2 restart helpdesk-server"
    Invoke-Ssh "sudo pm2 status"
    Write-Ok "App redemarree"
    exit 0
}

# -- Mode : Migrations seulement -----------------------------
if ($MigrateOnly) {
    Write-Step "Migrations Prisma (ajout des nouvelles tables uniquement)"
    Invoke-Ssh "cd $APP_DIR/server ; npx prisma migrate deploy"
    Write-Ok "Migrations appliquees"
    Invoke-Ssh "sudo pm2 restart helpdesk-server"
    Write-Ok "App redemarree"
    exit 0
}

# -- 1. Build serveur ----------------------------------------
Write-Step "1 -- Build serveur TypeScript"
Push-Location "$PROJECT_ROOT\server"
try {
    $ErrorActionPreference = "Continue"
    npm run build 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    if ($LASTEXITCODE -ne 0 -or !(Test-Path "dist\src\index.js")) {
        Write-Err "Build serveur echoue"
    }
    Write-Ok "dist/ compile"
} finally {
    $ErrorActionPreference = "Stop"
    Pop-Location
}

# -- 2. Build client -----------------------------------------
Write-Step "2 -- Build client React"
Push-Location "$PROJECT_ROOT\client"
try {
    $ErrorActionPreference = "Continue"
    npm run build 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    if ($LASTEXITCODE -ne 0 -or !(Test-Path "dist\index.html")) {
        Write-Err "Build client echoue"
    }
    Write-Ok "dist/ compile"
} finally {
    $ErrorActionPreference = "Stop"
    Pop-Location
}

# -- 3. Transfert SCP ----------------------------------------
Write-Step "3 -- Transfert vers le serveur"

Invoke-Ssh "mkdir -p $APP_DIR/client/dist $APP_DIR/server/dist $APP_DIR/server/prisma"

Write-Host "  Envoi client/dist..." -ForegroundColor Gray
scp -r "$PROJECT_ROOT\client\dist\*" "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/client/dist/"
if ($LASTEXITCODE -ne 0) { Write-Err "scp client echoue" }
Write-Ok "client/dist transfere"

Write-Host "  Envoi server/dist..." -ForegroundColor Gray
scp -r "$PROJECT_ROOT\server\dist\*" "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/server/dist/"
if ($LASTEXITCODE -ne 0) { Write-Err "scp server dist echoue" }
Write-Ok "server/dist transfere"

Write-Host "  Envoi server/prisma..." -ForegroundColor Gray
scp -r "$PROJECT_ROOT\server\prisma\*" "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/server/prisma/"
if ($LASTEXITCODE -ne 0) { Write-Err "scp prisma echoue" }
Write-Ok "server/prisma transfere"

scp "$PROJECT_ROOT\server\package.json"      "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/server/"
scp "$PROJECT_ROOT\server\package-lock.json" "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/server/"
Write-Ok "manifestes npm transferes"

# -- 4. Deps + Migrations ------------------------------------
Write-Step "4 -- Mise a jour sur le serveur"
Invoke-Ssh "cd $APP_DIR/server ; npm ci --omit=dev --silent ; npx prisma generate --silent ; npx prisma migrate deploy"
Write-Ok "Dependances et migrations a jour"

# -- 5. DB optionnelle ---------------------------------------
if ($WithDb) {
    Write-Step "5 -- Synchronisation base de donnees"
    $pgDump = Find-PgDump
    if (!$pgDump) { Write-Err "pg_dump introuvable" }

    New-Item -ItemType Directory -Force -Path $TMP_DIR | Out-Null
    $dumpFile = "$TMP_DIR\sync_dump.sql"

    Write-Host "  Dump de '$DB_NAME_DEV'..." -ForegroundColor Gray
    $env:PGPASSWORD = $DB_PASS_DEV
    & $pgDump --host=$DB_HOST --port=$DB_PORT --username=$DB_USER_DEV `
        --format=plain --no-owner --no-acl --file="$dumpFile" $DB_NAME_DEV
    if ($LASTEXITCODE -ne 0) { Write-Err "pg_dump echoue" }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

    $dumpSize = [Math]::Round((Get-Item $dumpFile).Length / 1KB, 1)
    Write-Ok "Dump : $dumpSize KB"

    scp "$dumpFile" "${SERVER_USER}@${SERVER_IP}:/tmp/helpdesk_sync.sql"
    if ($LASTEXITCODE -ne 0) { Write-Err "scp dump echoue" }
    Write-Ok "Dump transfere"

    Invoke-Ssh "pm2 stop helpdesk-server"
    Invoke-Ssh "sudo -u postgres psql -c 'DROP DATABASE IF EXISTS $DB_NAME_PROD'"
    Invoke-Ssh "sudo -u postgres psql -c 'CREATE DATABASE $DB_NAME_PROD OWNER $DB_USER_PROD'"
    Invoke-Ssh "PGPASSWORD=`$(grep DATABASE_URL $APP_DIR/server/.env | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|') psql --host=localhost --username=$DB_USER_PROD --dbname=$DB_NAME_PROD < /tmp/helpdesk_sync.sql"
    Invoke-Ssh "rm -f /tmp/helpdesk_sync.sql"
    Write-Ok "Base de donnees restauree"

    Remove-Item -Force $dumpFile -ErrorAction SilentlyContinue
}

# -- 6. Redemarrage ------------------------------------------
Write-Step "Redemarrage"
Invoke-Ssh "sudo pm2 restart helpdesk-server"
Invoke-Ssh "sudo pm2 status"
Write-Ok "Application redemarree"

Write-Host ""
Write-Host "  Synchronisation terminee !" -ForegroundColor Green
Write-Host "  http://${SERVER_IP}:${SERVER_PORT}" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Commandes utiles :" -ForegroundColor Gray
Write-Host "    Restart seul      : .\sync-to-server.ps1 -RestartOnly"
Write-Host "    App + DB          : .\sync-to-server.ps1 -WithDb"
Write-Host "    Migrations seules : .\sync-to-server.ps1 -MigrateOnly"
Write-Host ""
