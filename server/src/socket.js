import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins },
  });

  io.on('connection', (socket) => {
    // Tell everyone how many people are viewing the map right now
    io.emit('clients:count', io.engine.clientsCount);

    socket.on('disconnect', () => {
      io.emit('clients:count', io.engine.clientsCount);
    });
  });

  return io;
}

// Used by controllers to push events to every connected client.
// Safe to call even if Socket.IO isn't initialised (e.g. in tests).
export function broadcast(event, payload) {
  if (io) io.emit(event, payload);
}