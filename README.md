# LanCast Pro — Hệ Thống Trình Chiếu & Quản Lý Lớp Học Mạng LAN

Giải pháp trình chiếu màn hình, tương tác Camera/Micro thời gian thực và quản lý lớp học trong mạng nội bộ (LAN / Wi-Fi). Hoạt động **100% Offline**, **không phụ thuộc Internet/Cloud**, độ trễ **< 50ms**, truyền phát mượt mà chuẩn **60 FPS**.

---

## 🎯 Đối Tượng Sử Dụng

- **Giáo viên / Giảng viên**: Trình chiếu bài giảng, slide, code lập trình, chỉ điểm Laser và gọi học sinh phát biểu / chiếu bài tập trực tiếp.
- **Học sinh / Sinh viên**: Xem bài giảng toàn màn hình trên máy tính hoặc điện thoại, giơ tay xin chiếu bài, bật camera nộp bài tập viết tay tức thì.
- **Môi trường triển khai**: Phòng máy tính trường học, giảng đường đại học, trung tâm tin học, hội thảo nội bộ không có kết nối Internet ra ngoài.

---

## 🔄 Sơ Đồ Luồng Hoạt Động (Architecture & Workflow)

```text
+-----------------------------------------------------------------------------------+
|                        MẠNG CỤC BỘ NỘI BỘ (LAN / WI-FI)                           |
+-----------------------------------------------------------------------------------+
                                          |
                     [mDNS Service: http://lophoc.local:8888]
                                          |
                      +---------------------------------------+
                      |   HOST SERVER (FastAPI / Node.js)     |
                      |   - HTTP (:8888) & HTTPS (:8443)      |
                      |   - Socket.IO WebRTC Signaling Engine |
                      |   - In-Memory State & Queue Manager   |
                      +---------------------------------------+
                                  /               \
       (WebSocket Signaling / Auth)               (WebSocket Signaling / Role)
                                /                   \
    +--------------------------------+         +--------------------------------+
    |     NÚT GIÁO VIÊN (MASTER)     |         |     NÚT HỌC SINH (CLIENTS)     |
    | - React 18 Dashboard           |         | - Web App / PWA 1 Chạm         |
    | - Xác thực PIN: 123456         |         | - Auto-Join không cần tạo nick |
    | - Screen Capture Engine 60FPS  |         | - Toàn màn hình iOS & Android  |
    +--------------------------------+         +--------------------------------+
                    |                                          ^
                    |==== Luồng Video/Audio P2P Direct WebRTC ===| (Độ trễ < 50ms)
                    |                                          |
                    |<=== Camera/Screen Học sinh nộp bài tập ===| (Chuẩn OmeTV 0.0s)
```

---

## ⚡ Cơ Chế Vận Hành Cốt Lõi

1. **Khởi tạo & Định danh mDNS**: Máy chủ tự động phát sóng tên miền nội bộ `lophoc.local`. Thiết bị trong mạng Wi-Fi truy cập trực tiếp không cần nhập IP.
2. **Xác thực Giáo viên**: Giáo viên đăng nhập qua cổng `/teacher` với mã PIN bảo mật `123456` để nắm quyền chủ phòng.
3. **Truyền phát WebRTC P2P (Broadcasting)**: Khi Giáo viên phát màn hình, luồng video 60 FPS được phân phối trực tiếp tới từng học sinh qua mạng ngang hàng P2P cục bộ, không nghẽn băng thông.
4. **Tương tác Tức thì (Chuẩn OmeTV 0.0s)**: Khi Giáo viên mời học sinh phát biểu, Camera & Micro của học sinh tự động kích hoạt truyền ngược về bảng điều khiển Giáo viên mà không cần hộp thoại trung gian.

---

## 🚀 Hướng Dẫn Khởi Chạy (1-Click Run)

### 🪟 Trên Windows:
Nhấp đúp chuột vào file:
```cmd
start.bat
```

### 🍎 Trên macOS / Linux:
Mở Terminal và chạy lệnh:
```bash
chmod +x start.sh && ./start.sh
```
*(Hệ thống tự động kiểm tra thư viện, biên dịch giao diện và mở trình duyệt).*

---

## 🌐 Cổng Truy Cập Hệ Thống

| Vai Trò | Địa Chỉ Truy Cập | Ghi Chú |
| :--- | :--- | :--- |
| **Giáo Viên** | `http://localhost:8888/teacher` | Nhập mã PIN: **`123456`** |
| **Học Sinh (Khuyên dùng)** | `http://lophoc.local:8888` | Gõ tên miền ngắn không cần nhớ IP |
| **Học Sinh (IP Trực tiếp)** | `http://<IP_MÁY_BẠN>:8888` | Kết nối qua IP mạng LAN |
| **Học Sinh (HTTPS SSL)** | `https://<IP_MÁY_BẠN>:8443` | Cấp quyền Camera/Mic vĩnh viễn |

---

## 🛠️ Công Nghệ Nền Tảng

- **Giao diện**: React 18, Vite, Responsive Mobile Layout, PWA Standalone App.
- **Truyền dẫn Realtime**: WebSockets (Socket.IO), WebRTC Direct Mesh (VP8 / H.264 / Opus Audio).
- **Máy chủ Backend**: Python 3 FastAPI ASGI Uvicorn / Node.js Express.
- **Mạng nội bộ**: mDNS (Bonjour / Zero-Configuration Networking).
