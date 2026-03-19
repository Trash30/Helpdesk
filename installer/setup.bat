@echo off
:: ==============================================================
:: setup.bat — Point d'entrée de l'installateur HelpDesk Windows
:: Doit être exécuté en tant qu'Administrateur
:: ==============================================================

title HelpDesk — Installation

:: Vérifier les droits admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  ERREUR : Ce script doit etre execute en tant qu'Administrateur.
    echo  Clic droit sur setup.bat ^> "Executer en tant qu'administrateur"
    echo.
    pause
    exit /b 1
)

:: Lancer PowerShell avec le script principal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

if %errorLevel% neq 0 (
    echo.
    echo  L'installation s'est terminee avec des erreurs.
    echo  Consultez le journal : C:\HelpDesk\install.log
    pause
    exit /b %errorLevel%
)
