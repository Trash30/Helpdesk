#Requires -RunAsAdministrator
# ================================================================
# setup.ps1 — Installateur principal HelpDesk Windows
# ================================================================
$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"   # accélère les downloads

# ── Chemins ───────────────────────────────────────────────────
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ConfFile    = Join-Path $ScriptDir "config\helpdesk.conf"

# ── Lire la configuration ────────────────────────────────────
function Read-Conf {
    param($File)
    $conf = @{}
    Get-Content $File | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $conf[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }
    return $conf
}
$Conf = Read-Conf $ConfFile

$InstallDir   = $Conf['INSTALL_DIR']  -replace '"', ''
$AppDir       = Join-Path $InstallDir "app"
$PgDataDir    = Join-Path $InstallDir "pgdata"
$NginxDir     = Join-Path $InstallDir "nginx"
$LogFile      = Join-Path $InstallDir "install.log"
$ServerPort   = $Conf['SERVER_PORT']
$NginxPort    = $Conf['NGINX_PORT']
$CompanyName  = $Conf['COMPANY_NAME']
$AppUrl       = $Conf['APP_URL']
$NodeVersion  = $Conf['NODE_VERSION']
$PgVersion    = $Conf['PG_VERSION']
$PgInstUrl    = $Conf['PG_INSTALLER_URL']

# ── Helpers ───────────────────────────────────────────────────
function Log {
    param([string]$Msg, [string]$Color = "White")
    $ts = (Get-Date).ToString("HH:mm:ss")
    Write-Host "  [$ts] $Msg" -ForegroundColor $Color
    Add-Content -Path $LogFile -Value "[$ts] $Msg" -Encoding UTF8
}
function Step  { param($n, $t) Write-Host "`n  ── $n/10 : $t ──" -ForegroundColor Cyan }
function Ok    { param($t) Write-Host "  ✓ $t" -ForegroundColor Green;  Add-Content $LogFile "  OK: $t" }
function Warn  { param($t) Write-Host "  ⚠ $t" -ForegroundColor Yellow; Add-Content $LogFile "  WARN: $t" }
function Fail  { param($t) Write-Host "`n  ✗ ERREUR: $t" -ForegroundColor Red; Add-Content $LogFile "ERR: $t"; exit 1 }

function Download-File {
    param($Url, $Dest)
    Log "Téléchargement : $Url"
    Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
}

# ── Création du dossier log ───────────────────────────────────
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType File      -Force -Path $LogFile    | Out-Null

# ── Bannière ──────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║                                                          ║" -ForegroundColor Cyan
Write-Host "  ║         HelpDesk — Installateur Windows                  ║" -ForegroundColor Cyan
Write-Host "  ║         Node.js $NodeVersion · PostgreSQL $PgVersion · Nginx          ║" -ForegroundColor Cyan
Write-Host "  ║                                                          ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Détecter installation existante ──────────────────────────
$IsRepair = $false
if (Test-Path (Join-Path $AppDir "server\.env")) {
    Write-Host "  Une installation existante a été détectée dans $InstallDir" -ForegroundColor Yellow
    $choice = Read-Host "  (R)éparer / (N)ouvelle installation / (A)nnuler ? [R]"
    switch ($choice.ToUpper()) {
        'N' { Log "Nouvelle installation — suppression de l'ancienne..." ; Remove-Item $AppDir -Recurse -Force -ErrorAction SilentlyContinue }
        'A' { exit 0 }
        default { $IsRepair = $true; Log "Mode réparation" }
    }
}

# ============================================================
# ÉTAPE 1 — Vérification des prérequis
# ============================================================
Step 1 "Vérification des prérequis"

# Windows 10/11
$OsVer = [System.Environment]::OSVersion.Version
if ($OsVer.Major -lt 10) { Fail "Windows 10 ou 11 requis (version détectée : $OsVer)" }
Ok "Système d'exploitation : Windows $($OsVer.Major).$($OsVer.Build)"

# Droits admin
$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$IsAdmin = ([Security.Principal.WindowsPrincipal]$CurrentUser).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) { Fail "Droits Administrateur requis" }
Ok "Droits administrateur : OK"

