'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLOR_SETS = {
  dark: [
    null,
    '#00f0ff', // I - neon cyan
    '#fcee0a', // O - neon yellow
    '#b967ff', // T - neon purple
    '#05ffa1', // S - neon green
    '#ff2a6d', // Z - neon magenta
    '#7db4ff', // J - pale cyberpunk blue (Edgerunners)
    '#ff8a1f', // L - neon orange
  ],
  // mismos índices (1 = I … 7 = L), tonos más saturados/oscuros para fondo claro
  light: [
    null,
    '#00a3b4',
    '#e6c800',
    '#8a2be2',
    '#00a86b',
    '#e0115f',
    '#2455e0',
    '#f06a00',
  ],
};
let COLORS = COLOR_SETS.dark;

// paleta suave para la skin Pastel (mismos índices 1 = I … 7 = L)
const PASTEL_SETS = {
  dark: [
    null,
    '#9ef0f5', '#fff3a0', '#d6c2ff', '#b8f5d6', '#ffb3c9', '#b3d4ff', '#ffd1a3',
  ],
  light: [
    null,
    '#7fd8e0', '#f5e27a', '#b9a0f0', '#8fe3b8', '#f49ab5', '#8fb8f0', '#f7b77a',
  ],
};

// cada skin: paleta por tema + función de dibujo de un bloque
// px, py, s = área interior del bloque; ghost = bloque fantasma (sin brillo)
const SKINS = {
  retro: {
    palette: COLOR_SETS,
    draw(c, px, py, s, color, ghost) {
      c.shadowColor = color;
      c.shadowBlur = ghost ? 0 : blockBlur;
      c.fillStyle = color;
      c.fillRect(px, py, s, s);
      c.shadowBlur = 0;
      // núcleo oscuro con borde neón
      c.fillStyle = blockCore;
      c.fillRect(px + 4, py + 4, s - 8, s - 8);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(px, py, s, 2);
    },
  },
  neon: {
    palette: COLOR_SETS,
    draw(c, px, py, s, color, ghost) {
      // brillo fuerte alrededor del bloque
      c.shadowColor = color;
      c.shadowBlur = ghost ? 0 : 12 + blockBlur;
      c.fillStyle = color;
      c.fillRect(px, py, s, s);
      c.shadowBlur = 0;
      // tubo de neón: núcleo oscuro con contorno brillante
      c.fillStyle = blockCore;
      c.fillRect(px + 4, py + 4, s - 8, s - 8);
      c.strokeStyle = color;
      c.lineWidth = 1.5;
      c.strokeRect(px + 4.5, py + 4.5, s - 9, s - 9);
    },
  },
  pastel: {
    palette: PASTEL_SETS,
    draw(c, px, py, s, color, ghost) {
      const r = s * 0.25;
      c.fillStyle = color;
      roundRectPath(c, px, py, s, s, r);
      c.fill();
      if (ghost) return;
      // brillo superior redondeado
      c.fillStyle = 'rgba(255,255,255,0.45)';
      roundRectPath(c, px + 4, py + 4, s - 8, (s - 8) * 0.35, r / 2);
      c.fill();
      // borde suave
      c.strokeStyle = 'rgba(0,0,0,0.12)';
      c.lineWidth = 1;
      roundRectPath(c, px + 0.5, py + 0.5, s - 1, s - 1, r);
      c.stroke();
    },
  },
  pixel: {
    palette: COLOR_SETS,
    draw(c, px, py, s, color, ghost) {
      c.fillStyle = color;
      c.fillRect(px, py, s, s);
      if (ghost) return;
      // textura de tablero de ajedrez en celdas de píxel
      const p = Math.max(2, Math.floor(s / 7));
      const n = Math.floor(s / p);
      c.fillStyle = 'rgba(255,255,255,0.28)';
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if ((i + j) % 2 === 0) c.fillRect(px + i * p, py + j * p, p, p);
      // bisel: luz arriba-izquierda, sombra abajo-derecha
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(px, py, s, 2);
      c.fillRect(px, py, 2, s);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(px, py + s - 2, s, 2);
      c.fillRect(px + s - 2, py, 2, s);
    },
  },
};

const SKIN_NAMES = Object.keys(SKINS);
let currentSkin = SKIN_NAMES.includes(document.documentElement.dataset.skin)
  ? document.documentElement.dataset.skin
  : 'retro';

// rectángulo redondeado como path (compatible sin ctx.roundRect)
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let gridColor, blockCore, blockBlur;

function applyTheme(theme, save) {
  document.documentElement.dataset.theme = theme;
  COLORS = SKINS[currentSkin].palette[theme];
  const css = getComputedStyle(document.documentElement);
  gridColor = css.getPropertyValue('--grid').trim();
  blockCore = css.getPropertyValue('--block-core').trim();
  blockBlur = parseFloat(css.getPropertyValue('--block-blur'));
  const isLight = theme === 'light';
  themeBtn.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
  themeBtn.setAttribute('aria-pressed', String(isLight));
  if (save) {
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }
  // repintar aunque el juego esté en pausa o terminado
  if (current) { draw(); drawNext(); }
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// lee de nuevo las variables CSS del tema/skin activos (la rejilla depende de la skin)
function refreshCssVars() {
  const css = getComputedStyle(document.documentElement);
  gridColor = css.getPropertyValue('--grid').trim();
  blockCore = css.getPropertyValue('--block-core').trim();
  blockBlur = parseFloat(css.getPropertyValue('--block-blur'));
}

function applySkin(name, save) {
  if (!SKINS[name]) return;
  currentSkin = name;
  document.documentElement.dataset.skin = name;
  refreshCssVars();
  COLORS = SKINS[name].palette[document.documentElement.dataset.theme];
  if (save) {
    try { localStorage.setItem('skin', name); } catch (e) {}
  }
  // repintar aunque el juego esté en pausa o terminado
  if (current) { draw(); drawNext(); }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.globalAlpha = alpha ?? 1;
  SKINS[currentSkin].draw(context, px, py, s, color, !!alpha);
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
  themeBtn.blur(); // evita que Espacio sobre el botón dispare hardDrop
});

// con el select enfocado, las flechas y Espacio no deben mover la pieza ni cambiar la skin sin querer
skinSelect.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
    e.stopPropagation();
  }
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value, true);
  skinSelect.blur(); // evita que Espacio tras elegir skin dispare hardDrop
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', false);
skinSelect.value = currentSkin;
init();
