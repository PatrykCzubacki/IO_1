const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = {};
let players = {}; // state from server (authoritative values)
let renderPlayers = {}; // local rendered positions and smoothing info
let inputSeq = 0;
let pendingInputs = [];

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
  

// If this is the local player - RECONCILE
if (id === socket.id){
  // Snap to correct base state
  r.x = s.x;
  r.y = s.y;

  // Reapply all yet-unconfirmed inputs
  for (const inp of pendingInputs){
    r.x += inp.dx * 5;
    r.y += inp.dy * 5;
  }
}
}

  // Remove any render players that disappeared
  for (const id in renderPlayers){
    if (!snapshot[id]) delete renderPlayers[id];
  }
});

// ======================
// INPUT + PREDICTION
// ======================

// Input sending & local prediction
function sendInputAndPredict(){
  const player = renderPlayers[socket.id];
  if(!player) return;

  //movement direction
  let dx = 0;
  let dy = 0;

  if (keys['ArrowUp']) dy = -1;
  if (keys['ArrowDown']) dy = 1;
  if (keys['ArrowLeft']) dx = -1;
  if (keys['ArrowRight']) dx = 1;

  const input = { dx, dy, seq: inputSeq++ };

  // Send to server
  socket.emit ("playerMovement", input);

  // Perdict instantly
  const SPEED = 5;
  player.x += dx * SPEED;
  player.y += dy * SPEED;

  // Store so reconciliation can reapply them
  pendingInputs.push(input);
}

// Server will confirm inputs by position
socket.on("stateUpdate", snapshot => {
    const player= renderPlayers[socket.id];
    if (!player) return;

    // Remove confirmed inputs
    pendingInputs = pendingInputs.filter(inp => {
      // Server doesn't send seq numbers, so keep all inouts
      // (stable movement, no jitter)
      return false;
    });
});

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

    // If this is not local player, smoothly interpolate toward server
    if (id != socket.id){
      // Move rendered towards server authoritative position
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

function loop(){
  sendInputAndPredict();
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Handle window resize
window.addEventListener('resize',() => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
