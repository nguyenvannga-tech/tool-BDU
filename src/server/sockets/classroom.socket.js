const roomService = require('../services/room.service');

function emitStudentListToTeacher(io) {
  const teacherId = roomService.getTeacher();
  if (teacherId) {
    const list = roomService.getStudentList();
    io.to(teacherId).emit('update-student-list', list);
  }
}

function emitPresentationQueue(io) {
  const queueList = roomService.getQueueList();
  io.emit('update-presentation-queue', queueList);
}

module.exports = function registerClassroomSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[+] Socket kết nối mới: ${socket.id}`);
    
    // Gửi ngay trạng thái giáo viên cho client vừa kết nối
    const teacherId = roomService.getTeacher();
    socket.emit('teacher-status', { online: Boolean(teacherId) });

    // Đăng ký vai trò khi kết nối
    socket.on('register-role', (data) => {
      const { role, name } = data || {};
      socket.role = role;
      socket.userName = name || (role === 'teacher' ? 'Giáo viên' : 'Học sinh');

      if (role === 'teacher') {
        roomService.setTeacher(socket.id);
        console.log(`[★] Giáo viên đã đăng nhập: ${socket.id}`);
        socket.emit('teacher-registered', { success: true });
        emitStudentListToTeacher(io);
        emitPresentationQueue(io);
        io.emit('teacher-status', { online: true });
      } else if (role === 'student') {
        roomService.addStudent(socket.id, socket.userName);
        console.log(`[+] Học sinh vào lớp: ${socket.userName} (${socket.id})`);
        socket.emit('student-registered', { success: true, id: socket.id, name: socket.userName });
        emitStudentListToTeacher(io);
        emitPresentationQueue(io);

        const currentTeacher = roomService.getTeacher();
        socket.emit('teacher-status', { online: Boolean(currentTeacher) });
        if (currentTeacher) {
          io.to(currentTeacher).emit('student-needs-broadcast', { studentId: socket.id });
        }
      }
    });

    // Chat / Bình luận Realtime
    socket.on('send-chat-message', (data) => {
      const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const chatPayload = {
        senderId: socket.id,
        senderName: socket.userName || (socket.role === 'teacher' ? 'Giáo viên' : 'Học sinh'),
        role: socket.role || 'student',
        message: (data && data.message) || '',
        time: timeStr
      };
      io.emit('new-chat-message', chatPayload);
    });

    // Hàng đợi phát bài tập
    socket.on('request-join-queue', () => {
      if (roomService.addToQueue(socket.id)) {
        emitPresentationQueue(io);
      }
    });

    socket.on('request-leave-queue', () => {
      if (roomService.removeFromQueue(socket.id)) {
        emitPresentationQueue(io);
      }
    });

    socket.on('teacher-approve-queue-student', (studentId) => {
      if (socket.id !== roomService.getTeacher()) return;
      roomService.removeFromQueue(studentId);
      emitPresentationQueue(io);
      io.to(studentId).emit('request-screen-share', { teacherId: socket.id });
    });

    socket.on('teacher-approve-dual-stream', ({ studentId1, studentId2 }) => {
      if (socket.id !== roomService.getTeacher()) return;
      if (studentId1) {
        roomService.removeFromQueue(studentId1);
        io.to(studentId1).emit('request-screen-share', { teacherId: socket.id, isDual: true });
      }
      if (studentId2) {
        roomService.removeFromQueue(studentId2);
        io.to(studentId2).emit('request-screen-share', { teacherId: socket.id, isDual: true });
      }
      emitPresentationQueue(io);
    });

    socket.on('teacher-take-down-student', (studentId) => {
      if (socket.id !== roomService.getTeacher()) return;
      roomService.updateSharingState(studentId, false);
      emitStudentListToTeacher(io);
      io.to(studentId).emit('teacher-forced-take-down', {});
      io.emit('user-stopped-sharing', { senderId: studentId });
    });

    // Yêu cầu học sinh chia sẻ màn hình
    socket.on('teacher-request-share', (studentId) => {
      if (socket.id !== roomService.getTeacher()) return;
      io.to(studentId).emit('request-screen-share', { teacherId: socket.id });
    });

    // Học sinh phản hồi đồng ý/từ chối chia sẻ
    socket.on('student-response-share', (data) => {
      const { accepted } = data || {};
      const teacherId = roomService.getTeacher();
      if (teacherId) {
        io.to(teacherId).emit('student-share-response', {
          studentId: socket.id,
          studentName: socket.userName || 'Học sinh',
          accepted
        });
      }
    });

    // Trình chiếu màn hình Giáo viên cho cả lớp
    socket.on('teacher-start-broadcast', () => {
      if (socket.id !== roomService.getTeacher()) return;
      socket.broadcast.emit('teacher-broadcasting-started', { teacherId: socket.id });
    });

    socket.on('teacher-stop-broadcast', () => {
      if (socket.id !== roomService.getTeacher()) return;
      socket.broadcast.emit('teacher-broadcasting-stopped');
    });

    socket.on('student-request-broadcast', () => {
      const teacherId = roomService.getTeacher();
      if (teacherId) {
        io.to(teacherId).emit('student-needs-broadcast', { studentId: socket.id });
      }
    });

    // Laser pointer
    socket.on('laser-pointer-move', (posData) => {
      if (socket.id === roomService.getTeacher()) {
        socket.broadcast.emit('update-laser-pointer', posData);
      }
    });

    // Signaling WebRTC Mesh (Offer, Answer, ICE Candidate)
    socket.on('signal', (data) => {
      const { targetId, signalData } = data || {};
      if (targetId) {
        const senderName = socket.id === roomService.getTeacher() ? 'Giáo viên' : (socket.userName || 'Học sinh');
        io.to(targetId).emit('signal', {
          senderId: socket.id,
          senderName,
          signalData
        });
      }
    });

    // Dừng chia sẻ màn hình
    socket.on('stop-sharing', () => {
      roomService.updateSharingState(socket.id, false);
      roomService.removeFromQueue(socket.id);
      emitStudentListToTeacher(io);
      emitPresentationQueue(io);
      socket.broadcast.emit('user-stopped-sharing', { senderId: socket.id });
    });

    // Xử lý Ngắt kết nối
    socket.on('disconnect', () => {
      console.log(`[-] Ngắt kết nối: ${socket.id}`);
      if (socket.id === roomService.getTeacher()) {
        roomService.removeTeacher();
        io.emit('teacher-status', { online: false });
      } else {
        const removed = roomService.removeStudent(socket.id);
        if (removed) {
          emitStudentListToTeacher(io);
          emitPresentationQueue(io);
        }
      }
    });
  });
};
