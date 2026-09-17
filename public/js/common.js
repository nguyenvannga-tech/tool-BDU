// Cấu hình WebRTC ICE Server
// Trong mạng LAN nội bộ, các thiết bị tự trao đổi IP local (host candidates).
// Cấu hình STUN server Google dùng làm fallback nếu cần.
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Utility hiển thị thông báo toast / alert nhanh
function showAlert(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}
