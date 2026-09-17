import React, { useRef, useEffect } from 'react';

export default function VideoPlayer({
  stream,
  secondaryStream,
  title,
  secondaryTitle,
  placeholderText,
  showStopBtn,
  onStop,
  laserPos,
  isLaserEnabled,
  onLaserMove
}) {
  const videoRef = useRef(null);
  const secondaryVideoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(e => console.warn('Autoplay play error:', e));
        }
      });
    }
  }, [stream]);

  useEffect(() => {
    if (secondaryVideoRef.current && secondaryStream) {
      secondaryVideoRef.current.srcObject = secondaryStream;
      secondaryVideoRef.current.play().catch(() => {
        if (secondaryVideoRef.current) {
          secondaryVideoRef.current.muted = true;
          secondaryVideoRef.current.play().catch(e => console.warn('Secondary autoplay error:', e));
        }
      });
    }
  }, [secondaryStream]);

  const toggleFullscreen = () => {
    const video = videoRef.current;
    const container = containerRef.current;

    // 1. iPhone Safari specific: div.requestFullscreen is unsupported, must use video.webkitEnterFullscreen
    if (video && typeof video.webkitEnterFullscreen === 'function' && !container?.requestFullscreen && !container?.webkitRequestFullscreen) {
      video.webkitEnterFullscreen();
      return;
    }

    // 2. Standard Fullscreen API (Desktop, Android, iPad)
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (container && container.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        });
      } else if (container && container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (video && video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isLaserEnabled || !onLaserMove || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onLaserMove({ x, y, active: true });
  };

  const handleMouseLeave = () => {
    if (isLaserEnabled && onLaserMove) {
      onLaserMove({ active: false });
    }
  };

  return (
    <section className="stage-card">
      <div className="stage-header">
        <h2 className="stage-title">{title}</h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary btn-sm" onClick={toggleFullscreen}>
            Phóng toàn màn hình
          </button>
          {showStopBtn && (
            <button className="btn btn-danger btn-sm" onClick={onStop}>
              Dừng trình chiếu
            </button>
          )}
        </div>
      </div>

      <div
        className="video-frame"
        ref={containerRef}
        onDoubleClick={toggleFullscreen}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {!stream && !secondaryStream ? (
          <div className="stage-empty">
            <p>{placeholderText}</p>
          </div>
        ) : secondaryStream ? (
          <div style={{ display: 'flex', width: '100%', height: '100%', gap: '4px' }}>
            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => { videoRef.current && videoRef.current.play().catch(() => {}); }}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                {title}
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
              <video
                ref={secondaryVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => { secondaryVideoRef.current && secondaryVideoRef.current.play().catch(() => {}); }}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                {secondaryTitle || 'Màn hình 2'}
              </div>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => { videoRef.current && videoRef.current.play().catch(() => {}); }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <button className="overlay-btn" onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}>
              Phóng toàn màn hình
            </button>
          </>
        )}

        {/* Laser Pointer Overlay */}
        {laserPos && laserPos.active && (
          <div
            style={{
              position: 'absolute',
              top: `${laserPos.y * 100}%`,
              left: `${laserPos.x * 100}%`,
              width: '18px',
              height: '18px',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 12px 6px rgba(239, 68, 68, 0.8), 0 0 2px 1px #ffffff',
              pointerEvents: 'none',
              zIndex: 9999,
              transition: 'all 0.03s linear'
            }}
          />
        )}
      </div>
    </section>
  );
}
