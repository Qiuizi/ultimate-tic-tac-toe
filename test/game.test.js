import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAYERS,
  AI_DIFFICULTIES,
  alphaBeta,
  applyMove,
  canPlayMove,
  createGameSnapshot,
  createInitialState,
  evaluateGameState,
  getAvailableBoards,
  getComputerMove,
  getHardComputerMove,
  getLegalMoves,
  getUndoMoveCount,
  getWinner,
  restoreGameSnapshot,
  shouldIgnoreScheduledComputerMove,
} from "../src/game.js";
import {
  createInitialRoomState,
  generateRoomCode,
  normalizeRoomCode,
} from "../src/room.js";
import {
  createRoom,
  joinRoom,
  resetMockOnlineState,
  updateRoomState,
} from "../src/online.js";

test("first move can be played anywhere and forces the matching target board", () => {
  const state = createInitialState();

  assert.equal(canPlayMove(state, 4, 0), true);

  const next = applyMove(state, 4, 0);

  assert.equal(next.boards[4].cells[0], PLAYERS.X);
  assert.equal(next.currentPlayer, PLAYERS.O);
  assert.equal(next.forcedBoard, 0);
  assert.deepEqual(getAvailableBoards(next), [0]);
});

test("move is rejected outside the forced board", () => {
  const state = applyMove(createInitialState(), 4, 0);

  assert.equal(canPlayMove(state, 1, 1), false);
  assert.equal(applyMove(state, 1, 1), state);
});

test("move is rejected when the cell is already occupied", () => {
  const state = createInitialState();
  state.boards[4].cells[0] = PLAYERS.O;

  assert.equal(canPlayMove(state, 4, 0), false);
  assert.equal(applyMove(state, 4, 0), state);
});

