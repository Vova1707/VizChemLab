@echo off
echo Starting VizChemLab...

:: Start Backend
start cmd /k "python -m uvicorn app.main:app --reload --port 8765"

:: Start Frontend
cd frontend
start cmd /k "npm run dev"

echo Project started! 
echo Backend: http://localhost:8765/docs
echo Frontend: http://localhost:3000
pause
