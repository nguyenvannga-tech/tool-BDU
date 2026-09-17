# 🏫 LAN Classroom Screen Share (Hệ Thống Trình Chiếu Lớp Học Mạng LAN 100% Miễn Phí)

Ứng dụng chia sẻ màn hình, phát biểu Camera/Mic thời gian thực và quản lý lớp học trong mạng nội bộ (WiFi/LAN) với **độ trễ siêu thấp (< 50ms)**, **tốc độ 60 FPS**, **100% không tốn chi phí máy chủ đám mây**.

---

## 🌟 Tính Năng Nổi Bật

- 🖥️ **Phát màn hình Giáo viên 60FPS**: Trình chiếu slide, video bài giảng, màn hình lập trình siêu mượt.
- 📷 **Bật Camera/Mic học sinh tức thì (Chuẩn OmeTV 0.0s)**: Thầy Cô mời phát biểu/chấm bài là Camera & Micro của học sinh tự động bật và truyền về ngay lập tức.
- 💻 **Chia sẻ màn hình Học sinh**: Học sinh có thể chia sẻ toàn bộ màn hình máy tính để giáo viên xem bài làm.
- 🔴 **Laser chỉ điểm Realtime**: Giáo viên lia chuột tới đâu, chấm đỏ laser sáng lên trên máy tất cả học sinh tới đó.
- 💬 **Khung Chat Realtime**: Trao đổi tin nhắn trong lớp nhanh chóng, hỗ trợ phím Enter.
- 📱 **Giao diện Di động & Toàn màn hình**: Tương thích hoàn hảo mọi thiết bị (iPhone, iPad, Android, Windows, Mac).
- ⚡ **Cài đặt PWA 1 Chạm**: Học sinh có thể lưu ứng dụng ra màn hình chính, mở vào lớp trong 0.1s.
- 🔐 **Xác thực PIN Giáo viên**: Mã PIN quản trị mặc định: `123456`.

---

## 🚀 Hướng Dẫn Khởi Chạy Siêu Tốc (1-Click Run)

Chỉ cần tải mã nguồn về hoặc `git clone`, sau đó:

### 🪟 Trên Windows:
Nhấp đúp chuột vào file **`start.bat`**.

### 🍎 Trên macOS / Linux:
Mở Terminal và chạy:
```bash
./start.sh
# Hoặc: npm start
```

*(Script sẽ tự động cài đặt thư viện và khởi động toàn bộ hệ thống).*

---

## 🎯 Cổng Truy Cập Lớp Học

Khi Server khởi chạy, hệ thống sẽ cung cấp các đường dẫn:

- **👨‍🏫 Bảng Điều Khiển Giáo Viên**: `http://localhost:8888/teacher` (Mã PIN: **`123456`**)
- **🎓 Cổng Học Sinh (HTTP)**: `http://lophoc.local:8888` (hoặc `http://<IP_MÁY_BẠN>:8888`)
- **🔒 Cổng Học Sinh (HTTPS Cấp quyền Camera/Mic vĩnh viễn)**: `https://<IP_MÁY_BẠN>:8443`

---

## 📦 Đẩy Lên Git (Git Push)

```bash
git init
git add .
git commit -m "feat: complete lan classroom screen share system with WebRTC & PWA"
git branch -M main
git remote add origin <URL_REPO_CUA_BAN>
git push -u origin main
```

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: React 18, Vite, Socket.IO Client, WebRTC Native API, HTML5 Canvas/Video.
- **Backend**: Node.js Express + Socket.IO Server / Python 3 FastAPI ASGI Uvicorn.
- **Mạng**: mDNS (Bonjour/Zero-Config) `lophoc.local`, WebRTC Mesh P2P, SSL Self-signed.
