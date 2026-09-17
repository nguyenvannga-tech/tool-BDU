@echo off
title LAN Classroom Screen Share Enterprise Server
echo ==================================================================
echo   DANG KHOI CHAY LOP HOC TRUC TUYEN MANG LAN (REACT 18 + WEBRTC)
echo ==================================================================

if not exist node_modules (
    echo [i] Dang cai dat thu vien lan dau...
    call npm install
)

if not exist dist (
    echo [i] Dang bien dich giao dien React...
    call npm run build
)

if exist node_modules (
    node server.js
) else (
    python main.py
)

pause
