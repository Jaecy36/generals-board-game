const socket = io();
let selectedCell = null;
let selectedPieceId = null;
let localColor = null;
let currentState = null;
let currentRoom = null;

const boardEl = document.getElementById('board');
const pieceTrayEl = document.getElementById('pieceTray');
const statusEl = document.getElementById('status');
const playerColorEl = document.getElementById('playerColor');
const turnInfoEl = document.getElementById('turnInfo');
const gameResultEl = document.getElementById('gameResult');
const moveIndicatorEl = document.getElementById('moveIndicator');
const setupStatusEl = document.getElementById('setupStatus');
const battleRulesEl = document.getElementById('battleRules');
const gameAreaEl = document.querySelector('.game-area');
const joinBtn = document.getElementById('joinBtn');
const roomIdInput = document.getElementById('roomId');
const startGameBtn = document.getElementById('startGameBtn');
const setupControls = document.getElementById('setupControls');

const HIDDEN_ICON = '?';
const HIDDEN_LABEL = '?';

const UNIT_ICON = {
  general5: '5★',
  general4: '4★',
  general3: '3★',
  general2: '2★',
  general1: '1★',
  colonel: 'COL',
  lt_colonel: 'LtCol',
  major: 'Maj',
  captain: 'Capt',
  lieutenant1: '1Lt',
  lieutenant2: '2Lt',
  sergeant: 'Sgt',
  private: 'Pvt',
  spy: 'Spy',
  flag: '⚑',
  unknown: HIDDEN_ICON
};

const UNIT_LABELS = {
  general5: '5★ General',
  general4: '4★ General',
  general3: '3★ General',
  general2: '2★ General',
  general1: '1★ General',
  colonel: 'Colonel',
  lt_colonel: 'Lt. Colonel',
  major: 'Major',
  captain: 'Captain',
  lieutenant1: '1st Lieutenant',
  lieutenant2: '2nd Lieutenant',
  sergeant: 'Sergeant',
  private: 'Private',
  spy: 'Spy',
  flag: 'Flag',
  unknown: 'Unknown'
};

function renderPieceTray(state) {
  pieceTrayEl.innerHTML = '';
  if (state.phase !== 'setup') {
    pieceTrayEl.classList.add('hidden');
    return;
  }

  pieceTrayEl.classList.remove('hidden');
  const header = document.createElement('div');
  header.className = 'piece-tray-header';
  header.textContent = 'Available setup pieces';
  pieceTrayEl.appendChild(header);

  const unplaced = state.units.filter((unit) => unit.color === localColor && !unit.pos);
  if (unplaced.length === 0) {
    pieceTrayEl.innerHTML = '<div class="piece-tray-empty">All pieces placed. Click Ready when you are finished.</div>';
    return;
  }

  unplaced.forEach((unit) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `piece-card piece-${unit.type}`;
    if (selectedPieceId === unit.id) card.classList.add('selected');
    card.dataset.pieceId = unit.id;
    card.innerHTML = `<span class="piece-icon">${UNIT_ICON[unit.type]}</span><span class="piece-label">${UNIT_LABELS[unit.type]}</span>`;
    card.addEventListener('click', () => {
      selectedPieceId = unit.id;
      selectedCell = null;
      renderPieceTray(state);
      renderBoard(state);
    });
    pieceTrayEl.appendChild(card);
  });
}

joinBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  if (!roomId) {
    statusEl.textContent = 'Enter a room name first.';
    return;
  }
  currentRoom = roomId;
  socket.emit('joinRoom', roomId);
  statusEl.textContent = `Joining room ${roomId}...`;
});

startGameBtn.addEventListener('click', () => {
  if (!currentRoom) return;
  socket.emit('readyUp', currentRoom);
});

socket.on('joined', ({ roomId, color }) => {
  localColor = color;
  statusEl.textContent = `Joined ${roomId} as ${color}. Arrange your pieces on your rows.`;
  playerColorEl.textContent = `You are ${color.toUpperCase()}.`;
  gameAreaEl.classList.remove('hidden');
});

socket.on('stateUpdate', (state) => {
  currentState = state;
  renderBoard(state);
  renderPieceTray(state);
  updateInfo(state);
});

socket.on('errorMessage', (message) => {
  statusEl.textContent = message;
});

function mapDisplayRow(row) {
  return localColor === 'blue' ? 7 - row : row;
}

function mapActualRow(row) {
  return localColor === 'blue' ? 7 - row : row;
}

function isInSetupZone(color, row) {
  return color === 'blue' ? row <= 2 : row >= 5;
}

