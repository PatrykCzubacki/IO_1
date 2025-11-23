const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const keys = {};
let players = {};

document.addEventListener('keydown', (e) => keys[e.key] = true);
document.addEventListener('keyup', (e) => keys[e.key] = false);


socket.on('currentPlayers', (serverPlayers) => players = serverPlayers;);

socket.on('newPlayer', (player) => {
  players[player.id] = player;
});

socket.on('playerDisconnected', (id) => delete players[id]);

socket.on('playerMoved', (data) => {  
  if (!players[data.id]) return;
    players[data.id].x = data.x;
    players[data.id].y = data.y;
  
});

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

  //send player position to server
  socket.emit('playerMovement', { dx, dy});
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const id in players) {
    const p = players[id];
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
