const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3001;
const TURN_ORDER = ['blue', 'red'];
const MAX_PLAYERS = 2;
const ROOMS = {}; // roomId -> { players: [], state }

const SETUP_ROWS = {
  blue: [0, 1, 2],
  red: [5, 6, 7]
};

const PIECE_INFO = {
  general5: { label: '5★ General', rank: 13, icon: '♔' },
  general4: { label: '4★ General', rank: 12, icon: '♕' },
  general3: { label: '3★ General', rank: 11, icon: '♖' },
  general2: { label: '2★ General', rank: 10, icon: '♗' },
  general1: { label: '1★ General', rank: 9, icon: '♘' },
  colonel: { label: 'Colonel', rank: 8, icon: '♜' },
  lt_colonel: { label: 'Lt. Colonel', rank: 7, icon: '♝' },
  major: { label: 'Major', rank: 6, icon: '♟︎' },
  captain: { label: 'Captain', rank: 5, icon: '⚔' },
  lieutenant1: { label: '1st Lieutenant', rank: 4, icon: '⚜' },
  lieutenant2: { label: '2nd Lieutenant', rank: 3, icon: '✪' },
  sergeant: { label: 'Sergeant', rank: 2, icon: '⛨' },
  private: { label: 'Private', rank: 1, icon: '⚑' },
  spy: { label: 'Spy', rank: 0, icon: '☠' },
  flag: { label: 'Flag', rank: -1, icon: '⚑' }
};
const BOARD_SIZE = 8;
const PIECE_ORDER = [
  'general5', 'general4', 'general3', 'general2', 'general1',
  'colonel', 'lt_colonel', 'major', 'captain', 'lieutenant1',
  'lieutenant2', 'sergeant', 'spy', 'spy', 'private', 'private',
  'private', 'private', 'private', 'private', 'flag'
];

app.use(express.static('public'));

function createGameState(roomId) {
  const units = [];
  for (const color of Object.keys(SETUP_ROWS)) {
    PIECE_ORDER.forEach((type) => {
      units.push({ id: uuidv4(), type, color, pos: null });
    });
  }
  return {
    roomId,
    turn: 'blue',
    phase: 'setup',
    setupReady: { blue: false, red: false },
    winner: null,
    pendingFlagWin: null,
    pendingFlagTurn: null,
    lastMove: null,
    units,
    log: ['Game created. Blue moves first. Set up your pieces on your first three rows.']
  };
}

function getUnitAt(state, x, y) {
  return state.units.find((unit) => unit.pos && unit.pos[0] === x && unit.pos[1] === y);
}