# Espace disque (2 GB)
$Drive = Split-Path -Qualifier $InstallDir
$Disk  = Get-PSDrive ($Drive -replace ':','') -ErrorAction SilentlyContinue
if ($Disk -and $Disk.Free -lt 2GB) { Fail "Espace disque insuffisant (min 2 GB sur $Drive)" }
Ok "Espace disque : OK"

# Mémoire (2 GB)
$RAM = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
if ($RAM -lt 2GB) { Warn "Mémoire faible ($([math]::Round($RAM/1GB,1)) GB) — minimum recommandé : 2 GB" }
else { Ok "Mémoire : $([math]::Round($RAM/1GB,1)) GB" }

# Connectivité
try {
    Invoke-WebRequest "https://registry.npmjs.org/" -UseBasicParsing -TimeoutSec 5 | Out-Null
    Ok "Connexion Internet : OK"
} catch { Fail "Pas d'accès Internet — vérifiez votre connexion" }

# ============================================================
# ÉTAPE 2 — Node.js 20 LTS
# ============================================================
Step 2 "Vérification / Installation de Node.js $NodeVersion"

$NodeExe = "C:\Program Files\nodejs\node.exe"
$NodeOk  = $false
if (Test-Path $NodeExe) {
    $NodeVer = & $NodeExe -e "process.stdout.write(process.versions.node)"
    if ($NodeVer -match "^$($NodeVersion -replace '\.','\.')") { $NodeOk = $true }
}

if (-not $NodeOk) {
    $NodeMsi = Join-Path $env:TEMP "node-v$NodeVersion-x64.msi"
    Download-File "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-x64.msi" $NodeMsi
    Log "Installation de Node.js (MSI silencieux)..."
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$NodeMsi`" /qn /norestart ADDLOCAL=ALL"
    Remove-Item $NodeMsi -Force -ErrorAction SilentlyContinue
    # Rafraîchir le PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Ok "Node.js $NodeVersion installé"
} else {
    Ok "Node.js $NodeVer déjà installé"
}

# Vérification finale
& node -e "console.log('node ok')" | Out-Null
& npm  -v | Out-Null
Ok "node / npm disponibles"

# ============================================================
# ÉTAPE 3 — PostgreSQL 15
# ============================================================
Step 3 "Vérification / Installation de PostgreSQL $PgVersion"

$PgBin  = "C:\Program Files\PostgreSQL\$PgVersion\bin"
$PsqlExe = Join-Path $PgBin "psql.exe"

if (-not (Test-Path $PsqlExe)) {
    $PgInstaller = Join-Path $env:TEMP "pg-installer.exe"
    Download-File $PgInstUrl $PgInstaller
    Log "Installation de PostgreSQL (silencieux) → $PgDataDir"
    New-Item -ItemType Directory -Force -Path $PgDataDir | Out-Null
    $PgPass = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
    Start-Process $PgInstaller -Wait -ArgumentList `
        "--unattendedmodeui none --mode unattended --superpassword `"$PgPass`" --datadir `"$PgDataDir`" --servicename postgresql-$PgVersion"
    Remove-Item $PgInstaller -Force -ErrorAction SilentlyContinue
    Ok "PostgreSQL $PgVersion installé"
    # Sauvegarder le mot de passe superuser temporairement
    $PgSuperPass = $PgPass
} else {
    Ok "PostgreSQL $PgVersion déjà installé"
    $PgSuperPass = $null
}

# Ajouter pg bin au PATH de session
if ($env:Path -notlike "*$PgBin*") { $env:Path += ";$PgBin" }

# Démarrer le service
$PgService = "postgresql-x64-$PgVersion"
if (-not (Get-Service $PgService -ErrorAction SilentlyContinue)) {
    $PgService = "postgresql-$PgVersion"
}
Set-Service -Name $PgService -StartupType Automatic -ErrorAction SilentlyContinue
Start-Service -Name $PgService -ErrorAction SilentlyContinue
Ok "Service PostgreSQL démarré"

# ============================================================
# ÉTAPE 4 — NSSM (gestionnaire de services)
# ============================================================
Step 4 "Téléchargement de NSSM"

