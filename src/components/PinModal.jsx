import React, { useState } from 'react';

export default function PinModal({ isOpen, onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === '123456') {
      setError('');
      onSuccess();
    } else {
      setError('Mã PIN không chính xác. Mặc định: 123456');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>XÁC THỰC QUYỀN GIÁO VIÊN</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Nhập mã PIN để truy cập Bảng điều khiển Giáo viên:
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="password"
            className="chat-input"
            placeholder="Mã PIN (Mặc định: 123456)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '2px' }}
            autoFocus
          />

          {error && (
            <div style={{ color: '#000000', fontSize: '0.75rem', fontWeight: '600' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Xác nhận
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
