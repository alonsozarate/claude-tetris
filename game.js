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

let gridColor, blockCore, blockBlur;

function applyTheme(theme, save) {
  document.documentElement.dataset.theme = theme;
  COLORS = COLOR_SETS[theme];
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
  if (current) { draw(); drawNext(); } else { drawIdle(); }
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
  // combo: locks consecutivos que limpian líneas; un lock sin limpieza lo reinicia
  if (cleared) {
    combo++;
    gameBestCombo = Math.max(gameBestCombo, combo);
  } else {
    combo = 0;
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = alpha ? 0 : blockBlur;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.shadowBlur = 0;
  // núcleo oscuro con borde neón
  context.fillStyle = blockCore;
  context.fillRect(px + 4, py + 4, s - 8, s - 8);
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(px, py, s, 2);
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

// pantalla de inicio: tablero y preview vacíos (sin piezas todavía)
function drawIdle() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
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
  if (gameOver) return; // endGame() llamado desde un lock dentro de este frame: no dibujar ni reprogramar
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  savePendingEntry(); // si había una entrada sin guardar, se guarda con el nombre actual
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  gameBestCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  recordsEl.classList.add('hidden');
  nameEntryEl.classList.add('hidden');
  restartBtn.textContent = 'Reiniciar';
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; // el nombre se escribe sin disparar controles
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

// ---- Records (tabla local en localStorage) ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const recordsEl = document.getElementById('records');
const recordsBody = document.getElementById('records-body');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const nameEntryEl = document.getElementById('name-entry');
const nameInput = document.getElementById('player-name');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-records-btn');

let combo = 0;            // locks consecutivos con limpieza (partida actual)
let gameBestCombo = 0;    // mejor combo de la partida actual
let records = null;       // copia en memoria de 'tetris-records'
let pendingEntry = null;  // resultado de la última partida, pendiente de guardar nombre
let highlightEntry = null;
let clearTimer = null;    // no nulo mientras espera la confirmación de 'Borrar records'

function emptyRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.scores)) {
      const scores = topWith(data.scores
        .filter(s => s && typeof s.score === 'number')
        .map(s => ({
          name: String(s.name || 'AAA').slice(0, 12),
          score: s.score,
          lines: Number(s.lines) || 0,
          level: Number(s.level) || 1,
        })), null);
      return { scores, bestCombo: Number(data.bestCombo) || 0, maxLines: Number(data.maxLines) || 0 };
    }
  } catch (e) {}
  return emptyRecords();
}

function saveRecords(rec) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify({
      scores: rec.scores,
      bestCombo: rec.bestCombo,
      maxLines: rec.maxLines,
    }));
  } catch (e) {}
}

// top N de la lista + entrada opcional (sort estable: en empate gana la ya guardada)
function topWith(list, entry) {
  return list.concat(entry ? [entry] : []).sort((a, b) => b.score - a.score).slice(0, MAX_RECORDS);
}

function entersTop(list, score) {
  return score > 0 && (list.length < MAX_RECORDS || score > list[list.length - 1].score);
}

function renderRecords() {
  const rows = topWith(records.scores, pendingEntry);
  recordsBody.textContent = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'records-empty';
    td.textContent = 'Sin records todavía';
    tr.appendChild(td);
    recordsBody.appendChild(tr);
  }
  rows.forEach((s, i) => {
    const tr = document.createElement('tr');
    if (s === highlightEntry) tr.className = 'new-record';
    [i + 1, s.name, s.score.toLocaleString(), s.lines, s.level].forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    recordsBody.appendChild(tr);
  });
  bestComboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
}

function showGameOverRecords() {
  records = loadRecords();
  records.bestCombo = Math.max(records.bestCombo, gameBestCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords(records);
  pendingEntry = entersTop(records.scores, score)
    ? { name: 'AAA', score, lines, level }
    : null;
  highlightEntry = pendingEntry;
  nameInput.value = 'AAA';
  nameEntryEl.classList.toggle('hidden', !pendingEntry);
  recordsEl.classList.remove('hidden');
  renderRecords();
  if (pendingEntry) {
    nameInput.focus();
    nameInput.select();
  }
}

function savePendingEntry() {
  if (!pendingEntry) return;
  records = loadRecords(); // recarga: otra pestaña pudo guardar records desde que terminó la partida
  records.scores = topWith(records.scores, pendingEntry);
  saveRecords(records);
  pendingEntry = null;
  nameInput.blur(); // no dejar el foco en un input oculto
  nameEntryEl.classList.add('hidden');
  renderRecords();
}

function showStartScreen() {
  gameOver = true; // bloquea los controles hasta pulsar Jugar
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'PREPARADO';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  drawIdle();
  records = loadRecords();
  pendingEntry = null;
  highlightEntry = null;
  nameEntryEl.classList.add('hidden');
  recordsEl.classList.remove('hidden');
  renderRecords();
  overlay.classList.remove('hidden');
}

function disarmClear() {
  clearTimeout(clearTimer);
  clearTimer = null;
  clearBtn.textContent = 'Borrar records';
}

nameInput.addEventListener('input', () => {
  if (!pendingEntry) return;
  pendingEntry.name = nameInput.value.trim().slice(0, 12) || 'AAA';
  renderRecords();
});

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    savePendingEntry();
  }
});

saveBtn.addEventListener('click', savePendingEntry);

clearBtn.addEventListener('click', () => {
  if (clearTimer === null) {
    // primer clic: pedir confirmación (sin confirm/alert, que bloquean el navegador)
    clearBtn.textContent = '¿Seguro? Pulsa de nuevo';
    clearTimer = setTimeout(disarmClear, 3000);
    return;
  }
  disarmClear();
  records = emptyRecords();
  saveRecords(records);
  pendingEntry = null;
  highlightEntry = null;
  nameInput.blur();
  nameEntryEl.classList.add('hidden');
  renderRecords();
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', false);
showStartScreen();
