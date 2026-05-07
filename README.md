# Generals Board Game

## Objective

- Eliminate or capture the opponent's Flag.
- OR move your own Flag to the opponent’s back row and survive one more turn.

## Pieces (21 per player)

- 5★ General (1)
- 4★ General (1)
- 3★ General (1)
- 2★ General (1)
- 1★ General (1)
- Colonel (1)
- Lt. Colonel (1)
- Major (1)
- Captain (1)
- 1st Lieutenant (1)
- 2nd Lieutenant (1)
- Sergeant (1)
- Spy (2)
- Private (6)
- Flag (1)

## Setup

- Each player is assigned a color: Blue or Red.
- Blue pieces start on rows 0-2, Red pieces start on rows 5-7.
- Each player has 21 pieces placed in their home rows, leaving 3 empty squares in each starting zone.

## Movement

- Players alternate turns.
- Move one piece per turn.
- Legal move is one square vertically or horizontally.
- Diagonal and multi-square moves are illegal.

## Combat rules

- Higher rank eliminates lower rank.
- Equal ranks eliminate each other.
- Spy eliminates any officer (Sergeant through 5★ General) and the Flag.
- Private eliminates Spy and Flag.
- Flag can eliminate opposing Flag if it moves into the enemy Flag's square.

## Winning conditions

- Opponent's Flag is eliminated.
- Your Flag reaches the opponent’s back row and survives one more turn.
- A player resigns or cannot move.

## How to run

1. Open a terminal in the project folder.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in two browser windows or share the URL with a friend.

## How to play

- Enter a room name to create or join a game.
- The first player becomes Blue, the second player becomes Red.
- Blue goes first.
- Click a friendly unit to select it, then click a legal target tile to move or attack.
- The game validates moves on the server and broadcasts the state to both players.

## Notes

- The board is an 8x8 grid.
- The game enforces legal movement and challenge rules.
- The server tracks the Flag survival win condition.
