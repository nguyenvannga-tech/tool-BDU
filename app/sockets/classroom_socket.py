import socketio
from datetime import datetime
from app.services.room_service import room_service

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25
)

async def emit_student_list_to_teacher():
    teacher_id = room_service.get_teacher()
    if teacher_id:
        student_list = room_service.get_student_list()
        await sio.emit("update-student-list", student_list, to=teacher_id)

async def emit_presentation_queue():
    queue_list = room_service.get_queue_list()
    await sio.emit("update-presentation-queue", queue_list)

@sio.event
async def connect(sid, environ):
    print(f"[+] Kết nối mới: {sid}")
    teacher_id = room_service.get_teacher()
    await sio.emit("teacher-status", {"online": bool(teacher_id)}, to=sid)

@sio.event
async def disconnect(sid):
    print(f"[-] Ngắt kết nối: {sid}")
    if sid == room_service.get_teacher():
        room_service.remove_teacher()
        await sio.emit("teacher-status", {"online": False})
    else:
        removed = room_service.remove_student(sid)
        if removed:
            await emit_student_list_to_teacher()
            await emit_presentation_queue()

@sio.event
async def register_role(sid, data):
    role = data.get("role")
    name = data.get("name") or ("Giáo viên" if role == "teacher" else "Học sinh")

    if role == "teacher":
        room_service.set_teacher(sid)
        print(f"[★] Giáo viên chủ phòng kết nối: {sid}")
        await sio.emit("teacher-registered", {"success": True}, to=sid)
        await emit_student_list_to_teacher()
        await emit_presentation_queue()
        await sio.emit("teacher-status", {"online": True})
    elif role == "student":
        room_service.add_student(sid, name)
        print(f"[+] Học sinh vào lớp: {name} ({sid})")
        await sio.emit("student-registered", {"success": True, "id": sid, "name": name}, to=sid)
        await emit_student_list_to_teacher()
        await emit_presentation_queue()

        teacher_id = room_service.get_teacher()
        await sio.emit("teacher-status", {"online": bool(teacher_id)}, to=sid)
        if teacher_id:
            await sio.emit("student-needs-broadcast", {"studentId": sid}, to=teacher_id)



# Hàng đợi phát bài tập
@sio.on("request-join-queue")
async def handle_join_queue(sid):
    success = room_service.add_to_queue(sid)
    if success:
        await emit_presentation_queue()

@sio.on("request-leave-queue")
async def handle_leave_queue(sid):
    success = room_service.remove_from_queue(sid)
    if success:
        await emit_presentation_queue()

@sio.on("teacher-approve-queue-student")
async def handle_approve_queue_student(sid, student_id):
    if sid != room_service.get_teacher():
        return
    room_service.remove_from_queue(student_id)
    await emit_presentation_queue()
    await sio.emit("request-screen-share", {"teacherId": sid}, to=student_id)

@sio.on("teacher-take-down-student")
async def handle_take_down_student(sid, student_id):
    if sid != room_service.get_teacher():
        return
    room_service.update_sharing_state(student_id, False)
    await emit_student_list_to_teacher()
    await sio.emit("teacher-forced-take-down", {}, to=student_id)
    await sio.emit("user-stopped-sharing", {"senderId": student_id})

@sio.on("send-chat-message")
async def handle_send_chat(sid, data):
    time_str = datetime.now().strftime("%H:%M")
    student_name = "Học sinh"
    role = "student"

    if sid == room_service.get_teacher():
        student_name = "Giáo viên"
        role = "teacher"
    elif sid in room_service.students:
        student_name = room_service.students[sid]["name"]

    chat_payload = {
        "senderId": sid,
        "senderName": student_name,
        "role": role,
        "message": data.get("message", ""),
        "time": time_str
    }
    await sio.emit("new-chat-message", chat_payload)

@sio.on("teacher-request-share")
async def handle_teacher_request_share(sid, student_id):
    if sid != room_service.get_teacher():
        return
    await sio.emit("request-screen-share", {"teacherId": sid}, to=student_id)

@sio.on("student-response-share")
async def handle_student_response_share(sid, data):
    teacher_id = room_service.get_teacher()
    if teacher_id:
        student_name = room_service.students.get(sid, {}).get("name", "Học sinh")
        await sio.emit("student-share-response", {
            "studentId": sid,
            "studentName": student_name,
            "accepted": data.get("accepted", False)
        }, to=teacher_id)

@sio.on("teacher-start-broadcast")
async def handle_teacher_start_broadcast(sid):
    if sid != room_service.get_teacher():
        return
    await sio.emit("teacher-broadcasting-started", {"teacherId": sid}, skip_sid=sid)

@sio.on("teacher-stop-broadcast")
async def handle_teacher_stop_broadcast(sid):
    if sid != room_service.get_teacher():
        return
    await sio.emit("teacher-broadcasting-stopped", skip_sid=sid)

@sio.on("student-request-broadcast")
async def handle_student_request_broadcast(sid):
    teacher_id = room_service.get_teacher()
    if teacher_id:
        await sio.emit("student-needs-broadcast", {"studentId": sid}, to=teacher_id)

@sio.on("laser-pointer-move")
async def handle_laser_pointer_move(sid, data):
    if sid == room_service.get_teacher():
        await sio.emit("update-laser-pointer", data, skip_sid=sid)

@sio.on("teacher-approve-dual-stream")
async def handle_approve_dual_stream(sid, data):
    if sid != room_service.get_teacher():
        return
    student_id1 = data.get("studentId1")
    student_id2 = data.get("studentId2")
    if student_id1:
        room_service.remove_from_queue(student_id1)
        await sio.emit("request-screen-share", {"teacherId": sid, "isDual": True}, to=student_id1)
    if student_id2:
        room_service.remove_from_queue(student_id2)
        await sio.emit("request-screen-share", {"teacherId": sid, "isDual": True}, to=student_id2)
    await emit_presentation_queue()

@sio.on("signal")
async def handle_signal(sid, data):
    target_id = data.get("targetId")
    signal_data = data.get("signalData")
    if target_id:
        student_name = "Giáo viên" if sid == room_service.get_teacher() else room_service.students.get(sid, {}).get("name", "Học sinh")
        await sio.emit("signal", {
            "senderId": sid,
            "senderName": student_name,
            "signalData": signal_data
        }, to=target_id)

@sio.on("stop-sharing")
async def handle_stop_sharing(sid):
    room_service.update_sharing_state(sid, False)
    room_service.remove_from_queue(sid)
    await emit_student_list_to_teacher()
    await emit_presentation_queue()
    await sio.emit("user-stopped-sharing", {"senderId": sid}, skip_sid=sid)
