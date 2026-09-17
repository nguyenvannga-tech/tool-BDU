#!/usr/bin/env bash

echo "=================================================================="
echo "🚀 KHỞI CHẠY LỚP HỌC TRỰC TUYẾN MẠNG LAN (REACT 18 + WEBRTC 60FPS)"
echo "=================================================================="

# 1. Tự động cài đặt dependencies nếu chưa có
if [ ! -d "node_modules" ] && command -v npm &>/dev/null; then
    echo "[i] Đang cài đặt thư viện Node.js lần đầu..."
    npm install
fi

# 2. Tự động build giao diện nếu chưa có thư mục dist
if [ ! -d "dist" ] && command -v npm &>/dev/null; then
    echo "[i] Đang biên dịch giao diện React..."
    npm run build
fi

# 3. Khởi chạy Server (Ưu tiên Node.js hoặc Python)
export PYTHONPATH="${HOME}/Library/Python/3.9/lib/python/site-packages:${PYTHONPATH}"

if command -v node &>/dev/null; then
    node server.js
elif command -v python3 &>/dev/null; then
    python3 main.py
elif command -v python &>/dev/null; then
    python main.py
else
    echo "❌ Không tìm thấy Node.js hoặc Python 3 để chạy Server."
fi
