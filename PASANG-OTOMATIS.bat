@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Pesta Topeng.lnk'); $s.TargetPath='%~dp0MAIN-ONLINE.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
echo Pesta Topeng akan menyala otomatis setiap Windows dinyalakan.
echo Link baru ada di LINK-GAME.txt setiap kali menyala.
echo Untuk membatalkan, jalankan HAPUS-OTOMATIS.bat
pause
