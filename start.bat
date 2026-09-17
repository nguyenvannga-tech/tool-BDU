@echo off
title LAN Classroom Screen Share Server
echo ==================================================================
echo   DANG KHOI CHAY LOP HOC TRUC TUYEN MANG LAN
echo ==================================================================

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    if not exist node_modules (
        echo [i] Dang cai dat thu vien lan dau, vui long doi giay lat...
        call npm install
    )
    if not exist dist (
        echo [i] Dang bien dich giao dien...
        call npm run build
    )
    node server.js
    pause
    exit /b
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    pip install -r requirements.txt
    python main.py
    pause
    exit /b
)

echo.
echo [!] May tinh chua cai dat Node.js (Khuyen dung).
echo [i] Vui long tai va cai dat Node.js tai: https://nodejs.org (Ban LTS)
echo.
pause
