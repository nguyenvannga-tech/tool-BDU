const path = require('path');

module.exports = {
  DEFAULT_PORT: process.env.PORT || 8888,
  TEACHER_PIN: process.env.TEACHER_PIN || '123456',
  SSL: {
    DAYS: 365,
    KEY_SIZE: 2048,
    COMMON_NAME: 'LANClassroomEnterprise'
  },
  PATHS: {
    DIST: path.join(__dirname, '../../../dist'),
    PUBLIC: path.join(__dirname, '../../../public')
  }
};
