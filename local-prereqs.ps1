#Requires -RunAsAdministrator
# ================================================================
# local-prereqs.ps1 — Installation silencieuse des prerequis
# Node.js 20 LTS + PostgreSQL 15
# ================================================================
$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

$NODE_VERSION = "20.14.0"
$PG_VERSION   = "15"
$PG_INST_URL  = "https://get.enterprisedb.com/postgresql/postgresql-15.7-1-windows-x64.exe"

# ── Helpers ───────────────────────────────────────────────────────
function Write-Step { param($n, $t) Write-Host "`n  ── $n : $t" -ForegroundColor Cyan }
function Write-Ok   { param($t)     Write-Host "  [OK] $t"     -ForegroundColor Green }
function Write-Info { param($t)     Write-Host "  [INFO] $t"   -ForegroundColor Yellow }
function Write-Fail { param($t)     Write-Host "`n  [ERREUR] $t" -ForegroundColor Red; Read-Host "`n  Appuyez sur Entree pour fermer"; exit 1 }

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Download-File {
    param($Url, $Dest, $Label)
    Write-Host "  Telechargement de $Label..." -NoNewline
    try {
        Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
        Write-Host " OK" -ForegroundColor Green
    } catch {
        Write-Host " ECHEC" -ForegroundColor Red
        Write-Fail "Impossible de telecharger $Label : $($_.Exception.Message)"
    }
}

# ── Bannière ─────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║    HelpDesk — Installation des prerequis locaux          ║" -ForegroundColor Cyan
Write-Host "  ║    Node.js $NODE_VERSION  +  PostgreSQL $PG_VERSION                    ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Verifier connectivite Internet ───────────────────────────────
Write-Host "  Verification de la connexion Internet..." -NoNewline
try {
    Invoke-WebRequest "https://nodejs.org" -UseBasicParsing -TimeoutSec 8 | Out-Null
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-Host " ECHEC" -ForegroundColor Red
    Write-Fail "Pas d'acces Internet. Verifiez votre connexion et reessayez."
}

# ================================================================
# ETAPE 1 — Node.js 20 LTS
# ================================================================
Write-Step "1/2" "Node.js $NODE_VERSION LTS"

$NodeExe    = "C:\Program Files\nodejs\node.exe"
$NodeNeeded = $true

if (Test-Path $NodeExe) {
    try {
        $CurrentVer = & $NodeExe -e "process.stdout.write(process.versions.node)" 2>&1
        $Major = [int]($CurrentVer -split '\.')[0]
        if ($Major -ge 20) {
            Write-Ok "Node.js $CurrentVer deja installe (>= 20) — ignoré"
            $NodeNeeded = $false
        } else {
            Write-Info "Node.js $CurrentVer detecte — mise a jour vers $NODE_VERSION..."
        }
    } catch {
        Write-Info "Node.js detecte mais version illisible — reinstallation..."
    }
} else {
    # Chercher aussi dans le PATH
    $NodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($NodeCmd) {
        try {
            $CurrentVer = & node -e "process.stdout.write(process.versions.node)" 2>&1
            $Major = [int]($CurrentVer -split '\.')[0]
            if ($Major -ge 20) {
                Write-Ok "Node.js $CurrentVer deja disponible dans le PATH (>= 20) — ignoré"
                $NodeNeeded = $false
            }
        } catch {}
    }
}

if ($NodeNeeded) {
    $NodeMsi  = Join-Path $env:TEMP "node-v$NODE_VERSION-x64.msi"
    $NodeUrl  = "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-x64.msi"
    Download-File $NodeUrl $NodeMsi "Node.js $NODE_VERSION"

    Write-Host "  Installation de Node.js (cela peut prendre 1-2 minutes)..." -NoNewline
    $proc = Start-Process msiexec.exe -Wait -PassThru -ArgumentList `
        "/i `"$NodeMsi`" /qn /norestart ADDLOCAL=ALL"
    if ($proc.ExitCode -notin @(0, 3010)) {
        Write-Host " ECHEC (code $($proc.ExitCode))" -ForegroundColor Red
        Write-Fail "L'installation de Node.js a echoue (code $($proc.ExitCode))"
    }
    Write-Host " OK" -ForegroundColor Green
    Remove-Item $NodeMsi -Force -ErrorAction SilentlyContinue

    Refresh-Path
    try {
        $InstalledVer = & "C:\Program Files\nodejs\node.exe" -e "process.stdout.write(process.versions.node)" 2>&1
        Write-Ok "Node.js $InstalledVer installe"
    } catch {
        Write-Fail "Node.js installe mais introuvable — redemarrez votre session et reessayez"
    }
}

