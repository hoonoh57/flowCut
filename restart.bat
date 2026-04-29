@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title FlowCut - Restart
color 0E

echo.
echo  ==========================================
echo    FlowCut Quick Restart
echo    (server + vite only, AI untouched)
echo  ==========================================
echo.

cd /d E:\2026\flowCut

echo  [1/3] Stopping FlowCut server + Vite...
taskkill /f /fi "WINDOWTITLE eq FlowCut-Server*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq FlowCut-Vite*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3456.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo  [2/3] Status check (read-only)...
tasklist /fi "IMAGENAME eq ollama.exe" 2>nul | findstr /i "ollama" >nul 2>&1
if !errorlevel! equ 0 (echo        Ollama:  OK) else (echo        Ollama:  [NOT RUNNING] - run start.bat mode 2)
netstat -ano 2>nul | findstr ":8188.*LISTENING" >nul 2>&1
if !errorlevel! equ 0 (echo        ComfyUI: OK) else (echo        ComfyUI: [NOT RUNNING] - run start.bat mode 2)
if exist "E:\ffmpeg\bin\ffmpeg.exe" (echo        FFmpeg:  OK) else (echo        FFmpeg:  [MISSING])

:waitport
netstat -ano 2>nul | findstr ":3456.*LISTENING" >nul 2>&1
if not errorlevel 1 (timeout /t 1 /nobreak >nul & goto waitport)

echo  [3/3] Starting FlowCut...
start "FlowCut-Server" /min cmd /k "title FlowCut-Server [3456] && cd /d E:\2026\flowCut && color 0B && node server/server.cjs"
timeout /t 3 /nobreak >nul
echo        Server: port 3456

start "FlowCut-Vite" /min cmd /k "title FlowCut-Vite [5173] && cd /d E:\2026\flowCut && color 0D && npx vite"
timeout /t 3 /nobreak >nul
echo        Vite:   port 5173

echo.
echo  Refreshing browser...
start http://localhost:5173

echo.
echo  ==========================================
echo    Restarted! (Ollama/ComfyUI unchanged)
echo  ------------------------------------------
echo    Backend:  http://localhost:3456
echo    Frontend: http://localhost:5173
echo  ==========================================
echo.
timeout /t 3
