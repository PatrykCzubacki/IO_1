const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = {};
let players = {};

document.addEventListener('keydown', (e) => keys[e.key] = true);
document.addEventListener('keyup', (e) => keys[e.key] = false);


socket.on('currentPlayers', (serverPlayers) => players = serverPlayers);

socket.on('newPlayer', (player) => {
  players[player.id] = player;
});

socket.on('playerDisconnected', (id) => delete players[id]);

socket.on("stateUpdate", (serverPlayers) => {
  players = serverPlayers;
});


let lastMove = 0;
const MOVE_INTERVAL = 50; // ms = 20 updates/sec

function update(){

  const player = players[socket.id];
  if(!player) return

  //movement direction
  let dx = 0;
  let dy = 0;

  if (keys['ArrowUp']) dy = -1;
  if (keys['ArrowDown']) dy = 1;
  if (keys['ArrowLeft']) dx = -1;
  if (keys['ArrowRight']) dx = 1;

  const now = Date.now();
  if (now - lastMove > MOVE_INTERVAL)
  {
    //send player position to server
    socket.emit('playerMovement', { dx, dy});
    lastMove = now;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const id in players) {
    const p = players[id];
    if (!p.targetX){
      p.targetX = p.x;
      p.targetY = p.y;
    }

    // Interpolate 0.2 = smoothing factor
    p.x += (p.targetX - p.x) * 0.2;
    p.y += (p.targetY - p.y) * 0.2;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gameLoop(){
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
