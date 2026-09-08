@echo off
setlocal
cd /d "%~dp0"
echo Demarrage de MyGymTracker...
call npm.cmd run dev -- --host 127.0.0.1 --open
endlocal
