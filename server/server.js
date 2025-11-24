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

  socket.on("playerMovement", (input) => {
      const p = players[socket.id];
      if (!p) return;

      // Sanitize input
      p.dx = input.dx || 0;
      p.dy = input.dy || 0;
  });

  // Remove player
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    console.log('user disconnected:', socket.id);
  });
});

// ===========================
//      GAME LOOP (60 FPS SERVER)
// ===========================

const TICK_RATE = 60; // tick per second
const FRAME_TIME = 1000 / TICK_RATE;   
const RADIUS = 10;
const DIAMETER = RADIUS * 2;
const WORLD = { w: 1200, h: 800}; //bounds

setInterval(() => {
  // Move each player according to last known input
  for (const id in players){
    const p = players[id];

    // Apply input-driven movement
    p.x += p.dx * p.speed;
    p.y += p.dy * p.speed;

    // World bounds
    p.x = Math.max(RADIUS, Math.min(WORLD.w - RADIUS, p.x));
    p.y = Math.max(RADIUS, Math.min(WORLD.h - RADIUS, p.y));
  }

  // Collision resolution (simple pairwise separation)
  // Move overlkapping pairs apart by half overlap each
  const ids = Object.keys(players);
  for(let i=0; i < ids.length; i++){
    for (let j = i + 1; j < ids.length; j++){
      const a = players[ids[i]];
      const b = players[ids[j]];

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;


      const dist = Math.sqrt(distSq);
      if (dist < DIAMETER){
        const overlap = DIAMETER - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const push = overlap / 2;

        // Separate equally 
        a.x += nx * push;
        a.y += ny * push;
        b.x -= nx * push;
        b.y -= ny * push;

        // Clamp after push
        a.x = Math.max(RADIUS, Math.min(WORLD.w - RADIUS, a.x));
        a.y = Math.max(RADIUS, Math.min(WORLD.h - RADIUS, a.y));
        b.x = Math.max(RADIUS, Math.min(WORLD.w - RADIUS, b.x));
        b.y = Math.max(RADIUS, Math.min(WORLD.h - RADIUS, b.y));
      }
    }
  }

  // Broadvast authoritative state to all clients once per tick
  // We send only minimal fields to reduce bandwidth
  const snapshot = {};
  for (const id in players){
    const p = players[id];
    snapshot[id] = { id: p.id, x: p.x, y: p.y, color: p.color};
  }

  io.emit("stateUpdate", snapshot);
}, FRAME_TIME);


server.listen(PORT, () => {
  console.log('Server running on port ', PORT);
});
