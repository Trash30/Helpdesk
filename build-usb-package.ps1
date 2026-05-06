##############################################################
# build-usb-package.ps1
# Genere un package USB autonome pour deployer HelpDesk
# sur Ubuntu 22.04.
#
# Usage (depuis la racine du projet) :
#   .\build-usb-package.ps1
#
# Prerequis Windows :
#   - Node.js 20+  (node, npm dans PATH)
#   - PostgreSQL   (pg_dump dans PATH ou C:\Program Files\PostgreSQL\)
##############################################################
#Requires -Version 5.1
$ErrorActionPreference = "Stop"

# -- Config -------------------------------------------------
$PROJECT_ROOT = $PSScriptRoot
$OUTPUT_DIR   = "$PROJECT_ROOT\helpdesk-usb"
$ZIP_PATH     = "$PROJECT_ROOT\helpdesk-usb.zip"

# Base de donnees DEV locale
$DB_HOST     = "localhost"
$DB_PORT     = "5432"
$DB_NAME_DEV = "helpdesk_dev"
$DB_USER_DEV = "postgres"
$DB_PASS_DEV = "postgres"

# Serveur cible Ubuntu
$SERVER_IP   = "192.168.102.152"
$SERVER_PORT = "5173"

# Valeurs production generees
$DB_NAME_PROD = "helpdesk_prod"
$DB_USER_PROD = "hduser"
# -----------------------------------------------------------

function Write-Step { param($msg) Write-Host "`n-- $msg --" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "`n[ERREUR] $msg`n" -ForegroundColor Red; exit 1 }

function Find-PgDump {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

function New-RandomSecret {
    # Alphanumerique uniquement -- pas de +/=/  qui cassent bash et psql
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $rng   = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 48
    $rng.GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

# -- Banniere -----------------------------------------------
Clear-Host
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "     HelpDesk -- Createur de package USB" -ForegroundColor Cyan
Write-Host "     Machine DEV Windows -> Serveur Ubuntu" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Projet  : $PROJECT_ROOT"
Write-Host "  Package : $OUTPUT_DIR"
Write-Host "  Serveur : $SERVER_IP`:$SERVER_PORT"
Write-Host ""

$confirm = Read-Host "Continuer ? (O/n)"
if ($confirm -match "^[Nn]") { exit 0 }

# -- 1. Verifications ---------------------------------------
Write-Step "1/6 -- Verification des prerequis"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "node introuvable dans PATH - installez Node.js 20+"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Fail "npm introuvable dans PATH"
}
Write-Ok "Node.js $(node -v), npm $(npm -v)"

$pgDump = Find-PgDump
if (-not $pgDump) {
    Write-Fail "pg_dump introuvable. Installez PostgreSQL ou ajoutez son bin dans PATH."
}
Write-Ok "pg_dump : $pgDump"

if (-not (Test-Path "$PROJECT_ROOT\server\package.json")) {
    Write-Fail "Lancez ce script depuis la racine du projet HelpDesk."
}
if (-not (Test-Path "$PROJECT_ROOT\install-template.sh")) {
    Write-Fail "install-template.sh introuvable dans $PROJECT_ROOT"
}
Write-Ok "Racine du projet OK"

# -- 2. Build serveur (TypeScript) --------------------------
Write-Step "2/6 -- Build serveur (TypeScript)"
Push-Location "$PROJECT_ROOT\server"
try {
    Write-Host "  npm install..." -ForegroundColor Gray
    $ErrorActionPreference = "Continue"
    npm install 2>&1 | Out-Null
    Write-Host "  tsc..." -ForegroundColor Gray
    npm run build 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path "dist\src\index.js")) {
        Write-Fail "Build TypeScript echoue - dist\src\index.js introuvable."
    }
    Write-Ok "dist/ genere"
} finally {
    $ErrorActionPreference = "Stop"
    Pop-Location
}

# -- 3. Build client (React) --------------------------------
Write-Step "3/6 -- Build client (React)"
Push-Location "$PROJECT_ROOT\client"
try {
    Write-Host "  npm install..." -ForegroundColor Gray
    $ErrorActionPreference = "Continue"
    npm install 2>&1 | Out-Null
    Write-Host "  vite build..." -ForegroundColor Gray
    npm run build 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path "dist\index.html")) {
        Write-Fail "Build Vite echoue - dist\index.html introuvable."
    }
    Write-Ok "dist/ genere"
} finally {
    $ErrorActionPreference = "Stop"
    Pop-Location
}

# -- 4. Dump de la base de donnees DEV ----------------------
Write-Step "4/6 -- Export de la base de donnees DEV"

New-Item -ItemType Directory -Force -Path "$OUTPUT_DIR\db" | Out-Null

$dumpFile = "$OUTPUT_DIR\db\helpdesk_dev.sql"
Write-Host "  Dump de '$DB_NAME_DEV' en cours..." -ForegroundColor Gray

