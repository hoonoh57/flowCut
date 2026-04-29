@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title FlowCut - Restarting...
color 0E

echo.
echo  ==========================================
echo    FlowCut Quick Restart
echo  ==========================================
echo.

cd /d E:\2026\flowCut

echo  [1/4] Stopping FlowCut servers...
taskkill /f /fi "WINDOWTITLE eq FlowCut-Server*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq FlowCut-Vite*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3456.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo  [2/4] Checking AI services...

REM --- Ollama ---
tasklist /fi "IMAGENAME eq ollama.exe" 2>nul | findstr /i "ollama" >nul 2>&1
if !errorlevel! equ 0 (
    echo        Ollama: running
) else (
    echo        Ollama: starting...
    start "FlowCut-Ollama" /min cmd /k "title FlowCut-Ollama && color 0E && ollama serve"
    timeout /t 3 /nobreak >nul
    echo        Ollama: started
)

REM --- ComfyUI ---
set "COMFY_DIR=E:\WuxiaStudio\engine\ComfyUI\ComfyUI"
netstat -ano 2>nul | findstr ":8188.*LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo        ComfyUI: running on port 8188
) else (
    if exist "!COMFY_DIR!\main.py" (
        echo        ComfyUI: starting...
        start "FlowCut-ComfyUI" /min cmd /k "title FlowCut-ComfyUI && color 06 && cd /d !COMFY_DIR! && python main.py --listen 0.0.0.0 --port 8188"
        echo        ComfyUI: starting (30-60s for models)
        timeout /t 5 /nobreak >nul
    ) else (
        echo        ComfyUI: not found at !COMFY_DIR! - skipped
    )
)

REM --- FFmpeg ---
if exist "E:\ffmpeg\bin\ffmpeg.exe" (
    echo        FFmpeg: OK
) else (
    echo        FFmpeg: [MISSING] E:\ffmpeg\bin\ffmpeg.exe
)

echo  [3/4] Waiting for ports to free...
:waitport
netstat -ano 2>nul | findstr ":3456.*LISTENING" >nul 2>&1
if not errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto waitport
)
echo        Ports free.

echo  [4/4] Starting FlowCut...
start "FlowCut-Server" /min cmd /k "title FlowCut-Server [3456] && cd /d E:\2026\flowCut && color 0B && node server/server.cjs"
timeout /t 3 /nobreak >nul
echo        Export Server: port 3456

start "FlowCut-Vite" /min cmd /k "title FlowCut-Vite [5173] && cd /d E:\2026\flowCut && color 0D && npx vite"
timeout /t 3 /nobreak >nul
echo        Vite Dev: port 5173

echo.
echo  ==========================================
echo    FlowCut restarted!
echo  ------------------------------------------
echo    Backend:   http://localhost:3456
echo    Frontend:  http://localhost:5173
echo    Ollama:    http://localhost:11434
echo    ComfyUI:   http://localhost:8188
echo  ==========================================
echo.
timeout /t 3
