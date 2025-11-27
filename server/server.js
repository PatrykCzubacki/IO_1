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

const csvTest = fs.readFileSync(path.join(__dirname, '..', 'public', 'collision1.csv'), 'utf8')
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
  } while (collisionMap[ty][tx] !== -1); // Only spawn on walkable tiles (-1)

  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2,
    y: ty * TILE_SIZE + TILE_SIZE / 2
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

setInterval(() => {
  const dt = FRAME_TIME / 1000;
  // Move each player according to last known input
  for (const id in players){
    const p = players[id];
    let newX = p.x + p.dx * p.speed * dt;
    let newY = p.y + p.dy * p.speed * dt;

    if (!colliding(newX, p.y)) p.x = newX;
    if (!colliding(p.x, newY)) p.y = newY;
  }

    // Collision with map
    function colliding(x, y){
      const left = x - RADIUS;
      const right = x + RADIUS;
      const top = y - RADIUS;
      const bottom = y + RADIUS;

      // Tiles covered by the player's bounding box
      const tx1 = Math.floor(left / TILE_SIZE);
      const tx2 = Math.floor(right / TILE_SIZE);
      const ty1 = Math.floor(top / TILE_SIZE);
      const ty2 = Math.floor(bottom / TILE_SIZE);

      // Check all four corners
      for (let ty = ty1; ty <= ty2; ty++){
        for (let tx = tx1; tx <= tx2; tx++){
          if (ty < 0 || ty >= collisionMap.length || tx < 0 || tx >= collisionMap[0].length) {
            return true; // outside map = collision
          }
      if (collisionMap[ty][tx] === 0) return true; // 0 = wall
        }
        }
    return false; //no collision detected
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

        // Split push
        const push = overlap / 2;

        // Attempt to push
        const newAX = a.x + nx * push;
        const newAY = a.y + ny * push;
        const newBX = b.x - nx * push;
        const newBY = b.y - ny * push;

        // After push, ensure A is not inside a wall
        if (!colliding(newAX,a.y)) a.x = newAX;
        if (!colliding(a.x, newAY)) a.y = newAY;

        // After push, ensure B is not inside a wall
        if (!colliding(newBX,b.y)) b.x = newBX;
        if (!colliding(b.x, newBY)) b.y = newBY;

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