$env:PGPASSWORD = $DB_PASS_DEV
& $pgDump `
    "--host=$DB_HOST" `
    "--port=$DB_PORT" `
    "--username=$DB_USER_DEV" `
    "--format=plain" `
    "--no-owner" `
    "--no-acl" `
    "--file=$dumpFile" `
    $DB_NAME_DEV

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dumpFile)) {
    Write-Fail "pg_dump a echoue. Verifiez que PostgreSQL est demarre et que la DB '$DB_NAME_DEV' existe."
}
$dumpSizeKB = [Math]::Round((Get-Item $dumpFile).Length / 1KB, 1)
Write-Ok "Dump : $dumpFile ($dumpSizeKB KB)"
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

# -- 5. Construction du package USB -------------------------
Write-Step "5/6 -- Construction du package"

if (Test-Path $OUTPUT_DIR) {
    Remove-Item -Recurse -Force $OUTPUT_DIR
    Write-Warn "Ancien package supprime"
}

$dirs = @(
    "$OUTPUT_DIR\app\client\dist",
    "$OUTPUT_DIR\app\server\dist",
    "$OUTPUT_DIR\app\server\prisma",
    "$OUTPUT_DIR\db"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

Write-Host "  Copie client/dist..." -ForegroundColor Gray
Copy-Item -Recurse -Force "$PROJECT_ROOT\client\dist\*" "$OUTPUT_DIR\app\client\dist\"

Write-Host "  Copie server/dist..." -ForegroundColor Gray
Copy-Item -Recurse -Force "$PROJECT_ROOT\server\dist\*" "$OUTPUT_DIR\app\server\dist\"

Write-Host "  Copie server/prisma..." -ForegroundColor Gray
Copy-Item -Recurse -Force "$PROJECT_ROOT\server\prisma\*" "$OUTPUT_DIR\app\server\prisma\"

Copy-Item "$PROJECT_ROOT\server\package.json"      "$OUTPUT_DIR\app\server\package.json"
Copy-Item "$PROJECT_ROOT\server\package-lock.json" "$OUTPUT_DIR\app\server\package-lock.json"
Copy-Item "$PROJECT_ROOT\ecosystem.config.js"      "$OUTPUT_DIR\app\ecosystem.config.js"

# nginx.conf - configurer le port et l'IP
$nginxContent = Get-Content "$PROJECT_ROOT\nginx.conf" -Raw
$nginxContent = $nginxContent -replace "listen\s+80;",         "listen $SERVER_PORT;"
$nginxContent = $nginxContent -replace "server_name\s+[^;]+;", "server_name $SERVER_IP _;"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$OUTPUT_DIR\app\nginx.conf", $nginxContent, $utf8NoBom)

Write-Ok "Fichiers de l'application copies"

# -- Generer les secrets de production ----------------------
$JWT_SECRET   = New-RandomSecret
$DB_PASS_PROD = New-RandomSecret
Write-Ok "Secrets de production generes"

# -- 6. Generer install.sh depuis le template ---------------
Write-Step "6/6 -- Generation de install.sh"

$template = [System.IO.File]::ReadAllText("$PROJECT_ROOT\install-template.sh")

$template = $template -replace '\{\{SERVER_IP\}\}',   $SERVER_IP
$template = $template -replace '\{\{SERVER_PORT\}\}', $SERVER_PORT
$template = $template -replace '\{\{DB_NAME\}\}',     $DB_NAME_PROD
$template = $template -replace '\{\{DB_USER\}\}',     $DB_USER_PROD
$template = $template -replace '\{\{DB_PASS\}\}',     $DB_PASS_PROD
$template = $template -replace '\{\{JWT_SECRET\}\}',  $JWT_SECRET

# Forcer les fins de ligne Unix (LF)
$template = $template -replace "`r`n", "`n"
$template = $template -replace "`r",   "`n"

$installShPath = "$OUTPUT_DIR\install.sh"
[System.IO.File]::WriteAllText($installShPath, $template, $utf8NoBom)

Write-Ok "install.sh genere (LF Unix)"

# -- Creer le ZIP -------------------------------------------
Write-Host "  Creation du ZIP..." -ForegroundColor Gray
if (Test-Path $ZIP_PATH) { Remove-Item -Force $ZIP_PATH }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($OUTPUT_DIR, $ZIP_PATH)
$zipSizeMB = [Math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 1)

$totalSizeMB = [Math]::Round(
    (Get-ChildItem -Recurse $OUTPUT_DIR | Measure-Object -Property Length -Sum).Sum / 1MB, 1
)

# -- Resume -------------------------------------------------
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "   Package USB cree avec succes !" -ForegroundColor Green
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Dossier : $OUTPUT_DIR ($totalSizeMB MB)"
Write-Host "  Archive : $ZIP_PATH ($zipSizeMB MB)"
Write-Host ""
Write-Host "  Copier le dossier 'helpdesk-usb\' sur la cle USB" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Sur le serveur Ubuntu (cle USB branchee) :" -ForegroundColor Cyan
Write-Host "    sudo bash install.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "  L'app sera accessible sur : http://$SERVER_IP`:$SERVER_PORT" -ForegroundColor Green
Write-Host ""
