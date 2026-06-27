const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // --- NEW: Lobby & User Management ---
  socket.on('join_game', async ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username; // Save username to this specific socket connection
    socket.roomId = roomId;

    // Add user to Redis list of active players in this room
    await redisClient.sAdd(`room:${roomId}:players`, username);
    const players = await redisClient.sMembers(`room:${roomId}:players`);
    
    // Broadcast updated player list and a system message
    io.to(roomId).emit('update_players', players);
    socket.to(roomId).emit('receive_chat', { sender: 'System', text: `${username} joined the room!`, type: 'system' });

    // Send the drawing history to the new user
    const history = await redisClient.lRange(`room:${roomId}:history`, 0, -1);
    const parsedHistory = history.map(item => JSON.parse(item));
    socket.emit('load_history', parsedHistory);
  });

  // --- NEW: Real-Time Chat ---
  socket.on('send_chat', ({ roomId, username, text }) => {
    // Broadcast the message to everyone else in the room
    socket.to(roomId).emit('receive_chat', { sender: username, text: text, type: 'user' });
  });

  // --- EXISTING: Canvas Drawing Engine ---
  socket.on('draw_event', async (data) => {
    const { roomId, strokeData } = data;
    socket.to(roomId).emit('draw_event', strokeData);
    await redisClient.rPush(`room:${roomId}:history`, JSON.stringify(strokeData));
  });

  socket.on('clear_board', async (roomId) => {
    socket.to(roomId).emit('clear_board');
    await redisClient.del(`room:${roomId}:history`);
  });

  // --- NEW: Cleanup on Disconnect ---
  socket.on('disconnect', async () => {
    if (socket.username && socket.roomId) {
      await redisClient.sRem(`room:${socket.roomId}:players`, socket.username);
      const players = await redisClient.sMembers(`room:${socket.roomId}:players`);
      
      io.to(socket.roomId).emit('update_players', players);
      io.to(socket.roomId).emit('receive_chat', { sender: 'System', text: `${socket.username} left the room.`, type: 'system' });
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(3001, () => console.log('Server running on port 3001'));
