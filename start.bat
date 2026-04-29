@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title FlowCut Launcher
color 0A

echo.
echo  ==========================================
echo    FlowCut Dev Environment Launcher
echo  ==========================================
echo.
echo    [1] Edit Only   - FlowCut + Vite
echo    [2] Full AI     - Edit + Ollama + ComfyUI
echo    [3] AI Generate - Edit + ComfyUI only
echo.
set /p mode="  Enter mode [1/2/3]: "

cd /d E:\2026\flowCut

echo.
echo  [1/5] Cleaning up old FlowCut processes...
taskkill /f /fi "WINDOWTITLE eq FlowCut-Server*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq FlowCut-Vite*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3456.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1
timeout /t 1 /nobreak >nul
echo        Done.

echo  [2/5] Checking environment...
where node >nul 2>&1
if !errorlevel! neq 0 (echo        [FAIL] Node.js not found! & pause & exit /b 1)
echo        Node.js OK
if not exist "E:\ffmpeg\bin\ffmpeg.exe" (echo        [FAIL] FFmpeg missing! & pause & exit /b 1)
echo        FFmpeg OK
if not exist "node_modules" (call npm install)
if not exist "media_cache" mkdir media_cache
if not exist "output" mkdir output
if not exist "temp" mkdir temp

echo  [3/5] AI services...
if "!mode!"=="1" goto skip_all_ai

if "!mode!"=="3" goto check_comfy

echo        Checking Ollama...
netstat -ano 2>nul | findstr ":11434.*LISTENING" >nul 2>&1
if !errorlevel! equ 0 goto ollama_running
echo        Starting Ollama...
start "FlowCut-Ollama" /min cmd /k "title FlowCut-Ollama && color 0E && ollama serve"
timeout /t 3 /nobreak >nul
echo        Ollama started.
goto check_comfy
:ollama_running
echo        Ollama already running (port 11434).

:check_comfy
echo        Checking ComfyUI...
netstat -ano 2>nul | findstr ":8188.*LISTENING" >nul 2>&1
if !errorlevel! equ 0 goto comfy_running
if not exist "E:\WuxiaStudio\engine\ComfyUI\run_nvidia_gpu.bat" goto comfy_not_found
echo        Starting ComfyUI (run_nvidia_gpu.bat)...
start "FlowCut-ComfyUI" /min cmd /k "title FlowCut-ComfyUI && color 06 && cd /d E:\WuxiaStudio\engine\ComfyUI && run_nvidia_gpu.bat"
echo        Waiting for ComfyUI to load models...
set comfy_wait=0
:comfy_wait_loop
timeout /t 5 /nobreak >nul
set /a comfy_wait+=5
netstat -ano 2>nul | findstr ":8188.*LISTENING" >nul 2>&1
if !errorlevel! equ 0 goto comfy_ready
if !comfy_wait! geq 120 goto comfy_timeout
echo        Still loading... (!comfy_wait!s)
goto comfy_wait_loop
:comfy_ready
echo        ComfyUI ready! (took !comfy_wait!s)
goto start_flowcut
:comfy_timeout
echo        [WARN] ComfyUI not responding after 120s. Check GPU/VRAM.
goto start_flowcut
:comfy_running
echo        ComfyUI already running (port 8188).
goto start_flowcut
:comfy_not_found
echo        [WARN] run_nvidia_gpu.bat not found at E:\WuxiaStudio\engine\ComfyUI
goto start_flowcut

:skip_all_ai
echo        AI services skipped (Edit Only mode).

:start_flowcut
echo  [4/5] Starting FlowCut...
start "FlowCut-Server" /min cmd /k "title FlowCut-Server [3456] && cd /d E:\2026\flowCut && color 0B && node server/server.cjs"
timeout /t 3 /nobreak >nul
echo        Export Server started (port 3456)

start "FlowCut-Vite" /min cmd /k "title FlowCut-Vite [5173] && cd /d E:\2026\flowCut && color 0D && npx vite"
timeout /t 4 /nobreak >nul
echo        Vite started (port 5173)

echo  [5/5] Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo  ==========================================
if "!mode!"=="1" echo    Mode: EDIT ONLY
if "!mode!"=="2" echo    Mode: FULL AI
if "!mode!"=="3" echo    Mode: AI GENERATE
echo  ------------------------------------------
echo    Backend:   http://localhost:3456
echo    Frontend:  http://localhost:5173
if not "!mode!"=="1" echo    ComfyUI:   http://localhost:8188
if "!mode!"=="2" echo    Ollama:    http://localhost:11434
echo  ==========================================
echo.
echo  Press any key to close this launcher window.
echo  (Services will keep running in background)
pause >nul