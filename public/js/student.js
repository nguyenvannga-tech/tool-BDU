const socket = io();

// DOM elements
const loginContainer = document.getElementById('loginContainer');
const studentDashboard = document.getElementById('studentDashboard');
const studentNameInput = document.getElementById('studentNameInput');
const btnJoinClass = document.getElementById('btnJoinClass');
const displayNameEl = document.getElementById('displayName');
const teacherStatusBadge = document.getElementById('teacherStatusBadge');

const shareModal = document.getElementById('shareModal');
const btnAcceptShare = document.getElementById('btnAcceptShare');
const btnDeclineShare = document.getElementById('btnDeclineShare');

const studentVideoContainer = document.getElementById('studentVideoContainer');
const studentVideo = document.getElementById('studentVideo');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const videoContainer = document.getElementById('videoContainer');
const overlayControls = document.getElementById('overlayControls');
const activeStreamTitle = document.getElementById('activeStreamTitle');
const btnStopShareStudent = document.getElementById('btnStopShareStudent');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnOverlayFullscreen = document.getElementById('btnOverlayFullscreen');

const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');
const chatMessages = document.getElementById('chatMessages');

let studentName = '';
let localStream = null;
let currentTeacherId = null;
let pc = null;

btnJoinClass.addEventListener('click', joinClass);
studentNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinClass();
});

function joinClass() {
  const name = studentNameInput.value.trim();
  if (!name) {
    alert('Vui lòng nhập Tên hoặc Mã số Học sinh của bạn!');
    return;
  }
  studentName = name;
  displayNameEl.textContent = studentName;

  socket.emit('register-role', { role: 'student', name: studentName });

  loginContainer.style.display = 'none';
  studentDashboard.style.display = 'grid';
}

socket.on('student-registered', () => {
  console.log('[✓] Đã tham gia lớp học thành công.');
});

socket.on('teacher-status', (data) => {
  if (data.online) {
    teacherStatusBadge.className = 'badge badge-online';
    teacherStatusBadge.innerHTML = '<span class="status-dot"></span> Giáo viên đang online';
  } else {
    teacherStatusBadge.className = 'badge badge-offline';
    teacherStatusBadge.innerHTML = '<span class="status-dot"></span> Giáo viên vắng mặt';
  }
});

// Chat Realtime phía Học sinh
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

socket.on('request-screen-share', (data) => {
  currentTeacherId = data.teacherId;
  shareModal.classList.add('active');
});

btnDeclineShare.addEventListener('click', () => {
  shareModal.classList.remove('active');
  if (currentTeacherId) {
    socket.emit('student-response-share', { accepted: false, teacherId: currentTeacherId });
  }
});

btnAcceptShare.addEventListener('click', async () => {
  shareModal.classList.remove('active');

  try {
    try {
      localStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });
    } catch (aErr) {
      localStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
    }

    socket.emit('student-response-share', {
      accepted: true,
      teacherId: currentTeacherId
    });

    studentVideo.srcObject = localStream;
    studentVideo.style.display = 'block';
    videoPlaceholder.style.display = 'none';
    overlayControls.style.display = 'block';
    activeStreamTitle.textContent = 'Màn hình của bạn đang được chia sẻ với Giáo viên';
    btnStopShareStudent.style.display = 'inline-flex';

    initWebRTCConnection(currentTeacherId, true);

    localStream.getVideoTracks()[0].onended = () => {
      stopScreenSharing();
    };

  } catch (err) {
    console.error('Lỗi chia sẻ màn hình:', err);
    alert('Không thể mở màn hình chia sẻ: ' + err.message);
    if (currentTeacherId) {
      socket.emit('student-response-share', { accepted: false, teacherId: currentTeacherId });
    }
  }
});

btnStopShareStudent.addEventListener('click', stopScreenSharing);

function stopScreenSharing() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  socket.emit('stop-sharing');
  resetStudentVideo();
}

function resetStudentVideo() {
  studentVideo.srcObject = null;
  studentVideo.style.display = 'none';
  videoPlaceholder.style.display = 'flex';
  overlayControls.style.display = 'none';
  activeStreamTitle.textContent = 'Chưa có hoạt động chia sẻ màn hình';
  btnStopShareStudent.style.display = 'none';
  if (pc) {
    pc.close();
    pc = null;
  }
}

function initWebRTCConnection(targetId, isOffer) {
  if (pc) {
    pc.close();
  }
  pc = new RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', {
        targetId: targetId,
        signalData: { candidate: event.candidate }
      });
    }
  };

  pc.ontrack = (event) => {
    studentVideo.srcObject = event.streams[0];
    studentVideo.style.display = 'block';
    videoPlaceholder.style.display = 'none';
    overlayControls.style.display = 'block';
    activeStreamTitle.textContent = '📺 ĐANG XEM MÀN HÌNH TRÌNH CHIẾU TỪ GIÁO VIÊN';
  };

  if (isOffer) {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('signal', {
        targetId: targetId,
        signalData: offer
      });
    });
  }
}

socket.on('signal', async (data) => {
  const { senderId, signalData } = data;

  if (!pc) {
    initWebRTCConnection(senderId, false);
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
      console.error('Lỗi thêm ICE Candidate:', e);
    }
  }
});

socket.on('teacher-broadcasting-started', (data) => {
  currentTeacherId = data.teacherId;
});

socket.on('teacher-broadcasting-stopped', () => {
  alert('📢 Giáo viên đã kết thúc trình chiếu.');
  resetStudentVideo();
});

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
