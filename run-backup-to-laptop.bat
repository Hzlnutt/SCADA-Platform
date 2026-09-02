@echo off
TITLE SCADA Database Backup Sync to Laptop
echo ==================================================================
echo [SCADA] Menjalankan Backup dan Sinkronisasi ke Database Laptop...
echo ==================================================================

cd /d "%~dp0"
pnpm run sync:backup

echo.
echo ==================================================================
echo Proses selesai.
echo ==================================================================
timeout /t 5
