@echo off
chcp 65001 >nul
title Pesta Topeng - Online
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Mencoba memasang Node.js LTS lewat winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo Selesai. TUTUP jendela ini, lalu klik dua kali MAIN-ONLINE.bat sekali lagi.
  echo Kalau gagal, pasang manual dari https://nodejs.org ^(pilih versi LTS^).
  pause
  exit /b
)
node online.js
echo.
pause
