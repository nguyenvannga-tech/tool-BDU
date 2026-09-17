from typing import Dict, List, Optional, Any
from datetime import datetime

class RoomService:
    def __init__(self):
        self.teacher_socket_id: Optional[str] = None
        self.students: Dict[str, Dict[str, Any]] = {}
        self.presentation_queue: List[str] = [] # Danh sách socket.id sinh viên xin phát bài tập

    def set_teacher(self, socket_id: str) -> None:
        self.teacher_socket_id = socket_id

    def get_teacher(self) -> Optional[str]:
        return self.teacher_socket_id

    def remove_teacher(self) -> None:
        self.teacher_socket_id = None

    def add_student(self, socket_id: str, name: str) -> Dict[str, Any]:
        student = {
            "id": socket_id,
            "name": name or "Học sinh",
            "isSharing": False,
            "joinedAt": datetime.now().isoformat()
        }
        self.students[socket_id] = student
        return student

    def remove_student(self, socket_id: str) -> Optional[Dict[str, Any]]:
        if socket_id in self.presentation_queue:
            self.presentation_queue.remove(socket_id)
        return self.students.pop(socket_id, None)

    def get_student_list(self) -> List[Dict[str, Any]]:
        return list(self.students.values())

    def update_sharing_state(self, socket_id: str, is_sharing: bool) -> None:
        if socket_id in self.students:
            self.students[socket_id]["isSharing"] = is_sharing

    # Quản lý Hàng Đợi Bài Tập (Presentation Queue)
    def add_to_queue(self, socket_id: str) -> bool:
        if socket_id in self.students and socket_id not in self.presentation_queue:
            self.presentation_queue.append(socket_id)
            return True
        return False

    def remove_from_queue(self, socket_id: str) -> bool:
        if socket_id in self.presentation_queue:
            self.presentation_queue.remove(socket_id)
            return True
        return False

    def get_queue_list(self) -> List[Dict[str, Any]]:
        queue_info = []
        for index, sid in enumerate(self.presentation_queue):
            if sid in self.students:
                student = self.students[sid].copy()
                student["queuePosition"] = index + 1
                queue_info.append(student)
        return queue_info

    def clear_all(self) -> None:
        self.teacher_socket_id = None
        self.students.clear()
        self.presentation_queue.clear()

room_service = RoomService()
