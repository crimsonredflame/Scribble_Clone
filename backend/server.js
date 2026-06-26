const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Initialize Redis Client
const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    
    // Fetch drawing history from Redis to sync the new user
    const history = await redisClient.lRange(`room:${roomId}:history`, 0, -1);
    const parsedHistory = history.map(item => JSON.parse(item));
    
    socket.emit('load_history', parsedHistory);
  });

  socket.on('draw_event', async (data) => {
    const { roomId, strokeData } = data;
    
    // Broadcast to everyone else in the room
    socket.to(roomId).emit('draw_event', strokeData);
    
    // Persist the stroke in Redis
    await redisClient.rPush(`room:${roomId}:history`, JSON.stringify(strokeData));
  });

  socket.on('clear_board', async (roomId) => {
    socket.to(roomId).emit('clear_board');
    await redisClient.del(`room:${roomId}:history`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(3001, () => console.log('Server running on port 3001'));