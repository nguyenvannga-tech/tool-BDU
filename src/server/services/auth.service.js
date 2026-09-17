const config = require('../config/env.config');

class AuthService {
  /**
   * Kiểm tra mã PIN bảo mật của Giáo viên
   */
  validateTeacherPin(inputPin) {
    return String(inputPin).trim() === config.TEACHER_PIN;
  }
}

module.exports = new AuthService();
