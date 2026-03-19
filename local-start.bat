@echo off
:: ================================================================
:: local-start.bat — Demarrage rapide des serveurs de developpement
:: Prerequis : avoir lance local-setup.bat au moins une fois
:: ================================================================
title HelpDesk — Dev
chcp 65001 >nul 2>&1

:: ── Verifications rapides ─────────────────────────────────────────
if not exist "server\.env" (
    echo   [ERREUR] server\.env introuvable.
    echo   Lancez d'abord local-setup.bat
    pause & exit /b 1
)

if not exist "server\node_modules" (
    echo   [ERREUR] node_modules manquants.
    echo   Lancez d'abord local-setup.bat
    pause & exit /b 1
)

echo.
echo   Demarrage HelpDesk en mode developpement...
echo.
echo   Backend  : http://localhost:3001
echo   Frontend : http://localhost:5173
echo.
echo   Fermer cette fenetre pour tout arreter.
echo.

:: Demarrer backend et frontend en parallele
call npm run dev

pause