test("player can choose freely when the target board is already won", () => {
  const state = createInitialState();
  state.boards[0].winner = PLAYERS.X;

  const next = applyMove(state, 4, 0);

  assert.equal(next.forcedBoard, null);
  assert.deepEqual(getAvailableBoards(next), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("small board win is recorded", () => {
  const state = createInitialState();
  state.boards[4].cells = [PLAYERS.X, PLAYERS.X, null, null, null, null, null, null, null];

  const next = applyMove(state, 4, 2);

  assert.equal(next.boards[4].winner, PLAYERS.X);
  assert.deepEqual(next.boards[4].winningLine, [0, 1, 2]);
});

test("macro board win ends the game", () => {
  const state = createInitialState();
  state.boards[0].winner = PLAYERS.X;
  state.boards[1].winner = PLAYERS.X;
  state.boards[2].cells = [PLAYERS.X, PLAYERS.X, null, null, null, null, null, null, null];

  const next = applyMove(state, 2, 2);

  assert.equal(next.winner, PLAYERS.X);
  assert.deepEqual(next.winningLine, [0, 1, 2]);
  assert.equal(getAvailableBoards(next).length, 0);
});

test("macro board win works for O", () => {
  const state = createInitialState();
  state.currentPlayer = PLAYERS.O;
  state.boards[0].winner = PLAYERS.O;
  state.boards[4].winner = PLAYERS.O;
  state.boards[8].cells = [PLAYERS.O, PLAYERS.O, null, null, null, null, null, null, null];

  const next = applyMove(state, 8, 2);

  assert.equal(next.winner, PLAYERS.O);
  assert.deepEqual(next.winningLine, [0, 4, 8]);
  assert.equal(getAvailableBoards(next).length, 0);
});

test("game rejects moves after a macro win", () => {
  const state = createInitialState();
  state.boards[0].winner = PLAYERS.X;
  state.boards[1].winner = PLAYERS.X;
  state.boards[2].cells = [PLAYERS.X, PLAYERS.X, null, null, null, null, null, null, null];

  const won = applyMove(state, 2, 2);

  assert.equal(canPlayMove(won, 3, 0), false);
  assert.equal(applyMove(won, 3, 0), won);
});

test("macro draw ends the game when no playable small boards remain", () => {
  const state = createInitialState();
  const winners = [
    PLAYERS.X,
    PLAYERS.O,
    PLAYERS.X,
    PLAYERS.X,
    PLAYERS.O,
    PLAYERS.O,
    PLAYERS.O,
    PLAYERS.X,
    null,
  ];

  state.boards.forEach((board, index) => {
    board.winner = winners[index];
    board.full = Boolean(winners[index]);
  });
  state.boards[8].cells = [
    PLAYERS.X,
    PLAYERS.O,
    PLAYERS.X,
    PLAYERS.X,
    PLAYERS.O,
    PLAYERS.O,
    PLAYERS.O,
    PLAYERS.X,
    null,
  ];

  const next = applyMove(state, 8, 8);

  assert.equal(next.winner, null);
  assert.equal(next.draw, true);
  assert.equal(getAvailableBoards(next).length, 0);
});

test("initial state resets all board and turn data", () => {
  const state = createInitialState();

  assert.equal(state.currentPlayer, PLAYERS.X);
  assert.equal(state.forcedBoard, null);
  assert.equal(state.winner, null);
  assert.equal(state.draw, false);
  assert.equal(state.moveHistory.length, 0);
  assert.equal(state.boards.every((board) => board.cells.every((cell) => cell === null)), true);
});

test("two-player undo restores the previous board snapshot", () => {
  const initial = createInitialState();
  const snapshots = [createGameSnapshot(initial)];
  const afterMove = applyMove(initial, 4, 0);
  snapshots.push(createGameSnapshot(afterMove));

  const restored = restoreGameSnapshot(snapshots.at(-2));

  assert.equal(restored.boards[4].cells[0], null);
  assert.equal(restored.moveHistory.length, 0);
  assert.equal(restored.forcedBoard, null);
});

test("two-player undo restores the correct current player", () => {
  const initial = createInitialState();
  const afterMove = applyMove(initial, 4, 0);
  const restored = restoreGameSnapshot(createGameSnapshot(initial));

  assert.equal(getUndoMoveCount(afterMove, false), 1);
  assert.equal(restored.currentPlayer, PLAYERS.X);
});

test("computer-mode undo removes a player and AI round so the player can continue", () => {
  const initial = createInitialState();
  const snapshots = [createGameSnapshot(initial)];
  const afterPlayer = applyMove(initial, 4, 0);
  snapshots.push(createGameSnapshot(afterPlayer));
  const afterComputer = applyMove(afterPlayer, 0, 4);
  snapshots.push(createGameSnapshot(afterComputer));

  const undoCount = getUndoMoveCount(afterComputer, true);
  const restored = restoreGameSnapshot(snapshots[snapshots.length - 1 - undoCount]);

  assert.equal(undoCount, 2);
  assert.equal(restored.currentPlayer, PLAYERS.X);
  assert.equal(restored.moveHistory.length, 0);
  assert.equal(canPlayMove(restored, 4, 0), true);
});

test("undo preserves the Ultimate target-board rule", () => {
  const initial = createInitialState();
  const afterX = applyMove(initial, 4, 0);
  const afterO = applyMove(afterX, 0, 4);

  assert.equal(getUndoMoveCount(afterO, false), 1);

  const restored = restoreGameSnapshot(createGameSnapshot(afterX));

  assert.equal(restored.currentPlayer, PLAYERS.O);
  assert.equal(restored.forcedBoard, 0);
  assert.equal(canPlayMove(restored, 0, 1), true);
  assert.equal(canPlayMove(restored, 4, 1), false);
});

test("undo can restore an ended game to a non-ended snapshot", () => {
  const beforeWin = createInitialState();
  beforeWin.boards[0].winner = PLAYERS.X;
  beforeWin.boards[1].winner = PLAYERS.X;
  beforeWin.boards[2].cells = [PLAYERS.X, PLAYERS.X, null, null, null, null, null, null, null];
  const beforeSnapshot = createGameSnapshot(beforeWin, { lastScoredGame: null });

  const won = applyMove(beforeWin, 2, 2);
  const wonSnapshot = createGameSnapshot(won, { lastScoredGame: PLAYERS.X });
  const restored = restoreGameSnapshot(beforeSnapshot);

  assert.equal(wonSnapshot.state.winner, PLAYERS.X);
  assert.equal(restored.winner, null);
  assert.equal(restored.draw, false);
  assert.equal(canPlayMove(restored, 2, 2), true);
});

test("restart clears move history and leaves only the initial undo snapshot", () => {
  const played = applyMove(createInitialState(), 4, 0);
  assert.equal(played.moveHistory.length, 1);

  const restarted = createInitialState();
  const snapshots = [createGameSnapshot(restarted)];

  assert.equal(restarted.moveHistory.length, 0);
  assert.equal(snapshots.length, 1);
});

test("mode or difficulty reset clears move history and undo snapshots", () => {
  const played = applyMove(createInitialState(), 4, 0);
  assert.equal(played.moveHistory.length, 1);

  const resetState = createInitialState();
  const snapshots = [createGameSnapshot(resetState)];

  assert.equal(resetState.moveHistory.length, 0);
  assert.equal(getUndoMoveCount(resetState, true), 0);
  assert.equal(snapshots.length, 1);
});

test("stale scheduled AI move is ignored after undo changes the move count", () => {
  const afterPlayer = applyMove(createInitialState(), 4, 0);
  const scheduledMoveCount = afterPlayer.moveHistory.length;

  assert.equal(shouldIgnoreScheduledComputerMove(afterPlayer, scheduledMoveCount), false);

  const restored = restoreGameSnapshot(createGameSnapshot(createInitialState()));

  assert.equal(shouldIgnoreScheduledComputerMove(restored, scheduledMoveCount), true);
});

test("room code is six uppercase alphanumeric characters", () => {
  const code = generateRoomCode();

  assert.match(code, /^[A-Z0-9]{6}$/);
});

test("room code normalization removes whitespace and uppercases letters", () => {
  assert.equal(normalizeRoomCode(" ab 12 cd "), "AB12CD");
});

test("initial room state has X joined and O waiting", () => {
  const room = createInitialRoomState("ABC123");

  assert.equal(room.code, "ABC123");
  assert.equal(room.status, "waiting");
  assert.equal(room.version, 1);
  assert.equal(room.moveNumber, 0);
  assert.equal(room.players.X.joined, true);
  assert.equal(room.players.X.online, true);
  assert.equal(room.players.O.joined, false);
  assert.equal(room.players.O.online, false);
  assert.equal(room.gameState.currentPlayer, PLAYERS.X);
});

test("mock online adapter lets O join a created room", async () => {
  resetMockOnlineState();

  const created = await createRoom();
  const joined = await joinRoom(created.room.code);

  assert.equal(created.role, PLAYERS.X);
  assert.equal(joined.ok, true);
  assert.equal(joined.role, PLAYERS.O);
  assert.equal(joined.room.status, "playing");
  assert.equal(joined.room.players.O.joined, true);
  assert.equal(joined.room.players.O.online, true);
});

test("mock online adapter rejects stale room state updates", async () => {
  resetMockOnlineState();

  const created = await createRoom();
  const joined = await joinRoom(created.room.code);
  const nextState = applyMove(joined.room.gameState, 4, 0);
  const firstUpdate = await updateRoomState(joined.room.code, nextState, joined.room.version);
  const staleUpdate = await updateRoomState(joined.room.code, nextState, joined.room.version);

  assert.equal(firstUpdate.ok, true);
  assert.equal(staleUpdate.ok, false);
  assert.equal(staleUpdate.error, "Mock version conflict");
});

test("winner helper returns line details", () => {
  assert.deepEqual(
    getWinner([PLAYERS.O, null, null, PLAYERS.O, null, null, PLAYERS.O, null, null]),
    { winner: PLAYERS.O, line: [0, 3, 6] },
  );
});

test("computer move wins the macro board when possible", () => {
  const state = createInitialState();
  state.currentPlayer = PLAYERS.O;
  state.boards[0].winner = PLAYERS.O;
  state.boards[1].winner = PLAYERS.O;
  state.boards[2].cells = [PLAYERS.O, PLAYERS.O, null, null, null, null, null, null, null];

  assert.deepEqual(getComputerMove(state), { boardIndex: 2, cellIndex: 2 });
});

test("computer move blocks a human macro win", () => {
  const state = createInitialState();
  state.currentPlayer = PLAYERS.O;
  state.boards[0].winner = PLAYERS.X;
  state.boards[1].winner = PLAYERS.X;
  state.boards[2].cells = [PLAYERS.X, PLAYERS.X, null, null, null, null, null, null, null];

  assert.deepEqual(getComputerMove(state), { boardIndex: 2, cellIndex: 2 });
});

test("computer move prefers a legal center cell", () => {
  const state = applyMove(createInitialState(), 0, 4);

  assert.deepEqual(getComputerMove(state), { boardIndex: 4, cellIndex: 4 });
});

test("computer move always returns a legal move", () => {
  const state = applyMove(createInitialState(), 4, 0);
  const move = getComputerMove(state);

  assert.equal(
    getLegalMoves(state).some(
      (legalMove) =>
        legalMove.boardIndex === move.boardIndex && legalMove.cellIndex === move.cellIndex,
    ),
    true,
  );
});

test("computer takes a small-board win when it improves the ultimate position", () => {
  const state = createInitialState();
  state.currentPlayer = PLAYERS.O;
  state.forcedBoard = 4;
  state.boards[4].cells = [
    PLAYERS.O,
    PLAYERS.O,
    null,
    null,
    PLAYERS.X,
    null,
    null,
    null,
    PLAYERS.X,
  ];

  assert.deepEqual(getComputerMove(state), { boardIndex: 4, cellIndex: 2 });
});

test("computer avoids sending the player to a board with an immediate win", () => {
  const state = createInitialState();
  state.currentPlayer = PLAYERS.O;
  state.forcedBoard = 4;
  state.boards[0].cells = [
    PLAYERS.X,
    PLAYERS.X,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];
  state.boards[4].cells = [null, null, null, null, null, null, null, null, null];

  const move = getComputerMove(state);

  assert.equal(move.boardIndex, 4);
  assert.notEqual(move.cellIndex, 0);
});

test("hard computer move returns a legal ultimate move", () => {
  const state = applyMove(createInitialState(), 4, 0);
  const move = getHardComputerMove(state, PLAYERS.O, PLAYERS.X, {
    maxDepth: 2,
    timeLimitMs: 100,
  });

  assert.equal(
    getLegalMoves(state).some(
      (legalMove) =>
        legalMove.boardIndex === move.boardIndex && legalMove.cellIndex === move.cellIndex,
    ),
    true,
  );
});

test("hard computer move still takes an immediate macro win", () => {
  const state = createInitialState(PLAYERS.O);
  state.boards[0].winner = PLAYERS.O;
  state.boards[1].winner = PLAYERS.O;
  state.boards[2].cells = [PLAYERS.O, PLAYERS.O, null, null, null, null, null, null, null];

  assert.deepEqual(getComputerMove(state, PLAYERS.O, PLAYERS.X, AI_DIFFICULTIES.HARD), {
    boardIndex: 2,
    cellIndex: 2,
  });
});

test("alpha-beta evaluates terminal states and respects shallow depth", () => {
  const wonState = createInitialState();
  wonState.winner = PLAYERS.O;

  assert.equal(evaluateGameState(wonState), 100000);
  assert.equal(
    Number.isFinite(
      alphaBeta(createInitialState(PLAYERS.O), 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, true),
    ),
    true,
  );
});
