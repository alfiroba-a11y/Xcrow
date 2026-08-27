import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  const token = localStorage.getItem('xcrow_token') || localStorage.getItem('xcrow_admin_token');
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      autoConnect: false,
    });
  }
  socket.auth = { token };
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
