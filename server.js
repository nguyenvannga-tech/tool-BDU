const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const selfsigned = require('selfsigned');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = require('./src/server/config/env.config');
const networkService = require('./src/server/services/network.service');
const roomService = require('./src/server/services/room.service');
const registerClassroomSocketHandlers = require('./src/server/sockets/classroom.socket');

const app = express();

// Middleware JSON
app.use(express.json());

// 1. Phục vụ ứng dụng React SPA Production Build (từ dist hoặc public)
if (fs.existsSync(config.PATHS.DIST)) {
  app.use(express.static(config.PATHS.DIST));
} else {
  app.use(express.static(config.PATHS.PUBLIC));
}

// 2. Health Check API Endpoint theo tiêu chuẩn Enterprise
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeStudents: roomService.getStudentList().length,
    isTeacherOnline: Boolean(roomService.getTeacher()),
    memory: {
      rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
      heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
      heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
    }
  });
});

// 3. SPA Fallback Routing
app.get('*', (req, res) => {
  if (fs.existsSync(path.join(config.PATHS.DIST, 'index.html'))) {
    res.sendFile(path.join(config.PATHS.DIST, 'index.html'));
  } else if (fs.existsSync(path.join(config.PATHS.PUBLIC, 'index.html'))) {
    res.sendFile(path.join(config.PATHS.PUBLIC, 'index.html'));
  } else {
    res.send('React App is building... Please run `npm run build` first.');
  }
});

// 4. Tạo chứng chỉ SSL 2048-bit tiêu chuẩn cho HTTPS
const attrs = [{ name: 'commonName', value: config.SSL.COMMON_NAME }];
const pki = selfsigned.generate(attrs, { days: config.SSL.DAYS, keySize: config.SSL.KEY_SIZE });
const credentials = { key: pki.private, cert: pki.cert };

// 5. Khởi chạy Server
networkService.findAvailablePort(config.DEFAULT_PORT, (err, port) => {
  if (err) {
    console.error('💥 Lỗi không tìm được cổng phù hợp:', err);
    process.exit(1);
  }

  const httpsPort = 8443;

  const httpServer = http.createServer(app);
  const httpsServer = https.createServer(credentials, app);

  const io = new Server({
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000
  });
  io.attach(httpServer);
  io.attach(httpsServer);

  // Đăng ký toàn bộ sự kiện Socket.IO
  registerClassroomSocketHandlers(io);

  httpServer.listen(port, '0.0.0.0', () => {
    httpsServer.listen(httpsPort, '0.0.0.0', () => {
      const localIps = networkService.getLocalIpAddresses();
      const primaryIp = localIps[0] || 'localhost';

      console.log('\n==================================================================');
      console.log('🚀 ENTERPRISE LAN CLASSROOM SERVER (DUAL HTTP & HTTPS SSL)');
      console.log('==================================================================');
      console.log(`👨‍🏫 CỔNG GIÁO VIÊN (Mã PIN 123456):        http://localhost:${port}/teacher`);
      console.log(`🎓 CỔNG HỌC SINH (HTTP thường):            http://${primaryIp}:${port}`);
      console.log(`🔒 CỔNG HỌC SINH (HTTPS - CẤP QUYỀN VĨNH VIỄN): https://${primaryIp}:${httpsPort}`);
      console.log('==================================================================\n');

      const startUrl = `http://localhost:${port}/teacher`;
      const startCmd = process.platform === 'win32' ? `start ${startUrl}` :
                       process.platform === 'darwin' ? `open ${startUrl}` : `xdg-open ${startUrl}`;

      exec(startCmd, (execErr) => {
        if (execErr) console.log(`[i] Sẵn sàng tại: ${startUrl}`);
      });
    });
  });

  // 6. Graceful Shutdown & Global Error Handlers (Tránh crash sập app)
  const gracefulShutdown = (signal) => {
    console.log(`\n[!] Nhận tín hiệu ${signal}. Đang dọn dẹp RAM và ngắt kết nối an toàn...`);
    roomService.clearAll();
    io.close(() => {
      httpServer.close(() => {
        httpsServer.close(() => {
          console.log('[✓] Đã tắt toàn bộ Server an toàn. Tạm biệt!');
          process.exit(0);
        });
      });
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
});

// Bắt các ngoại lệ chưa được xử lý để tránh crash Server
process.on('uncaughtException', (err) => {
  console.error('⚠️ UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UNHANDLED REJECTION:', reason);
});
