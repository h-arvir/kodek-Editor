import 'dotenv/config';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production set CORS_ORIGIN to your frontend URL (e.g. https://your-app.vercel.app).
// Multiple origins can be comma-separated.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin requests (origin is undefined) and listed origins
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST'],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 10000,
  pingInterval: 5000,
  transports: ['websocket', 'polling'],
});

// ── Judge0 execution proxy ────────────────────────────────────────────────────
// API keys stay on the server; the browser never sees them.
const JUDGE0_BASE = `https://${process.env.RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com'}`;
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 10;

app.post('/api/execute', async (req, res) => {
  const { source_code, language_id, stdin = '' } = req.body;

  if (!process.env.RAPIDAPI_KEY) {
    return res.status(500).json({ error: 'Server is missing RAPIDAPI_KEY configuration.' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com',
  };

  try {
    // Submit code
    const submitRes = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=false&fields=*`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source_code, language_id, stdin }),
    });
    const { token } = await submitRes.json();
    if (!token) return res.status(500).json({ error: 'No submission token returned by Judge0.' });

    // Poll until done
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(
        `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false&fields=*`,
        { headers }
      );
      const result = await pollRes.json();
      if (result.status?.id > 2) return res.json(result); // finished
    }

    return res.status(504).json({ error: 'Execution timed out. Please try again.' });
  } catch (err) {
    console.error('Judge0 proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Collaboration state ───────────────────────────────────────────────────────

// rooms: Map<roomId, Map<socketId, { id, username, color, cursor, host, canEdit }>>
const rooms = new Map();
// lobbies: Map<roomId, Map<socketId, { id, username, color }>>
const lobbies = new Map();
// bannedUsers: Map<roomId, Set<username>>
const bannedUsers = new Map();

const colors = [
  '#FF5252', '#7C4DFF', '#00BFA5', '#FFD740', '#64DD17',
  '#448AFF', '#FF6E40', '#EC407A', '#26A69A', '#AB47BC',
  '#5C6BC0', '#FFA726',
];

const assignUserColor = (username) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    connections: io.engine.clientsCount,
    rooms: Array.from(rooms.keys()),
  });
});

// ── Serve built frontend in production ───────────────────────────────────────
// Only active when the dist/ folder exists (i.e. after `npm run build`).
// For split deployment (frontend on Vercel) this block is never reached.
const distPath = path.join(__dirname, '../dist');
import { existsSync } from 'fs';
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  let currentRoom = null;
  let currentUser = null;

  socket.emit('connected', { id: socket.id });

  socket.on('ping', (callback) => {
    if (typeof callback === 'function') callback({ time: Date.now(), id: socket.id });
    else socket.emit('pong', { time: Date.now(), id: socket.id });
  });

  socket.on('leaveRoom', (roomId) => {
    if (roomId && rooms.has(roomId) && rooms.get(roomId).has(socket.id)) {
      socket.leave(roomId);
      const leavingUser = rooms.get(roomId).get(socket.id);
      rooms.get(roomId).delete(socket.id);

      socket.to(roomId).emit('userLeft', { userId: socket.id, username: leavingUser?.username });

      let roomUsers = Array.from(rooms.get(roomId).values());
      if (leavingUser?.host && roomUsers.length > 0) {
        const newHostUser = roomUsers[0];
        const updatedNewHost = { ...newHostUser, host: true, canEdit: true };
        rooms.get(roomId).set(newHostUser.id, updatedNewHost);
        roomUsers = Array.from(rooms.get(roomId).values());
        io.to(newHostUser.id).emit('hostTransferred', { newHost: updatedNewHost });
      }

      io.in(roomId).emit('userList', roomUsers);

      if (rooms.get(roomId).size === 0) rooms.delete(roomId);
      if (currentRoom === roomId) { currentRoom = null; currentUser = null; }
    }
  });

  socket.on('joinRoom', ({ roomId, username }) => {
    try {
      if (!roomId || !username) {
        socket.emit('error', { message: 'Room ID and Username are required.' });
        return;
      }

      if (currentRoom && currentRoom !== roomId) {
        socket.leave(currentRoom);
        if (rooms.has(currentRoom)) {
          const leavingUser = rooms.get(currentRoom).get(socket.id);
          rooms.get(currentRoom).delete(socket.id);
          socket.to(currentRoom).emit('userLeft', { userId: socket.id, username: leavingUser?.username });
          io.in(currentRoom).emit('userList', Array.from(rooms.get(currentRoom).values()));
          if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
        }
      }

      const banned = bannedUsers.get(roomId);
      if (banned && banned.has(username)) {
        socket.emit('error', { message: 'You have been banned from this room.' });
        return;
      }

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());

      const existingUsers = Array.from(rooms.get(roomId).values());
      const lobbyUsers = lobbies.has(roomId) ? Array.from(lobbies.get(roomId).values()) : [];
      const isDuplicateUsername =
        existingUsers.some((u) => u.username === username) ||
        lobbyUsers.some((u) => u.username === username);

      if (isDuplicateUsername) {
        socket.emit('error', { message: 'Username is already taken in this room' });
        return;
      }

      const userColor = assignUserColor(username);

      if (rooms.get(roomId).size > 0) {
        const hostUser = existingUsers.find((u) => u.host);
        if (hostUser) {
          if (!lobbies.has(roomId)) lobbies.set(roomId, new Map());
          const lobbyUser = { id: socket.id, username, color: userColor };
          lobbies.get(roomId).set(socket.id, lobbyUser);
          currentRoom = roomId;
          currentUser = lobbyUser;
          socket.emit('waitingForHost', { roomId });
          io.to(hostUser.id).emit('joinRequest', { userId: socket.id, username, color: userColor });
          return;
        }
      }

      socket.join(roomId);
      currentRoom = roomId;
      currentUser = { id: socket.id, username, color: userColor };
      rooms.get(roomId).set(socket.id, { ...currentUser, cursor: null, host: true, canEdit: true });

      const roomUsers = Array.from(rooms.get(roomId).values());
      socket.emit('roomJoined', { roomId, users: roomUsers, self: { ...currentUser, host: true, canEdit: true } });
      io.in(roomId).emit('userList', roomUsers);
    } catch (error) {
      console.error(`Error joining room ${roomId}:`, error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('codeChange', ({ roomId, userId, data }) => {
    if (!roomId || data === undefined || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const senderUser = rooms.get(roomId).get(socket.id);
    if (!senderUser?.canEdit && !senderUser?.host) return;
    socket.to(roomId).emit('codeChange', { userId, data });
  });

  socket.on('shareInitialState', ({ roomId, requesterId, code, language, output, comments }) => {
    if (!roomId || !requesterId || code === undefined || language === undefined || output === undefined || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    if (!rooms.get(roomId).has(requesterId)) return;
    io.to(requesterId).emit('initialState', {
      code, language, output,
      comments: Array.isArray(comments) ? comments : [],
    });
  });

  // ── Inline line comments ──────────────────────────────────────────────────

  const validateRoom = () =>
    currentRoom && rooms.has(currentRoom) && rooms.get(currentRoom).has(socket.id);

  socket.on('lineComment:add', ({ roomId, comment }) => {
    if (!roomId || !comment || roomId !== currentRoom || !validateRoom()) return;
    socket.to(roomId).emit('lineComment:add', { comment });
  });

  socket.on('lineComment:reply', ({ roomId, commentId, reply }) => {
    if (!roomId || !commentId || !reply || roomId !== currentRoom || !validateRoom()) return;
    socket.to(roomId).emit('lineComment:reply', { commentId, reply });
  });

  socket.on('lineComment:resolve', ({ roomId, commentId }) => {
    if (!roomId || !commentId || roomId !== currentRoom || !validateRoom()) return;
    socket.to(roomId).emit('lineComment:resolve', { commentId });
  });

  socket.on('lineComment:delete', ({ roomId, commentId }) => {
    if (!roomId || !commentId || roomId !== currentRoom || !validateRoom()) return;
    socket.to(roomId).emit('lineComment:delete', { commentId });
  });

  socket.on('cursorMove', ({ roomId, position, visible }) => {
    if (!roomId || !position || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const roomData = rooms.get(roomId);
    const userInfo = roomData.get(socket.id);
    if (!userInfo) return;
    userInfo.cursor = position;
    roomData.set(socket.id, userInfo);
    socket.to(roomId).emit('cursorUpdate', {
      userId: socket.id,
      username: userInfo.username,
      position,
      visible,
      color: userInfo.color,
    });
  });

  socket.on('mouse-move', ({ roomId, coordinates, visible }) => {
    if (!roomId || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const roomData = rooms.get(roomId);
    const userInfo = roomData.get(socket.id);
    if (!userInfo) return;
    if (coordinates) userInfo.coordinates = coordinates;
    roomData.set(socket.id, userInfo);
    socket.to(roomId).emit('mouse-update', {
      userId: socket.id,
      username: userInfo.username,
      coordinates: userInfo.coordinates,
      visible,
      color: userInfo.color,
    });
  });

  socket.on('languageChange', ({ roomId, userId, language }) => {
    if (!roomId || !language || !userId || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    socket.to(roomId).emit('languageChange', { userId, language });
  });

  socket.on('filesTreeUpdate', ({ roomId, userId, tree }) => {
    if (!roomId || !tree || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    socket.to(roomId).emit('filesTreeUpdate', { userId, tree });
  });

  socket.on('shareFilesState', ({ roomId, requesterId, tree }) => {
    if (!roomId || !requesterId || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    if (!rooms.get(roomId).has(requesterId)) return;
    io.to(requesterId).emit('initialFilesState', { tree });
  });

  socket.on('codeOutput', ({ roomId, userId, output }) => {
    if (!roomId || output === undefined || !userId || !currentRoom || roomId !== currentRoom) return;
    const roomData = rooms.get(roomId);
    const userInfo = roomData?.get(userId);
    if (!userInfo?.username) return;
    socket.to(roomId).emit('codeOutput', { userId, username: userInfo.username, output });
  });

  socket.on('chatMessage', ({ roomId, message }) => {
    if (!roomId || !message || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const userInfo = rooms.get(roomId).get(socket.id);
    if (!userInfo) return;
    io.in(roomId).emit('chatMessage', {
      userId: socket.id,
      username: userInfo.username,
      text: message,
      timestamp: new Date().toISOString(),
      color: userInfo.color,
    });
  });

  // ── WebRTC audio signaling ────────────────────────────────────────────────

  socket.on('webrtc-offer', ({ roomId, targetUserId, offer }) => {
    if (!roomId || !targetUserId || !offer || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    io.to(targetUserId).emit('webrtc-offer', { fromUserId: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ roomId, targetUserId, answer }) => {
    if (!roomId || !targetUserId || !answer || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    io.to(targetUserId).emit('webrtc-answer', { fromUserId: socket.id, answer });
  });

  socket.on('webrtc-ice-candidate', ({ roomId, targetUserId, candidate }) => {
    if (!roomId || !targetUserId || !candidate || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    io.to(targetUserId).emit('webrtc-ice-candidate', { fromUserId: socket.id, candidate });
  });

  socket.on('audio-chat-join', ({ roomId }) => {
    if (!roomId || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const userInfo = rooms.get(roomId).get(socket.id);
    if (!userInfo) return;
    socket.to(roomId).emit('user-joined-audio', { userId: socket.id, username: userInfo.username });
  });

  socket.on('audio-chat-leave', ({ roomId }) => {
    if (!roomId || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const userInfo = rooms.get(roomId).get(socket.id);
    if (!userInfo) return;
    socket.to(roomId).emit('user-left-audio', { userId: socket.id, username: userInfo.username });
  });

  // ── WebRTC video signaling ────────────────────────────────────────────────

  socket.on('webrtc-video-offer', ({ roomId, targetUserId, offer }) => {
    if (!roomId || !targetUserId || !offer || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    io.to(targetUserId).emit('webrtc-video-offer', { fromUserId: socket.id, offer });
  });

  socket.on('webrtc-video-answer', ({ roomId, targetUserId, answer }) => {
    if (!roomId || !targetUserId || !answer || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    io.to(targetUserId).emit('webrtc-video-answer', { fromUserId: socket.id, answer });
  });

  socket.on('webrtc-video-ice-candidate', ({ roomId, targetUserId, candidate }) => {
    if (!roomId || !targetUserId || !candidate || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    io.to(targetUserId).emit('webrtc-video-ice-candidate', { fromUserId: socket.id, candidate });
  });

  socket.on('video-chat-join', ({ roomId }) => {
    if (!roomId || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const userInfo = rooms.get(roomId).get(socket.id);
    if (!userInfo) return;
    socket.to(roomId).emit('user-joined-video', { userId: socket.id, username: userInfo.username });
  });

  socket.on('video-chat-leave', ({ roomId }) => {
    if (!roomId || !currentRoom || roomId !== currentRoom) return;
    if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const userInfo = rooms.get(roomId).get(socket.id);
    if (!userInfo) return;
    socket.to(roomId).emit('user-left-video', { userId: socket.id, username: userInfo.username });
  });

  // ── Room permissions ──────────────────────────────────────────────────────

  const isHost = () => {
    if (!currentRoom || !rooms.has(currentRoom)) return false;
    return rooms.get(currentRoom).get(socket.id)?.host === true;
  };

  socket.on('admitUser', ({ roomId, userId }) => {
    if (!isHost() || currentRoom !== roomId) return;
    const lobby = lobbies.get(roomId);
    if (!lobby || !lobby.has(userId)) return;

    const lobbyUser = lobby.get(userId);
    lobby.delete(userId);

    const userSocket = io.sockets.sockets.get(userId);
    if (!userSocket) return;

    userSocket.join(roomId);
    const fullUser = { ...lobbyUser, cursor: null, host: false, canEdit: false };
    rooms.get(roomId).set(userId, fullUser);

    const roomUsers = Array.from(rooms.get(roomId).values());
    io.to(userId).emit('admitted', { roomId, users: roomUsers, self: { ...lobbyUser, host: false, canEdit: false } });
    io.in(roomId).emit('userList', roomUsers);
    io.to(socket.id).emit('requestInitialState', { requesterId: userId });
    io.to(socket.id).emit('requestFilesState', { requesterId: userId });
  });

  socket.on('denyUser', ({ roomId, userId }) => {
    if (!isHost() || currentRoom !== roomId) return;
    const lobby = lobbies.get(roomId);
    if (lobby) lobby.delete(userId);
    io.to(userId).emit('joinDenied', { message: 'The host declined your request to join.' });
  });

  socket.on('kickUser', ({ roomId, userId }) => {
    if (!isHost() || currentRoom !== roomId || userId === socket.id) return;
    io.to(userId).emit('kicked', { message: 'You were removed from the room by the host.' });
    const userSocket = io.sockets.sockets.get(userId);
    if (userSocket) setTimeout(() => userSocket.disconnect(true), 400);
  });

  socket.on('banUser', ({ roomId, userId }) => {
    if (!isHost() || currentRoom !== roomId || userId === socket.id) return;
    const roomData = rooms.get(roomId);
    if (!roomData) return;
    const targetUser = roomData.get(userId);
    if (!targetUser) return;
    if (!bannedUsers.has(roomId)) bannedUsers.set(roomId, new Set());
    bannedUsers.get(roomId).add(targetUser.username);
    io.to(userId).emit('banned', { message: 'You have been banned from this room.' });
    const userSocket = io.sockets.sockets.get(userId);
    if (userSocket) setTimeout(() => userSocket.disconnect(true), 400);
  });

  socket.on('setPermission', ({ roomId, userId, canEdit }) => {
    if (!isHost() || currentRoom !== roomId || userId === socket.id) return;
    const roomData = rooms.get(roomId);
    if (!roomData || !roomData.has(userId)) return;
    const updatedUser = { ...roomData.get(userId), canEdit: !!canEdit };
    roomData.set(userId, updatedUser);
    io.to(userId).emit('permissionChanged', { canEdit: !!canEdit });
    io.in(roomId).emit('userList', Array.from(roomData.values()));
  });

  socket.on('requestStateSync', () => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const hostUser = Array.from(rooms.get(currentRoom).values()).find((u) => u.host);
    if (hostUser) io.to(hostUser.id).emit('requestInitialState', { requesterId: socket.id });
  });

  // ── Typing indicator ──────────────────────────────────────────────────────
  socket.on('typing', () => {
    if (!currentRoom || !currentUser) return;
    socket.to(currentRoom).emit('userTyping', { userId: socket.id, username: currentUser.username });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id}, Reason: ${reason}`);

    if (currentRoom && lobbies.has(currentRoom)) {
      const lobby = lobbies.get(currentRoom);
      if (lobby.has(socket.id)) {
        lobby.delete(socket.id);
        const roomData = rooms.get(currentRoom);
        if (roomData) {
          const hostUser = Array.from(roomData.values()).find((u) => u.host);
          if (hostUser) io.to(hostUser.id).emit('joinRequestCancelled', { userId: socket.id });
        }
      }
    }

    if (currentRoom && rooms.has(currentRoom)) {
      const roomData = rooms.get(currentRoom);
      const leavingUser = roomData.get(socket.id);

      if (leavingUser) {
        roomData.delete(socket.id);
        let updatedRoomUsers = Array.from(roomData.values());

        if (leavingUser.host && roomData.size > 0) {
          const newHostUser = updatedRoomUsers[0];
          if (newHostUser) {
            const updatedNewHost = { ...newHostUser, host: true, canEdit: true };
            roomData.set(newHostUser.id, updatedNewHost);
            updatedRoomUsers = Array.from(roomData.values());
            io.to(newHostUser.id).emit('hostTransferred', { newHost: updatedNewHost });
          }
        }

        socket.to(currentRoom).emit('userLeft', { userId: socket.id, username: leavingUser.username });

        if (roomData.size === 0) {
          rooms.delete(currentRoom);
        } else {
          io.in(currentRoom).emit('userList', updatedRoomUsers);
        }
      }
    }

    currentRoom = null;
    currentUser = null;
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