$NssmDir = Join-Path $InstallDir "nssm"
$NssmExe = Join-Path $NssmDir "win64\nssm.exe"
if (-not (Test-Path $NssmExe)) {
    $NssmZip = Join-Path $env:TEMP "nssm.zip"
    Download-File "https://nssm.cc/release/nssm-2.24.zip" $NssmZip
    Expand-Archive $NssmZip -DestinationPath $NssmDir -Force
    # Retrouver le bon dossier extrait
    $NssmExe = Get-ChildItem -Path $NssmDir -Name "nssm.exe" -Recurse | Select-Object -First 1
    $NssmExe = Join-Path $NssmDir $NssmExe
    Remove-Item $NssmZip -Force -ErrorAction SilentlyContinue
    Ok "NSSM téléchargé"
} else {
    Ok "NSSM déjà présent"
}

# ============================================================
# ÉTAPE 5 — Création DB helpdesk_user / helpdesk_db
# ============================================================
Step 5 "Configuration de la base de données"

# Générer un mot de passe aléatoire pour helpdesk_user
$DbPass = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})

# Tenter de créer l'utilisateur et la DB
# On utilise psql via PGPASSWORD si disponible
if (-not $IsRepair) {
    Log "Création de helpdesk_user et helpdesk_db..."
    $env:PGPASSWORD = $PgSuperPass
    try {
        & "$PgBin\psql.exe" -U postgres -c "
            DO \$\$ BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='helpdesk_user') THEN
                CREATE USER helpdesk_user WITH PASSWORD '$DbPass';
              ELSE
                ALTER USER helpdesk_user WITH PASSWORD '$DbPass';
              END IF;
            END \$\$;" 2>&1 | Out-Null
        & "$PgBin\psql.exe" -U postgres -c "
            SELECT 'CREATE DATABASE helpdesk_db OWNER helpdesk_user'
            WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='helpdesk_db')" -t 2>&1 | `
            ForEach-Object { if ($_ -match "CREATE") {
                & "$PgBin\psql.exe" -U postgres -c "CREATE DATABASE helpdesk_db OWNER helpdesk_user;" | Out-Null
            }}
        & "$PgBin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE helpdesk_db TO helpdesk_user;" 2>&1 | Out-Null
        Ok "Base de données helpdesk_db créée"
    } catch {
        Warn "Impossible de créer la DB automatiquement — vous devrez peut-être le faire manuellement"
        Warn "  psql -U postgres -c `"CREATE USER helpdesk_user WITH PASSWORD '...';`""
        $DbPass = Read-Host "  Entrez le mot de passe que vous allez utiliser pour helpdesk_user"
    }
} else {
    # En mode réparation, relire le .env
    $EnvContent = Get-Content (Join-Path $AppDir "server\.env") -Raw
    if ($EnvContent -match "DATABASE_URL=postgresql://helpdesk_user:([^@]+)@") {
        $DbPass = $Matches[1]
        Ok "Mot de passe DB récupéré depuis .env existant"
    } else {
        $DbPass = Read-Host "  Entrez le mot de passe PostgreSQL pour helpdesk_user"
    }
}

# ============================================================
# ÉTAPE 6 — Copie de l'app + .env + npm ci + migrate + build
# ============================================================
Step 6 "Déploiement de l'application"

# Copier les sources (le dossier parent de installer/)
$SourceDir = Split-Path -Parent $ScriptDir
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "uploads\attachments") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "uploads\logo") | Out-Null

# Copier client/ et server/ (exclure installer/, node_modules, .git)
foreach ($SubDir in @("client", "server", "ecosystem.config.js", "package.json")) {
    $Src = Join-Path $SourceDir $SubDir
    if (Test-Path $Src) {
        $Dst = Join-Path $AppDir $SubDir
        if ((Get-Item $Src) -is [System.IO.DirectoryInfo]) {
            robocopy $Src $Dst /E /XD node_modules dist .git /NFL /NDL /NJH /NJS 2>&1 | Out-Null
        } else {
            Copy-Item $Src $Dst -Force
        }
    }
}
Ok "Sources copiées dans $AppDir"

# Générer JWT secret
$JwtSecret = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
if ($AppUrl -eq '') { $AppUrl = "http://localhost:$NginxPort" }
$SmtpFrom = if ($Conf['SMTP_FROM']) { $Conf['SMTP_FROM'] } else { "$CompanyName <noreply@helpdesk.local>" }

# Écrire .env
$EnvPath = Join-Path $AppDir "server\.env"
if (-not $IsRepair -or -not (Test-Path $EnvPath)) {
    @"
DATABASE_URL=postgresql://helpdesk_user:$DbPass@localhost:5432/helpdesk_db
JWT_SECRET=$JwtSecret
PORT=$ServerPort
NODE_ENV=production
UPLOADS_PATH=$AppDir\uploads
APP_URL=$AppUrl
SMTP_HOST=$($Conf['SMTP_HOST'])
SMTP_PORT=$($Conf['SMTP_PORT'])
SMTP_USER=$($Conf['SMTP_USER'])
SMTP_PASS=$($Conf['SMTP_PASS'])
SMTP_FROM=$SmtpFrom
"@ | Set-Content $EnvPath -Encoding UTF8
    Ok ".env créé"
}

# npm ci (server)
Log "npm ci (serveur)..."
Push-Location (Join-Path $AppDir "server")
& npm ci --omit=dev 2>&1 | Out-Null
Ok "Dépendances serveur installées"

# Prisma migrate + seed
Log "Migrations Prisma..."
& npx prisma migrate deploy 2>&1 | Out-Null
Ok "Migrations appliquées"
Log "Seed..."
& npx ts-node prisma/seed.ts 2>&1 | Out-Null | ForEach-Object { Log $_ }
Ok "Données initiales chargées"
Pop-Location

# npm ci + build (client)
Log "npm ci (client)..."
Push-Location (Join-Path $AppDir "client")
& npm ci 2>&1 | Out-Null
Log "Build frontend..."
& npm run build 2>&1 | Out-Null
Ok "Frontend compilé"
Pop-Location

# ============================================================
# ÉTAPE 7 — Service Windows HelpDesk-Server via NSSM
# ============================================================
Step 7 "Installation du service Windows (serveur Node.js)"

$ServiceName = "HelpDesk-Server"
$NodeExePath = (Get-Command node -ErrorAction SilentlyContinue)?.Source
if (-not $NodeExePath) { $NodeExePath = "C:\Program Files\nodejs\node.exe" }

# Supprimer l'ancien service si présent
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
    & $NssmExe stop   $ServiceName 2>&1 | Out-Null
    & $NssmExe remove $ServiceName confirm 2>&1 | Out-Null
}

& $NssmExe install $ServiceName $NodeExePath "dist\index.js"
& $NssmExe set $ServiceName AppDirectory (Join-Path $AppDir "server")
& $NssmExe set $ServiceName AppEnvironmentExtra `
    "NODE_ENV=production" `
    "PORT=$ServerPort"
& $NssmExe set $ServiceName Start SERVICE_AUTO_START
& $NssmExe set $ServiceName AppStdout (Join-Path $InstallDir "logs\server-out.log")
& $NssmExe set $ServiceName AppStderr (Join-Path $InstallDir "logs\server-err.log")
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "logs") | Out-Null

Start-Service $ServiceName
Ok "Service $ServiceName installé et démarré"

# ============================================================
# ÉTAPE 8 — Nginx Windows portable + service via NSSM
# ============================================================
Step 8 "Installation de Nginx (reverse proxy)"

$NginxSvcName = "HelpDesk-Nginx"
$NginxZipUrl  = "https://nginx.org/download/nginx-1.26.2.zip"
$NginxZip     = Join-Path $env:TEMP "nginx.zip"

if (-not (Test-Path (Join-Path $NginxDir "nginx.exe"))) {
    Download-File $NginxZipUrl $NginxZip
    Expand-Archive $NginxZip -DestinationPath $env:TEMP -Force
    $ExtractedDir = Get-ChildItem $env:TEMP -Filter "nginx-*" -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Move-Item $ExtractedDir.FullName $NginxDir -Force
    Remove-Item $NginxZip -Force -ErrorAction SilentlyContinue
    Ok "Nginx extrait dans $NginxDir"
} else {
    Ok "Nginx déjà présent"
}

# Écrire nginx.conf
$ClientDist = Join-Path $AppDir "client\dist"
$UploadPath  = Join-Path $AppDir "uploads"
# Nginx sur Windows utilise des forward slashes
$ClientDistFwd = $ClientDist -replace '\\', '/'
$UploadPathFwd  = $UploadPath  -replace '\\', '/'

@"
worker_processes 1;
events { worker_connections 1024; }
http {
    include      mime.types;
    default_type application/octet-stream;
    sendfile     on;
    client_max_body_size 15M;

    server {
        listen $NginxPort;
        server_name localhost;

        location /api/ {
            proxy_pass         http://127.0.0.1:$ServerPort;
            proxy_http_version 1.1;
            proxy_set_header   Host \$host;
            proxy_set_header   X-Real-IP \$remote_addr;
            proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_read_timeout 60s;
        }

        location /uploads/ {
            alias $UploadPathFwd/;
        }

        location / {
            root      $ClientDistFwd;
            try_files \$uri \$uri/ /index.html;
        }
    }
}
"@ | Set-Content (Join-Path $NginxDir "conf\nginx.conf") -Encoding UTF8

# Supprimer ancien service Nginx si présent
if (Get-Service $NginxSvcName -ErrorAction SilentlyContinue) {
    & $NssmExe stop   $NginxSvcName 2>&1 | Out-Null
    & $NssmExe remove $NginxSvcName confirm 2>&1 | Out-Null
}
$NginxExe = Join-Path $NginxDir "nginx.exe"
& $NssmExe install $NginxSvcName $NginxExe
& $NssmExe set $NginxSvcName AppDirectory $NginxDir
& $NssmExe set $NginxSvcName Start SERVICE_AUTO_START
Start-Service $NginxSvcName
Ok "Service Nginx installé et démarré"

# ============================================================
# ÉTAPE 9 — Raccourci bureau + menu Démarrer
# ============================================================
Step 9 "Création des raccourcis"

$WshShell = New-Object -ComObject WScript.Shell

# Raccourci bureau → ouvrir le navigateur
$DesktopShortcut = Join-Path ([System.Environment]::GetFolderPath("Desktop")) "HelpDesk.lnk"
$Sc = $WshShell.CreateShortcut($DesktopShortcut)
$Sc.TargetPath      = "http://localhost:$NginxPort"
$Sc.Description     = "Ouvrir HelpDesk"
$Sc.Save()
Ok "Raccourci bureau créé"

# Dossier Start Menu
$StartMenu = Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\HelpDesk"
New-Item -ItemType Directory -Force -Path $StartMenu | Out-Null

$ScApp = $WshShell.CreateShortcut((Join-Path $StartMenu "HelpDesk.lnk"))
$ScApp.TargetPath  = "http://localhost:$NginxPort"
$ScApp.Description = "Ouvrir HelpDesk"
$ScApp.Save()

# Raccourci stop/start
$ScStart = $WshShell.CreateShortcut((Join-Path $StartMenu "Démarrer HelpDesk.lnk"))
$ScStart.TargetPath  = Join-Path $ScriptDir "start.bat"
$ScStart.Save()

$ScStop = $WshShell.CreateShortcut((Join-Path $StartMenu "Arrêter HelpDesk.lnk"))
$ScStop.TargetPath  = Join-Path $ScriptDir "stop.bat"
$ScStop.Save()

Ok "Menu Démarrer configuré"

# ============================================================
# ÉTAPE 10 — Résumé final
# ============================================================
Step 10 "Résumé de l'installation"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║       Installation terminée avec succès !                ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  URL de l'application : " -NoNewline
Write-Host "http://localhost:$NginxPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Identifiants par défaut :" -ForegroundColor Yellow
Write-Host "    Admin  : admin@helpdesk.com  / admin123" -ForegroundColor White
Write-Host "    Agent  : agent1@helpdesk.com / agent123" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT : changez ces mots de passe immédiatement !" -ForegroundColor Red
Write-Host ""
Write-Host "  Log d'installation : $LogFile"
Write-Host ""

$open = Read-Host "  Ouvrir l'application dans le navigateur ? (O/n)"
if ($open -notmatch '^[Nn]') {
    Start-Process "http://localhost:$NginxPort"
}
