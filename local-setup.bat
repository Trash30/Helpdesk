@echo off
:: ================================================================
:: local-setup.bat — Configuration initiale pour test local Windows
:: A lancer UNE SEULE FOIS (ou apres un git pull majeur)
:: ================================================================
title HelpDesk — Setup local
chcp 65001 >nul 2>&1

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║          HelpDesk — Setup local Windows                  ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.

:: ── Verifier Node.js ─────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERREUR] Node.js introuvable.
    echo   Installez Node.js 20+ depuis https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo   [OK] Node.js %NODE_VER%

:: ── Verifier npm ─────────────────────────────────────────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERREUR] npm introuvable.
    pause & exit /b 1
)

:: ── Verifier psql ────────────────────────────────────────────────
where psql >nul 2>&1
if %errorlevel% neq 0 (
    :: Chercher dans les emplacements courants de PostgreSQL
    set "PSQL_FOUND="
    for %%d in (
        "C:\Program Files\PostgreSQL\17\bin"
        "C:\Program Files\PostgreSQL\16\bin"
        "C:\Program Files\PostgreSQL\15\bin"
        "C:\Program Files\PostgreSQL\14\bin"
    ) do (
        if exist "%%~d\psql.exe" (
            set "PSQL_FOUND=%%~d"
        )
    )
    if not defined PSQL_FOUND (
        echo   [ERREUR] PostgreSQL (psql) introuvable dans le PATH.
        echo   Installez PostgreSQL 15+ depuis https://www.postgresql.org/download/windows/
        echo   ou ajoutez son dossier bin au PATH.
        pause & exit /b 1
    )
    set "PATH=%PSQL_FOUND%;%PATH%"
)
for /f "tokens=*" %%v in ('psql --version 2^>^&1') do set PG_VER=%%v
echo   [OK] %PG_VER%

echo.

:: ── Creer server/.env si inexistant ──────────────────────────────
if exist "server\.env" (
    echo   [SKIP] server\.env existe deja ^(supprimez-le pour reconfigurer^)
    goto :deps
)

echo   Configuration de la base de donnees PostgreSQL :
echo   ^(laissez vide pour utiliser la valeur par defaut^)
echo.

set /p PG_HOST="  Hote PostgreSQL [localhost] : "
if "%PG_HOST%"=="" set PG_HOST=localhost

set /p PG_PORT_VAL="  Port PostgreSQL [5432] : "
if "%PG_PORT_VAL%"=="" set PG_PORT_VAL=5432

set /p PG_USER="  Utilisateur PostgreSQL [postgres] : "
if "%PG_USER%"=="" set PG_USER=postgres

set /p PG_PASS="  Mot de passe PostgreSQL : "
if "%PG_PASS%"=="" (
    echo   [AVERTISSEMENT] Mot de passe vide.
)

set /p DB_NAME="  Nom de la base de donnees [helpdesk_dev] : "
if "%DB_NAME%"=="" set DB_NAME=helpdesk_dev

set /p COMPANY="  Nom de la societe [Mon Helpdesk] : "
if "%COMPANY%"=="" set COMPANY=Mon Helpdesk

echo.
echo   Creation de la base de donnees '%DB_NAME%'...
set PGPASSWORD=%PG_PASS%
psql -h %PG_HOST% -p %PG_PORT_VAL% -U %PG_USER% -c "CREATE DATABASE %DB_NAME%;" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Base de donnees creee
) else (
    echo   [INFO] Base de donnees existante ou erreur ignoree
)

:: Generer un secret JWT aleatoire
for /f "tokens=*" %%j in ('powershell -NoProfile -Command "[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))"') do set JWT_SECRET=%%j

:: Ecrire le fichier .env
(
echo DATABASE_URL=postgresql://%PG_USER%:%PG_PASS%@%PG_HOST%:%PG_PORT_VAL%/%DB_NAME%
echo JWT_SECRET=%JWT_SECRET%
echo PORT=3001
echo NODE_ENV=development
echo APP_URL=http://localhost:5173
echo COMPANY_NAME=%COMPANY%
echo UPLOADS_PATH=./uploads
echo SMTP_HOST=
echo SMTP_PORT=587
echo SMTP_USER=
echo SMTP_PASS=
echo SMTP_FROM=noreply@helpdesk.local
) > server\.env

echo   [OK] server\.env cree

:deps
echo.
echo   Installation des dependances npm...
call npm install --prefix server >nul 2>&1
echo   [OK] Dependances server
call npm install --prefix client >nul 2>&1
echo   [OK] Dependances client
call npm install >nul 2>&1
echo   [OK] Dependances racine

echo.
echo   Generation du client Prisma + migrations + seed...
cd server
call npx prisma generate >nul 2>&1
echo   [OK] Prisma client genere
call npx prisma migrate deploy 2>&1
if %errorlevel% neq 0 (
    echo   [INFO] migrate deploy echoue, tentative avec migrate dev...
    call npx prisma migrate dev --name init 2>&1
)
echo   [OK] Migrations appliquees
call npx prisma db seed 2>&1
echo   [OK] Seed termine
cd ..
echo   [OK] Seed termine

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║   Setup termine ! Lancez local-start.bat pour demarrer  ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.
echo   Comptes de test :
echo     admin@helpdesk.com  /  admin123
echo     agent1@helpdesk.com /  agent123
echo.
pause
