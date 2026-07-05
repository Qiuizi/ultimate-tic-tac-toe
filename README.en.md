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
- Online room-code MVP: mock preview by default, cross-device sync when Supabase is configured.
- In-page rules modal for new players.
- Clear hints for whose turn it is, which board is forced, and when free choice is allowed.
- Highlighted playable boards, small-board wins, and big-board wins.
- Friendly feedback for invalid clicks.
- Full move history with a collapsed recent view and an expand option.
- Undo for the current game; two-player mode undoes one move, and computer mode usually undoes the player + AI round.
- Scoreboard for `X` wins, `O` wins, and draws.
- Score persistence with `localStorage`.
- Responsive layout for desktop and mobile screens.

## Online Mode Status

v1.3.0 has started the online-play architecture work. The current code includes:

- an online mode entry,
- create room / join room / leave room UI,
- 6-character room codes, room state, and a local online session state,
- a default mock adapter that uses in-memory rooms to simulate room creation, joining, subscriptions, and version conflicts,
- a Supabase Realtime adapter that stores authoritative room state in a `rooms` table and syncs boards with Postgres Changes.

Without Supabase configuration, online mode keeps using the mock preview. It does not access the network and does not affect local two-player or computer modes.

### Supabase Setup

Real cross-device online play requires a Supabase project:

1. Create a project in the Supabase Dashboard.
2. Open SQL Editor and run [docs/supabase.sql](./docs/supabase.sql).
3. In Database Publications / Realtime settings, confirm `public.rooms` is enabled for Postgres Changes.
4. Configure the public frontend values before building:

```bash
ONLINE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-public-browser-key
```

For local development, create `.env.local`:

```bash
ONLINE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-public-browser-key
```

These names are also supported:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-browser-key
```

`.env.local` is ignored by git and should not be committed. `npm run dev` serves `src/config.js` dynamically from `.env.local` or the current environment. Without config, online mode automatically uses the mock adapter.

This is a static site without Vite / Webpack. `npm run build` writes those public values into `dist/src/config.js`. GitHub Pages injects public config from GitHub Actions Variables. These values are included in the browser bundle, so only use a publishable / anon public key. Never put privileged server keys, secret keys, or database login credentials in frontend config.

MVP boundaries:

- Supports creating rooms, joining rooms, copying room codes, turn-limited moves, board sync, game-end sync, and leaving rooms.
- No accounts, friends, matchmaking, chat, leaderboard, spectators, or complete reconnect flow.
- No server-side referee; frontend rules and database version checks do not provide strong anti-cheat protection.
- Room restore after page refresh is not implemented yet. Refreshing requires creating or joining a room again.

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
node --check src/room.js
node --check src/online.js
node --check src/online-supabase.js
```

## Build

```bash
npm run build
```

The static output is written to `dist/`. If `ONLINE_PROVIDER`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`, or the compatible `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, are set, the build script writes public Supabase config. Without them, online mode uses the mock adapter.

For GitHub Pages online mode, configure these public repository variables in `Settings` → `Secrets and variables` → `Actions` → `Variables`:

```txt
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

The deploy workflow sets `ONLINE_PROVIDER=supabase` during the build step and reads those two public variables. Do not put privileged server keys, secret keys, or database login credentials in Actions Variables / Secrets for frontend builds.

## Project Structure

```txt
.
├── index.html
├── package.json
├── docs/
│   └── supabase.sql # Supabase rooms table and MVP RLS policies
├── scripts/
│   ├── build.mjs
│   └── dev-server.mjs
├── src/
│   ├── app.js        # UI rendering, interaction, mode, history, undo, and score state
│   ├── config.js     # Default empty online config, build can inject public Supabase config
│   ├── game.js       # Ultimate rules, win checks, and AI
│   ├── online.js     # Online adapter selector: Supabase when configured, mock otherwise
│   ├── online-mock.js
│   ├── online-supabase.js
│   ├── room.js       # Room code, room state, and online session utilities
│   └── styles.css
├── tests/
│   └── e2e/
│       └── app.spec.js
└── test/
    └── game.test.js
```

## Future Improvements

- Tune the hard AI evaluation so it makes fewer bad board-sending decisions.
- Add page-refresh restore and clearer disconnect states for online mode.
- Move deeper AI search into a Web Worker if the search depth is increased.
- Add a fuller review or replay view on top of the complete move history.
