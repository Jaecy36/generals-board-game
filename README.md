# Generals Online

A turn-based online board game prototype for friends to play together.

## How to run

1. Open a terminal in the project folder.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in two browser windows or share the URL with a friend.

## How to play

- Enter a room name to create or join a game.
- The first player becomes Blue, the second player becomes Red.
- Blue goes first.
- Click a friendly unit to select it, then click a target tile to move or attack.
- Win by eliminating the enemy general.

## Game pieces

- General: slow but powerful command piece.
- Infantry: balanced movement and attack.
- Cavalry: fast movement.
- Artillery: strong attack.

## Notes

- The server validates moves and broadcasts the game state to all players.
- The board is an 8x8 grid.
- A player can only move a unit if it is that player's turn.
