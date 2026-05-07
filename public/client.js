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
const logListEl = document.getElementById('logList');
const gameAreaEl = document.querySelector('.game-area');
const joinBtn = document.getElementById('joinBtn');
const roomIdInput = document.getElementById('roomId');

const UNIT_ICON = {
  general: '♚',
  infantry: '♙',
  cavalry: '♞',
  artillery: '♖'
};

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

socket.on('joined', ({ roomId, color }) => {
  localColor = color;
  statusEl.textContent = `Joined ${roomId} as ${color}. Waiting for opponent...`;
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
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      const unit = state.units.find((u) => u.pos[0] === row && u.pos[1] === col);
      if (unit) {
        const unitHtml = `<div class="unit ${unit.color}"><span class="icon">${UNIT_ICON[unit.type]}</span><span class="label">${unit.type}</span></div>`;
        cell.innerHTML = unitHtml;
      }
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
  }

  if (selectedCell) {
    const selectedButton = boardEl.querySelector(`.cell[data-row="${selectedCell[0]}"][data-col="${selectedCell[1]}"]`);
    if (selectedButton) selectedButton.classList.add('selected');
    markAttackTargets(selectedCell);
  }
}

function updateInfo(state) {
  turnInfoEl.textContent = `Turn: ${state.turn.toUpperCase()}`;
  gameResultEl.textContent = state.winner ? `Winner: ${state.winner.toUpperCase()}` : '';

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

function markAttackTargets(from) {
  const source = currentState.units.find((u) => u.pos[0] === from[0] && u.pos[1] === from[1]);
  if (!source) return;
  const moveRange = source.type === 'cavalry' ? 3 : source.type === 'infantry' ? 2 : 1;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const distance = Math.abs(row - from[0]) + Math.abs(col - from[1]);
      if (distance > 0 && distance <= moveRange) {
        const target = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (target) target.classList.add('attackable');
      }
    }
  }
}
