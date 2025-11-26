const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = {};
let renderPlayers = {}; // local rendered positions and smoothing info
let collisionMap = [];
let TILE_SIZE = 32;

// =================
// Load collision map (same CSV)
// =================

fetch('collision.csv')
  .then(res => res.text())
  .then(text => {
    collisionMap = text.trim().split('\n').map(r => r.split(',').map(Number));
  });


// Load tileset PNG
const tileset = new Image();
tileset.src = 'map.png';


document.addEventListener('keydown', (e) => keys[e.key] = true);
document.addEventListener('keyup', (e) => keys[e.key] = false);

// ====================
// Rysowanie mapy
// ====================
function drawMap(){
  if (!collisionMap.length) return;

  const tilesPerRow = tileset.width / TILE_SIZE;

   for (let y = 0; y < collisionMap.length; y++){
      for (let x = 0; x < collisionMap[0].length; x++){
        const tileId = collisionMap[y][x];
        if (tileId === 0) continue; // 0 = puste

        const sx = ((tileId - 1) % tilesPerRow) * TILE_SIZE;
        const sy = Math.floor((tileId -1 ) / tilesPerRow) * TILE_SIZE;

        ctx.drawImage(
          tileset,
          sx, sy, TILE_SIZE, TILE_SIZE,
          x * TILE_SIZE, y * TILE_SIZE,
          TILE_SIZE, TILE_SIZE
        );
      }
    }
}

// ===========================
// Render players
// ===========================

function ensureRender(id, serverObj){
  if (!renderPlayers[id]){
    renderPlayers[id] = {
      x: serverObj.x,
      y: serverObj.y,
      color: serverObj.color || '#888',
      serverX: serverObj.x,
      serverY: serverObj.y,
      isLocal: id === socket.id
    };
  } else {
    renderPlayers[id].serverX = serverObj.x;
    renderPlayers[id].serverY = serverObj.y;
    // Update color if changed
    renderPlayers[id].color = serverObj.color;
  }
}

// =================
// Socket events
// =================

// Initial & new players
socket.on('currentPlayers', serverPlayers => {
  // Create render copies
  for (const id in serverPlayers){
    ensureRender(id, serverPlayers[id]);
  }
});

socket.on('newPlayer', player => ensureRender(player.id,player));
socket.on('playerDisconnected', id => delete renderPlayers[id]);

// ===================
//  SERVER UPDATE
// ===================

// Authoritateive snapshot from server
socket.on("stateUpdate", snapshot => {

  // Update render target positions
  for (const id in snapshot){
    const s = snapshot[id];
    ensureRender(id, s);
  }

  // Remove missing players
  for (const id in renderPlayers){
    if(!snapshot[id]) delete renderPlayers[id];
  }
  });

   // =====================
// INPUT SENDING LOOP
// =====================
setInterval(() => {
  let dx = 0, dy = 0;
  if (keys['ArrowUp']) dy = -1;
  if (keys['ArrowDown']) dy = 1;
  if (keys['ArrowLeft']) dx = -1;
  if (keys['ArrowRight']) dx = 1;
  if (dx !== 0 && dy !== 0){ const inv = 1/Math.sqrt(2); dx *= inv; dy *= inv; }
  socket.emit('playerMovement', { dx, dy });
}, 1000/60); // send 60 times per second


// ===================
// DRAW LOOP
// ===================

// Drawing & smoothing
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();

  // Smoothing factor for remote players and reconciliation on local
  const SMOOTH = 0.2; // [0..1] higher = faster snap

  for (const id in renderPlayers) {
    const r = renderPlayers[id];

    // Smoothly move to server position for all players
    r.x += (r.serverX - r.x) * SMOOTH;
    r.y += (r.serverY - r.y) * SMOOTH;
    
    
    // Draw
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  requestAnimationFrame(draw);
}
draw();

// Handle window resize
window.addEventListener('resize',() => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
