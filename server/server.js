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

  socket.on("playerInput", data => {
      const p = players[socket.id];
      if (!p) return;

      // Store input only
      p.dx = data.dx;
      p.dy = data.dy;
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

const TICK = 1000 / 60;   

function updateGame(){
    const radius = 10;
    const diameter = radius * 2;

    // Update all players
    for (const id in players){
        const p = players[id];
        if (!p) continue;

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

            if (dist < diameter){
                // Revert
                p.x = oldX;
                p.y = oldY;
                break;
            }
      }
    }
    io.emit("stateUpdate", players);
  }

setInterval(updateGame, TICK);
    
server.listen(PORT, () => {
  //console.log('Server running on http://localhost:3000');
});
