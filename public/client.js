const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = {};
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
    renderPlayers[id].serverX = serverObj.x;
    renderPlayers[id].serverY = serverObj.y;
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
  delete renderPlayers[id];
});

// ===================
//  SERVER UPDATE
// ===================

// Authoritateive snapshot from server
socket.on("stateUpdate", snapshot => {

  // Update render target positions
  for (const id in snapshot){
    const s = snapshot[id];
    ensureRender(id, s);
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
