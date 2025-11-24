const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = {};
let players = {}; // state from server (authoritative values)
let renderPlayers = {}; // local rendered positions and smoothing info

document.addEventListener('keydown', (e) => keys[e.key] = true);
document.addEventListener('keyup', (e) => keys[e.key] = false);

// Helper to ensure render state entry
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
    // Update color if changed
    renderPlayers[id].color = serverObj.color;
  }
}

// Initial & new players
socket.on('currentPlayers', serverPlayers => {
  players = serverPlayers;

  // Create render copies
  for (const id in serverPlayers){
    ensureRender(id, serverPlayers[id]);
  }
});

socket.on('newPlayer', (player) => {
  players[player.id] = player;
  ensureRender(player.id,player);
});

socket.on('playerDisconnected', id => {
  delete players[id];
  delete renderPlayers[id];
});

// ===================
//  SERVER UPDATE
// ===================

// Authoritateive snapshot from server
socket.on("stateUpdate", snapshot => {
  // Replace authoritative server state
  players = snapshot;

  // Update render target positions
  for (const id in snapshot){
    const s = snapshot[id];
    ensureRender(id, s);

    // Store server authoritative coordinates for smooth reconciliation
    renderPlayers[id].serverX = s.x;
    renderPlayers[id].serverY = s.y;
  
    // Remove missing
    for (const id in renderPlayers){
      if (!snapshot[id]) delete renderPlayers[id];
    }
  });

let lastDx = 0, lastDy = 0;
const SPEED = 300; // px per second (same as server)

function sendInput(dx, dy){
  socket.emit("playerMovement", { dx, dy});
}

// ======================
// PREDICTION
// ======================

// Input sending & local prediction
function predict(dt){
  const player = renderPlayers[socket.id];
  if(!player) return;

  // Movement direction
  let dx = 0;
  let dy = 0;

  if (keys['ArrowUp']) dy = -1;
  if (keys['ArrowDown']) dy = 1;
  if (keys['ArrowLeft']) dx = -1;
  if (keys['ArrowRight']) dx = 1;

  // Normalize diagonal
  if (dx !== 0 && dy !== 0){
    const inv = 1 / Math.sqrt(2);
    dx *= inv;
    dy *= inv;
  }

  if (dx !== lastDx || dy !== lastDy){
    sendInput(dx,dy);
    lastDx = dx;
    lastDy = dy;
  }

  // Local prediction
  player.x += dx * SPEED * dt;
  player.y += dy * SPEED * dt;


// ===================
// DRAW LOOP
// ===================

// Drawing & smoothing
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Smoothing factor for remote players and reconciliation on local
  const SMOOTH = 0.2; // [0..1] higher = faster snap
  const RECONCILE = 0.1;

  for (const id in renderPlayers) {
    const r = renderPlayers[id];

    if (r.isLocal){
      // Reconcile
      const dx = r.serverX - r.x;
      const dy = r.serverY - r.y;
      r.x += dx * RECONCILE;
      r.y += dy * RECONCILE;
    } else{
      r.x += (r.serverX - r.x) * SMOOTH;
      r.y += (r.serverY - r.y) * SMOOTH;
    }
    
    // Draw
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}


// ========================
// MAIN LOOP
// ========================

let lastTime = performance.now();

function loop(){
  const dt = (t - lastTime) / 1000; // seconds
  lastTime = t;

  predict(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Handle window resize
window.addEventListener('resize',() => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
