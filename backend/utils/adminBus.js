let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function notifyAdmins(event = 'admin:refresh', payload) {
  if (ioInstance) ioInstance.to('admin-room').emit(event, payload);
}

module.exports = { setIO, notifyAdmins };
