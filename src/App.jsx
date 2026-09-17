import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import TeacherDashboard from './components/TeacherDashboard';
import StudentView from './components/StudentView';

const socket = io({
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  autoConnect: true
});

export default function App() {
  const [role, setRole] = useState(() => {
    return window.location.pathname.includes('/teacher') ? 'teacher' : 'student';
  });

  useEffect(() => {
    const handlePopState = () => {
      setRole(window.location.pathname.includes('/teacher') ? 'teacher' : 'student');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogoutTeacher = () => {
    setRole('student');
    window.history.replaceState({}, '', '/');
  };

  return (
    <>
      {role === 'teacher' ? (
        <TeacherDashboard socket={socket} onLogout={handleLogoutTeacher} />
      ) : (
        <StudentView socket={socket} />
      )}
    </>
  );
}

