@echo off
cd /d "%~dp0"

echo ================================================================== >> backup-sync.log
echo [%date% %time%] Memulai sinkronisasi backup SCADA ke laptop... >> backup-sync.log

call pnpm run sync:backup >> backup-sync.log 2>&1

echo [%date% %time%] Sinkronisasi selesai. >> backup-sync.log
