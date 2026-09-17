class RoomService {
  constructor() {
    this.teacherSocketId = null;
    this.students = new Map(); // socketId -> { id, name, isSharing, joinedAt }
    this.presentationQueue = []; // socketId list
  }

  setTeacher(socketId) {
    this.teacherSocketId = socketId;
  }

  getTeacher() {
    return this.teacherSocketId;
  }

  removeTeacher() {
    this.teacherSocketId = null;
  }

  addStudent(socketId, name) {
    const student = {
      id: socketId,
      name: name || 'Học sinh',
      isSharing: false,
      joinedAt: new Date().toISOString()
    };
    this.students.set(socketId, student);
    return student;
  }

  removeStudent(socketId) {
    const qIndex = this.presentationQueue.indexOf(socketId);
    if (qIndex !== -1) {
      this.presentationQueue.splice(qIndex, 1);
    }
    if (this.students.has(socketId)) {
      const student = this.students.get(socketId);
      this.students.delete(socketId);
      return student;
    }
    return null;
  }

  getStudentList() {
    return Array.from(this.students.values());
  }

  updateSharingState(socketId, isSharing) {
    if (this.students.has(socketId)) {
      this.students.get(socketId).isSharing = isSharing;
    }
  }

  addToQueue(socketId) {
    if (this.students.has(socketId) && !this.presentationQueue.includes(socketId)) {
      this.presentationQueue.push(socketId);
      return true;
    }
    return false;
  }

  removeFromQueue(socketId) {
    const idx = this.presentationQueue.indexOf(socketId);
    if (idx !== -1) {
      this.presentationQueue.splice(idx, 1);
      return true;
    }
    return false;
  }

  getQueueList() {
    return this.presentationQueue.map((sid, idx) => {
      const student = this.students.get(sid) || { id: sid, name: 'Học sinh' };
      return {
        ...student,
        queuePosition: idx + 1
      };
    });
  }

  clearAll() {
    this.teacherSocketId = null;
    this.students.clear();
    this.presentationQueue = [];
  }
}

module.exports = new RoomService();