function renderBoard(state) {
  boardEl.innerHTML = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const actualRow = mapActualRow(row);
      const cell = document.createElement('button');
      const isLight = (row + col) % 2 === 0;
      cell.className = `cell ${isLight ? 'light' : 'dark'}`;
      cell.dataset.row = actualRow;
      cell.dataset.col = col;
      const unit = state.units.find((u) => u.pos && u.pos[0] === actualRow && u.pos[1] === col);
      if (unit) {
        const icon = unit.hidden ? HIDDEN_ICON : UNIT_ICON[unit.type];
        const label = unit.hidden ? HIDDEN_LABEL : UNIT_ICON[unit.type];
        const title = unit.hidden ? HIDDEN_LABEL : UNIT_LABELS[unit.type];
        const unitHtml = `<div class="unit ${unit.hidden ? 'enemy' : unit.color}" title="${title}"><span class="icon">${icon}</span><span class="label">${label}</span></div>`;
        cell.innerHTML = unitHtml;
      }
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
  }

  if (selectedCell) {
    const selectedButton = boardEl.querySelector(`.cell[data-row="${selectedCell[0]}"][data-col="${selectedCell[1]}"]`);
    if (selectedButton) selectedButton.classList.add('selected');
    markTargets(selectedCell);
  } else if (selectedPieceId) {
    markTargets(null);
  }
}

function updateInfo(state) {
  const phaseText = state.phase === 'setup' ? 'Setup phase' : 'Playing phase';
  turnInfoEl.textContent = state.phase === 'setup' ? `${phaseText}` : `Turn: ${state.turn.toUpperCase()}`;
  gameResultEl.textContent = state.winner ? `Winner: ${state.winner.toUpperCase()}` : '';

  if (state.phase === 'setup') {
    setupControls.classList.remove('hidden');
    battleRulesEl.classList.add('hidden');
    pieceTrayEl.classList.remove('hidden');
    const unplacedCount = state.units.filter((unit) => unit.color === localColor && !unit.pos).length;
    const myReady = state.setupReady ? state.setupReady[localColor] : false;
    startGameBtn.disabled = myReady || unplacedCount > 0;
    startGameBtn.textContent = myReady ? 'Ready' : 'Ready to start';
    const readyFor = state.setupReady ? state.setupReady : { blue: false, red: false };
    setupStatusEl.textContent = unplacedCount > 0
      ? `Place ${unplacedCount} remaining pieces before readying.`
      : `Ready: Blue ${readyFor.blue ? '✓' : '✗'}, Red ${readyFor.red ? '✓' : '✗'}`;
    statusEl.textContent = myReady ? 'Waiting for the opponent to finish setup.' : 'Arrange your pieces on your setup rows and click Ready.';
  } else {
    setupControls.classList.add('hidden');
    setupStatusEl.textContent = '';
    pieceTrayEl.classList.add('hidden');
    battleRulesEl.classList.remove('hidden');
    selectedPieceId = null;
  }

}

function onCellClick(event) {
  if (!currentState || !localColor) return;
  if (currentState.winner) return;
  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);
  const clicked = [row, col];
  const unit = currentState.units.find((u) => u.pos && u.pos[0] === row && u.pos[1] === col);

  if (currentState.phase === 'setup' && selectedPieceId && !unit && isInSetupZone(localColor, row)) {
    socket.emit('placePiece', { roomId: currentRoom, pieceId: selectedPieceId, to: clicked });
    selectedPieceId = null;
    selectedCell = null;
    return;
  }

  if (unit && unit.color === localColor) {
    selectedCell = clicked;
    selectedPieceId = null;
    renderBoard(currentState);
    return;
  }

  if (!selectedCell) return;
  socket.emit('makeMove', { roomId: currentRoom, from: selectedCell, to: clicked });
  selectedCell = null;
}

function markTargets(from) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const target = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
      if (!target) continue;
      target.classList.remove('attackable', 'placeable');
      const occupied = currentState.units.some((u) => u.pos && u.pos[0] === row && u.pos[1] === col);
      const isSetupZone = isInSetupZone(localColor, row);

      if (currentState.phase === 'setup') {
        if (selectedPieceId && !occupied && isSetupZone) {
          target.classList.add('placeable');
        }
        if (from) {
          const source = currentState.units.find((u) => u.pos && u.pos[0] === from[0] && u.pos[1] === from[1]);
          if (source && source.color === localColor && Math.abs(row - from[0]) + Math.abs(col - from[1]) === 1 && !occupied && isSetupZone) {
            target.classList.add('attackable');
          }
        }
      } else {
        if (from && Math.abs(row - from[0]) + Math.abs(col - from[1]) === 1) {
          target.classList.add('attackable');
        }
      }
    }
  }
}
