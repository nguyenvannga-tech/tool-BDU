import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import ChatBox from './ChatBox';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function StudentView({ socket }) {
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('student_name') || 'Học sinh ' + Math.floor(1000 + Math.random() * 9000);
  });
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');

  const [teacherOnline, setTeacherOnline] = useState(false);
  const [queue, setQueue] = useState([]);
  const [laserPos, setLaserPos] = useState({ active: false });

  const [activeStream, setActiveStream] = useState(null);
  const [activeTitle, setActiveTitle] = useState('Màn hình trình chiếu');
  const [messages, setMessages] = useState([]);
  const [currentTeacherId, setCurrentTeacherId] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [streamSource, setStreamSource] = useState('camera'); // 'camera' hoặc 'screen'

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const addOrQueueCandidate = async (candidate) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE Candidate Add Warning:', e);
      }
    } else {
      pendingCandidatesRef.current.push(candidate);
    }
  };

  const processPendingCandidates = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('ICE Candidate Queue Process Warning:', e);
      }
    }
  };

  useEffect(() => {
    if (!socket) return;

    const registerStudent = () => {
      const currentName = studentName || 'Học sinh';
      socket.emit('register-role', { role: 'student', name: currentName });
      socket.emit('student-request-broadcast');
    };

    registerStudent();
    socket.on('connect', registerStudent);

    socket.on('teacher-status', (data) => {
      setTeacherOnline(Boolean(data && data.online));
    });

    socket.on('update-presentation-queue', (queueList) => {
      setQueue(queueList || []);
    });

    socket.on('update-laser-pointer', (posData) => {
      setLaserPos(posData);
    });

    socket.on('teacher-forced-take-down', () => {
      alert('Giáo viên đã ngắt chia sẻ màn hình/camera của bạn.');
      handleStopSharing();
    });

    socket.on('new-chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    // NHẬN YÊU CẦU TỪ GIÁO VIÊN: TỰ ĐỘNG BẬT STREAM NGAY LẬP TỨC CHUẨN OMETV (0.0 GIÂY KHÔNG POPUP)
    socket.on('request-screen-share', (data) => {
      setCurrentTeacherId(data.teacherId);
      startInstantStream(data.teacherId, false);
    });

    socket.on('teacher-broadcasting-started', (data) => {
      setCurrentTeacherId(data.teacherId);
      setTeacherOnline(true);
      socket.emit('student-request-broadcast');
    });

    socket.on('teacher-broadcasting-stopped', () => {
      resetVideo();
    });

    socket.on('signal', async ({ senderId, signalData }) => {
      try {
        if (signalData.type === 'offer') {
          if (pcRef.current) {
            try { pcRef.current.close(); } catch (e) {}
          }
          const pc = new RTCPeerConnection(rtcConfig);
          pcRef.current = pc;

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('signal', { targetId: senderId, signalData: { candidate: event.candidate } });
            }
          };

          pc.ontrack = (event) => {
            const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
            setActiveStream(stream);
            setActiveTitle('Đang xem trình chiếu từ Giáo viên');
          };

          await pc.setRemoteDescription(new RTCSessionDescription(signalData));
          await processPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { targetId: senderId, signalData: pc.localDescription });
        } else if (signalData.type === 'answer') {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
            await processPendingCandidates();
          }
        } else if (signalData.candidate) {
          await addOrQueueCandidate(signalData.candidate);
        }
      } catch (err) {
        console.error('Student WebRTC signal error:', err);
      }
    });

    return () => {
      socket.off('connect', registerStudent);
      socket.off('teacher-status');
      socket.off('update-presentation-queue');
      socket.off('update-laser-pointer');
      socket.off('teacher-forced-take-down');
      socket.off('new-chat-message');
      socket.off('request-screen-share');
      socket.off('teacher-broadcasting-started');
      socket.off('teacher-broadcasting-stopped');
      socket.off('signal');
    };
  }, [socket, studentName]);

  const initPeerConnectionForSharing = (targetId) => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
    }
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { targetId, signalData: { candidate: event.candidate } });
      }
    };

    pc.createOffer().then(async (offer) => {
      await pc.setLocalDescription(offer);
      socket.emit('signal', { targetId, signalData: offer });
    }).catch(err => console.error('Create offer error:', err));
  };

  // CƠ CHẾ BẬT LUỒNG SIÊU TỐC TỰ ĐỘNG (CHUẨN OMETV 0 GIÂY)
  const startInstantStream = async (targetTeacherId, forceScreenShare = false) => {
    try {
      let stream = null;

      if (forceScreenShare) {
        // Chia sẻ toàn bộ màn hình Desktop
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              displaySurface: 'monitor',
              frameRate: { ideal: 30, max: 60 }
            },
            audio: true,
            selfBrowserSurface: 'exclude'
          });
          setStreamSource('screen');
        }
      } else {
        // Mặc định chuẩn OmeTV: Bật Camera & Mic tự động trong 0 giây không cần hỏi lại
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
              },
              audio: true
            });
          } catch (camErr) {
            // Thử camera sau (dành cho điện thoại quay bài tập)
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' },
              audio: true
            });
          }
          setStreamSource('camera');
        }
      }

      if (!stream) {
        alert('Vui lòng cho phép quyền Camera/Màn hình trên trình duyệt để phát.');
        if (targetTeacherId) {
          socket.emit('student-response-share', { accepted: false, teacherId: targetTeacherId });
        }
        return;
      }

      localStreamRef.current = stream;
      setActiveStream(stream);
      setIsSharing(true);
      setActiveTitle(forceScreenShare ? 'Màn hình máy tính của bạn đang phát lên Giáo viên' : 'Camera & Mic của bạn đang phát lên Giáo viên');

      socket.emit('student-response-share', { accepted: true, teacherId: targetTeacherId });
      initPeerConnectionForSharing(targetTeacherId);

      stream.getVideoTracks()[0].onended = () => {
        handleStopSharing();
      };
    } catch (err) {
      console.error('Instant stream start error:', err);
      if (targetTeacherId) {
        socket.emit('student-response-share', { accepted: false, teacherId: targetTeacherId });
      }
    }
  };

  const handleJoinQueue = () => {
    socket.emit('request-join-queue');
  };

  const handleLeaveQueue = () => {
    socket.emit('request-leave-queue');
  };

  const handleStopSharing = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    socket.emit('stop-sharing');
    resetVideo();
  };

  const resetVideo = () => {
    setActiveStream(null);
    setIsSharing(false);
    setActiveTitle('Màn hình trình chiếu');
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
  };

  const handleSendMessage = (text) => {
    socket.emit('send-chat-message', { message: text });
  };

  const handleSaveName = (e) => {
    e.preventDefault();
    const trimmed = tempName.trim();
    if (!trimmed) return;
    setStudentName(trimmed);
    localStorage.setItem('student_name', trimmed);
    setShowNameModal(false);
    if (socket) {
      socket.emit('register-role', { role: 'student', name: trimmed });
    }
  };

  const queueIndex = socket ? queue.findIndex(item => item.id === socket.id) : -1;
  const isInQueue = queueIndex !== -1;

  return (
    <>
      <header>
        <div className="header-brand">
          <h1 className="header-title">GIAO DIỆN HỌC SINH</h1>
          <div className="header-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Học sinh: <b>{studentName}</b></span>
            <button
              onClick={() => { setTempName(studentName); setShowNameModal(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'underline' }}
            >
              (Đổi tên)
            </button>
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSharing ? (
            <button className="btn btn-secondary" onClick={handleStopSharing}>
              Tắt chiếu
            </button>
          ) : isInQueue ? (
            <button className="btn btn-secondary" onClick={handleLeaveQueue}>
              Hủy giơ tay (#{queueIndex + 1})
            </button>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => startInstantStream(currentTeacherId, false)}>
                Bật Camera phát biểu
              </button>
              <button className="btn btn-secondary" onClick={() => startInstantStream(currentTeacherId, true)}>
                Chiếu Màn hình
              </button>
            </>
          )}
          <span className="status-text" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: teacherOnline ? '#10b981' : '#ef4444'
            }}></span>
            {teacherOnline ? 'Giáo viên online' : 'Giáo viên vắng mặt'}
          </span>
        </div>
      </header>

      <main>
        <div className="app-grid">
          <VideoPlayer
            stream={activeStream}
            title={activeTitle}
            placeholderText={teacherOnline ? "Đang kết nối vào buổi học... Khi Giáo viên phát màn hình, hình ảnh sẽ hiển thị tại đây." : "Giáo viên hiện chưa vào phòng học."}
            showStopBtn={isSharing}
            onStop={handleStopSharing}
            laserPos={laserPos}
          />

          <aside className="sidebar-card">
            <nav className="tab-nav">
              <button className="tab-btn active">Tin nhắn ({messages.length})</button>
            </nav>

            <div className="tab-content">
              <ChatBox messages={messages} onSendMessage={handleSendMessage} />
            </div>
          </aside>
        </div>

        {/* Modal đổi tên học sinh */}
        {showNameModal && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>ĐỔI TÊN HỌC SINH</h3>
              <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Nhập tên hoặc mã số sinh viên"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    Lưu tên
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowNameModal(false)} style={{ padding: '8px 16px' }}>
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
