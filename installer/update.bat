@echo off
:: ── Mise à jour de l'application HelpDesk ────────────────────
title HelpDesk — Mise à jour

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Droits Administrateur requis. Clic droit ^> "Executer en tant qu'administrateur"
    pause & exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
    param()
    $ErrorActionPreference = 'Stop'
    $AppDir    = 'C:\HelpDesk\app'
    $LogFile   = 'C:\HelpDesk\install.log'
    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')

    function Log { param($m) Write-Host $m; Add-Content $LogFile `"[$timestamp] $m`" }
    function Ok  { param($m) Write-Host `"  OK: $m`" -ForegroundColor Green }

    Write-Host ''
    Write-Host '  Mise a jour HelpDesk...' -ForegroundColor Cyan
    Write-Host ''

    # npm ci (server)
    Log 'npm ci (server)...'
    Push-Location `"`$AppDir\server`"
    npm ci --omit=dev 2>&1 | Out-Null
    Ok 'Dependances serveur'

    # Prisma migrate
    Log 'Migrations Prisma...'
    npx prisma migrate deploy 2>&1 | Out-Null
    Ok 'Migrations appliquees'
    Pop-Location

    # npm ci + build (client)
    Log 'Build frontend...'
    Push-Location `"`$AppDir\client`"
    npm ci 2>&1 | Out-Null
    npm run build 2>&1 | Out-Null
    Ok 'Frontend compile'
    Pop-Location

    # Redemarrer services
    Log 'Redemarrage des services...'
    Restart-Service HelpDesk-Server -ErrorAction SilentlyContinue
    Restart-Service HelpDesk-Nginx  -ErrorAction SilentlyContinue
    Ok 'Services redemarres'

    Write-Host ''
    Write-Host '  Mise a jour terminee !' -ForegroundColor Green
    Write-Host ''
"

pause
