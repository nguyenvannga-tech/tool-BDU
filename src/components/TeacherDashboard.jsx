import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import ChatBox from './ChatBox';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function TeacherDashboard({ socket, onLogout }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('teacher_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [queue, setQueue] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeStream, setActiveStream] = useState(null);
  const [secondaryStream, setSecondaryStream] = useState(null);
  const [activeTitle, setActiveTitle] = useState('Màn hình trình chiếu');
  const [secondaryTitle, setSecondaryTitle] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [sharingStudent, setSharingStudent] = useState(null);
  const [isLaserEnabled, setIsLaserEnabled] = useState(false);
  const [laserPos, setLaserPos] = useState({ active: false });

  const peerConnectionsRef = useRef(new Map());
  const broadcastPeerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const studentsRef = useRef([]);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const addOrQueueCandidate = async (remoteId, pc, candidate) => {
    if (pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE Candidate Add Warning:', e);
      }
    } else {
      if (!pendingCandidatesRef.current.has(remoteId)) {
        pendingCandidatesRef.current.set(remoteId, []);
      }
      pendingCandidatesRef.current.get(remoteId).push(candidate);
    }
  };

  const processPendingCandidates = async (remoteId, pc) => {
    const queued = pendingCandidatesRef.current.get(remoteId) || [];
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('ICE Candidate Queue Process Warning:', e);
      }
    }
    pendingCandidatesRef.current.set(remoteId, []);
  };

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const registerTeacher = () => {
      socket.emit('register-role', { role: 'teacher', name: 'Giáo viên', pin: '123456' });
    };

    registerTeacher();
    socket.on('connect', registerTeacher);

    socket.on('update-student-list', (list) => {
      setStudents(list || []);

      if (localStreamRef.current) {
        (list || []).forEach(student => {
          if (!broadcastPeerConnectionsRef.current.has(student.id)) {
            connectAndSendTeacherStream(student.id);
          }
        });
      }
    });

    socket.on('student-needs-broadcast', ({ studentId }) => {
      if (localStreamRef.current) {
        connectAndSendTeacherStream(studentId);
      }
    });

    socket.on('update-presentation-queue', (queueList) => {
      setQueue(queueList || []);
    });

    socket.on('student-share-response', ({ studentId, studentName, accepted }) => {
      if (accepted) {
        alert(`Học sinh ${studentName} đã chấp nhận chia sẻ màn hình.`);
        setSharingStudent({ id: studentId, name: studentName });
        setActiveTitle(`Màn hình của học sinh: ${studentName}`);
      } else {
        alert(`Học sinh ${studentName} từ chối chia sẻ.`);
      }
    });

    socket.on('new-chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('signal', async ({ senderId, senderName, signalData }) => {
      // 1. Nhận OFFER từ học sinh chia sẻ màn hình / camera lên giáo viên
      if (signalData.type === 'offer') {
        let pc = peerConnectionsRef.current.get(senderId);
        if (pc) {
          try { pc.close(); } catch (e) {}
        }
        pc = createReceivingPeerConnection(senderId, senderName);
        peerConnectionsRef.current.set(senderId, pc);

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData));
          await processPendingCandidates(senderId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { targetId: senderId, signalData: pc.localDescription });
        } catch (err) {
          console.error('Error handling student screen share offer:', err);
        }
        return;
      }

      // 2. Nhận ANSWER từ học sinh khi giáo viên đang phát bài giảng
      if (signalData.type === 'answer' && broadcastPeerConnectionsRef.current.has(senderId)) {
        const bPc = broadcastPeerConnectionsRef.current.get(senderId);
        try {
          await bPc.setRemoteDescription(new RTCSessionDescription(signalData));
          await processPendingCandidates(senderId, bPc);
        } catch (err) {
          console.warn('Broadcaster signal handling warning:', err);
        }
        return;
      }

      // 3. Nhận ICE Candidate
      if (signalData.candidate) {
        if (peerConnectionsRef.current.has(senderId)) {
          const pc = peerConnectionsRef.current.get(senderId);
          await addOrQueueCandidate(senderId, pc, signalData.candidate);
        } else if (broadcastPeerConnectionsRef.current.has(senderId)) {
          const bPc = broadcastPeerConnectionsRef.current.get(senderId);
          await addOrQueueCandidate(senderId, bPc, signalData.candidate);
        }
        return;
      }
    });

    socket.on('user-stopped-sharing', ({ senderId }) => {
      if (sharingStudent && sharingStudent.id === senderId) {
        alert(`Học sinh ${sharingStudent.name} đã dừng chia sẻ màn hình.`);
        resetVideo();
      }
    });

    return () => {
      socket.off('connect', registerTeacher);
      socket.off('update-student-list');
      socket.off('student-needs-broadcast');
      socket.off('update-presentation-queue');
      socket.off('student-share-response');
      socket.off('new-chat-message');
      socket.off('signal');
      socket.off('user-stopped-sharing');
    };
  }, [socket, isAuthenticated, sharingStudent]);

  const handleLogin = (e) => {
    e.preventDefault();
    const trimmed = pinInput.trim();
    if (trimmed === '123456') {
      sessionStorage.setItem('teacher_auth', 'true');
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Mã PIN không chính xác! (Mã PIN mặc định: 123456)');
    }
  };

  const handleLogoutTeacher = () => {
    sessionStorage.removeItem('teacher_auth');
    setIsAuthenticated(false);
    if (isBroadcasting) {
      handleStopBroadcast();
    }
    if (onLogout) {
      onLogout();
    }
  };

  const handleLaserMove = (posData) => {
    setLaserPos(posData);
    if (socket) {
      socket.emit('laser-pointer-move', posData);
    }
  };

  const createReceivingPeerConnection = (remoteId, remoteName) => {
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { targetId: remoteId, signalData: { candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
      if (!activeStream) {
        setActiveStream(stream);
      } else {
        setSecondaryStream(stream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (['disconnected', 'closed', 'failed'].includes(pc.iceConnectionState)) {
        resetVideo();
      }
    };

    return pc;
  };

  const handleInviteStudent = (studentId, studentName) => {
    if (window.confirm(`Gửi yêu cầu học sinh "${studentName}" chia sẻ màn hình?`)) {
      socket.emit('teacher-request-share', studentId);
    }
  };

  const handleApproveQueueStudent = (studentId) => {
    socket.emit('teacher-approve-queue-student', studentId);
  };

  const handleApproveDualStream = () => {
    if (queue.length < 2) {
      alert('Cần có ít nhất 2 sinh viên trong hàng đợi giơ tay để chia đôi màn hình so sánh!');
      return;
    }
    const student1 = queue[0];
    const student2 = queue[1];
    if (window.confirm(`Cho chiếu song song 2 màn hình của "${student1.name}" và "${student2.name}"?`)) {
      setActiveTitle(`Màn hình 1: ${student1.name}`);
      setSecondaryTitle(`Màn hình 2: ${student2.name}`);
      socket.emit('teacher-approve-dual-stream', { studentId1: student1.id, studentId2: student2.id });
    }
  };

  const handleTakeDownStudent = (studentId) => {
    socket.emit('teacher-take-down-student', studentId);
    resetVideo();
  };

  const handleStartBroadcast = async () => {
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor',
            frameRate: { ideal: 30, max: 60 }
          },
          audio: true,
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include'
        });
      } catch (aErr) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: false,
          selfBrowserSurface: 'exclude'
        });
      }

      localStreamRef.current = stream;
      setActiveStream(stream);
      setIsBroadcasting(true);
      setActiveTitle('Đang phát màn hình Giáo viên cho cả lớp');

      socket.emit('teacher-start-broadcast');

      studentsRef.current.forEach(student => {
        connectAndSendTeacherStream(student.id);
      });

      stream.getVideoTracks()[0].onended = () => {
        handleStopBroadcast();
      };
    } catch (err) {
      console.error('Broadcast error:', err);
    }
  };

  const connectAndSendTeacherStream = async (studentId) => {
    if (!localStreamRef.current) return;
    
    if (broadcastPeerConnectionsRef.current.has(studentId)) {
      try {
        broadcastPeerConnectionsRef.current.get(studentId).close();
      } catch (e) {}
      broadcastPeerConnectionsRef.current.delete(studentId);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    broadcastPeerConnectionsRef.current.set(studentId, pc);

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { targetId: studentId, signalData: { candidate: event.candidate } });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { targetId: studentId, signalData: offer });
    } catch (err) {
      console.error('Error creating broadcast offer for student:', studentId, err);
    }
  };

  const handleStopBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    socket.emit('teacher-stop-broadcast');
    broadcastPeerConnectionsRef.current.forEach(pc => {
      try { pc.close(); } catch (e) {}
    });
    broadcastPeerConnectionsRef.current.clear();
    resetVideo();
  };

  const resetVideo = () => {
    setActiveStream(null);
    setSecondaryStream(null);
    setIsBroadcasting(false);
    setSharingStudent(null);
    setActiveTitle('Màn hình trình chiếu');
    setSecondaryTitle('');
    peerConnectionsRef.current.forEach(pc => {
      try { pc.close(); } catch (e) {}
    });
    peerConnectionsRef.current.clear();
  };

  const handleSendMessage = (text) => {
    socket.emit('send-chat-message', { message: text });
  };

  // MÀN HÌNH NHẬP MÃ PIN CHO GIÁO VIÊN NẾU CHƯA XÁC THỰC
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header>
          <div className="header-brand">
            <h1 className="header-title">BẢNG ĐIỀU KHIỂN GIÁO VIÊN</h1>
            <div className="header-subtitle">Phòng học LAN (lophoc.local)</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={onLogout}>
              Về trang Học sinh
            </button>
          </div>
        </header>

        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="modal-content" style={{ maxWidth: '380px', width: '90%', margin: 'auto' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700' }}>XÁC THỰC GIÁO VIÊN</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Vui lòng nhập mã PIN quản trị viên để mở bảng điều khiển lớp học.
            </p>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <input
                type="password"
                className="chat-input"
                placeholder="Nhập mã PIN (Mặc định: 123456)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
              />
              {authError && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '600' }}>
                  {authError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px' }}>
                  Đăng Nhập
                </button>
                <button type="button" className="btn btn-secondary" onClick={onLogout} style={{ padding: '10px 16px' }}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // GIAO DIỆN BẢNG ĐIỀU KHIỂN GIÁO VIÊN KHI ĐÃ NHẬP PIN
  return (
    <>
      <header>
        <div className="header-brand">
          <h1 className="header-title">BẢNG ĐIỀU KHIỂN GIÁO VIÊN</h1>
          <div className="header-subtitle">Phòng học LAN (lophoc.local)</div>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${isLaserEnabled ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setIsLaserEnabled(!isLaserEnabled)}
          >
            {isLaserEnabled ? 'Laser chỉ điểm: BẬT' : 'Laser chỉ điểm: TẮT'}
          </button>
          {sharingStudent && (
            <button className="btn btn-secondary" onClick={() => handleTakeDownStudent(sharingStudent.id)}>
              Hạ xuống (Tắt chiếu)
            </button>
          )}
          <button className="btn btn-primary" onClick={handleStartBroadcast}>
            Phát Màn Hình
          </button>
          <button className="btn btn-secondary" onClick={handleLogoutTeacher}>
            Thoát
          </button>
        </div>
      </header>

      <main>
        <div className="app-grid">
          <VideoPlayer
            stream={activeStream}
            secondaryStream={secondaryStream}
            title={activeTitle}
            secondaryTitle={secondaryTitle}
            placeholderText="Bấm 'Phát Màn Hình' hoặc chọn 'Cho chiếu màn hình' trong danh sách giơ tay."
            showStopBtn={activeStream !== null}
            onStop={isBroadcasting ? handleStopBroadcast : (sharingStudent ? () => handleTakeDownStudent(sharingStudent.id) : resetVideo)}
            laserPos={laserPos}
            isLaserEnabled={isLaserEnabled}
            onLaserMove={handleLaserMove}
          />

          <aside className="sidebar-card">
            <nav className="tab-nav">
              <button
                className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                Sinh viên ({students.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
                onClick={() => setActiveTab('queue')}
              >
                Giơ tay ({queue.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                Tin nhắn ({messages.length})
              </button>
            </nav>

            <div className="tab-content">
              {activeTab === 'students' ? (
                <ul className="user-list">
                  {students.length === 0 ? (
                    <li style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '1rem 0' }}>
                      Chưa có sinh viên trong lớp...
                    </li>
                  ) : (
                    students.map(s => (
                      <li key={s.id} className="user-item">
                        <span style={{ fontWeight: '500' }}>{s.name}</span>
                        {sharingStudent && sharingStudent.id === s.id ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleTakeDownStudent(s.id)}>
                            Hạ xuống
                          </button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => handleInviteStudent(s.id, s.name)}>
                            Mời chia sẻ
                          </button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              ) : activeTab === 'queue' ? (
                <div>
                  {queue.length >= 2 && (
                    <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handleApproveDualStream}>
                        So sánh song song 2 bài đầu tiên
                      </button>
                    </div>
                  )}
                  <ul className="user-list">
                    {queue.length === 0 ? (
                      <li style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '1rem 0' }}>
                        Không có sinh viên nào giơ tay xin chiếu...
                      </li>
                    ) : (
                      queue.map((q, idx) => (
                        <li key={q.id} className="user-item">
                          <div>
                            <span style={{ fontWeight: '600', marginRight: '6px' }}>#{idx + 1}</span>
                            <span>{q.name}</span>
                          </div>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApproveQueueStudent(q.id)}>
                            Cho chiếu màn hình
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : (
                <ChatBox messages={messages} onSendMessage={handleSendMessage} />
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
