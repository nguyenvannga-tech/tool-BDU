import React, { useState, useRef, useEffect } from 'react';

export default function ChatBox({ messages, onSendMessage }) {
  const [inputText, setInputText] = useState('');
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="chat-container">
      <div className="chat-history" ref={chatMessagesRef}>
        {messages.length === 0 ? (
          <div className="msg-bubble" style={{ textAlign: 'center', color: '#9ca3af' }}>
            Chưa có tin nhắn...
          </div>
        ) : (
          messages.map((msg, index) => {
            const isTeacher = msg.role === 'teacher';
            return (
              <div key={index} className={`msg-bubble ${isTeacher ? 'teacher' : ''}`}>
                <div className="msg-meta">
                  <span>{msg.senderName} {isTeacher ? '(Giáo viên)' : ''}</span>
                  <span>{msg.time}</span>
                </div>
                <div className="msg-text">{msg.message}</div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="chat-form">
        <input
          type="text"
          className="chat-input"
          placeholder="Nhập tin nhắn..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '8px 16px', minWidth: '60px' }}>
          Gửi
        </button>
      </form>
    </div>
  );
}
