# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no package manager, build step, linter, or test suite. The game is plain HTML/CSS/JS loaded directly by the browser.

- Run: open `index.html` in a browser, or serve the folder statically (e.g. `python3 -m http.server 8000`, then visit `http://localhost:8000`). A server is only needed if you want to avoid `file://` quirks.
- Test: no automated tests exist. Verify changes by playing in the browser; the game can be checked end-to-end manually (movement, rotation/wall kicks, hard/soft drop, line clears, level-up, pause, game over, restart).

## Architecture

Three files, no modules, no globals beyond the script scope:

- `index.html` — DOM skeleton: a `#board` canvas (300×600), a `#next-canvas` (120×120), HUD spans (`#score`, `#lines`, `#level`), and a `#overlay` used for both PAUSE and GAME OVER. `game.js` is loaded at the end of `<body>`.
- `style.css` — dark arcade theme and overlay styling. Carries no game logic.
- `game.js` — the entire game, executed once on load. Its state lives in top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `lastTime`, `animId`).

Key design points that span multiple functions:

- **Board model**: `board` is a `ROWS × COLS` array of ints where `0` is empty and `1–7` are the piece type (index into `COLORS` / `PIECES`). Pieces are square matrices of the same ints, so a locked piece keeps its color.
- **Piece lifecycle**: `randomPiece()` → becomes `current` in `spawn()` (which also generates a new `next` and calls `endGame()` if the new piece already collides). A piece locks via `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. Locking is triggered from three places: the gravity tick in `loop`, `softDrop()` when blocked, and `hardDrop()`.
- **Collision**: `collide(shape, ox, oy)` is the single source of truth for legality, used by movement, gravity, rotation, `ghostY()`, and spawn.
- **Rotation**: `tryRotate()` rotates the matrix and tries horizontal kicks `[0, -1, 1, -2, 2]`; if none fits, the rotation is discarded.
- **Game loop**: `requestAnimationFrame(loop)` accumulates `dt` into `dropAccum` and advances gravity when it passes `dropInterval`; `draw()` runs every frame and redraws everything from state (no dirty tracking). Keyboard input is handled in a single `keydown` listener that mutates state directly and then calls `updateHUD()`.
- **Pause/restart**: `togglePause()` cancels/restarts the rAF loop; `init()` resets all state and is also the restart button's handler. `endGame()` cancels the loop and shows the overlay.
- **Scoring and speed**: `clearLines()` awards `LINE_SCORES[n] × level` (using the level before the update), then recomputes `level = floor(lines/10)+1` and `dropInterval = max(100, 1000 − (level−1)×90)`. Hard drop adds 2 points per row, soft drop 1 point per row.

## Coupling to keep in mind

- `COLS`/`ROWS`/`BLOCK` in `game.js` must match the canvas `width`/`height` attributes in `index.html` (`COLS×BLOCK` by `ROWS×BLOCK`). The next-piece preview hard-codes a 4×4 area and block size `NB = 30` inside `drawNext()`.
- Color indices in `COLORS` must stay aligned with the values used in `PIECES` (1 = I … 7 = L).
- The UI strings (`PAUSA`, `GAME OVER`, `Reiniciar`, control labels) are in Spanish and the README is in Spanish; keep new user-facing text consistent with that.
