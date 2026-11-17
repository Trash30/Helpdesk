@echo off
setlocal EnableExtensions
chcp 65001 >nul
title HelpDesk VOGO (portable)

rem ============================================================
rem  HelpDesk VOGO - version portable Windows (aucune installation)
rem  Double-clic pour demarrer. Fermer cette fenetre = arret propre.
rem ============================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "NODE=%ROOT%\node\node.exe"
set "PGBIN=%ROOT%\pgsql\bin"
set "DATA=%ROOT%\data"
set "PGDATA=%DATA%\pgdata"
set "PG_PORT=54329"
set "APP_PORT=3000"

echo.
echo  ==========================================
echo    HelpDesk VOGO - version portable
echo  ==========================================
echo.

if not exist "%NODE%" ( echo [ERREUR] node\node.exe introuvable. & goto :fail )
if not exist "%PGBIN%\pg_ctl.exe" ( echo [ERREUR] pgsql\bin introuvable. & goto :fail )
if not exist "%DATA%" mkdir "%DATA%"
if not exist "%DATA%\uploads" mkdir "%DATA%\uploads"

rem --- Secret JWT propre a cette cle (genere une seule fois) ---
if not exist "%DATA%\jwt.secret" (
  "%NODE%" -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))" > "%DATA%\jwt.secret"
)
set /p JWT_SECRET=<"%DATA%\jwt.secret"

rem --- Premiere utilisation : initialisation de la base ---
set "FIRST_RUN=0"
if not exist "%PGDATA%\PG_VERSION" (
  set "FIRST_RUN=1"
  echo [1/4] Premiere utilisation : creation de la base de donnees...
  "%PGBIN%\initdb.exe" -D "%PGDATA%" -U postgres -A trust -E UTF8 --locale=C >"%DATA%\initdb.log" 2>&1
  if errorlevel 1 (
    echo [ERREUR] initdb a echoue. Voir data\initdb.log
    echo          Si la cle est en FAT32, copiez ce dossier sur le disque du PC ^(ou formatez la cle en NTFS^).
    echo          Ce programme ne doit pas etre lance en tant qu'administrateur.
    goto :fail
  )
)

rem --- Demarrage de PostgreSQL ---
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" status >nul 2>&1
if errorlevel 1 (
  echo [2/4] Demarrage de la base de donnees...
  "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -o "-p %PG_PORT% -c listen_addresses=127.0.0.1" -l "%DATA%\postgres.log" -w -t 60 start >nul
  if errorlevel 1 ( echo [ERREUR] PostgreSQL n'a pas demarre. Voir data\postgres.log & goto :fail )
) else (
  echo [2/4] Base de donnees deja demarree.
)

set "DATABASE_URL=postgresql://postgres@127.0.0.1:%PG_PORT%/helpdesk"
set "NODE_ENV=production"
set "PORT=%APP_PORT%"
set "HOST=127.0.0.1"
set "UPLOADS_PATH=%DATA%\uploads"
set "COOKIE_SECURE=false"
set "APP_URL=http://localhost:%APP_PORT%"
set "COMPANY_NAME=HelpDesk"
set "PGCLIENTENCODING=UTF8"

if "%FIRST_RUN%"=="1" (
  echo [3/4] Chargement des donnees...
  "%PGBIN%\createdb.exe" -h 127.0.0.1 -p %PG_PORT% -U postgres -E UTF8 -T template0 helpdesk
  if errorlevel 1 goto :fail
  "%PGBIN%\psql.exe" -h 127.0.0.1 -p %PG_PORT% -U postgres -d helpdesk -q -v ON_ERROR_STOP=1 -f "%ROOT%\db\helpdesk.sql" >"%DATA%\restore.log" 2>&1
  if errorlevel 1 ( echo [ERREUR] Restauration impossible. Voir data\restore.log & goto :fail )
  pushd "%ROOT%\app\server"
  "%NODE%" reset-passwords.js
  popd
  echo.
)

echo [4/4] Demarrage de l'application...
echo.
echo   Adresse  : http://localhost:%APP_PORT%
echo   Admin    : mot de passe Helpdesk2026   ^(agents : Agent2026^)
echo   Pour arreter : fermez cette fenetre ^(ou Ctrl+C^).
echo.
start "" "http://localhost:%APP_PORT%"

pushd "%ROOT%\app\server"
"%NODE%" portable-server.js
popd

echo.
echo Arret de la base de donnees...
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -m fast stop >nul 2>&1
echo Termine.
timeout /t 2 >nul
exit /b 0

:fail
echo.
echo Le demarrage a echoue.
pause
exit /b 1
