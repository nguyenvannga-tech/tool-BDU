const os = require('os');
const net = require('net');

class NetworkService {
  /**
   * Quét và lấy tất cả địa chỉ IP IPv4 trong mạng LAN nội bộ
   */
  getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const ipList = [];
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && !alias.internal) {
          ipList.push(alias.address);
        }
      }
    }
    return ipList;
  }

  /**
   * Tự động dò tìm cổng rảnh nếu cổng ban đầu bị chiếm
   */
  findAvailablePort(startPort, callback) {
    const testServer = net.createServer();
    testServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        this.findAvailablePort(startPort + 1, callback);
      } else {
        callback(err, startPort);
      }
    });
    testServer.once('listening', () => {
      testServer.close(() => {
        callback(null, startPort);
      });
    });
    testServer.listen(startPort, '0.0.0.0');
  }
}

module.exports = new NetworkService();
