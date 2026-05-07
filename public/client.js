const socket = io();
let selectedCell = null;
let localColor = null;
let currentState = null;
let currentRoom = null;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const playerColorEl = document.getElementById('playerColor');
const turnInfoEl = document.getElementById('turnInfo');
const gameResultEl = document.getElementById('gameResult');
const setupStatusEl = document.getElementById('setupStatus');
const logListEl = document.getElementById('logList');
const gameAreaEl = document.querySelector('.game-area');
const joinBtn = document.getElementById('joinBtn');
const roomIdInput = document.getElementById('roomId');
const legendGrid = document.getElementById('legendGrid');
const startGameBtn = document.getElementById('startGameBtn');
const setupControls = document.getElementById('setupControls');

const UNIT_ICON = {
  general5: '5★',
  general4: '4★',
  general3: '3★',
  general2: '2★',
  general1: '1★',
  colonel: 'COL',
  lt_colonel: 'LtC',
  major: 'Maj',
  captain: 'Capt',
  lieutenant1: '1Lt',
  lieutenant2: '2Lt',
  sergeant: 'Sgt',
  private: 'Pvt',
  spy: 'Spy',
  flag: '⚑'
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
  flag: 'Flag'
};

function renderLegend() {
  legendGrid.innerHTML = '';
  Object.keys(UNIT_ICON).forEach((key) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-icon">${UNIT_ICON[key]}</span><span class="legend-name">${UNIT_LABELS[key]}</span>`;
    legendGrid.appendChild(item);
  });
}

renderLegend();

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
  updateInfo(state);
});

socket.on('errorMessage', (message) => {
  statusEl.textContent = message;
});

function renderBoard(state) {
  boardEl.innerHTML = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('button');
      const isLight = (row + col) % 2 === 0;
      cell.className = `cell ${isLight ? 'light' : 'dark'}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      const unit = state.units.find((u) => u.pos[0] === row && u.pos[1] === col);
      if (unit) {
        const unitHtml = `<div class="unit ${unit.color}" title="${UNIT_LABELS[unit.type]}"><span class="icon">${UNIT_ICON[unit.type]}</span><span class="label">${UNIT_ICON[unit.type]}</span></div>`;
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
  }
}

function updateInfo(state) {
  const phaseText = state.phase === 'setup' ? 'Setup phase' : 'Playing phase';
  turnInfoEl.textContent = state.phase === 'setup' ? `${phaseText}` : `Turn: ${state.turn.toUpperCase()}`;
  gameResultEl.textContent = state.winner ? `Winner: ${state.winner.toUpperCase()}` : '';

  if (state.phase === 'setup') {
    setupControls.classList.remove('hidden');
    const myReady = state.setupReady ? state.setupReady[localColor] : false;
    startGameBtn.disabled = myReady;
    startGameBtn.textContent = myReady ? 'Ready' : 'Ready to start';
    const readyFor = state.setupReady ? state.setupReady : { blue: false, red: false };
    setupStatusEl.textContent = `Ready: Blue ${readyFor.blue ? '✓' : '✗'}, Red ${readyFor.red ? '✓' : '✗'}`;
    statusEl.textContent = myReady ? 'Waiting for the opponent to finish setup.' : 'Arrange your pieces on your setup rows and click Ready.';
  } else {
    setupControls.classList.add('hidden');
    setupStatusEl.textContent = '';
  }

  logListEl.innerHTML = '';
  state.log.slice(0, 8).forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = entry;
    logListEl.appendChild(li);
  });
}

function onCellClick(event) {
  if (!currentState || !localColor) return;
  if (currentState.winner) return;
  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);
  const clicked = [row, col];
  const unit = currentState.units.find((u) => u.pos[0] === row && u.pos[1] === col);

  if (unit && unit.color === localColor) {
    selectedCell = clicked;
    renderBoard(currentState);
    return;
  }

  if (!selectedCell) return;
  socket.emit('makeMove', { roomId: currentRoom, from: selectedCell, to: clicked });
  selectedCell = null;
}

function markTargets(from) {
  const source = currentState.units.find((u) => u.pos[0] === from[0] && u.pos[1] === from[1]);
  if (!source) return;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const distance = Math.abs(row - from[0]) + Math.abs(col - from[1]);
      const target = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
      if (!target) continue;
      if (currentState.phase === 'setup') {
        const isOwnZone = source.color === 'blue' ? row <= 2 : row >= 5;
        const occupied = currentState.units.some((u) => u.pos[0] === row && u.pos[1] === col);
        if (isOwnZone && !occupied) {
          target.classList.add('attackable');
        }
      } else {
        if (distance === 1) {
          target.classList.add('attackable');
        }
      }
    }
  }
}
