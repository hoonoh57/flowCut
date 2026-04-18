@echo off
echo === Real-ESRGAN Portable Downloader ===
echo.

set REALESRGAN_DIR=E:\2026\flowcut\tools\realesrgan
if exist "%REALESRGAN_DIR%\realesrgan-ncnn-vulkan.exe" (
    echo Already installed at %REALESRGAN_DIR%
    goto :done
)

mkdir "%REALESRGAN_DIR%" 2>nul

echo Downloading Real-ESRGAN ncnn Vulkan...
curl -L -o "%REALESRGAN_DIR%\realesrgan.zip" "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip"

echo Extracting...
powershell -Command "Expand-Archive -Path '%REALESRGAN_DIR%\realesrgan.zip' -DestinationPath '%REALESRGAN_DIR%' -Force"

echo Cleaning up...
del "%REALESRGAN_DIR%\realesrgan.zip"

if exist "%REALESRGAN_DIR%\realesrgan-ncnn-vulkan.exe" (
    echo.
    echo === Installation Complete! ===
    echo Location: %REALESRGAN_DIR%\realesrgan-ncnn-vulkan.exe
) else (
    echo.
    echo === Installation Failed ===
    echo Please download manually from:
    echo https://github.com/xinntao/Real-ESRGAN/releases
)

:done
pause