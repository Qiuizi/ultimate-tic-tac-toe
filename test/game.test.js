import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAYERS,
  AI_DIFFICULTIES,
  alphaBeta,
  applyMove,
  canPlayMove,
  createInitialState,
  evaluateGameState,
  getAvailableBoards,
  getComputerMove,
  getHardComputerMove,
  getLegalMoves,
  getWinner,
} from "../src/game.js";

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
