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

    // Save old position
    const oldX = player.x;
    const oldY= player.y;



    const speed = player.speed;

    // Apply movement on server
    player.x += data.dx * speed;
    player.y += data.dy * speed;

    const radius = 10;

    // Collision block
    for (const id in players){
      if(id === socket.id) continue; // Skip yourself

      const other = players[id];

      const dx = player.x - other.x;
      const dy = player.y - other.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist< radius *2){
          // Collision -> revert movement
          player.x = oldX;
          player.y = oldY;
          break;
      }

    }

    // Now send authoritative position
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