function isInBounds(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function isInSetupZone(color, x, y) {
  return SETUP_ROWS[color].includes(x);
}

function canMove(unit, x, y, state) {
  if (!isInBounds(x, y)) return false;
  const target = getUnitAt(state, x, y);
  if (state.phase === 'setup') {
    if (unit.color !== 'blue' && unit.color !== 'red') return false;
    if (!isInSetupZone(unit.color, x, y)) return false;
    if (target) return false;
    return isInSetupZone(unit.color, unit.pos[0], unit.pos[1]);
  }
  const distance = Math.abs(unit.pos[0] - x) + Math.abs(unit.pos[1] - y);
  if (distance !== 1) return false;
  return !target || target.color !== unit.color;
}

function calculateVisibleUnits(state, color) {
  const ownUnits = state.units.filter((unit) => unit.color === color && unit.pos);
  const visible = ownUnits.map((unit) => ({ ...unit, hidden: false }));
  const isVisiblePosition = (x, y) => ownUnits.some((unit) => Math.abs(unit.pos[0] - x) + Math.abs(unit.pos[1] - y) <= 1);
  state.units.forEach((unit) => {
    if (unit.pos && unit.color !== color && isVisiblePosition(unit.pos[0], unit.pos[1])) {
      visible.push({ ...unit, hidden: true, type: 'unknown' });
    }
  });
  return visible;
}

function isOfficer(type) {
  return type !== 'private' && type !== 'spy' && type !== 'flag';
}

function resolveCombat(attacker, defender, state) {
  const attackerRank = PIECE_INFO[attacker.type].rank;
  const defenderRank = PIECE_INFO[defender.type].rank;

  if (attacker.type === defender.type) {
    state.units = state.units.filter((unit) => unit.id !== attacker.id && unit.id !== defender.id);
    return `${attacker.color} ${PIECE_INFO[attacker.type].label} and ${defender.color} ${PIECE_INFO[defender.type].label} eliminated each other.`;
  }

  if (attacker.type === 'spy' && (defender.type === 'flag' || isOfficer(defender.type))) {
    state.units = state.units.filter((unit) => unit.id !== defender.id);
    return `${attacker.color} Spy eliminated ${defender.color} ${PIECE_INFO[defender.type].label}.`;
  }

  if (attacker.type === 'private' && (defender.type === 'spy' || defender.type === 'flag')) {
    state.units = state.units.filter((unit) => unit.id !== defender.id);
    return `${attacker.color} Private eliminated ${defender.color} ${PIECE_INFO[defender.type].label}.`;
  }

  if (attacker.type === 'flag' && defender.type === 'flag') {
    state.units = state.units.filter((unit) => unit.id !== defender.id);
    return `${attacker.color} Flag captured ${defender.color} Flag.`;
  }

  if (attackerRank > defenderRank) {
    state.units = state.units.filter((unit) => unit.id !== defender.id);
    return `${attacker.color} ${PIECE_INFO[attacker.type].label} defeated ${defender.color} ${PIECE_INFO[defender.type].label}.`;
  }

  if (attackerRank < defenderRank) {
    state.units = state.units.filter((unit) => unit.id !== attacker.id);
    return `${attacker.color} ${PIECE_INFO[attacker.type].label} was defeated by ${defender.color} ${PIECE_INFO[defender.type].label}.`;
  }

  state.units = state.units.filter((unit) => unit.id !== attacker.id && unit.id !== defender.id);
  return `${attacker.color} ${PIECE_INFO[attacker.type].label} and ${defender.color} ${PIECE_INFO[defender.type].label} eliminated each other.`;
}

function checkWinner(state) {
  const blueFlag = state.units.find((unit) => unit.type === 'flag' && unit.color === 'blue');
  const redFlag = state.units.find((unit) => unit.type === 'flag' && unit.color === 'red');
  if (!blueFlag) return 'red';
  if (!redFlag) return 'blue';
  return null;
}

io.on('connection', (socket) => {
  function emitRoomState(roomId) {
    const room = ROOMS[roomId];
    if (!room) return;
    room.players.forEach((player) => {
      if (room.state.phase === 'setup') {
        io.to(player.id).emit('stateUpdate', room.state);
      } else {
        const visibleState = {
          ...room.state,
          units: calculateVisibleUnits(room.state, player.color)
        };
        io.to(player.id).emit('stateUpdate', visibleState);
      }
    });
  }

  socket.on('joinRoom', (roomId) => {
    const existing = ROOMS[roomId];
    if (existing && existing.players.length >= MAX_PLAYERS) {
      socket.emit('errorMessage', 'This room is full.');
      return;
    }

    socket.join(roomId);
    if (!existing) {
      ROOMS[roomId] = { players: [], state: createGameState(roomId) };
    }

    const room = ROOMS[roomId];
    if (!room.players.find((player) => player.id === socket.id)) {
      const color = room.players.length === 0 ? 'blue' : 'red';
      room.players.push({ id: socket.id, color });
      room.state.log.unshift(`${color} joined the room.`);
    }

    const player = room.players.find((player) => player.id === socket.id);
    socket.emit('joined', { roomId, color: player.color });
    emitRoomState(roomId);

    if (room.players.length === MAX_PLAYERS && room.state.phase === 'setup') {
      room.state.log.unshift('Both players are in the room. Arrange your pieces and click ready.');
      emitRoomState(roomId);
    }
  });

  socket.on('makeMove', ({ roomId, from, to }) => {
    const room = ROOMS[roomId];
    if (!room) return;
    if (room.state.winner) return;

    const player = room.players.find((player) => player.id === socket.id);
    if (!player) return;

    const unit = getUnitAt(room.state, ...from);
    if (!unit || unit.color !== player.color) {
      socket.emit('errorMessage', 'Invalid unit selection.');
      return;
    }
    if (room.state.phase === 'playing' && room.state.turn !== player.color) {
      socket.emit('errorMessage', 'It is not your turn.');
      return;
    }
    if (!canMove(unit, ...to, room.state)) {
      socket.emit('errorMessage', 'Invalid move.');
      return;
    }

    const target = getUnitAt(room.state, ...to);
    let actionText = `${player.color} moved ${PIECE_INFO[unit.type].label} from ${from} to ${to}.`;
    unit.pos = [...to];
    if (room.state.phase === 'playing' && target && target.color !== player.color) {
      actionText = resolveCombat(unit, target, room.state);
    }

    if (room.state.phase === 'setup') {
      room.state.setupReady[player.color] = false;
      room.state.log.unshift(`${player.color} rearranged pieces during setup.`);
    }

    const attackerStillAlive = room.state.units.some((u) => u.id === unit.id);
    if (room.state.phase === 'playing' && unit.type === 'flag' && attackerStillAlive) {
      const opponentColor = player.color === 'blue' ? 'red' : 'blue';
      const backRow = unit.color === 'blue' ? BOARD_SIZE - 1 : 0;
      if (unit.pos[0] === backRow) {
        room.state.pendingFlagWin = unit.color;
        room.state.pendingFlagTurn = opponentColor;
        actionText += ` ${unit.color} Flag reached the enemy back row and must survive one turn to win.`;
      }
    }

    if (room.state.phase === 'playing' && room.state.pendingFlagWin && room.state.pendingFlagTurn === player.color) {
      const pendingFlag = room.state.units.find((u) => u.type === 'flag' && u.color === room.state.pendingFlagWin);
      const backRow = room.state.pendingFlagWin === 'blue' ? BOARD_SIZE - 1 : 0;
      if (pendingFlag && pendingFlag.pos[0] === backRow) {
        room.state.winner = room.state.pendingFlagWin;
        room.state.log.unshift(`${room.state.winner} wins by Flag reaching the opposite end and surviving one turn!`);
      }
      room.state.pendingFlagWin = null;
      room.state.pendingFlagTurn = null;
    }

    if (!room.state.winner && room.state.phase === 'playing') {
      room.state.turn = TURN_ORDER[(TURN_ORDER.indexOf(room.state.turn) + 1) % TURN_ORDER.length];
    }

    room.state.lastMove = { text: actionText, player: player.color };
    room.state.log.unshift(actionText);
    if (room.state.phase === 'playing') {
      const winner = checkWinner(room.state);
      if (winner) {
        room.state.winner = winner;
        room.state.log.unshift(`${winner} wins!`);
      }
    }

    emitRoomState(roomId);
  });

  socket.on('placePiece', ({ roomId, pieceId, to }) => {
    const room = ROOMS[roomId];
    if (!room) return;
    if (room.state.winner) return;
    if (room.state.phase !== 'setup') return;

    const player = room.players.find((player) => player.id === socket.id);
    if (!player) return;

    const piece = room.state.units.find((unit) => unit.id === pieceId);
    if (!piece || piece.color !== player.color || piece.pos) {
      socket.emit('errorMessage', 'Invalid piece selection.');
      return;
    }
    const [x, y] = to;
    if (!isInBounds(x, y) || !isInSetupZone(player.color, x, y) || getUnitAt(room.state, x, y)) {
      socket.emit('errorMessage', 'Invalid placement.');
      return;
    }

    piece.pos = [x, y];
    room.state.setupReady[player.color] = false;
    const actionText = `${player.color} placed ${PIECE_INFO[piece.type].label} at ${to}.`;
    room.state.lastMove = { text: actionText, player: player.color };
    room.state.log.unshift(actionText);
    emitRoomState(roomId);
  });

  socket.on('readyUp', (roomId) => {
    const room = ROOMS[roomId];
    if (!room) return;
    const player = room.players.find((player) => player.id === socket.id);
    if (!player) return;

    const unplaced = room.state.units.filter((unit) => unit.color === player.color && !unit.pos).length;
    if (unplaced > 0) {
      socket.emit('errorMessage', `Place all ${unplaced} remaining pieces before readying.`);
      return;
    }

    room.state.setupReady[player.color] = true;
    const actionText = `${player.color} is ready to begin.`;
    room.state.lastMove = { text: actionText, player: player.color };
    room.state.log.unshift(actionText);
    if (room.players.length === MAX_PLAYERS && room.state.setupReady.blue && room.state.setupReady.red) {
      room.state.phase = 'playing';
      room.state.turn = 'blue';
      room.state.log.unshift('Both players are ready. Game begins.');
    }
    emitRoomState(roomId);
  });

  socket.on('disconnecting', () => {
    const rooms = Object.keys(socket.rooms).filter((r) => r !== socket.id);
    rooms.forEach((roomId) => {
      const room = ROOMS[roomId];
      if (!room) return;
      room.players = room.players.filter((player) => player.id !== socket.id);
      room.state.log.unshift('A player disconnected. Game ended.');
      room.state.winner = 'disconnected';
      io.to(roomId).emit('stateUpdate', room.state);
      delete ROOMS[roomId];
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
