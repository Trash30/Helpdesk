@echo off
:: ── Arrêt des services HelpDesk ───────────────────────────────
title HelpDesk — Arrêt

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Droits Administrateur requis. Clic droit ^> "Executer en tant qu'administrateur"
    pause & exit /b 1
)

echo.
echo   Arrêt des services HelpDesk...
echo.

net stop HelpDesk-Nginx  >nul 2>&1 && echo   ✓ Nginx arrêté           || echo   ⚠ Nginx déjà arrêté
net stop HelpDesk-Server >nul 2>&1 && echo   ✓ Serveur Node.js arrêté || echo   ⚠ Serveur déjà arrêté

echo.
echo   Services arrêtés.
echo.
pause
