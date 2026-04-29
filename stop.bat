@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title FlowCut - FULL STOP
color 0C

echo.
echo  ==========================================
echo    FlowCut FULL SHUTDOWN
echo  ==========================================
echo.

echo  [1/5] FlowCut windows...
taskkill /f /fi "WINDOWTITLE eq FlowCut-*" >nul 2>&1
echo        Done.

echo  [2/5] Node.js processes...
wmic process where "name='node.exe' and commandline like '%%server.cjs%%'" call terminate >nul 2>&1
wmic process where "name='node.exe' and commandline like '%%vite%%'" call terminate >nul 2>&1
wmic process where "name='node.exe' and commandline like '%%flowCut%%'" call terminate >nul 2>&1
echo        Done.

echo  [3/5] Ollama...
taskkill /f /im ollama.exe >nul 2>&1
taskkill /f /im ollama_llama_server.exe >nul 2>&1
echo        Done.

echo  [4/5] ComfyUI...
wmic process where "name='python.exe' and commandline like '%%ComfyUI%%'" call terminate >nul 2>&1
wmic process where "name='python.exe' and commandline like '%%main.py%%'" call terminate >nul 2>&1
echo        Done.

echo  [5/5] Kill by ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3456.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8188.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":11434.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
echo        Done.

del /q "E:\2026\flowCut\temp\filter_*.txt" >nul 2>&1

echo.
echo  ==========================================
echo    FlowCut stopped.
echo  ==========================================
echo.
timeout /t 3
