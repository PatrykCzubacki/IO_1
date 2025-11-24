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
  console.log('Player connected:', socket.id);

  // Create player
  players[socket.id] = {
      id: socket.id, 
      x: Math.random() * 800, 
      y: Math.random() * 600,
      dx: 0,
      dy: 0, 
      color: '#' + ((1<<24)*Math.random() | 0).toString(16), 
      speed: 5
    };

  // Send all players to new client
  socket.emit('currentPlayers', players);

  // Send new player to everyone else
  socket.broadcast.emit('newPlayer', players[socket.id] );

  // Receive movement input
  socket.on('playerMovement', (input) => {
      if (!players[socket.id]) return;
      players[socket.id].dx = input.dx;
      players[socket.id].dy = input.dy;
  });

  // Remove player
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    console.log('user disconnected:', socket.id);
  });
});

// ===========================
//      SERVER TICK LOOP
// ===========================

const TICK_RATE = 30;   // 30 ticks/sec
const FRAME_TIME = 1000 / TICK_RATE;

setInterval(() => {
    const radius = 10;
    const diameter = radius * 2;

    // Update all players
    for (const id in players){
        const p = players[id];

        const oldX = p.x;
        const oldY = p.y;

        // Apply movement;
        p.x += p.dx * p.speed;
        p.y += p.dy * p.speed;

        // Check collision with other players
        for(const otherId in players){
            if (otherId == id) continue;

            const o = players[otherId];

            const dx = p.x - o.x;
            const dy = p.y - o.y;

            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < diameter && dist > 0) {

              // Distance they overlap
              const overlap = diameter - dist;

              // Normalize push direction
              const nx = dx / dist;
              const ny = dy / dist;

              // Push each player by half of overlap
              const push = overlap / 2;

              p.x += nx * push;
              p.y += ny * push;

              o.x -= nx * push;
              o.y -= ny * push;
            }
        }

        // World bounds
        p.x = Math.max(radius, Math.min(800 - radius, p.x));
        p.y = Math.max(radius, Math.min(800 - radius, p.y));
    }
        // Send updated state to all clients;
        io.emit("stateUpdate", players);
    }, FRAME_RATE);

server.listen(PORT, () => {
  //console.log('Server running on http://localhost:3000');
});
