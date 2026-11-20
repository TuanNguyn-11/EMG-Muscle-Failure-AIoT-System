@echo off
rem Mo web dashboard: double-click file nay. Trinh duyet tu mo http://localhost:5173
rem Bam nut "Fake" tren trang de xem du lieu tap gia (khong can emulator / thiet bi).
cd /d "%~dp0"
if not exist node_modules (
  echo Cai thu vien lan dau...
  call npm install || (pause & exit /b 1)
)
call npm run dev -- --open
pause
