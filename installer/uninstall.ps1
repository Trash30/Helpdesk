#Requires -RunAsAdministrator
# ================================================================
# uninstall.ps1 — Désinstallation complète de HelpDesk Windows
# ================================================================
$ErrorActionPreference = "SilentlyContinue"

$InstallDir = "C:\HelpDesk"
$NssmDir    = Join-Path $InstallDir "nssm"
$NssmExe    = Get-ChildItem -Path $NssmDir -Name "nssm.exe" -Recurse -ErrorAction SilentlyContinue |
              ForEach-Object { Join-Path $NssmDir $_ } | Select-Object -First 1

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "  ║       Désinstallation de HelpDesk                        ║" -ForegroundColor Red
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
Write-Host ""
Write-Host "  Cette opération va :" -ForegroundColor Yellow
Write-Host "    - Arrêter et supprimer les services Windows"
Write-Host "    - Supprimer le dossier $InstallDir"
Write-Host "    - Supprimer les raccourcis"
Write-Host ""
Write-Host "  La base de données PostgreSQL et Node.js/PostgreSQL eux-mêmes" -ForegroundColor Yellow
Write-Host "  NE seront PAS désinstallés automatiquement." -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "  Confirmer la désinstallation ? (oui/N)"
if ($confirm -ne "oui") {
    Write-Host "  Annulé." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "  Désinstallation en cours..." -ForegroundColor Cyan

# ── Arrêt et suppression des services ────────────────────────
foreach ($svc in @("HelpDesk-Nginx", "HelpDesk-Server")) {
    if (Get-Service $svc -ErrorAction SilentlyContinue) {
        Write-Host "  Arrêt du service $svc..."
        Stop-Service $svc -Force -ErrorAction SilentlyContinue
        if ($NssmExe -and (Test-Path $NssmExe)) {
            & $NssmExe remove $svc confirm 2>&1 | Out-Null
        } else {
            sc.exe delete $svc 2>&1 | Out-Null
        }
        Write-Host "  ✓ Service $svc supprimé" -ForegroundColor Green
    }
}

# ── Suppression des raccourcis ────────────────────────────────
$Desktop = [System.Environment]::GetFolderPath("Desktop")
Remove-Item (Join-Path $Desktop "HelpDesk.lnk") -Force -ErrorAction SilentlyContinue

$StartMenu = Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\HelpDesk"
Remove-Item $StartMenu -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Raccourcis supprimés" -ForegroundColor Green

# ── Suppression du dossier d'installation ────────────────────
Start-Sleep -Seconds 2   # laisser le temps aux services de s'arrêter
Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
if (-not (Test-Path $InstallDir)) {
    Write-Host "  ✓ Dossier $InstallDir supprimé" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Impossible de supprimer $InstallDir complètement — fermez les fichiers ouverts et réessayez" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ✓ Désinstallation terminée." -ForegroundColor Green
Write-Host ""
Write-Host "  Pour désinstaller Node.js ou PostgreSQL, utilisez :" -ForegroundColor Gray
Write-Host "    Paramètres Windows > Applications > Désinstaller un programme" -ForegroundColor Gray
Write-Host ""
Read-Host "  Appuyez sur Entrée pour fermer"