# ================================================================
# ETAPE 2 — PostgreSQL 15
# ================================================================
Write-Step "2/2" "PostgreSQL $PG_VERSION"

$PgBins = @(
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\17\bin"
)
$PgBinFound = $null
foreach ($d in $PgBins) {
    if (Test-Path (Join-Path $d "psql.exe")) {
        $PgBinFound = $d
        break
    }
}

$PgNeeded  = $true
$PgSavedPassword = $null

if ($PgBinFound) {
    try {
        $PgVer = & "$PgBinFound\psql.exe" --version 2>&1
        Write-Ok "PostgreSQL detecte : $PgVer — ignoré"
        $PgNeeded = $false
        # Ajouter au PATH de session si absent
        if ($env:Path -notlike "*$PgBinFound*") { $env:Path += ";$PgBinFound" }
    } catch {
        Write-Info "PostgreSQL detecte mais psql inaccessible — continuation..."
    }
}

if ($PgNeeded) {
    # Generer un mot de passe superuser
    $PgSavedPassword = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})

    $PgInst = Join-Path $env:TEMP "pg15-installer.exe"
    Download-File $PG_INST_URL $PgInst "PostgreSQL $PG_VERSION"

    Write-Host "  Installation de PostgreSQL (cela peut prendre 3-5 minutes)..." -NoNewline
    $proc = Start-Process $PgInst -Wait -PassThru -ArgumentList (
        "--unattendedmodeui none",
        "--mode unattended",
        "--superpassword `"$PgSavedPassword`"",
        "--servicename `"postgresql-x64-$PG_VERSION`"",
        "--serviceaccount `"NT AUTHORITY\NetworkService`""
    )
    # EnterpriseDB renvoie 0 ou parfois 1 en cas de warning non-bloquant
    if ($proc.ExitCode -notin @(0, 1)) {
        Write-Host " ECHEC (code $($proc.ExitCode))" -ForegroundColor Red
        Write-Fail "L'installation de PostgreSQL a echoue (code $($proc.ExitCode))"
    }
    Write-Host " OK" -ForegroundColor Green
    Remove-Item $PgInst -Force -ErrorAction SilentlyContinue

    # Demarrer le service
    $SvcName = "postgresql-x64-$PG_VERSION"
    $svc = Get-Service $SvcName -ErrorAction SilentlyContinue
    if ($svc) {
        Set-Service $SvcName -StartupType Automatic
        if ($svc.Status -ne "Running") { Start-Service $SvcName -ErrorAction SilentlyContinue }
        Write-Ok "Service PostgreSQL demarre"
    } else {
        Write-Info "Service PostgreSQL non detecte apres installation — verifiez manuellement"
    }

    # Ajouter au PATH permanent
    $PgBinInstalled = "C:\Program Files\PostgreSQL\$PG_VERSION\bin"
    $MachinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($MachinePath -notlike "*$PgBinInstalled*") {
        [System.Environment]::SetEnvironmentVariable(
            "Path",
            "$MachinePath;$PgBinInstalled",
            "Machine"
        )
        Write-Ok "PostgreSQL ajoute au PATH systeme"
    }
    $env:Path += ";$PgBinInstalled"

    # Sauvegarder le mot de passe postgres dans un fichier
    $PgPassFile = Join-Path $PSScriptRoot "local-pg-password.txt"
    @"
Mot de passe du superuser PostgreSQL (compte 'postgres') :

  $PgSavedPassword

Conservez ce mot de passe — il vous sera demande dans local-setup.bat.
Ce fichier peut etre supprime apres avoir note le mot de passe.
"@ | Set-Content $PgPassFile -Encoding UTF8
    Write-Ok "Mot de passe PostgreSQL sauvegarde dans local-pg-password.txt"
}

# ================================================================
# RESUME
# ================================================================
Refresh-Path

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║             Prerequis installes avec succes !            ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Afficher les versions installees
try {
    $nv = & node -v 2>&1; Write-Host "  Node.js : $nv" -ForegroundColor White
} catch { Write-Host "  Node.js : installe (redemarrer le terminal pour voir la version)" -ForegroundColor White }
try {
    $pv = & psql --version 2>&1; Write-Host "  psql    : $pv" -ForegroundColor White
} catch { Write-Host "  psql    : installe (redemarrer le terminal pour voir la version)" -ForegroundColor White }

if ($PgSavedPassword) {
    Write-Host ""
    Write-Host "  Mot de passe PostgreSQL (superuser 'postgres') :" -ForegroundColor Yellow
    Write-Host "    $PgSavedPassword" -ForegroundColor White
    Write-Host "  (aussi sauvegarde dans local-pg-password.txt)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Prochaine etape : lancez local-setup.bat" -ForegroundColor Cyan
Write-Host ""
