@echo off
echo Starting Arcade Nexus...

echo [1/2] Launching Backend (FastAPI)...
start "Arcade Nexus Backend" cmd /k "cd backend && uv run python run.py"

echo [2/2] Launching Frontend (Vite)...
start "Arcade Nexus Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo ===================================================
echo.
