console.log("Working directory:", __dirname);
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const path = require("path");
console.log("Static folder:", __dirname + '/public');
app.use(express.static(path.join(__dirname, "..", "public")));

const players = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Add player
  players[socket.id] = { x: Math.random() * 800, y: Math.random() * 600, color: '#' + ((1<<24)*Math.random() | 0).toString(16) };

  // Send all players to new client
  socket.emit('currentPlayers', players);

  // Send new player to everyone else
  socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

  // Move player
  socket.on('move', (data) => {
    const player = players[socket.id];
    if (!player) return;
    player.x += data.x;
    player.y += data.y;
    io.emit('playerMoved', { id: socket.id, x: player.x, y: player.y });
  });

  // Remove player
  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
