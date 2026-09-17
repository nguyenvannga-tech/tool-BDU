const socket = io();

const studentListEl = document.getElementById('studentList');
const studentCountEl = document.getElementById('studentCount');
const remoteVideo = document.getElementById('remoteVideo');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const videoContainer = document.getElementById('videoContainer');
const overlayControls = document.getElementById('overlayControls');
const activeStreamTitle = document.getElementById('activeStreamTitle');
const btnBroadcast = document.getElementById('btnBroadcast');
const btnStopStream = document.getElementById('btnStopStream');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnOverlayFullscreen = document.getElementById('btnOverlayFullscreen');
const mirrorNotice = document.getElementById('mirrorNotice');

const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');
const chatMessages = document.getElementById('chatMessages');

let peerConnections = new Map();
let broadcastPeerConnections = new Map();
let localTeacherStream = null;
let currentStudentsList = [];
let currentActiveSharingStudent = null;

socket.on('connect', () => {
  console.log('[+] Socket kết nối thành công:', socket.id);
  socket.emit('register-role', { role: 'teacher', name: 'Giáo viên' });
});

socket.on('teacher-registered', () => {
  console.log('[✓] Đã đăng ký vai trò Giáo viên.');
});

socket.on('update-student-list', (students) => {
  currentStudentsList = students;
  studentCountEl.textContent = students.length;
  studentListEl.innerHTML = '';

  if (students.length === 0) {
    studentListEl.innerHTML = '<li class="student-item" style="justify-content:center; color:#94a3b8;">Chưa có học sinh nào vào lớp...</li>';
    return;
  }

  students.forEach((student) => {
    const li = document.createElement('li');
    li.className = 'student-item';
    li.innerHTML = `
      <div class="student-info">
        <span class="status-dot"></span>
        <span>${escapeHtml(student.name)}</span>
        ${student.isSharing ? '<span class="badge badge-sharing">Đang chia sẻ</span>' : ''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="inviteStudentShare('${student.id}', '${escapeHtml(student.name)}')">
        📢 Mời chia sẻ
      </button>
    `;
    studentListEl.appendChild(li);

    if (localTeacherStream && !broadcastPeerConnections.has(student.id)) {
      connectAndSendTeacherStreamToStudent(student.id);
    }
  });
});

window.inviteStudentShare = function(studentId, studentName) {
  if (confirm(`Bạn có muốn gửi yêu cầu học sinh "${studentName}" chia sẻ màn hình không?`)) {
    socket.emit('teacher-request-share', studentId);
    alert(`Đã gửi yêu cầu tới ${studentName}. Đang chờ phản hồi...`);
  }
};

socket.on('student-share-response', (data) => {
  const { studentId, studentName, accepted } = data;
  if (accepted) {
    alert(`[✓] Học sinh ${studentName} ĐÃ ĐỒNG Ý chia sẻ! Đang nhận hình ảnh...`);
    currentActiveSharingStudent = { id: studentId, name: studentName };
    activeStreamTitle.textContent = `Màn hình của Học sinh: ${studentName}`;
  } else {
    alert(`[X] Học sinh ${studentName} từ chối chia sẻ màn hình.`);
  }
});

// Chat Realtime
btnSendChat.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('send-chat-message', { message: text });
  chatInput.value = '';
}

