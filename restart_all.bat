@echo off
echo ========================================================
echo        RESTARTING SONGS PORTAL SYSTEM (FULL STACK)
echo ========================================================
echo.
echo 1. Stopping any running Node processes on ports 5000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo 2. Starting MS SQL Server Service (if stopped)...
net start MSSQL$SQLEXPRESS >nul 2>&1

echo 3. Starting Backend API and Frontend UI...
echo.
echo Running on:
echo   - Local:   http://localhost:5173
echo   - Network: http://100.86.64.109:5173
echo ========================================================
npm run dev
