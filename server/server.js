console.log("Working directory:", __dirname);
const express = require('express');
const path = require("path");
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000


console.log("Static folder:", __dirname + '/public');
app.use(express.static(path.join(__dirname, "..", "public")));

const players = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Add player
  players[socket.id] = { 
      x: Math.random() * 800, 
      y: Math.random() * 600, 
      color: '#' + ((1<<24)*Math.random() | 0).toString(16), 
      speed: 5
    };

  // Send all players to new client
  socket.emit('currentPlayers', players);

  // Send new player to everyone else
  socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

  // Move player
  socket.on('playerMovement', (data) => {
    const player = players[socket.id];
    if (!player) return;
    player.x = data.x;
    player.y = data.y;

    const radius = 10;

    // Block movement if collising with another player
    for (const id in players){
      if(id === socket.id) continue; // Skip yourself
      const other = players[id];

      const dx = player.x - other.x;
      const dy = player.y - other.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist< radius *2){
        // Distance too small -> calculate push-out
        const overlap = (radius * 2) - dist;

        // Normalize push direction
        const nx = dx / dist;
        const ny = dy / dist;

        // Push both players equally
        player.x += nx * overlap / 2;
        player.y += ny * overlap / 2;

        other.x -= nx * overlap / 2;
        other.y -= ny * overlap / 2;

        // Broadcast both players immediately
        io.emit('playerMoved', { id: socket.id, x: player.x, y: player.y });
        io.emit('playerMoved', { id: id, x: other.x, y: other.y });

      }

    }

    // Always broadcast moving player (if no collision)
    io.emit('playerMoved', {id: socket.id, x: player.x, y: player.y});
    
  });

  // Remove player
  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, () => {
  //console.log('Server running on http://localhost:3000');
});
