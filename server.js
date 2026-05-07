const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TURN_ORDER = ['blue', 'red'];
const MAX_PLAYERS = 2;
const ROOMS = {}; // roomId -> { players: [], state }

const UNIT_STATS = {
  general: { move: 1, attack: 6, icon: '♚' },
  infantry: { move: 2, attack: 3, icon: '♙' },
  cavalry: { move: 3, attack: 4, icon: '♞' },
  artillery: { move: 1, attack: 5, icon: '♖' }
};
const BOARD_SIZE = 8;
const START_POSITIONS = {
  blue: [
    { type: 'general', pos: [0, 3] },
    { type: 'infantry', pos: [1, 2] },
    { type: 'infantry', pos: [1, 4] },
    { type: 'cavalry', pos: [0, 1] },
    { type: 'artillery', pos: [0, 6] }
  ],
  red: [
    { type: 'general', pos: [7, 4] },
    { type: 'infantry', pos: [6, 3] },
    { type: 'infantry', pos: [6, 5] },
    { type: 'cavalry', pos: [7, 6] },
    { type: 'artillery', pos: [7, 1] }
  ]
};

app.use(express.static('public'));

function createGameState(roomId) {
  const units = [];
  for (const color of Object.keys(START_POSITIONS)) {
    START_POSITIONS[color].forEach(({ type, pos }) => {
      units.push({ id: uuidv4(), type, color, pos, health: 1 });
    });
  }
  return {
    roomId,
    turn: 'blue',
    winner: null,
    units,
    log: ['Game created. Blue moves first.']
  };
}

function getUnitAt(state, x, y) {
  return state.units.find((unit) => unit.pos[0] === x && unit.pos[1] === y);
}

function isInBounds(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function manhattanDistance(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function canMove(unit, x, y, state) {
  if (!isInBounds(x, y)) return false;
  const distance = manhattanDistance(unit.pos, [x, y]);
  if (distance === 0 || distance > UNIT_STATS[unit.type].move) return false;
  const target = getUnitAt(state, x, y);
  return !target || target.color !== unit.color;
}

function applyAttack(attacker, defender, state) {
  const attackPower = UNIT_STATS[attacker.type].attack;
  const defendPower = UNIT_STATS[defender.type].attack;
  if (attackPower >= defendPower) {
    state.units = state.units.filter((unit) => unit.id !== defender.id);
    return `${attacker.color} ${attacker.type} defeated ${defender.color} ${defender.type}.`;
  }
  state.units = state.units.filter((unit) => unit.id !== attacker.id);
  return `${attacker.color} ${attacker.type} was defeated by ${defender.color} ${defender.type}.`;
}

function checkWinner(state) {
  const generals = state.units.filter((unit) => unit.type === 'general');
  if (generals.length !== 2) {
    return generals[0]?.color || null;
  }
  return null;
}

io.on('connection', (socket) => {
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
    }

    const player = room.players.find((player) => player.id === socket.id);
    socket.emit('joined', { roomId, color: player.color });
    io.to(roomId).emit('stateUpdate', room.state);

    if (room.players.length === MAX_PLAYERS) {
      room.state.log.push('Both players joined. Game begins.');
      io.to(roomId).emit('stateUpdate', room.state);
    }
  });

  socket.on('makeMove', ({ roomId, from, to }) => {
    const room = ROOMS[roomId];
    if (!room) return;
    if (room.state.winner) return;

    const player = room.players.find((player) => player.id === socket.id);
    if (!player) return;
    if (room.state.turn !== player.color) {
      socket.emit('errorMessage', 'It is not your turn.');
      return;
    }

    const unit = getUnitAt(room.state, ...from);
    if (!unit || unit.color !== player.color) {
      socket.emit('errorMessage', 'Invalid unit selection.');
      return;
    }
    if (!canMove(unit, ...to, room.state)) {
      socket.emit('errorMessage', 'Invalid move.');
      return;
    }

    const target = getUnitAt(room.state, ...to);
    let actionText = `${player.color} moved ${unit.type} from ${from} to ${to}.`;
    unit.pos = [...to];
    if (target && target.color !== player.color) {
      actionText = applyAttack(unit, target, room.state);
    }

    room.state.turn = TURN_ORDER[(TURN_ORDER.indexOf(room.state.turn) + 1) % TURN_ORDER.length];
    room.state.log.unshift(actionText);
    const winner = checkWinner(room.state);
    if (winner) {
      room.state.winner = winner;
      room.state.log.unshift(`${winner} wins!`);
    }

    io.to(roomId).emit('stateUpdate', room.state);
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
