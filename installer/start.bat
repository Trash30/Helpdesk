@echo off
:: ── Démarrage des services HelpDesk ──────────────────────────
title HelpDesk — Démarrage

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Droits Administrateur requis. Clic droit ^> "Executer en tant qu'administrateur"
    pause & exit /b 1
)

echo.
echo   Démarrage des services HelpDesk...
echo.

net start HelpDesk-Server >nul 2>&1 && echo   ✓ Serveur Node.js démarré || echo   ⚠ Serveur déjà actif ou erreur
net start HelpDesk-Nginx  >nul 2>&1 && echo   ✓ Nginx démarré           || echo   ⚠ Nginx déjà actif ou erreur

echo.
echo   Application disponible sur : http://localhost
echo.
pause
