# Ultimate Tic-Tac-Toe

Live demo: <https://qiuizi.github.io/ultimate-tic-tac-toe/>

![Ultimate Tic-Tac-Toe Screenshot](./assets/screenshot.png)

A vanilla JavaScript implementation of Ultimate Tic-Tac-Toe.

Unlike regular tic-tac-toe, this game uses 9 small boards. The cell you choose decides which small board your opponent has to play in next, so the game has an extra layer of strategy around where you send your opponent.

## What Is Ultimate Tic-Tac-Toe

- The full board is made of 9 small tic-tac-toe boards.
- Each small board is also a 3 x 3 grid.
- After you play a cell, your opponent must play in the matching small board.
- If that target board is already won or full, your opponent can choose any available board.
- Winning a small board claims that spot on the big board.
- The first player to claim three small boards in a row wins the game.
- If every playable board is finished and nobody has a big-board line, the game is a draw.

## Features

- Local two-player mode.
- Computer mode: player is `X`, computer is `O`.
- Normal and hard AI options.
- In-page rules modal for new players.
- Clear hints for whose turn it is, which board is forced, and when free choice is allowed.
- Highlighted playable boards, small-board wins, and big-board wins.
- Friendly feedback for invalid clicks.
- Full move history with a collapsed recent view and an expand option.
- Undo for the current game; two-player mode undoes one move, and computer mode usually undoes the player + AI round.
- Scoreboard for `X` wins, `O` wins, and draws.
- Score persistence with `localStorage`.
- Responsive layout for desktop and mobile screens.

## AI Strategy

This is Ultimate Tic-Tac-Toe, so the AI does not use a full Minimax search over all 81 cells.

Normal AI uses a heuristic evaluation. It looks at things like:

- immediate big-board wins,
- blocking the player's big-board wins,
- small-board value,
- where the move sends the opponent next,
- center and corner positions.

Hard AI adds a shallow Alpha-Beta search on top of the same evaluation:

- search depth is 3 plies,
- leaf nodes use the heuristic evaluator,
- there is a time guard of about 950ms to avoid freezing the page.

Hard mode is stronger than normal mode, but it is not a perfect or unbeatable AI.

## Tech Stack

- HTML
- CSS
- JavaScript ES Modules
- Node.js `node:test`
- Playwright
- No frontend framework

## Run Locally

```bash
npm run dev
```

Then open:

```txt
http://localhost:3000
```

## Test

```bash
npm test
```

Run browser end-to-end tests:

```bash
npm run test:e2e
```

The Playwright tests cover page loading, the rules modal, two-player mode, computer mode, undo, move history, and a mobile smoke check.

You can also run syntax checks directly:

```bash
node --check src/game.js
node --check src/app.js
```

## Build

```bash
npm run build
```

The static output is written to `dist/`.

## Project Structure

```txt
.
├── index.html
├── package.json
├── scripts/
│   ├── build.mjs
│   └── dev-server.mjs
├── src/
│   ├── app.js        # UI rendering, interaction, mode, history, undo, and score state
│   ├── game.js       # Ultimate rules, win checks, and AI
│   └── styles.css
├── tests/
│   └── e2e/
│       └── app.spec.js
└── test/
    └── game.test.js
```

## Future Improvements

- Tune the hard AI evaluation so it makes fewer bad board-sending decisions.
- Move deeper AI search into a Web Worker if the search depth is increased.
- Add a fuller review or replay view on top of the complete move history.
