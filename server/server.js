console.log("Working directory:", __dirname);
const express = require('express');
const path = require("path");
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000


console.log("Static folder:", __dirname + '/public');
app.use(express.static(path.join(__dirname, "..", "public")));

// =======================
// Load collision map CSV
// =======================
let collisionMap = [];
const TILE_SIZE = 32; // Same as Tiled tileset

const csvTest = fs.readFileSync(path.join(__dirname, '..', 'public', 'collision.csv'), 'utf8')
collisionMap = csvTest.trim().split('\n').map(r => r.split(',').map(Number));
const MAP_WIDTH = collisionMap[0].length * TILE_SIZE;
const MAP_HEIGHT = collisionMap.length * TILE_SIZE;

// =====================
// Players
// =====================

const players = {};

function getRandomSpawn(){
  let tx, ty;
  do {
    tx = Math.floor(Math.random() * collisionMap[0].length);
    ty = Math.floor(Math.random() * collisionMap.length);
  } while (collisionMap[ty][tx] !== 0);

  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2;
    y: ty * TILE_SIZE + TILE_SIZE / 2;
  };
}

// ================
// Socket.io
// ================

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  const spawn = getRandomSpawn();

  // Create player
  players[socket.id] = {
      id: socket.id, 
      x: spawn.x, 
      y: spawn.y,
      dx: 0,
      dy: 0, 
      color: '#' + ((1<<24)*Math.random() | 0).toString(16), 
      speed: 150 // Keep server speed LOW to acoid divergence
    };

  // Send all players to new client
  socket.emit('currentPlayers', players);

  // Send new player to everyone else
  socket.broadcast.emit('newPlayer', players[socket.id] );

  socket.on("playerMovement", (input) => {
      const p = players[socket.id];
      if (!p) return;

      // Sanitize input
      p.dx = typeof input.dx === "number" ? input.dx : 0;
      p.dy = typeof input.dy === "number" ? input.dy : 0;
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
  const dt = FRAME_TIME / 1000;
  // Move each player according to last known input
  for (const id in players){
    const p = players[id];
    let newX = p.x + p.dx * p.speed * dt;
    let newY = p.y + p.dy * p.speed * dt;

    // Collision with map
    function colliding(x, y){
      const tx = Math.floor(x / TILE_SIZE);
      const ty = Math.floor(y / TILE_SIZE);
      if (ty < 0 || ty >= collisionMap.length || tx < 0 || tx >= collisionMap[0].length) return true;
      return collisionMap[ty][tx] !== 0;
    }

    if (!colliding(newX, p.y)) p.x = newX;
    if (!colliding(p.x, newY)) p.y = newY;
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

      if (distSq < DIAMETER * DIAMETER){
        const dist = Math.sqrt(distSq) || 0.01;
        const overlap = DIAMETER - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const push = overlap / 2;

        // Separate equally 
        a.x += nx * push;
        a.y += ny * push;
        b.x -= nx * push;
        b.y -= ny * push;

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
