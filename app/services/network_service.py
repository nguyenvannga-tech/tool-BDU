import socket
import subprocess
import sys
from typing import List

class NetworkService:
    def __init__(self):
        self.mdns_process = None

    @staticmethod
    def get_local_ip_addresses() -> List[str]:
        """
        Tự động quét và thích ứng 100% với MỌI dải mạng LAN / WiFi / Hotspot:
        - Dải 10.x.x.x (Mạng trường học, doanh nghiệp)
        - Dải 172.16.x.x - 172.31.x.x (Mạng nội bộ Class B)
        - Dải 192.168.x.x (WiFi cá nhân, phòng trọ, gia đình)
        - Dải Hotspot / USB Tethering
        """
        ip_set = set()

        # Phương pháp 1: Phát hiện IP Routing chủ đạo đang hoạt động
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("1.1.1.1", 80))
            main_ip = s.getsockname()[0]
            s.close()
            if main_ip and not main_ip.startswith("127."):
                ip_set.add(main_ip)
        except Exception:
            pass

        # Phương pháp 2: Phân giải Hostname hệ thống lấy tất cả các Card mạng đang bật
        try:
            hostname = socket.gethostname()
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip = item[4][0]
                if ":" not in ip and not ip.startswith("127."):
                    ip_set.add(ip)
        except Exception:
            pass

        # Phương pháp 3: Socket Broadcast Discovery dự phòng
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            s.connect(("<broadcast>", 0))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127."):
                ip_set.add(ip)
        except Exception:
            pass

        result = list(ip_set)
        if not result:
            result = ["127.0.0.1"]
            
        return result

    @staticmethod
    def find_available_port(start_port: int) -> int:
        """
        Tự động kiểm tra và tìm cổng rảnh nếu cổng ban đầu bị bận
        """
        port = start_port
        while port < 65535:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("0.0.0.0", port))
                    return port
                except OSError:
                    port += 1
        return start_port

    def start_mdns_broadcast(self, port: int):
        """
        Phát sóng mDNS tên miền lophoc.local trên mạng LAN nội bộ
        """
        try:
            if sys.platform == "darwin":
                # macOS built-in dns-sd service
                self.mdns_process = subprocess.Popen(
                    ["dns-sd", "-R", "lophoc", "_http._tcp", "local", str(port)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                print(f"[mDNS] Đã phát sóng tên miền: http://lophoc.local:{port}")
        except Exception as e:
            print(f"[mDNS] Warning: Không thể khởi chạy mDNS broadcast: {e}")

network_service = NetworkService()

