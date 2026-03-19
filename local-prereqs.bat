@echo off
:: ================================================================
:: local-prereqs.bat — Installe Node.js 20 et PostgreSQL 15
:: Necessite les droits Administrateur
:: ================================================================
title HelpDesk — Installation des prerequis

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   Droits Administrateur requis.
    echo   Clic droit sur ce fichier ^> "Executer en tant qu'administrateur"
    echo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-prereqs.ps1"
pause
