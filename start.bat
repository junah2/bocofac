@echo off
echo Starting BOCOFAC backend and frontend...

start "BOCOFAC Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "BOCOFAC Frontend" cmd /k "cd /d %~dp0frontend && npm start"

echo Two windows will open: Backend (port 4000) and Frontend (port 3000).
echo Wait for the Frontend window to say "Compiled successfully!" then open http://localhost:3000
