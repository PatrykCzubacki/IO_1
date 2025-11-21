const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let players = {};

socket.on('currentPlayers', (serverPlayers) => {
  players = serverPlayers;
});

socket.on('newPlayer', (player) => {
  players[player.id] = player;
});

socket.on('playerDisconnected', (id) => {
  delete players[id];
});

socket.on('playerMoved', (data) => {
  if (players[data.id]) {
    players[data.id].x = data.x;
    players[data.id].y = data.y;
  }
});

window.addEventListener('keydown', (e) => {
  const speed = 5;
  if (e.key === 'ArrowUp') socket.emit('move', { x: 0, y: -speed });
  if (e.key === 'ArrowDown') socket.emit('move', { x: 0, y: speed });
  if (e.key === 'ArrowLeft') socket.emit('move', { x: -speed, y: 0 });
  if (e.key === 'ArrowRight') socket.emit('move', { x: speed, y: 0 });
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const id in players) {
    const p = players[id];
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  requestAnimationFrame(draw);
}
draw();
