const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = {};
let renderPlayers = {}; // local rendered positions and smoothing info
let collisionMap = [];
let TILE_SIZE = 64;

// =====================
// FLOATING TEXT FOR LOCAL PLAYER
// =====================
let floatingText = null; // {text, timer}


// =================
// Load collision map (same CSV)
// =================

fetch('collision1.csv')
  .then(res => res.text())
  .then(text => {
    collisionMap = text.trim().split('\n').map(r => r.split(',').map(Number));
  });


// Load tileset PNG
let tilesetLoaded = false;
const tileset = new Image();
tileset.src = 'map.png';
tileset.onload = () => tilesetLoaded = true;

// ====================
// LOAD CUSTOM FONT
// ====================
const spookyFont = new FontFace('SpookyFont', 'url(assets/fonts/RubikWetPaint-Regular.ttf)');

spookyFont.load().then(font => {
  document.fonts.add(font);
  console.log("Custom font loaded.");
});

// =====================
// INPUT HANDLING
// =====================

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;

// ========================
// SHOW TEXT ABOVE PLAYER ON "X"
// ========================
if (key === 'x' && renderPlayers[socket.id]){
  const me = renderPlayers[socket.id];
  floatingText = {
    text: "BOOO!",
    timer: 500 // miliseconds
  };
}
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  keys[key] = false;
});

// ====================
// Rysowanie mapy
// ====================
function drawMap(){
  if (!collisionMap.length || !tilesetLoaded) return;

  const tilesPerRow = Math.floor(tileset.width / TILE_SIZE);

   for (let y = 0; y < collisionMap.length; y++){
      for (let x = 0; x < collisionMap[0].length; x++){
        const tileId = collisionMap[y][x];
        if (tileId === -1) continue; // walkable, no tile

        // tileId 0 = first tile in tileset (top-left)
        const tileIndex = tileId;

        const sx = (tileIndex % tilesPerRow) * TILE_SIZE;
        const sy = Math.floor(tileIndex / tilesPerRow) * TILE_SIZE;

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
      isLocal: id === socket.id,
      text: "",
      textExpire: 0
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
  if (keys['arrowup']) dy = -1;
  if (keys['arrowdown']) dy = 1;
  if (keys['arrowleft']) dx = -1;
  if (keys['arrowright']) dx = 1;
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

  // Track local player for floating text
  const me = renderPlayers[socket.id];

  for (const id in renderPlayers) {
    const r = renderPlayers[id];

    // Smoothly move to server position for all players
    r.x += (r.serverX - r.x) * SMOOTH;
    r.y += (r.serverY - r.y) * SMOOTH;

    // Player invisibility on holding the Z key
    ctx.globalAlpha = (r.isLocal && keys['z']) ? 0.0 : 1.0;
    
    // Draw
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0; // Player visibility reset
  }
    // =========================
    // DRAW TEXT ABOVE PLAYER IF ACTIVE
    // =========================
    if (floatingText && me){
      ctx.font = "26px SpookyFont";
      ctx.textAlign = "center";
      ctx.fillStyle = "white";
      ctx.fillText(floatingText.text, me.x, me.y - 40);
    
      // Update timer
      floatingText.timer -=16; // approx per frame
      if (floatingText.timer <= 0) floatingText = null;

  }
  requestAnimationFrame(draw);
}
draw();

// Handle window resize
window.addEventListener('resize',() => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
