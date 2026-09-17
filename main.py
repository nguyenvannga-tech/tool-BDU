import sys
import os

user_site = os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages')
if os.path.exists(user_site) and user_site not in sys.path:
    sys.path.insert(0, user_site)

import time
import webbrowser
import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.config import config
from app.services.network_service import network_service
from app.services.room_service import room_service
from app.sockets.classroom_socket import sio

start_time = time.time()

fastapi_app = FastAPI(
    title="LAN Classroom Screen Share Enterprise API",
    description="Python FastAPI + Socket.IO + React 18 High-Tech Classroom System",
    version="3.0.0"
)

@fastapi_app.get("/health")
async def health_check():
    uptime = int(time.time() - start_time)
    return JSONResponse({
        "status": "UP",
        "engine": "Python 3.9 FastAPI + Uvicorn ASGI",
        "uptimeSeconds": uptime,
        "activeStudents": len(room_service.get_student_list()),
        "isTeacherOnline": bool(room_service.get_teacher())
    })

# Điều hướng các link cũ (/student.html, /teacher.html) về SPA chuẩn (/, /teacher)
@fastapi_app.get("/student.html")
async def redirect_student_html():
    return RedirectResponse(url="/")

@fastapi_app.get("/teacher.html")
async def redirect_teacher_html():
    return RedirectResponse(url="/teacher")

target_static_dir = config.DIST_DIR if config.DIST_DIR.exists() else config.PUBLIC_DIR

if (target_static_dir / "assets").exists():
    fastapi_app.mount("/assets", StaticFiles(directory=str(target_static_dir / "assets")), name="assets")

@fastapi_app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api") or full_path.startswith("socket.io"):
        return JSONResponse({"error": "Not Found"}, status_code=404)
    
    file_path = target_static_dir / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    
    index_file = target_static_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    
    return JSONResponse({"message": "React App is building... Please run `npm run build` first."})

app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

if __name__ == "__main__":
    port = network_service.find_available_port(config.DEFAULT_PORT)
    local_ips = network_service.get_local_ip_addresses()
    network_service.start_mdns_broadcast(port)

    print("\n==================================================================")
    print("🚀 PYTHON 3 FASTAPI LAN CLASSROOM (TỰ ĐỘNG THÍCH ỨNG DẢI MẠNG)")
    print("==================================================================")
    print(f"🌟 TÊN MIỀN NỘI BỘ LAN (Mọi máy gõ trực tiếp): http://lophoc.local:{port}")
    print(f"👨‍🏫 BẢNG ĐIỀU KHIỂN GIÁO VIÊN: http://localhost:{port}/teacher")
    print("\n📱 ĐƯỜNG DẪN DỰ PHÒNG THEO IP (WiFi / Hotspot):")
    for ip in local_ips:
        print(f"   👉 Đường dẫn lớp học: http://{ip}:{port}")
    print("==================================================================\n")

    teacher_url = f"http://localhost:{port}/teacher"
    try:
        webbrowser.open(teacher_url)
    except Exception:
        pass

    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