socket.on('new-chat-message', (data) => {
  if (chatMessages.children.length === 1 && chatMessages.children[0].textContent.includes('Chưa có bình luận')) {
    chatMessages.innerHTML = '';
  }

  const isTeacher = data.role === 'teacher';
  const div = document.createElement('div');
  div.className = `chat-bubble ${isTeacher ? 'chat-bubble-teacher' : ''}`;
  div.innerHTML = `
    <div class="chat-header-info">
      <span>${escapeHtml(data.senderName)} ${isTeacher ? '(Giáo viên)' : ''}</span>
      <span class="chat-time">${data.time}</span>
    </div>
    <div class="chat-text">${escapeHtml(data.message)}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Phóng Toàn Màn Hình (Fullscreen)
btnFullscreen.addEventListener('click', toggleFullscreen);
btnOverlayFullscreen.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleFullscreen();
});
videoContainer.addEventListener('dblclick', toggleFullscreen);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (videoContainer.requestFullscreen) {
      videoContainer.requestFullscreen();
    } else if (videoContainer.webkitRequestFullscreen) {
      videoContainer.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

socket.on('signal', async (data) => {
  const { senderId, senderName, signalData } = data;

  if (broadcastPeerConnections.has(senderId)) {
    const bPc = broadcastPeerConnections.get(senderId);
    if (signalData.type === 'answer') {
      await bPc.setRemoteDescription(new RTCSessionDescription(signalData));
    } else if (signalData.candidate) {
      try {
        await bPc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      } catch (e) {
        console.error('Lỗi ICE Candidate:', e);
      }
    }
    return;
  }

  let pc = peerConnections.get(senderId);
  if (!pc) {
    pc = createPeerConnectionForReceivingStudent(senderId, senderName);
    peerConnections.set(senderId, pc);
  }

  if (signalData.type === 'offer') {
    await pc.setRemoteDescription(new RTCSessionDescription(signalData));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('signal', {
      targetId: senderId,
      signalData: pc.localDescription
    });
  } else if (signalData.type === 'answer') {
    await pc.setRemoteDescription(new RTCSessionDescription(signalData));
  } else if (signalData.candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
    } catch (e) {
      console.error('Lỗi ICE Candidate:', e);
    }
  }
});

function createPeerConnectionForReceivingStudent(remoteId, remoteName) {
  const pc = new RTCPeerConnection(rtcConfig);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', {
        targetId: remoteId,
        signalData: { candidate: event.candidate }
      });
    }
  };

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.style.display = 'block';
    videoPlaceholder.style.display = 'none';
    overlayControls.style.display = 'block';
    btnStopStream.style.display = 'inline-flex';
  };

  pc.oniceconnectionstatechange = () => {
    if (['disconnected', 'closed', 'failed'].includes(pc.iceConnectionState)) {
      resetVideoView();
    }
  };

  return pc;
}

btnBroadcast.addEventListener('click', async () => {
  try {
    try {
      localTeacherStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });
    } catch (aErr) {
      localTeacherStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
    }

    remoteVideo.srcObject = localTeacherStream;
    remoteVideo.style.display = 'block';
    videoPlaceholder.style.display = 'none';
    overlayControls.style.display = 'block';
    mirrorNotice.style.display = 'block';
    activeStreamTitle.textContent = 'Màn hình của Giáo viên (Đang phát trực tiếp cho cả lớp)';
    btnStopStream.style.display = 'inline-flex';

    socket.emit('teacher-start-broadcast');

    currentStudentsList.forEach(student => {
      connectAndSendTeacherStreamToStudent(student.id);
    });

    localTeacherStream.getVideoTracks()[0].onended = () => {
      stopTeacherBroadcast();
    };
  } catch (err) {
    console.error('Lỗi trình chiếu:', err);
    alert('Không thể mở cửa sổ chọn màn hình trình chiếu: ' + err.message);
  }
});

function connectAndSendTeacherStreamToStudent(studentId) {
  if (!localTeacherStream) return;

  const pc = new RTCPeerConnection(rtcConfig);
  broadcastPeerConnections.set(studentId, pc);

  localTeacherStream.getTracks().forEach(track => {
    pc.addTrack(track, localTeacherStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', {
        targetId: studentId,
        signalData: { candidate: event.candidate }
      });
    }
  };

  pc.createOffer().then(offer => {
    pc.setLocalDescription(offer);
    socket.emit('signal', {
      targetId: studentId,
      signalData: offer
    });
  }).catch(e => console.error('Lỗi tạo Offer broadcast:', e));
}

btnStopStream.addEventListener('click', () => {
  if (localTeacherStream) {
    stopTeacherBroadcast();
  } else {
    resetVideoView();
    socket.emit('stop-sharing');
  }
});

function stopTeacherBroadcast() {
  if (localTeacherStream) {
    localTeacherStream.getTracks().forEach(track => track.stop());
    localTeacherStream = null;
  }
  socket.emit('teacher-stop-broadcast');
  broadcastPeerConnections.forEach(pc => pc.close());
  broadcastPeerConnections.clear();
  resetVideoView();
}

function resetVideoView() {
  remoteVideo.srcObject = null;
  remoteVideo.style.display = 'none';
  videoPlaceholder.style.display = 'flex';
  overlayControls.style.display = 'none';
  mirrorNotice.style.display = 'none';
  activeStreamTitle.textContent = 'Chưa có màn hình được phát';
  btnStopStream.style.display = 'none';
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();
}

socket.on('user-stopped-sharing', (data) => {
  if (currentActiveSharingStudent && currentActiveSharingStudent.id === data.senderId) {
    alert(`Học sinh ${currentActiveSharingStudent.name} đã dừng chia sẻ màn hình.`);
    resetVideoView();
  }
});

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
