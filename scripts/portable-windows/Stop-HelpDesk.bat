@echo off
rem Arrete la base de donnees si la fenetre de Start-HelpDesk a ete fermee brutalement.
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
"%ROOT%\pgsql\bin\pg_ctl.exe" -D "%ROOT%\data\pgdata" -m fast stop
echo.
echo Base de donnees arretee. Vous pouvez retirer la cle.
pause
